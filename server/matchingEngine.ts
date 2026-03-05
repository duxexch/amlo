/**
 * MatchingEngine — محرك المطابقة المركزي
 * ════════════════════════════════════════
 * Redis-backed real-time matching queue for random chat.
 * Designed to be reusable for: random chat, world explore, future features.
 *
 * Flow:
 *   1. User joins queue with filters → `joinQueue()`
 *   2. Engine finds best match from queue → `findMatch()`
 *   3. Both users get `random-match-found` socket event
 *   4. WebRTC call starts between them
 *   5. User clicks "Next" → `nextMatch()` (ends current, re-queues)
 *   6. User leaves → `leaveQueue()`
 */
import { getRedis } from "./redis";
import { getDb } from "./db";
import { eq, and, ne, sql, gte } from "drizzle-orm";
import * as schema from "../shared/schema";
import { io } from "./index";
import { getUserSocketId, getOnlineUserIds, isUserOnline } from "./onlineUsers";
import { getAllPricing } from "./pricingService";
import { createLogger } from "./logger";

const log = createLogger("matching");

// ── Types ──
export interface MatchFilters {
  type: "video" | "audio";        // call type
  genderFilter: "both" | "male" | "female";
  ageMin: number;
  ageMax: number;
  countryFilter?: string;          // ISO code or undefined for "all"
}

export interface QueueEntry {
  userId: string;
  filters: MatchFilters;
  joinedAt: number;                // timestamp
  socketId: string;
}

export interface MatchResult {
  success: boolean;
  matchedUser?: {
    id: string;
    username: string;
    displayName: string | null;
    avatar: string | null;
    country: string | null;
    gender: string | null;
    level: number;
  };
  sessionId?: string;
  cost?: number;
  error?: string;
}

// ── Redis keys ──
const QUEUE_KEY = "ablox:matching:queue";           // HASH: userId -> JSON(QueueEntry)
const RECENT_KEY = "ablox:matching:recent";          // HASH: `${userId1}:${userId2}` -> timestamp
const ACTIVE_KEY = "ablox:matching:active";          // HASH: userId -> sessionId (currently in call)
const RECENT_EXPIRY = 30 * 60;                       // 30 minutes — don't re-match same pair

// ── In-memory fallback (single node) ──
const localQueue = new Map<string, QueueEntry>();
const localActive = new Map<string, string>();        // userId -> sessionId
const localRecent = new Map<string, number>();         // `u1:u2` -> timestamp

// Memory leak protection: max sizes for in-memory maps
const MAX_LOCAL_RECENT = 10_000;
const MAX_LOCAL_QUEUE = 10_000;
const MAX_LOCAL_ACTIVE = 10_000;

// ── Queue Management ──

/** Add user to the matching queue */
export async function joinQueue(userId: string, socketId: string, filters: MatchFilters): Promise<{ queued: boolean; cost: number }> {
  const entry: QueueEntry = { userId, filters, joinedAt: Date.now(), socketId };

  // Calculate cost from pricing
  const cost = await calculateRandomChatCost(filters);

  // Check user has enough coins
  const db = getDb();
  if (db && cost > 0) {
    const [user] = await db.select({ coins: schema.users.coins }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!user || user.coins < cost) {
      log.warn({ userId, cost, coins: user?.coins }, "Queue join rejected — insufficient coins");
      return { queued: false, cost };
    }
  }

  const redis = getRedis();
  if (redis) {
    await redis.hset(QUEUE_KEY, userId, JSON.stringify(entry));
    await redis.expire(QUEUE_KEY, 600); // 10 min TTL — stale queue entries cleaned
  }
  localQueue.set(userId, entry);

  log.info(`User ${userId} joined queue (${filters.type}, ${filters.genderFilter})`);
  return { queued: true, cost };
}

/** Remove user from the matching queue */
export async function leaveQueue(userId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.hdel(QUEUE_KEY, userId).catch(() => {});
  }
  localQueue.delete(userId);
  log.info(`User ${userId} left queue`);
}

