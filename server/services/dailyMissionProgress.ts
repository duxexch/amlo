import { getRedis } from "../redis";

const LOGIN_KEY_PREFIX = "gamification:daily:login";
const CLAIMED_KEY_PREFIX = "gamification:daily:claimed";

export function getDailyMissionDayKey(date = new Date()): string {
    return date.toISOString().slice(0, 10);
}

function secondsUntilTomorrow(date = new Date()): number {
    const next = new Date(date);
    next.setUTCHours(24, 0, 0, 0);
    return Math.max(60, Math.floor((next.getTime() - date.getTime()) / 1000));
}

export async function markDailyLoginMission(userId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    const day = getDailyMissionDayKey();
    const ttl = secondsUntilTomorrow();
    try {
        await redis.set(`${LOGIN_KEY_PREFIX}:${userId}:${day}`, "1", "EX", ttl);
    } catch {
        // best effort only
    }
}

export async function isDailyLoginMissionDone(userId: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;
    const day = getDailyMissionDayKey();
    try {
        const v = await redis.get(`${LOGIN_KEY_PREFIX}:${userId}:${day}`);
        return v === "1";
    } catch {
        return false;
    }
}

export async function claimDailyMission(userId: string, missionId: string): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;
    const day = getDailyMissionDayKey();
    const ttl = secondsUntilTomorrow();
    const key = `${CLAIMED_KEY_PREFIX}:${userId}:${day}`;
    try {
        const added = await redis.sadd(key, missionId);
        if (added === 1) {
            await redis.expire(key, ttl);
            return true;
        }
        return false;
    } catch {
        return false;
    }
}

export async function unclaimDailyMission(userId: string, missionId: string): Promise<void> {
    const redis = getRedis();
    if (!redis) return;
    const day = getDailyMissionDayKey();
    try {
        await redis.srem(`${CLAIMED_KEY_PREFIX}:${userId}:${day}`, missionId);
    } catch {
        // best effort only
    }
}

export async function getClaimedDailyMissionIds(userId: string): Promise<Set<string>> {
    const redis = getRedis();
    if (!redis) return new Set();
    const day = getDailyMissionDayKey();
    try {
        const ids = await redis.smembers(`${CLAIMED_KEY_PREFIX}:${userId}:${day}`);
        return new Set(ids || []);
    } catch {
        return new Set();
    }
}
