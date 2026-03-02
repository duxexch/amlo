import "dotenv/config";
import { validateEnv } from "./config";

// Validate environment BEFORE anything else
const env = validateEnv();

import express, { type Request, Response, NextFunction } from "express";
import session from "express-session";
import helmet from "helmet";
import cors from "cors";
import compression from "compression";
import rateLimit from "express-rate-limit";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { initRedis, createRedisSessionStore, getRedis, createRedisDuplicate } from "./redis";
import { logger, createLogger } from "./logger";

const serverLog = createLogger("server");

const app = express();
const httpServer = createServer(app);

// Trust proxy when behind Nginx/load balancer (needed for rate limiting + secure cookies)
if (process.env.NODE_ENV === "production") {
  app.set("trust proxy", 1);
}

// ── Socket.io (secured) ──
const socketOrigin = process.env.NODE_ENV === "production"
  ? process.env.CORS_ORIGIN || "https://aplo.app"
  : "*";

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: socketOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"],
  pingTimeout: 30000,
  pingInterval: 25000,
  maxHttpBufferSize: 1e6, // 1MB max message size
  connectionStateRecovery: {
    maxDisconnectionDuration: 10 * 60 * 1000, // 10 minutes recovery (mobile-friendly)
  },
  perMessageDeflate: {
    threshold: 1024, // compress messages > 1KB
  },
});

// Redis adapter is set up inside the main async startup below

// ── Socket.io authentication middleware ──
io.use((socket, next) => {
  const userId = socket.handshake.auth?.userId || socket.handshake.query?.userId;
  if (!userId || typeof userId !== "string" || userId.length > 100) {
    // Allow connection but without user context (will need to emit user-online)
    return next();
  }
  socket.data.userId = userId;
  next();
});

// ── Socket.io connection rate limiting ──
const socketConnectionCounts = new Map<string, { count: number; resetAt: number }>();
const SOCKET_MAX_CONNECTIONS_PER_IP = process.env.NODE_ENV === "production" ? 20 : 10000;  // High limit for dev/testing
const SOCKET_WINDOW_MS = 60_000; // 1 minute

io.use((socket, next) => {
  const ip = socket.handshake.address || "unknown";
  const now = Date.now();
  const record = socketConnectionCounts.get(ip);
  if (record) {
    if (now > record.resetAt) {
      socketConnectionCounts.set(ip, { count: 1, resetAt: now + SOCKET_WINDOW_MS });
    } else if (record.count >= SOCKET_MAX_CONNECTIONS_PER_IP) {
      return next(new Error("Too many connections from this IP"));
    } else {
      record.count++;
    }
  } else {
    socketConnectionCounts.set(ip, { count: 1, resetAt: now + SOCKET_WINDOW_MS });
  }
  // Cleanup old records periodically
  if (socketConnectionCounts.size > 500) {
    for (const [key, val] of socketConnectionCounts) {
      if (now > val.resetAt) socketConnectionCounts.delete(key);
    }
  }
  next();
});

// ── Periodic cleanup of socketConnectionCounts to prevent memory leak ──
setInterval(() => {
  const now = Date.now();
  for (const [key, val] of socketConnectionCounts) {
    if (now > val.resetAt) socketConnectionCounts.delete(key);
  }
}, 120_000).unref(); // Every 2 minutes

// Online users — Redis-backed (shared across nodes)
import { onlineUsersMap, startOnlineUsersCleanup, setUserOnline, getUserSocketId, getUserSocketIdSync, removeUserOnline } from "./onlineUsers";

// ── Viewer-count debounce (prevents 50K broadcasts per join in popular rooms) ──
const viewerCountDebounce = new Map<string, NodeJS.Timeout>();
function scheduleViewerCountBroadcast(roomId: string) {
  if (viewerCountDebounce.has(roomId)) return; // already scheduled
  viewerCountDebounce.set(roomId, setTimeout(async () => {
    viewerCountDebounce.delete(roomId);
    const count = io.sockets.adapter.rooms.get(`room:${roomId}`)?.size || 0;
    io.to(`room:${roomId}`).emit("viewer-count", count);
  }, 500)); // max 1 broadcast per 500ms per room
}

