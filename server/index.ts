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
import { applyCdnConfig } from "./cdn";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import { createAdapter } from "@socket.io/redis-adapter";
import { initRedis, createRedisSessionStore, getRedis, createRedisDuplicate } from "./redis";
import { isDatabaseConnected, getPool } from "./db";
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
  ? process.env.CORS_ORIGIN || "https://mrco.live"
  : "*";

export const io = new SocketIOServer(httpServer, {
  cors: {
    origin: socketOrigin,
    methods: ["GET", "POST"],
    credentials: true,
  },
  // ── Transport: prefer websocket, fall back to polling for restricted networks ──
  transports: ["websocket", "polling"],
  // ── Adaptive heartbeat: balanced for scale ──
  pingTimeout: 30000,       // 30s — faster disconnect detection
  pingInterval: 25000,      // 25s — lighter than 30s
  // ── Buffer limits: prevent abuse while allowing normal messages ──
  maxHttpBufferSize: 128_000, // 128KB — chat messages are small
  // ── Connection recovery: mobile users lose signal frequently ──
  connectionStateRecovery: {
    maxDisconnectionDuration: 10 * 60 * 1000, // 10 min recovery window (was 15)
    skipMiddlewares: true,
  },
  // ── Compression: level 4 = fast, CPU-efficient ──
  perMessageDeflate: {
    threshold: 512,         // compress messages > 512 bytes
    zlibDeflateOptions: {
      chunkSize: 8 * 1024,  // 8KB chunks — less overhead
      level: 4,             // level 4 = fast compression
    },
    clientNoContextTakeover: true,
    serverNoContextTakeover: true,
  },
  // ── HTTP compression for polling transport fallback ──
  httpCompression: {
    threshold: 512,
  },
  // ── Upgrade timeout ──
  upgradeTimeout: 15000, // 15s (was 30s — faster cleanup)
  // ── Allow EIO3 for older clients ──
  allowEIO3: true,
});

// Redis adapter is set up inside the main async startup below