/** Check if user is in the queue */
export async function isInQueue(userId: string): Promise<boolean> {
  if (localQueue.has(userId)) return true;
  const redis = getRedis();
  if (redis) {
    return (await redis.hexists(QUEUE_KEY, userId)) === 1;
  }
  return false;
}

/** Set user as actively in a call */
export async function setActiveCall(userId: string, sessionId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.hset(ACTIVE_KEY, userId, sessionId).catch(() => {});
    await redis.expire(ACTIVE_KEY, 3600).catch(() => {}); // 1 hour TTL — prevents permanent stale entries
  }
  localActive.set(userId, sessionId);
}

/** Clear user's active call */
export async function clearActiveCall(userId: string): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.hdel(ACTIVE_KEY, userId).catch(() => {});
  }
  localActive.delete(userId);
}

/** Get user's active session */
export async function getActiveCall(userId: string): Promise<string | null> {
  const local = localActive.get(userId);
  if (local) return local;
  const redis = getRedis();
  if (redis) {
    return await redis.hget(ACTIVE_KEY, userId);
  }
  return null;
}

/** Mark two users as recently matched (prevents re-matching) */
async function markRecentMatch(userId1: string, userId2: string): Promise<void> {
  const key1 = `${userId1}:${userId2}`;
  const key2 = `${userId2}:${userId1}`;
  const now = Date.now();

  const redis = getRedis();
  if (redis) {
    const multi = redis.multi();
    multi.hset(RECENT_KEY, key1, now.toString());
    multi.hset(RECENT_KEY, key2, now.toString());
    multi.expire(RECENT_KEY, RECENT_EXPIRY);
    await multi.exec();
  }
  localRecent.set(key1, now);
  localRecent.set(key2, now);
}

/** Check if two users were recently matched */
async function wasRecentlyMatched(userId1: string, userId2: string): Promise<boolean> {
  const key = `${userId1}:${userId2}`;
  const now = Date.now();
  const threshold = now - RECENT_EXPIRY * 1000;

  // Local check first
  const local = localRecent.get(key);
  if (local && local > threshold) return true;

  const redis = getRedis();
  if (redis) {
    const ts = await redis.hget(RECENT_KEY, key);
    if (ts && parseInt(ts) > threshold) return true;
  }
  return false;
}

// ── Core Matching Logic ──

/**
 * Find a match for the given user from the queue.
 * Called right after joinQueue, and periodically for waiting users.
 */