// ── Chat message throttle (prevents spam flooding) ──
const chatThrottle = new Map<string, number[]>();
const CHAT_MAX_MSGS = 20; // max messages
const CHAT_WINDOW_MS = 10_000; // per 10 seconds

function isChatRateLimited(userId: string): boolean {
  const now = Date.now();
  const times = chatThrottle.get(userId) || [];
  const recent = times.filter(t => now - t < CHAT_WINDOW_MS);
  if (recent.length >= CHAT_MAX_MSGS) return true;
  recent.push(now);
  chatThrottle.set(userId, recent);
  return false;
}

// Cleanup chat throttle periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, times] of chatThrottle) {
    const recent = times.filter(t => now - t < CHAT_WINDOW_MS);
    if (recent.length === 0) chatThrottle.delete(userId);
    else chatThrottle.set(userId, recent);
  }
}, 30_000).unref();

io.on("connection", (socket) => {

  // ── Validate incoming data helper ──
  function isStr(v: unknown, maxLen = 200): v is string {
    return typeof v === "string" && v.length > 0 && v.length <= maxLen;
  }

  // ── User goes online ──
  socket.on("user-online", async (userId: unknown) => {
    if (!isStr(userId, 100)) return;
    // Prevent spoofing: once a userId is set, it cannot be changed
    if (socket.data.userId && socket.data.userId !== userId) {
      log(`Socket ${socket.id} tried to change userId from ${socket.data.userId} to ${userId}`, "socket.io");
      return;
    }
    // Prevent hijacking: if another socket already owns this userId, reject
    const existing = getUserSocketIdSync(userId);
    if (existing && existing !== socket.id) {
      const existingSocket = io.sockets.sockets.get(existing);
      if (existingSocket?.connected) {
        log(`Socket ${socket.id} rejected: userId ${userId} already owned by ${existing}`, "socket.io");
        socket.emit("auth-error", { message: "هذا الحساب متصل من جهاز آخر" });
        return;
      }
    }
    await setUserOnline(userId, socket.id);
    socket.data.userId = userId;
    socket.join(`user:${userId}`);
  });

  // ── Rooms (live streams) ──
  socket.on("join-room", (roomId: unknown) => {
    if (!isStr(roomId, 100)) return;
    socket.join(`room:${roomId}`);
    // Debounced viewer-count: prevents flooding in popular rooms (50K viewers = 50K broadcasts)
    scheduleViewerCountBroadcast(roomId);
  });

  socket.on("leave-room", (roomId: unknown) => {
    if (!isStr(roomId, 100)) return;
    socket.leave(`room:${roomId}`);
    scheduleViewerCountBroadcast(roomId);
  });

  socket.on("chat-message", (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { roomId, message, user } = data as Record<string, unknown>;
    if (!isStr(roomId, 100) || !isStr(message, 5000)) return;
    // Verify socket actually joined this room
    if (!socket.rooms.has(`room:${roomId}`)) return;
    // ── Throttle: prevent spam flooding ──
    if (socket.data.userId && isChatRateLimited(socket.data.userId)) {
      socket.emit("error", { type: "rate_limited", message: "أنت ترسل بسرعة كبيرة. انتظر قليلاً" });
      return;
    }
    const chatMsg = {
      id: Date.now().toString() + Math.random().toString(36).slice(2, 6),
      roomId,
      message: message.slice(0, 5000),
      user: typeof user === "object" && user ? { id: (user as any).id, name: (user as any).name, avatar: (user as any).avatar } : null,
      timestamp: new Date().toISOString(),
    };
    io.to(`room:${roomId}`).emit("chat-message", chatMsg);
    // ── Persist last 200 messages per room in Redis ──
    persistRoomMessage(roomId, chatMsg);
  });

  socket.on("send-gift", (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { roomId, gift, sender } = data as Record<string, unknown>;
    if (!isStr(roomId, 100)) return;
    // Verify socket is in the room
    if (!socket.rooms.has(`room:${roomId}`)) return;
    // Only allow gift object with known fields
    const safeGift = typeof gift === "object" && gift ? { id: (gift as any).id, name: (gift as any).name, icon: (gift as any).icon, price: (gift as any).price } : null;
    const safeSender = typeof sender === "object" && sender ? { id: (sender as any).id, name: (sender as any).name, avatar: (sender as any).avatar } : null;
    io.to(`room:${roomId}`).emit("gift-received", { roomId, gift: safeGift, sender: safeSender });
  });

  // ── Private Chat (typing indicator) — sync local lookup, zero overhead ──
  socket.on("typing", (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { conversationId, receiverId } = data as Record<string, unknown>;
    if (!isStr(conversationId, 100) || !isStr(receiverId, 100)) return;
    const receiverSocketId = getUserSocketIdSync(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", {
        conversationId,
        userId: socket.data.userId,
      });
    }
  });

  socket.on("stop-typing", (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { conversationId, receiverId } = data as Record<string, unknown>;
    if (!isStr(conversationId, 100) || !isStr(receiverId, 100)) return;
    const receiverSocketId = getUserSocketIdSync(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stop-typing", {
        conversationId,
        userId: socket.data.userId,
      });
    }
  });

  // ── Private Chat (read receipt) ──
  socket.on("messages-read", (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { conversationId, receiverId } = data as Record<string, unknown>;
    if (!isStr(conversationId, 100) || !isStr(receiverId, 100)) return;
    const receiverSocketId = getUserSocketIdSync(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messages-read", {
        conversationId,
        readerId: socket.data.userId,
      });
    }
  });

  // ── Calls (WebRTC signaling) — sync lookup ──
  socket.on("call-signal", (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { callId, targetId, signal } = data as Record<string, unknown>;
    if (!isStr(callId, 100) || !isStr(targetId, 100)) return;
    const targetSocketId = getUserSocketIdSync(targetId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-signal", {
        callId,
        senderId: socket.data.userId,
        signal,
      });
    }
  });

  // ── World (حول العالم) ──
  socket.on("world-typing", (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { sessionId, receiverId } = data as Record<string, unknown>;
    if (!isStr(sessionId, 100) || !isStr(receiverId, 100)) return;
    const receiverSocketId = getUserSocketIdSync(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("world-chat-typing", {
        sessionId,
        userId: socket.data.userId,
      });
    }
  });

  socket.on("world-stop-typing", (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { sessionId, receiverId } = data as Record<string, unknown>;
    if (!isStr(sessionId, 100) || !isStr(receiverId, 100)) return;
    const receiverSocketId = getUserSocketIdSync(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("world-chat-stop-typing", {
        sessionId,
        userId: socket.data.userId,
      });
    }
  });

  // ── Disconnect ──
  socket.on("disconnect", async () => {
    const userId = socket.data.userId;
    if (userId) {
      await removeUserOnline(userId);
    }
    // Also update viewer-count for all rooms this socket was in
    for (const room of socket.rooms) {
      if (room.startsWith("room:")) {
        const roomId = room.slice(5);
        scheduleViewerCountBroadcast(roomId);
      }
    }
  });
});