// ── Socket.io authentication middleware (session-based) ──
// Instead of trusting client-provided userId, we verify the session cookie
// This prevents any client from impersonating another user
io.use((socket, next) => {
  // Parse session cookie from the handshake headers
  const cookieHeader = socket.handshake.headers.cookie;
  if (!cookieHeader) {
    // Allow connection without user context (public/guest)
    return next();
  }

  // Create a minimal req/res pair to run express-session parsing
  // The sessionMiddleware is set up later, so we do manual cookie parsing here.
  // Extract the ablox.sid cookie value (user session)
  const sidMatch = cookieHeader.match(/ablox\.sid=s%3A([^.]+)\./);
  if (!sidMatch) {
    // Fallback: try legacy connect.sid cookie (for existing sessions during migration)
    const legacyMatch = cookieHeader.match(/connect\.sid=s%3A([^.]+)\./);
    if (!legacyMatch) return next();
    const legacyId = legacyMatch[1];
    if (!legacyId) return next();
    // Use legacy session ID
    const redis = getRedis();
    if (redis) {
      const sessionKey = `ablox:sess:${legacyId}`;
      redis.get(sessionKey).then((data) => {
        if (data) {
          try {
            const sess = JSON.parse(data);
            if (sess.userId && typeof sess.userId === "string") {
              socket.data.userId = sess.userId;
              socket.data.sessionVerified = true;
            }
          } catch { /* Invalid session data */ }
        }
        next();
      }).catch(() => next());
    } else {
      next();
    }
    return;
  }

  const sessionId = sidMatch[1];
  if (!sessionId) return next();

  // Look up session in Redis store
  const redis = getRedis();
  if (redis) {
    const sessionKey = `ablox:sess:${sessionId}`;
    redis.get(sessionKey).then((data) => {
      if (data) {
        try {
          const sess = JSON.parse(data);
          if (sess.userId && typeof sess.userId === "string") {
            socket.data.userId = sess.userId;
            socket.data.sessionVerified = true;
          }
        } catch {
          // Invalid session data — continue as guest
        }
      }
      next();
    }).catch(() => {
      // Redis error — allow connection as guest
      next();
    });
  } else {
    // No Redis — fall back to trusting handshake auth (dev only)
    const userId = socket.handshake.auth?.userId;
    if (userId && typeof userId === "string" && userId.length <= 100) {
      socket.data.userId = userId;
    }
    next();
  }
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
import { onlineUsersMap, startOnlineUsersCleanup, setUserOnline, getUserSocketId, getUserSocketIdSync, removeUserOnline, getOnlineUsersCount } from "./onlineUsers";

// Matching engine — random chat queue
import { joinQueue, leaveQueue, findMatch, endRandomCall, startMatchingLoop, startQueueCleanup, type MatchFilters } from "./matchingEngine";

// ── Viewer-count debounce (prevents 50K broadcasts per join in popular rooms) ──
const viewerCountDebounce = new Map<string, NodeJS.Timeout>();
function scheduleViewerCountBroadcast(roomId: string) {
  if (viewerCountDebounce.has(roomId)) return; // already scheduled
  viewerCountDebounce.set(roomId, setTimeout(async () => {
    viewerCountDebounce.delete(roomId);
    const count = io.sockets.adapter.rooms.get(`room:${roomId}`)?.size || 0;
    io.to(`room:${roomId}`).emit("viewer-count", count);
  }, 1000)); // max 1 broadcast per second per room (was 500ms)
}

// ── Chat message throttle (O(1) sliding window counter) ──
const chatThrottle = new Map<string, { count: number; windowStart: number }>();
const CHAT_MAX_MSGS = 20; // max messages
const CHAT_WINDOW_MS = 10_000; // per 10 seconds

// ── Typing indicator throttle (prevents excessive typing events) ──
const typingThrottle = new Map<string, number>(); // userId -> last emit timestamp
const TYPING_THROTTLE_MS = 3000; // max 1 typing event per 3 seconds per user

function isChatRateLimited(userId: string): boolean {
  const now = Date.now();
  const entry = chatThrottle.get(userId);
  if (!entry || now - entry.windowStart > CHAT_WINDOW_MS) {
    chatThrottle.set(userId, { count: 1, windowStart: now });
    return false;
  }
  if (entry.count >= CHAT_MAX_MSGS) return true;
  entry.count++;
  return false;
}

// Cleanup chat throttle + typing throttle periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, entry] of chatThrottle) {
    if (now - entry.windowStart > CHAT_WINDOW_MS) chatThrottle.delete(userId);
  }
  // Step 17: Clean up typing throttle to prevent memory leaks
  for (const [uid, ts] of typingThrottle) {
    if (now - ts > TYPING_THROTTLE_MS * 2) typingThrottle.delete(uid);
  }
  // Step 29: Memory leak protection — cap Map sizes
  if (chatThrottle.size > 50_000) chatThrottle.clear();
  if (typingThrottle.size > 50_000) typingThrottle.clear();
  if (viewerCountDebounce.size > 10_000) viewerCountDebounce.clear();
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
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      roomId,
      message: message.slice(0, 2000),
      // Use server-verified userId instead of client-supplied user object
      user: socket.data.userId
        ? { id: socket.data.userId, name: typeof user === "object" && user ? ((user as any).name || "مستخدم") : "مستخدم" }
        : (typeof user === "object" && user ? { id: (user as any).id, name: (user as any).name } : null),
      ts: Date.now(),
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

  // ── Speaker Invitation (Audio Rooms) ──
  socket.on("invite-speaker", async (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { roomId, targetUserId, hostName } = data as Record<string, unknown>;
    if (!isStr(roomId, 100) || !isStr(targetUserId, 100)) return;
    // Only host (room creator) can invite — verify socket is in room
    if (!socket.rooms.has(`room:${roomId}`)) return;
    const targetSocketId = await getUserSocketId(targetUserId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("speaker-invite", {
        roomId,
        hostId: socket.data.userId,
        hostName: typeof hostName === "string" ? hostName : "المضيف",
      });
    }
  });

  socket.on("accept-speaker-invite", (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { roomId, userName } = data as Record<string, unknown>;
    if (!isStr(roomId, 100)) return;
    // Broadcast to the room that a new speaker joined
    io.to(`room:${roomId}`).emit("speaker-joined", {
      roomId,
      userId: socket.data.userId,
      userName: typeof userName === "string" ? userName : "مستخدم",
    });
  });

  socket.on("decline-speaker-invite", async (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { roomId, hostId } = data as Record<string, unknown>;
    if (!isStr(roomId, 100) || !isStr(hostId, 100)) return;
    const hostSocketId = await getUserSocketId(hostId);
    if (hostSocketId) {
      io.to(hostSocketId).emit("speaker-declined", {
        roomId,
        userId: socket.data.userId,
      });
    }
  });

  socket.on("remove-speaker", (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { roomId, targetUserId } = data as Record<string, unknown>;
    if (!isStr(roomId, 100) || !isStr(targetUserId, 100)) return;
    if (!socket.rooms.has(`room:${roomId}`)) return;
    io.to(`room:${roomId}`).emit("speaker-removed", {
      roomId,
      userId: targetUserId,
    });
  });

  // ── Private Chat (typing indicator) — throttled to save bandwidth ──
  socket.on("typing", async (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { conversationId, receiverId } = data as Record<string, unknown>;
    if (!isStr(conversationId, 100) || !isStr(receiverId, 100)) return;
    // Server-side throttle: max 1 typing event per 3s per user
    const uid = socket.data.userId || socket.id;
    const lastTyping = typingThrottle.get(uid) || 0;
    if (Date.now() - lastTyping < TYPING_THROTTLE_MS) return; // drop excessive events
    typingThrottle.set(uid, Date.now());
    const receiverSocketId = await getUserSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("typing", {
        conversationId,
        userId: socket.data.userId,
      });
    }
  });

  socket.on("stop-typing", async (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { conversationId, receiverId } = data as Record<string, unknown>;
    if (!isStr(conversationId, 100) || !isStr(receiverId, 100)) return;
    const receiverSocketId = await getUserSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("stop-typing", {
        conversationId,
        userId: socket.data.userId,
      });
    }
  });

  // ── Private Chat (read receipt) ──
  socket.on("messages-read", async (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { conversationId, receiverId } = data as Record<string, unknown>;
    if (!isStr(conversationId, 100) || !isStr(receiverId, 100)) return;
    const receiverSocketId = await getUserSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("messages-read", {
        conversationId,
        readerId: socket.data.userId,
      });
    }
  });

  // ── Calls (WebRTC signaling) — sync lookup ──
  socket.on("call-signal", async (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { callId, targetId, signal } = data as Record<string, unknown>;
    if (!isStr(callId, 100) || !isStr(targetId, 100)) return;
    const targetSocketId = await getUserSocketId(targetId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("call-signal", {
        callId,
        senderId: socket.data.userId,
        signal,
      });
    }
  });

  // ── Random Chat Matching ──
  socket.on("random-match-start", async (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const userId = socket.data.userId;
    if (!userId) {
      socket.emit("random-match-error", { message: "يرجى تسجيل الدخول" });
      return;
    }
    const { type, genderFilter, ageMin, ageMax, countryFilter } = data as Record<string, unknown>;
    if (!isStr(type as string, 10)) return;
    const filters: MatchFilters = {
      type: (["video", "audio", "text"].includes(type as string) ? type : "video") as "video" | "audio" | "text",
      genderFilter: (["both", "male", "female"].includes(genderFilter as string) ? genderFilter : "both") as "both" | "male" | "female",
      ageMin: typeof ageMin === "number" ? Math.max(18, Math.min(100, ageMin)) : 18,
      ageMax: typeof ageMax === "number" ? Math.max(18, Math.min(100, ageMax)) : 60,
      countryFilter: isStr(countryFilter as string, 10) ? (countryFilter as string) : undefined,
    };
    const { queued, cost } = await joinQueue(userId, socket.id, filters);
    if (!queued) {
      socket.emit("random-match-error", { message: "رصيد غير كافي", required: cost });
      return;
    }
    socket.emit("random-queue-joined", { cost });
    // Try to find a match immediately
    const result = await findMatch(userId);
    // If match found, events are emitted by findMatch()
    // If not found, user stays in queue and matching loop will retry
  });

  socket.on("random-match-cancel", async () => {
    const userId = socket.data.userId;
    if (!userId) return;
    await leaveQueue(userId);
    socket.emit("random-queue-left");
  });

  socket.on("random-match-next", async (data: unknown) => {
    const userId = socket.data.userId;
    if (!userId) return;
    // End current call
    await endRandomCall(userId);
    // Re-join queue with same filters
    if (data && typeof data === "object") {
      const { type, genderFilter, ageMin, ageMax, countryFilter } = data as Record<string, unknown>;
      const filters: MatchFilters = {
        type: (type === "video" ? "video" : "audio") as "video" | "audio",
        genderFilter: (["both", "male", "female"].includes(genderFilter as string) ? genderFilter : "both") as "both" | "male" | "female",
        ageMin: typeof ageMin === "number" ? ageMin : 18,
        ageMax: typeof ageMax === "number" ? ageMax : 60,
        countryFilter: isStr(countryFilter as string, 10) ? (countryFilter as string) : undefined,
      };
      const { queued, cost } = await joinQueue(userId, socket.id, filters);
      if (queued) {
        socket.emit("random-queue-joined", { cost });
        await findMatch(userId);
      } else {
        socket.emit("random-match-error", { message: "رصيد غير كافي", required: cost });
      }
    }
  });

  socket.on("random-match-end", async () => {
    const userId = socket.data.userId;
    if (!userId) return;
    await endRandomCall(userId);
  });

  // ── World (حول العالم) ──

  // Join world session room (for real-time messaging)
  socket.on("world-join-session", (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { sessionId } = data as Record<string, unknown>;
    if (!isStr(sessionId, 100)) return;
    socket.join(`world:${sessionId}`);
  });

  socket.on("world-leave-session", (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { sessionId } = data as Record<string, unknown>;
    if (!isStr(sessionId, 100)) return;
    socket.leave(`world:${sessionId}`);
  });

  // Real-time world chat message — persist to DB and broadcast
  socket.on("world-chat-send", async (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { sessionId, content, type } = data as Record<string, unknown>;
    if (!isStr(sessionId, 100) || !isStr(content as string, 5000)) return;
    const userId = socket.data.userId;
    if (!userId) return;
    // Rate limiting
    if (isChatRateLimited(userId)) {
      socket.emit("world-error", { type: "rate_limited", message: "أنت ترسل بسرعة كبيرة" });
      return;
    }
    try {
      // Persist to DB using pool directly
      const pool = getPool();
      if (pool) {
        const msgType = isStr(type as string, 20) ? type : "text";
        const msgContent = (content as string).slice(0, 2000);
        const result = await pool.query(
          `INSERT INTO world_messages (session_id, sender_id, content, type) VALUES ($1, $2, $3, $4) RETURNING id, session_id as "sessionId", sender_id as "senderId", content, type, created_at as "createdAt"`,
          [sessionId, userId, msgContent, msgType]
        );
        const msg = result.rows[0];
        // Broadcast to both users in the session room
        io.to(`world:${sessionId}`).emit("world-chat-message", { sessionId, message: msg });
      }
    } catch (err) {
      socket.emit("world-error", { type: "send_failed", message: "فشل إرسال الرسالة" });
    }
  });

  socket.on("world-typing", async (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { sessionId, receiverId } = data as Record<string, unknown>;
    if (!isStr(sessionId, 100) || !isStr(receiverId, 100)) return;
    const uid = socket.data.userId || socket.id;
    const lastTyping = typingThrottle.get(`world:${uid}`) || 0;
    if (Date.now() - lastTyping < TYPING_THROTTLE_MS) return;
    typingThrottle.set(`world:${uid}`, Date.now());
    const receiverSocketId = await getUserSocketId(receiverId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("world-chat-typing", {
        sessionId,
        userId: socket.data.userId,
      });
    }
  });

  socket.on("world-stop-typing", async (data: unknown) => {
    if (!data || typeof data !== "object") return;
    const { sessionId, receiverId } = data as Record<string, unknown>;
    if (!isStr(sessionId, 100) || !isStr(receiverId, 100)) return;
    const receiverSocketId = await getUserSocketId(receiverId);
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
      await leaveQueue(userId);
      await endRandomCall(userId);
      await removeUserOnline(userId);

      // ── World session disconnect notification ──
      // Notify any world session partner that this user disconnected
      for (const room of socket.rooms) {
        if (room.startsWith("world:")) {
          const sessionId = room.slice(6);
          io.to(room).emit("world-partner-disconnected", { sessionId, userId });
        }
      }
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

// Start matching engine loop + queue cleanup
startMatchingLoop();
startQueueCleanup();

// Step 23: Periodic room cleanup — clear debounce timers for rooms that no longer exist
setInterval(() => {
  for (const [roomId, timeout] of viewerCountDebounce) {
    const roomKey = `room:${roomId}`;
    if (!io.sockets.adapter.rooms.has(roomKey)) {
      clearTimeout(timeout);
      viewerCountDebounce.delete(roomId);
    }
  }
}, 60_000).unref(); // Every minute

// ── Persist room messages in Redis (last 200 per room, 24h TTL) ──
// Uses pipeline (single round-trip) and fire-and-forget to avoid event loop congestion.
function persistRoomMessage(roomId: string, msg: object) {
  try {
    const redis = getRedis();
    if (!redis) return;
    const key = `ablox:room:${roomId}:messages`;
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

// ── Ultra-fast response cache (BEFORE all middleware) ──
// Caches full JSON responses in memory. Cache HIT bypasses Helmet, CORS,
// compression, rate limiters, session — everything. ~2-3x faster than Redis path.
const _responseCache = new Map<string, { body: string; ts: number }>();

const FAST_CACHE_PATHS: Record<string, number> = {
  "/api/featured-streams": 30_000,       // 30s
  "/api/announcement-popup": 60_000,     // 60s
  "/api/app-download": 120_000,          // 2min (rarely changes)
  "/api/social/gifts": 60_000,           // 60s
  "/api/social/streams/active": 15_000,  // 15s
  "/api/widgets/status": 60_000,         // 60s
};

/** Invalidate a cached response (call after admin updates) */
export function invalidateResponseCache(path?: string) {
  if (path) _responseCache.delete(path);
  else _responseCache.clear();
}

app.use((req, res, next) => {
  if (req.method !== "GET") return next();
  const ttl = FAST_CACHE_PATHS[req.path];
  if (!ttl) return next();

  const now = Date.now();
  const cached = _responseCache.get(req.path);
  if (cached && now - cached.ts < ttl) {
    // Serve from memory — bypasses ALL middleware below
    // IMPORTANT: Include all security headers since Helmet is bypassed
    res.writeHead(200, {
      "Content-Type": "application/json; charset=utf-8",
      "Access-Control-Allow-Origin": req.headers.origin || "*",
      "Access-Control-Allow-Credentials": "true",
      "X-Cache": "HIT",
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "X-XSS-Protection": "0",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Permissions-Policy": "camera=self, microphone=self, geolocation=()",
      ...(process.env.NODE_ENV === "production" ? {
        "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",
        "Content-Security-Policy": "default-src 'self'",
      } : {}),
    });
    return res.end(cached.body);
  }

  // Cache MISS — intercept res.json() to capture and cache the response
  const origJson = res.json.bind(res);
  (res as any).json = (body: any) => {
    try {
      _responseCache.set(req.path, { body: JSON.stringify(body), ts: Date.now() });
    } catch { /* don't break response if caching fails */ }
    res.setHeader("X-Cache", "MISS");
    return origJson(body);
  };

  next();
});

// ── SEO: X-Robots-Tag, Sitemap, Security.txt, Apple AASA, Widget API ──
import { registerSeoRoutes } from "./seo";
registerSeoRoutes(app);

// ── Security middleware (Step 20: lighter in dev — skip CSP/HSTS) ──
if (process.env.NODE_ENV !== "production") {
  // In dev, use minimal Helmet (just basic headers, no CSP overhead)
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: false,
  }));
} else {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "https://fonts.googleapis.com"],
        fontSrc: ["'self'", "https://fonts.gstatic.com"],
        imgSrc: ["'self'", "data:", "blob:", "https:"],
        connectSrc: ["'self'", "wss:", "ws:", process.env.CORS_ORIGIN || "https://mrco.live"],
        mediaSrc: ["'self'", "blob:"],
        objectSrc: ["'none'"],
        frameAncestors: ["'none'"],
        baseUri: ["'self'"],
        formAction: ["'self'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
    referrerPolicy: { policy: "strict-origin-when-cross-origin" },
    hsts: {
      maxAge: 31536000,
      includeSubDomains: true,
      preload: true,
    },
  }));
}

