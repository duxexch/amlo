/**
 * Online Users Management — Hybrid local-first + Redis for horizontal scaling.
 *
 * Strategy: Local Map is the primary source of truth for THIS node (O(1) lookups).
 * Redis HSET "ablox:online_users" is kept in sync for cross-node visibility.
 * This gives us fast local reads with multi-node consistency.
 */
import { getRedis } from "./redis";
import { createLogger } from "./logger";

const REDIS_KEY = "ablox:online_users";
const REDIS_TTL = 3600; // 1 hour TTL on the hash — prevents permanent zombie entries
const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const onlineLog = createLogger("onlineUsers");

// ── Primary in-memory store (always fast, always available) ──
const localMap = new Map<string, string>();

// ── Core API ──

/** Set a user as online with their socketId (local + Redis sync) */
export async function setUserOnline(userId: string, socketId: string): Promise<void> {
  localMap.set(userId, socketId);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.hset(REDIS_KEY, userId, socketId);
      // Refresh TTL on each online event to keep the hash alive
      await redis.expire(REDIS_KEY, REDIS_TTL);
    } catch (err) {
      onlineLog.warn(`Redis setUserOnline failed for ${userId}: ${err}`);
    }
  }
}

/** Get the socketId for an online user (null if offline) — local-first O(1) */
export async function getUserSocketId(userId: string): Promise<string | null> {
  // Fast local lookup first
  const local = localMap.get(userId);
  if (local) return local;
  // Fallback to Redis for cross-node lookups
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.hget(REDIS_KEY, userId);
    } catch {
      return null;
    }
  }
  return null;
}

/** Remove a user from the online map (local + Redis sync) */
export async function removeUserOnline(userId: string): Promise<void> {
  localMap.delete(userId);
  const redis = getRedis();
  if (redis) {
    try {
      await redis.hdel(REDIS_KEY, userId);
    } catch (err) {
      onlineLog.warn(`Redis removeUserOnline failed for ${userId}: ${err}`);
    }
  }
}

/** Get total number of online users */
export async function getOnlineUsersCount(): Promise<number> {
  const redis = getRedis();
  if (redis) {
    try {
      return await redis.hlen(REDIS_KEY);
    } catch {
      return localMap.size;
    }
  }
  return localMap.size;
}

/** Check if a user is online — local-first O(1) */
export async function isUserOnline(userId: string): Promise<boolean> {
  // Fast local check
  if (localMap.has(userId)) return true;
  // Cross-node fallback
  const redis = getRedis();
  if (redis) {
    try {
      return (await redis.hexists(REDIS_KEY, userId)) === 1;
    } catch {
      return false;
    }
  }
  return false;
}

/** Batch check multiple users' online status — single HMGET instead of N HEXISTS */
export async function areUsersOnline(userIds: string[]): Promise<Map<string, boolean>> {
  const result = new Map<string, boolean>();
  if (userIds.length === 0) return result;

  // Start with local checks
  const needRedis: string[] = [];
  for (const uid of userIds) {
    if (localMap.has(uid)) {
      result.set(uid, true);
    } else {
      needRedis.push(uid);
      result.set(uid, false); // default false
    }
  }

  // Batch Redis lookup for remaining
  if (needRedis.length > 0) {
    const redis = getRedis();
    if (redis) {
      try {
        const values = await redis.hmget(REDIS_KEY, ...needRedis);
        for (let i = 0; i < needRedis.length; i++) {
          if (values[i] !== null) {
            result.set(needRedis[i], true);
          }
        }
      } catch {
        // already defaulted to false
      }
    }
  }

  return result;
}

/** Synchronous local-only lookup — for same-node socket handlers (zero overhead) */
export function getUserSocketIdSync(userId: string): string | null {
  return localMap.get(userId) ?? null;
}

/** Synchronous local-only check — for same-node socket handlers */
export function isUserOnlineSync(userId: string): boolean {
  return localMap.has(userId);
}

/** Get all online user IDs */
export async function getOnlineUserIds(): Promise<string[]> {
  const redis = getRedis();
  if (redis) {
    const all = await redis.hkeys(REDIS_KEY);
    return all;
  }
  return Array.from(localMap.keys());
}

// ── Last Seen tracking (Redis-backed) ──
const LAST_SEEN_PREFIX = "ablox:last_seen:";
const LAST_SEEN_TTL = 30 * 24 * 3600; // 30 days

/** Store when user was last online */
export async function setLastSeen(userId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    try {
      await redis.set(`${LAST_SEEN_PREFIX}${userId}`, Date.now().toString(), "EX", LAST_SEEN_TTL);
    } catch (err) {
      onlineLog.warn(`Redis setLastSeen failed for ${userId}: ${err}`);
    }
  }
}

/** Get when user was last online (returns ISO string or null) */
export async function getLastSeen(userId: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    try {
      const ts = await redis.get(`${LAST_SEEN_PREFIX}${userId}`);
      if (ts) return new Date(parseInt(ts, 10)).toISOString();
    } catch {
      return null;
    }
  }
  return null;
}

/** Batch get last seen for multiple users */
export async function getLastSeenBatch(userIds: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  if (userIds.length === 0) return result;
  const redis = getRedis();
  if (redis) {
    try {
      const keys = userIds.map(id => `${LAST_SEEN_PREFIX}${id}`);
      const values = await redis.mget(...keys);
      for (let i = 0; i < userIds.length; i++) {
        if (values[i]) result.set(userIds[i], new Date(parseInt(values[i]!, 10)).toISOString());
      }
    } catch { /* ignore */ }
  }
  return result;
}

// ── Cleanup ──
let _cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Start periodic cleanup of zombie entries.
 * Checks if each socketId still belongs to a connected socket.
 */
export function startOnlineUsersCleanup(io: { sockets: { sockets: Map<string, unknown> } }): void {
  if (_cleanupTimer) return;
  _cleanupTimer = setInterval(async () => {
    try {
      const redis = getRedis();
      let cleaned = 0;

      if (redis) {
        const all = await redis.hgetall(REDIS_KEY);
        const pipeline = redis.pipeline();
        for (const [userId, socketId] of Object.entries(all)) {
          if (!io.sockets.sockets.has(socketId)) {
            pipeline.hdel(REDIS_KEY, userId);
            cleaned++;
          }
        }
        if (cleaned > 0) await pipeline.exec();
      } else {
        for (const [userId, socketId] of localMap) {
          if (!io.sockets.sockets.has(socketId)) {
            localMap.delete(userId);
            cleaned++;
          }
        }
      }

      if (cleaned > 0) {
        const remaining = redis ? await redis.hlen(REDIS_KEY) : localMap.size;
        onlineLog.info(`Cleaned ${cleaned} zombie entries, ${remaining} remaining`);
      }
    } catch (err) {
      onlineLog.error({ err }, "Cleanup error");
    }
  }, CLEANUP_INTERVAL_MS); // Every 5 minutes (reduced frequency for less overhead)
  _cleanupTimer.unref();
}

export function stopOnlineUsersCleanup(): void {
  if (_cleanupTimer) {
    clearInterval(_cleanupTimer);
    _cleanupTimer = null;
  }
}

// ── Legacy compatibility: synchronous Map reference for code that needs it ──
// This is a DEPRECATED shim — new code should use the async API above.
export const onlineUsersMap = localMap;