// Start zombie cleanup for online users
startOnlineUsersCleanup(io);

// ── Persist room messages in Redis (last 200 per room, 24h TTL) ──
// Uses pipeline (single round-trip) and fire-and-forget to avoid event loop congestion.
function persistRoomMessage(roomId: string, msg: object) {
  try {
    const redis = getRedis();
    if (!redis) return;
    const key = `aplo:room:${roomId}:messages`;
    redis.pipeline()
      .lpush(key, JSON.stringify(msg))
      .ltrim(key, 0, 199)
      .expire(key, 86400)
      .exec()
      .catch(() => {}); // fire-and-forget, non-critical
  } catch { /* non-critical */ }
}

// Re-export for backward compatibility
export { onlineUsersMap } from "./onlineUsers";

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

// ── Security middleware ──
app.use(helmet({
  contentSecurityPolicy: process.env.NODE_ENV === "production" ? {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:", "blob:", "https:"],
      connectSrc: ["'self'", "wss:", "ws:", process.env.CORS_ORIGIN || "https://aplo.app"],
      mediaSrc: ["'self'", "blob:"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      upgradeInsecureRequests: [],
    },
  } : false,
  crossOriginEmbedderPolicy: false,
  referrerPolicy: { policy: "strict-origin-when-cross-origin" },
  hsts: process.env.NODE_ENV === "production" ? {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  } : false,
}));

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.CORS_ORIGIN || "https://aplo.app"
    : true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