app.use(cors({
  origin: process.env.NODE_ENV === "production"
    ? process.env.CORS_ORIGIN || "https://mrco.live"
    : true,
  credentials: true,
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization"],
  maxAge: 86400,
}));

app.use(compression({
  threshold: 1024,  // only compress responses > 1KB
  level: 4,         // level 4 = fast compression, low CPU
  filter: (req, res) => {
    // Don't compress if client doesn't want it
    if (req.headers['x-no-compression']) return false;
    // Skip compression for small responses and images
    const type = res.getHeader('Content-Type') as string || '';
    if (type.startsWith('image/')) return false;
    return compression.filter(req, res);
  },
}));

// ── Global rate limiting (per IP) ──
const isDev = process.env.NODE_ENV !== "production";
const globalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: isDev ? 10_000_000 : 500, // 10M in dev for load testing (was 100K — caused 234K non-2xx responses)
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: "تم تجاوز الحد الأقصى للطلبات. حاول لاحقاً" },
  skip: (req) => {
    const p = req.path;
    // Skip rate limiting for non-API, health, metrics, and all public GET endpoints
    if (!p.startsWith("/api") || p === "/api/health" || p === "/api/metrics") return true;
    // Skip public read-only endpoints (GET) — they have their own caching
    if (req.method === "GET" && (
      p === "/api/featured-streams" ||
      p === "/api/announcement-popup" ||
      p === "/api/app-download" ||
      p === "/api/social/gifts" ||
      p === "/api/social/streams/active"
    )) return true;
    return false;
  },
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