export async function findMatch(userId: string): Promise<MatchResult> {
  const db = getDb();
  if (!db) return { success: false, error: "قاعدة البيانات غير متاحة" };

  // Get the user's queue entry
  let myEntry = localQueue.get(userId);
  if (!myEntry) {
    const redis = getRedis();
    if (redis) {
      const raw = await redis.hget(QUEUE_KEY, userId);
      if (raw) myEntry = JSON.parse(raw);
    }
  }
  if (!myEntry) return { success: false, error: "لست في طابور البحث" };

  // Get all queue entries
  let allEntries: QueueEntry[] = [];
  const redis = getRedis();
  if (redis) {
    const all = await redis.hgetall(QUEUE_KEY);
    for (const [uid, raw] of Object.entries(all)) {
      if (uid !== userId) {
        try { allEntries.push(JSON.parse(raw)); } catch (e: any) { log.warn(`Skipping unparseable queue entry for ${uid}`); }
      }
    }
  } else {
    for (const [uid, entry] of localQueue) {
      if (uid !== userId) allEntries.push(entry);
    }
  }

  // Filter candidates
  const candidates: QueueEntry[] = [];
  for (const entry of allEntries) {
    // Skip users in active calls
    const activeCall = await getActiveCall(entry.userId);
    if (activeCall) continue;

    // Skip recently matched
    if (await wasRecentlyMatched(userId, entry.userId)) continue;

    // Skip if not online
    if (!await isUserOnline(entry.userId)) continue;

    // Must match call type
    if (entry.filters.type !== myEntry.filters.type) continue;

    // Gender compatibility — bidirectional
    // My filter must accept their gender, AND their filter must accept my gender
    const theirInfo = await getUserBasicInfo(db, entry.userId);
    const myInfo = await getUserBasicInfo(db, userId);
    if (!theirInfo || !myInfo) continue;

    // My gender filter vs their actual gender
    if (myEntry.filters.genderFilter !== "both" && theirInfo.gender !== myEntry.filters.genderFilter) continue;
    // Their gender filter vs my actual gender
    if (entry.filters.genderFilter !== "both" && myInfo.gender !== entry.filters.genderFilter) continue;

    // Country filter — bidirectional
    if (myEntry.filters.countryFilter && theirInfo.country !== myEntry.filters.countryFilter) continue;
    if (entry.filters.countryFilter && myInfo.country !== entry.filters.countryFilter) continue;

    // Age filter
    if (theirInfo.age !== null) {
      if (myEntry.filters.ageMin > 0 && theirInfo.age < myEntry.filters.ageMin) continue;
      if (myEntry.filters.ageMax < 100 && theirInfo.age > myEntry.filters.ageMax) continue;
    }
    if (myInfo.age !== null) {
      if (entry.filters.ageMin > 0 && myInfo.age < entry.filters.ageMin) continue;
      if (entry.filters.ageMax < 100 && myInfo.age > entry.filters.ageMax) continue;
    }

    candidates.push(entry);
  }

  if (candidates.length === 0) {
    return { success: false, error: "لا يوجد مستخدمين مطابقين حالياً" };
  }

  // Pick the oldest waiting user (FIFO fairness)
  candidates.sort((a, b) => a.joinedAt - b.joinedAt);
  const matched = candidates[0];

  // ── Execute match ──
  const filters = myEntry.filters;
  const cost = await calculateRandomChatCost(filters);
  const matchedCost = await calculateRandomChatCost(matched.filters);

  // Charge coins from both users atomically
  if (cost > 0) {
    const charged = await chargeCoins(db, userId, cost, `دردشة عشوائية (${filters.type})`);
    if (!charged) {
      await leaveQueue(userId);
      return { success: false, error: "رصيد غير كافي" };
    }
  }
  if (matchedCost > 0) {
    const charged = await chargeCoins(db, matched.userId, matchedCost, `دردشة عشوائية (${matched.filters.type})`);
    if (!charged) {
      // Refund first user if second can't pay
      if (cost > 0) {
        await db.update(schema.users).set({ coins: sql`coins + ${cost}` }).where(eq(schema.users.id, userId));
      }
      await leaveQueue(matched.userId);
      // Try finding another match
      return findMatch(userId);
    }
  }

  // Create call session in DB
  const [session] = await db.insert(schema.calls).values({
    callerId: userId,
    receiverId: matched.userId,
    type: filters.type === "video" ? "video" : "voice",
    status: "active",
    startedAt: new Date(),
    coinRate: cost,
  }).returning();

  // Remove both from queue
  await leaveQueue(userId);
  await leaveQueue(matched.userId);

  // Set both as active
  await setActiveCall(userId, session.id);
  await setActiveCall(matched.userId, session.id);

  // Mark as recently matched
  await markRecentMatch(userId, matched.userId);

  // Get matched user's full info
  const matchedUserInfo = await getUserBasicInfo(db, matched.userId);
  const myUserInfo = await getUserBasicInfo(db, userId);

  // Notify both users via Socket
  const mySocketId = await getUserSocketId(userId);
  const matchedSocketId = await getUserSocketId(matched.userId);

  if (mySocketId) {
    io.to(mySocketId).emit("random-match-found", {
      sessionId: session.id,
      callType: filters.type,
      matchedUser: matchedUserInfo ? {
        id: matched.userId,
        username: matchedUserInfo.username,
        displayName: matchedUserInfo.displayName,
        avatar: matchedUserInfo.avatar,
        country: matchedUserInfo.country,
        gender: matchedUserInfo.gender,
        level: matchedUserInfo.level,
      } : null,
      cost,
    });
  }

  if (matchedSocketId) {
    io.to(matchedSocketId).emit("random-match-found", {
      sessionId: session.id,
      callType: matched.filters.type,
      matchedUser: myUserInfo ? {
        id: userId,
        username: myUserInfo.username,
        displayName: myUserInfo.displayName,
        avatar: myUserInfo.avatar,
        country: myUserInfo.country,
        gender: myUserInfo.gender,
        level: myUserInfo.level,
      } : null,
      cost: matchedCost,
    });
  }

  log.info(`Match found: ${userId} <-> ${matched.userId} (session: ${session.id})`);

  return {
    success: true,
    matchedUser: matchedUserInfo ? {
      id: matched.userId,
      username: matchedUserInfo.username,
      displayName: matchedUserInfo.displayName,
      avatar: matchedUserInfo.avatar,
      country: matchedUserInfo.country,
      gender: matchedUserInfo.gender,
      level: matchedUserInfo.level,
    } : undefined,
    sessionId: session.id,
    cost,
  };
}

