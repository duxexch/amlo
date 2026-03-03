/**
 * Redis connection & session store helper.
 * Falls back gracefully when Redis is unavailable (local dev).
 */
import { Redis } from "ioredis";
import { RedisStore } from "connect-redis";
import { createLogger } from "./logger";
import memoryStoreFactory from "memorystore";
const redisLog = createLogger("redis");

let redisClient: Redis | null = null;

/**
 * Attach standard error/status handlers to any Redis client.
 */
function attachHandlers(client: Redis, label = "redis") {
  client.on("connect", () => redisLog.info(`[${label}] connected`));
  client.on("ready", () => redisLog.info(`[${label}] ready`));
  client.on("end", () => redisLog.info(`[${label}] connection closed`));
  client.on("error", (err) => redisLog.warn(`[${label}] ${err.message}`));
}

/**
 * Initialize Redis — tests real connectivity before returning.
 * Returns the client if connected, null otherwise.
 */
export async function initRedis(): Promise<Redis | null> {
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    redisLog.info("REDIS_URL not set — running without Redis");
    return null;
  }

  try {
    const client = new Redis(url, {
      maxRetriesPerRequest: null, // never give up on pending commands
      retryStrategy(times) {
        if (times > 10) {
          redisLog.error("Redis retry limit reached — giving up");
          return null;
        }
        return Math.min(times * 200, 3000);
      },
      lazyConnect: true,
      connectTimeout: 5000,
      enableReadyCheck: true,
      enableOfflineQueue: true,
      keepAlive: 30000,
      noDelay: true,
    });

    attachHandlers(client, "main");

    // Test real connectivity with a timeout
    await client.connect();
    await client.ping();

    redisClient = client;
    redisLog.info("Redis connection verified (PING OK)");
    return redisClient;
  } catch (err: any) {
    redisLog.warn(`Redis unavailable: ${err.message} — running without Redis`);
    return null;
  }
}

/**
 * Get the existing Redis client (synchronous).
 * Must call initRedis() first during startup.
 */
export function getRedis(): Redis | null {
  return redisClient;
}

/**
 * Create a duplicate Redis client with error handlers attached.
 * Used for pub/sub in Socket.io adapter.
 */
export function createRedisDuplicate(label: string): Redis | null {
  if (!redisClient) return null;
  try {
    const dup = redisClient.duplicate();
    attachHandlers(dup, label);
    return dup;
  } catch (err: any) {
    redisLog.warn(`Failed to duplicate Redis client [${label}]: ${err.message}`);
    return null;
  }
}

/**
 * Wrap ioredis client so connect-redis v9 object-style SET works.
 * connect-redis v9 calls: client.set(key, value, {EX: ttl})
 * ioredis expects:         client.set(key, value, 'EX', ttl)
 */
function wrapIoredisForConnectRedis(redis: Redis) {
  const originalSet = redis.set.bind(redis);
  (redis as any).set = (key: string, value: string, opts?: any) => {
    if (opts && typeof opts === "object" && !Array.isArray(opts)) {
      const args: any[] = [key, value];
      if (opts.EX) args.push("EX", opts.EX);
      else if (opts.PX) args.push("PX", opts.PX);
      if (opts.NX) args.push("NX");
      else if (opts.XX) args.push("XX");
      return (originalSet as any)(...args);
    }
    return (originalSet as any)(key, value, opts);
  };
  return redis;
}

/**
 * Create a session store backed by Redis.
 * Falls back to MemoryStore if Redis is unavailable.
 */
export function createRedisSessionStore(session: any) {
  const redis = getRedis();

  if (redis) {
    redisLog.info("Using Redis session store");
    const wrapped = wrapIoredisForConnectRedis(redis);
    return new RedisStore({
      client: wrapped as any,
      prefix: "ablox:sess:",
      ttl: 86400, // 24 hours
    });
  }

  // Fallback to MemoryStore
  redisLog.info("Falling back to MemoryStore for sessions");
  const MemoryStore = memoryStoreFactory(session);
  return new MemoryStore({ checkPeriod: 86400000 });
}

/**
 * Cache helper: get/set with TTL.
 */
export async function cacheGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  try {
    return await redis.get(`ablox:cache:${key}`);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: string, ttlSeconds = 300): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.setex(`ablox:cache:${key}`, ttlSeconds, value);
  } catch { /* ignore */ }
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  try {
    await redis.del(`ablox:cache:${key}`);
  } catch { /* ignore */ }
}