// ── Stripe webhook: raw body parser MUST come BEFORE express.json() ──
// Stripe signature verification requires the raw request body (Buffer),
// not the parsed JSON object. This middleware captures it for the webhook route.
app.use("/api/v1/payments/webhook", express.raw({ type: "application/json" }));
app.use("/api/payments/webhook", express.raw({ type: "application/json" }));

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use(express.urlencoded({ extended: false }));

// ── Additional security headers + Step 27: Request ID ──
let reqIdCounter = 0;
app.use((_req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "0"); // modern browsers handle this
  res.setHeader("Permissions-Policy", "camera=self, microphone=self, geolocation=()");
  // Fast monotonic request ID (no crypto overhead)
  res.setHeader("X-Request-Id", `${Date.now().toString(36)}-${(reqIdCounter++).toString(36)}`);
  next();
});

// ── CSRF Protection (Origin-based) ──
// Validates Origin/Referer for state-changing requests (POST/PUT/PATCH/DELETE).
// Combined with SameSite=lax cookies, this prevents CSRF attacks without tokens.
const CSRF_SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);
const CSRF_SKIP_PATHS = new Set([
  "/api/v1/payments/webhook",
  "/api/payments/webhook",
]);

app.use((req, res, next) => {
  // Skip safe methods
  if (CSRF_SAFE_METHODS.has(req.method)) return next();

  // Skip webhook routes (they use their own signature verification)
  if (CSRF_SKIP_PATHS.has(req.path)) return next();

  // Only enforce on API routes
  if (!req.path.startsWith("/api")) return next();

  // In production, verify the Origin header matches our domain
  if (process.env.NODE_ENV === "production") {
    const origin = req.headers.origin || req.headers.referer;
    const allowedOrigin = process.env.CORS_ORIGIN || "https://mrco.live";

    if (origin) {
      try {
        const originUrl = new URL(origin);
        const allowedUrl = new URL(allowedOrigin);
        if (originUrl.origin !== allowedUrl.origin) {
          serverLog.warn(`CSRF blocked: origin ${origin} does not match ${allowedOrigin} — ${req.method} ${req.path}`);
          return res.status(403).json({
            success: false,
            message: "طلب غير مصرح — CSRF protection",
          });
        }
      } catch {
        // Invalid URL format — block
        return res.status(403).json({
          success: false,
          message: "طلب غير مصرح — invalid origin",
        });
      }
    }
    // If no Origin header at all on a state-changing request, still allow
    // because some clients/proxies strip it. SameSite cookies provide backup protection.
  }

  next();
});