app.use(compression());

// ── Global rate limiting (per IP) ──
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 500, // 500 requests per 15 min per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "تم تجاوز الحد الأقصى للطلبات. حاول لاحقاً" },
  skip: (req) => !req.path.startsWith("/api"), // only rate limit API
});
app.use(globalLimiter);

// ── Strict rate limiting on auth endpoints ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // 10 login attempts per 15 min
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "تم تجاوز عدد المحاولات. حاول بعد 15 دقيقة" },
});
app.use("/api/admin/auth", authLimiter);
app.use("/api/agent/auth", authLimiter);
app.use("/api/social/auth", authLimiter);

// ── Write-operation rate limiting ──
const writeLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 writes per minute
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "طلبات كثيرة جداً. حاول بعد دقيقة" },
  skip: (req) => req.method === "GET",
});
app.use("/api/social", writeLimiter);

app.use(
  express.json({
    limit: "10mb",
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

// ── Additional security headers ──
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0"); // modern browsers handle this
  res.setHeader("Permissions-Policy", "camera=self, microphone=self, geolocation=()");
  next();
});

// ── Session middleware (Redis-backed) ──
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET env var is required in production");
}
if (!SESSION_SECRET) {
  console.warn("⚠️  WARNING: Using dev-only SESSION_SECRET — set SESSION_SECRET in .env for production");
}
const sessionStore = createRedisSessionStore(session);
app.use(
  session({
    secret: SESSION_SECRET || "dev-only-session-secret-not-for-production",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      sameSite: "lax",
    },
  }),
);