/** End current call and optionally re-queue for next match */
export async function endRandomCall(userId: string, findNext: boolean = false): Promise<{ ended: boolean; requeued?: boolean }> {
  const db = getDb();
  if (!db) return { ended: false };

  const sessionId = await getActiveCall(userId);
  if (!sessionId) return { ended: false };

  // Get session to find the other user
  const [session] = await db.select().from(schema.calls).where(eq(schema.calls.id, sessionId)).limit(1);
  if (!session) {
    await clearActiveCall(userId);
    return { ended: false };
  }

  const otherUserId = session.callerId === userId ? session.receiverId : session.callerId;

  // Calculate duration and coins
  const startTime = session.startedAt || session.createdAt;
  const durationSeconds = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);

  // Update session
  await db.update(schema.calls).set({
    status: "ended",
    endedAt: new Date(),
    durationSeconds,
  }).where(eq(schema.calls.id, sessionId));

  // Clear active calls
  await clearActiveCall(userId);
  await clearActiveCall(otherUserId);

  // Notify the other user
  const otherSocketId = await getUserSocketId(otherUserId);
  if (otherSocketId) {
    io.to(otherSocketId).emit("random-call-ended", {
      sessionId,
      durationSeconds,
      reason: findNext ? "next" : "ended",
    });
  }

  log.info(`Call ended: ${sessionId} (duration: ${durationSeconds}s)`);

  return { ended: true, requeued: false };
}

// ── Periodic matcher (runs every N seconds to match waiting users) ──
const MATCHING_LOOP_INTERVAL_MS = 3_000; // 3 seconds
let matcherInterval: ReturnType<typeof setInterval> | null = null;

export function startMatchingLoop(): void {
  if (matcherInterval) return;

  matcherInterval = setInterval(async () => {
    try {
      // Get all queued users
      let queuedUsers: string[] = [];
      const redis = getRedis();
      if (redis) {
        queuedUsers = await redis.hkeys(QUEUE_KEY);
      } else {
        queuedUsers = Array.from(localQueue.keys());
      }

      // Try to match each user
      for (const userId of queuedUsers) {
        const activeCall = await getActiveCall(userId);
        if (activeCall) continue; // Already in a call

        const result = await findMatch(userId);
        if (result.success) {
          // Match was found and handled in findMatch()
          break; // Process one match per cycle to avoid race conditions
        }
      }
    } catch (err) {
      log.error({ err }, "Matching loop error");
    }
  }, MATCHING_LOOP_INTERVAL_MS);

  matcherInterval.unref();
  log.info(`Matching loop started (every ${MATCHING_LOOP_INTERVAL_MS / 1000}s)`);
}

export function stopMatchingLoop(): void {
  if (matcherInterval) {
    clearInterval(matcherInterval);
    matcherInterval = null;
  }
}

// ── Helpers ──

interface UserBasicInfo {
  username: string;
  displayName: string | null;
  avatar: string | null;
  country: string | null;
  gender: string | null;
  level: number;
  age: number | null;
}

// Simple cache to avoid repeated DB lookups during matching
import { TtlCache } from "./utils/ttlCache";
const userInfoCache = new TtlCache<string, UserBasicInfo>({ ttlMs: 60_000, maxSize: 5_000 });