// ── Session middleware (Redis-backed) ──
// NOTE: Session store is set up inside the async IIFE after Redis connects.
//       We define session config here but apply it after initRedis().
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && process.env.NODE_ENV === "production") {
  throw new Error("SESSION_SECRET env var is required in production");
}
if (!SESSION_SECRET) {
  serverLog.warn("Using dev-only SESSION_SECRET — set SESSION_SECRET in .env for production");
}

export function log(message: string, source = "express") {
  createLogger(source).info(message);
}

// High-frequency paths to skip logging (prevents ~500 log writes/sec during load)
const LOG_SKIP_PATHS = new Set([
  "/api/health", "/api/metrics",
  "/api/featured-streams", "/api/announcement-popup", "/api/app-download",
  "/api/social/gifts", "/api/social/streams/active",
  "/sitemap.xml", "/sitemap-images.xml", "/robots.txt", "/ads.txt", "/humans.txt",
  "/api/widgets/status", "/widgets/status",
]);

app.use((req, res, next) => {
  const path = req.path;

  // Skip logging for high-frequency endpoints
  if (LOG_SKIP_PATHS.has(path) || !path.startsWith("/api")) {
    return next();
  }

  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    log(`${req.method} ${path} ${res.statusCode} in ${duration}ms`);
  });

  next();
});