export function log(message: string, source = "express") {
  createLogger(source).info(message);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  // ── Initialize Redis (test connectivity before using it) ──
  await initRedis();

  // ── Attach Redis Adapter for horizontal scaling ──
  try {
    const redis = getRedis();
    if (redis) {
      const pubClient = createRedisDuplicate("pub");
      const subClient = createRedisDuplicate("sub");
      if (pubClient && subClient) {
        io.adapter(createAdapter(pubClient, subClient));
        console.log("[socket.io] Redis adapter attached — horizontal scaling enabled");
      } else {
        console.log("[socket.io] Redis duplicate failed — using in-memory adapter");
      }
    } else {
      console.log("[socket.io] No Redis — using in-memory adapter (single node only)");
    }
  } catch (err) {
    console.error("[socket.io] Redis adapter setup failed, using in-memory:", err);
  }

  // ── Health check endpoint (before route registration) ──
  app.get("/api/health", async (_req, res) => {
    const { isDatabaseConnected } = await import("./db");
    const { getRedis } = await import("./redis");
    const dbOk = await isDatabaseConnected();
    let redisOk = false;
    try {
      const redis = getRedis();
      if (redis) { await redis.ping(); redisOk = true; }
    } catch { /* redis down */ }

    const healthy = dbOk && redisOk;
    res.status(healthy ? 200 : 503).json({
      status: healthy ? "healthy" : "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: { database: dbOk ? "up" : "down", redis: redisOk ? "up" : "down" },
    });
  });

  // ── Prometheus-compatible metrics endpoint ──
  app.get("/api/metrics", async (_req, res) => {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const { getPool } = await import("./db");
    const pool = getPool();
    const { getOnlineUsersCount } = await import("./onlineUsers");
    const onlineCount = await getOnlineUsersCount();

    const lines = [
      `# HELP aplo_uptime_seconds Server uptime in seconds`,
      `# TYPE aplo_uptime_seconds gauge`,
      `aplo_uptime_seconds ${Math.floor(process.uptime())}`,
      `# HELP aplo_memory_rss_bytes RSS memory usage`,
      `# TYPE aplo_memory_rss_bytes gauge`,
      `aplo_memory_rss_bytes ${mem.rss}`,
      `# HELP aplo_memory_heap_used_bytes Heap memory used`,
      `# TYPE aplo_memory_heap_used_bytes gauge`,
      `aplo_memory_heap_used_bytes ${mem.heapUsed}`,
      `# HELP aplo_memory_heap_total_bytes Total heap size`,
      `# TYPE aplo_memory_heap_total_bytes gauge`,
      `aplo_memory_heap_total_bytes ${mem.heapTotal}`,
      `# HELP aplo_memory_external_bytes External memory`,
      `# TYPE aplo_memory_external_bytes gauge`,
      `aplo_memory_external_bytes ${mem.external}`,
      `# HELP aplo_cpu_user_microseconds CPU user time`,
      `# TYPE aplo_cpu_user_microseconds counter`,
      `aplo_cpu_user_microseconds ${cpu.user}`,
      `# HELP aplo_cpu_system_microseconds CPU system time`,
      `# TYPE aplo_cpu_system_microseconds counter`,
      `aplo_cpu_system_microseconds ${cpu.system}`,
      `# HELP aplo_online_users Online user count`,
      `# TYPE aplo_online_users gauge`,
      `aplo_online_users ${onlineCount}`,
      `# HELP aplo_socket_connections Active socket connections`,
      `# TYPE aplo_socket_connections gauge`,
      `aplo_socket_connections ${io.engine.clientsCount}`,
    ];

    // DB pool metrics
    if (pool) {
      lines.push(
        `# HELP aplo_db_pool_total Total DB pool connections`,
        `# TYPE aplo_db_pool_total gauge`,
        `aplo_db_pool_total ${pool.totalCount}`,
        `# HELP aplo_db_pool_idle Idle DB pool connections`,
        `# TYPE aplo_db_pool_idle gauge`,
        `aplo_db_pool_idle ${pool.idleCount}`,
        `# HELP aplo_db_pool_waiting Waiting DB pool requests`,
        `# TYPE aplo_db_pool_waiting gauge`,
        `aplo_db_pool_waiting ${pool.waitingCount}`,
      );
    }

    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(lines.join("\n") + "\n");
  });

  // Apply DB-level constraints on startup (idempotent)
  const { applyDatabaseConstraints } = await import("./db");
  await applyDatabaseConstraints();

  // Hash mock agent account passwords at startup
  const { initMockAccountHashes } = await import("./routes/admin");
  await initMockAccountHashes();

  await registerRoutes(httpServer, app);

  app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    // Log with stack trace
    serverLog.error({ status, err }, message);

    if (res.headersSent) {
      return next(err);
    }

    // Don't leak error details in production
    const clientMessage = process.env.NODE_ENV === "production" && status === 500
      ? "خطأ في الخادم"
      : message;

    return res.status(status).json({ success: false, message: clientMessage });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  const port = parseInt(process.env.PORT || "3000", 10);
  httpServer.listen(
    {
      port,
      host: "0.0.0.0",
    },
    () => {
      log(`serving on port ${port}`);
    },
  );

  // ── Graceful shutdown ──
  const shutdown = async (signal: string) => {
    log(`Received ${signal}. Starting graceful shutdown...`, "system");

    // 1. Stop accepting new connections
    httpServer.close(() => {
      log("HTTP server closed", "system");
    });

    // 2. Close Socket.io connections
    io.close(() => {
      log("Socket.io server closed", "system");
    });

    // 3. Close database pool
    try {
      const { getPool } = await import("./db");
      const p = getPool();
      if (p) await p.end();
      log("Database pool closed", "system");
    } catch { /* already closed */ }

    // 4. Close Redis
    try {
      const redis = getRedis();
      if (redis) await redis.quit();
      log("Redis connection closed", "system");
    } catch { /* already closed */ }

    // 5. Force exit after 10s if something hangs
    setTimeout(() => {
      log("Force exit after timeout", "system");
      process.exit(1);
    }, 10_000).unref();

    process.exit(0);
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

  // ── Unhandled rejection / uncaught exception safety nets ──
  process.on("unhandledRejection", (reason) => {
    serverLog.fatal({ reason: String(reason) }, "Unhandled Rejection");
  });

  process.on("uncaughtException", (err) => {
    serverLog.fatal({ err }, "Uncaught Exception");
    // Exit — process is in undefined state
    process.exit(1);
  });
})();