async function getUserBasicInfo(db: any, userId: string): Promise<UserBasicInfo | null> {
  const cached = userInfoCache.get(userId);
  if (cached) return cached;

  const [user] = await db.select({
    username: schema.users.username,
    displayName: schema.users.displayName,
    avatar: schema.users.avatar,
    country: schema.users.country,
    gender: schema.users.gender,
    level: schema.users.level,
    birthDate: schema.users.birthDate,
  }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);

  if (!user) return null;

  let age: number | null = null;
  if (user.birthDate) {
    const birth = new Date(user.birthDate);
    const now = new Date();
    age = now.getFullYear() - birth.getFullYear();
    const monthDiff = now.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
      age--;
    }
  }

  const info: UserBasicInfo = {
    username: user.username,
    displayName: user.displayName,
    avatar: user.avatar,
    country: user.country,
    gender: user.gender,
    level: user.level,
    age,
  };

  userInfoCache.set(userId, info);
  return info;
}

/** Calculate cost for random chat based on filters — uses cached pricing */
async function calculateRandomChatCost(filters: MatchFilters): Promise<number> {
  const { filters: p } = await getAllPricing();
  let total = 0;

  // Base spin cost
  total += p.spin_cost || 0;

  // Gender filter cost
  const genderKey = `gender_${filters.genderFilter}` as keyof typeof p;
  total += (p[genderKey] as number) || 0;

  // Age filter cost (if custom range)
  if (filters.ageMin > 18 || filters.ageMax < 60) {
    total += p.age_range || 0;
  }

  // Country filter cost
  if (filters.countryFilter) {
    total += p.country_specific || 0;
  }

  return total;
}

/** Charge coins atomically */
async function chargeCoins(db: any, userId: string, amount: number, description: string): Promise<boolean> {
  if (amount <= 0) return true;

  const result = await db.update(schema.users)
    .set({
      coins: sql`coins - ${amount}`,
      updatedAt: new Date(),
    })
    .where(and(
      eq(schema.users.id, userId),
      sql`coins >= ${amount}`
    ))
    .returning({ id: schema.users.id, coins: schema.users.coins });

  if (!result.length) return false;

  await db.insert(schema.walletTransactions).values({
    userId,
    type: "random_chat",
    amount: -amount,
    balanceAfter: result[0].coins,
    currency: "coins",
    description,
    status: "completed",
  });

  return true;
}

// ── Cleanup ──

/** Remove stale entries (users who disconnected without leaving queue) */
export function startQueueCleanup(): void {
  setInterval(async () => {
    const now = Date.now();
    const MAX_QUEUE_TIME = 5 * 60 * 1000; // 5 minutes max in queue

    // Clean local queue
    for (const [userId, entry] of localQueue) {
      if (now - entry.joinedAt > MAX_QUEUE_TIME) {
        await leaveQueue(userId);
        const socketId = await getUserSocketId(userId);
        if (socketId) {
          io.to(socketId).emit("random-match-timeout", { message: "انتهت مهلة البحث" });
        }
      }
    }

    // Clean recent matches cache
    const recentThreshold = now - RECENT_EXPIRY * 1000;
    for (const [key, ts] of localRecent) {
      if (ts < recentThreshold) localRecent.delete(key);
    }
    // Memory leak protection — cap map sizes
    if (localRecent.size > MAX_LOCAL_RECENT) localRecent.clear();
    if (localQueue.size > MAX_LOCAL_QUEUE) localQueue.clear();
    if (localActive.size > MAX_LOCAL_ACTIVE) localActive.clear();

    // TtlCache handles its own cleanup automatically
  }, 30_000).unref();
}

/** Get queue stats (for admin) */
export async function getQueueStats(): Promise<{ queueSize: number; activeCalls: number }> {
  const redis = getRedis();
  let queueSize = localQueue.size;
  let activeCalls = localActive.size;

  if (redis) {
    queueSize = await redis.hlen(QUEUE_KEY).catch(() => localQueue.size);
    activeCalls = await redis.hlen(ACTIVE_KEY).catch(() => localActive.size);
  }

  return { queueSize, activeCalls };
}
