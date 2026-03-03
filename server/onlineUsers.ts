/**
 * Online Users Management — Hybrid local-first + Redis for horizontal scaling.
 *
 * Strategy: Local Map is the primary source of truth for THIS node (O(1) lookups).
 * Redis HSET "ablox:online_users" is kept in sync for cross-node visibility.
 * This gives us fast local reads with multi-node consistency.
 */
import { getRedis } from "./redis";

const REDIS_KEY = "ablox:online_users";

// ── Primary in-memory store (always fast, always available) ──
const localMap = new Map<string, string>();

// ── Core API ──

/** Set a user as online with their socketId (local + Redis sync) */
export async function setUserOnline(userId: string, socketId: string): Promise<void> {
  localMap.set(userId, socketId);
  const redis = getRedis();
  if (redis) {
    // Fire-and-forget Redis sync — don't block on network
    redis.hset(REDIS_KEY, userId, socketId).catch(() => {});
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
    redis.hdel(REDIS_KEY, userId).catch(() => {});
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
        console.log(`[onlineUsers] Cleaned ${cleaned} zombie entries, ${remaining} remaining`);
      }
    } catch (err) {
      console.error("[onlineUsers] Cleanup error:", err);
    }
  }, 5 * 60 * 1000); // Every 5 minutes (reduced frequency for less overhead)
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
