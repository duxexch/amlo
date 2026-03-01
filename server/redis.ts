/**
 * Redis connection & session store helper.
 */
import { Redis } from "ioredis";
import { RedisStore } from "connect-redis";
import { createLogger } from "./logger";
const log = (msg: string, _src?: string) => redisLog.info(msg);
const redisLog = createLogger("redis");

let redisClient: Redis | null = null;

/**
 * Get or create Redis client.
 * Falls back gracefully if REDIS_URL is not set.
 */
export function getRedis(): Redis | null {
  if (redisClient) return redisClient;

  const url = process.env.REDIS_URL;
  if (!url) {
    log("REDIS_URL not set — using MemoryStore fallback", "redis");
    return null;
  }

  try {
    redisClient = new Redis(url, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 10) return null; // stop retrying
        return Math.min(times * 200, 3000);
      },
      lazyConnect: false,
    });

    redisClient.on("connect", () => log("Redis connected", "redis"));
    redisClient.on("error", (err) => log(`Redis error: ${err.message}`, "redis"));

    return redisClient;
  } catch (err: any) {
    log(`Failed to create Redis client: ${err.message}`, "redis");
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
    log("Using Redis session store", "redis");
    const wrapped = wrapIoredisForConnectRedis(redis);
    return new RedisStore({
      client: wrapped as any,
      prefix: "aplo:sess:",
      ttl: 86400, // 24 hours
    });
  }

  // Fallback to MemoryStore
  log("Falling back to MemoryStore for sessions", "redis");
  const MemoryStore = require("memorystore")(session);
  return new MemoryStore({ checkPeriod: 86400000 });
}

/**
 * Cache helper: get/set with TTL.
 */
export async function cacheGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (!redis) return null;
  return redis.get(`aplo:cache:${key}`);
}

export async function cacheSet(key: string, value: string, ttlSeconds = 300): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.setex(`aplo:cache:${key}`, ttlSeconds, value);
}

export async function cacheDel(key: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;
  await redis.del(`aplo:cache:${key}`);
}