(async () => {
  // ── Initialize Redis (test connectivity before using it) ──
  await initRedis();

  // ── Session middleware (Redis-backed, set up AFTER Redis connects) ──
  // Separate cookies for user and admin to prevent session collision
  // when both are opened in the same browser.
  const sessionStore = createRedisSessionStore(session);
  const userSessionMiddleware = session({
    name: "ablox.sid",            // user session cookie
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
  });
  const adminSessionMiddleware = session({
    name: "ablox.admin.sid",      // admin session cookie — separate from user
    secret: SESSION_SECRET || "dev-only-session-secret-not-for-production",
    resave: false,
    saveUninitialized: false,
    store: sessionStore,
    cookie: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      maxAge: 8 * 60 * 60 * 1000, // 8 hours for admin
      sameSite: "lax",
    },
  });
  // Skip session middleware on high-frequency endpoints that don't need sessions
  const SESSION_SKIP_PATHS = new Set([
    "/api/health", "/api/metrics",
    "/api/featured-streams", "/api/announcement-popup", "/api/app-download",
    "/sitemap.xml", "/sitemap-images.xml", "/robots.txt", "/ads.txt", "/humans.txt",
    "/api/widgets/status", "/widgets/status",
  ]);
  // Also skip session for public social GET endpoints
  const SESSION_SKIP_SOCIAL_GET = new Set([
    "/api/social/gifts", "/api/social/streams/active",
  ]);
  app.use((req, res, next) => {
    if (SESSION_SKIP_PATHS.has(req.path)) return next();
    if (req.method === "GET" && SESSION_SKIP_SOCIAL_GET.has(req.path)) return next();
    // Admin routes get their own cookie to prevent session collision
    if (req.path.startsWith("/api/admin") || req.path.startsWith("/api/v1/admin")) {
      return adminSessionMiddleware(req, res, next);
    }
    return userSessionMiddleware(req, res, next);
  });
  serverLog.info("Dual session middleware initialized (user: ablox.sid, admin: ablox.admin.sid)");

  // ── Attach Redis Adapter for horizontal scaling ──
  try {
    const redis = getRedis();
    if (redis) {
      const pubClient = createRedisDuplicate("pub");
      const subClient = createRedisDuplicate("sub");
      if (pubClient && subClient) {
        io.adapter(createAdapter(pubClient, subClient));
        serverLog.info("Socket.io Redis adapter attached — horizontal scaling enabled");
      } else {
        serverLog.warn("Socket.io Redis duplicate failed — using in-memory adapter");
      }
    } else {
      serverLog.info("Socket.io no Redis — using in-memory adapter (single node only)");
    }
  } catch (err) {
    serverLog.error({ err }, "Socket.io Redis adapter setup failed, using in-memory");
  }

  // ── Digital Asset Links for TWA/APK verification ──
  app.get("/.well-known/assetlinks.json", (_req, res) => {
    const fingerprints: string[] = [];

    // Custom signing key fingerprint (from env)
    const custom = process.env.TWA_SHA256_FINGERPRINT;
    if (custom && custom !== "__SIGNING_KEY_SHA256_FINGERPRINT__") {
      fingerprints.push(custom);
    }

    // Google Play App Signing fingerprint (if using Play App Signing)
    const play = process.env.PLAY_SHA256_FINGERPRINT;
    if (play) {
      fingerprints.push(play);
    }

    // PWABuilder signing key fingerprint (from Google Play package)
    fingerprints.push(
      "04:CA:7C:EB:B7:6A:2E:74:9E:B8:C8:8D:94:E9:B7:69:AF:29:E6:08:9E:81:6C:51:73:0C:7F:C5:AB:86:3E:65"
    );

    const packageName = process.env.TWA_PACKAGE_NAME || "live.mrco.twa";

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json([
      {
        relation: ["delegate_permission/common.handle_all_urls"],
        target: {
          namespace: "android_app",
          package_name: packageName,
          sha256_cert_fingerprints: fingerprints,
        },
      },
    ]);
  });

  // ── Health check endpoint (before route registration) ──
  // Cached health status to avoid pool/Redis drain under load
  let _healthCache: { data: any; ts: number } = { data: null, ts: 0 };
  const HEALTH_CACHE_MS = 5_000; // 5 seconds

  app.get("/api/health", async (_req, res) => {
    const now = Date.now();
    if (_healthCache.data && now - _healthCache.ts < HEALTH_CACHE_MS) {
      return res.status(_healthCache.data.healthy ? 200 : 503).json(_healthCache.data.body);
    }

    const dbOk = await isDatabaseConnected();
    let redisOk = false;
    try {
      const redis = getRedis();
      if (redis) { await redis.ping(); redisOk = true; }
    } catch { /* redis down */ }

    const healthy = dbOk && redisOk;
    const body = {
      status: healthy ? "healthy" : "degraded",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      services: { database: dbOk ? "up" : "down", redis: redisOk ? "up" : "down" },
    };
    _healthCache = { data: { healthy, body }, ts: now };
    res.status(healthy ? 200 : 503).json(body);
  });

  // ── Prometheus-compatible metrics endpoint ──
  app.get("/api/metrics", async (_req, res) => {
    const mem = process.memoryUsage();
    const cpu = process.cpuUsage();
    const pool = getPool();
    const onlineCount = await getOnlineUsersCount();

    const lines = [
      `# HELP ablox_uptime_seconds Server uptime in seconds`,
      `# TYPE ablox_uptime_seconds gauge`,
      `ablox_uptime_seconds ${Math.floor(process.uptime())}`,
      `# HELP ablox_memory_rss_bytes RSS memory usage`,
      `# TYPE ablox_memory_rss_bytes gauge`,
      `ablox_memory_rss_bytes ${mem.rss}`,
      `# HELP ablox_memory_heap_used_bytes Heap memory used`,
      `# TYPE ablox_memory_heap_used_bytes gauge`,
      `ablox_memory_heap_used_bytes ${mem.heapUsed}`,
      `# HELP ablox_memory_heap_total_bytes Total heap size`,
      `# TYPE ablox_memory_heap_total_bytes gauge`,
      `ablox_memory_heap_total_bytes ${mem.heapTotal}`,
      `# HELP ablox_memory_external_bytes External memory`,
      `# TYPE ablox_memory_external_bytes gauge`,
      `ablox_memory_external_bytes ${mem.external}`,
      `# HELP ablox_cpu_user_microseconds CPU user time`,
      `# TYPE ablox_cpu_user_microseconds counter`,
      `ablox_cpu_user_microseconds ${cpu.user}`,
      `# HELP ablox_cpu_system_microseconds CPU system time`,
      `# TYPE ablox_cpu_system_microseconds counter`,
      `ablox_cpu_system_microseconds ${cpu.system}`,
      `# HELP ablox_online_users Online user count`,
      `# TYPE ablox_online_users gauge`,
      `ablox_online_users ${onlineCount}`,
      `# HELP ablox_socket_connections Active socket connections`,
      `# TYPE ablox_socket_connections gauge`,
      `ablox_socket_connections ${io.engine.clientsCount}`,
    ];

    // DB pool metrics
    if (pool) {
      lines.push(
        `# HELP ablox_db_pool_total Total DB pool connections`,
        `# TYPE ablox_db_pool_total gauge`,
        `ablox_db_pool_total ${pool.totalCount}`,
        `# HELP ablox_db_pool_idle Idle DB pool connections`,
        `# TYPE ablox_db_pool_idle gauge`,
        `ablox_db_pool_idle ${pool.idleCount}`,
        `# HELP ablox_db_pool_waiting Waiting DB pool requests`,
        `# TYPE ablox_db_pool_waiting gauge`,
        `ablox_db_pool_waiting ${pool.waitingCount}`,
      );
    }

    res.setHeader("Content-Type", "text/plain; version=0.0.4");
    res.send(lines.join("\n") + "\n");
  });

  // Apply DB-level constraints on startup (idempotent)
  const { applyDatabaseConstraints, ensureDefaultAdmin } = await import("./db");
  await applyDatabaseConstraints();
  await ensureDefaultAdmin();

  // Initialize email/OTP service
  const { initEmailService } = await import("./services/email");
  initEmailService();

  // Initialize push notification service
  const { initPushService } = await import("./services/pushNotification");
  initPushService();

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
  applyCdnConfig(app); // CDN headers + security headers
  if (process.env.NODE_ENV === "production") {
    serveStatic(app);
  } else {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
  }

  // ALWAYS serve the app on the port specified in the environment variable PORT
  const port = parseInt(process.env.PORT || "3000", 10);
  // ── HTTP Keep-Alive optimization ──
  httpServer.keepAliveTimeout = 65000;   // 65s — above typical ALB/proxy 60s timeout
  httpServer.headersTimeout = 66000;     // must be > keepAliveTimeout
  httpServer.maxHeadersCount = 50;       // limit header count

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
