/**
 * XP & Level System — نظام النقاط والمستويات
 * =============================================
 * Awards XP for user actions and auto-levels up.
 *
 * Level formula: XP_needed = 100 * level^1.5
 * Max level: 55
 */
import { getPool } from "../db";
import { createLogger } from "../logger";

const xpLog = createLogger("xp");

// ── XP rewards per action ──
export const XP_REWARDS = {
  message_sent: 2,
  voice_call_minute: 5,
  video_call_minute: 8,
  gift_sent: 15,
  gift_received: 10,
  stream_started: 20,
  stream_watched_minute: 3,
  friend_added: 10,
  world_session: 5,
  story_posted: 8,
  daily_login: 25,
} as const;

export type XPAction = keyof typeof XP_REWARDS;

// ── Level thresholds (synced with shared/levelConfig.ts) ──
import { getXpForNextLevel, MAX_LEVEL as SHARED_MAX_LEVEL } from "../../shared/levelConfig";
const MAX_LEVEL = SHARED_MAX_LEVEL;

// Import XP_TABLE from shared config for consistency
const XP_TABLE: number[] = [
  // Tier 0 — Bronze (1-5)
  0, 100, 300, 600, 1_000,
  // Tier 1 — Silver (6-10)
  1_500, 2_200, 3_000, 4_000, 5_000,
  // Tier 2 — Gold (11-15)
  6_500, 8_000, 10_000, 12_500, 15_000,
  // Tier 3 — Platinum (16-20)
  18_000, 21_000, 25_000, 30_000, 35_000,
  // Tier 4 — Diamond (21-25)
  40_000, 47_000, 55_000, 65_000, 75_000,
  // Tier 5 — Crown (26-30)
  87_000, 100_000, 115_000, 130_000, 150_000,
  // Tier 6 — Legend (31-35)
  175_000, 200_000, 230_000, 265_000, 300_000,
  // Tier 7 — Master (36-40)
  340_000, 385_000, 435_000, 490_000, 550_000,
  // Tier 8 — Grand Master (41-45)
  620_000, 700_000, 790_000, 890_000, 1_000_000,
  // Tier 9 — Elite (46-50)
  1_120_000, 1_260_000, 1_420_000, 1_600_000, 1_800_000,
  // Tier 10 — Supreme (51-55)
  2_050_000, 2_350_000, 2_700_000, 3_100_000, 3_500_000,
];

/** Calculate XP required to reach a specific level (uses shared XP_TABLE) */
export function xpForLevel(level: number): number {
  if (level <= 0 || level > MAX_LEVEL) return 0;
  return XP_TABLE[level - 1] || 0;
}

/** Calculate level from total XP */
export function levelFromXp(totalXp: number): number {
  for (let lvl = MAX_LEVEL; lvl >= 1; lvl--) {
    if (totalXp >= xpForLevel(lvl)) return lvl;
  }
  return 1;
}

/** Get level progress as percentage */
export function levelProgress(totalXp: number, currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) return 100;
  const currentLevelXp = xpForLevel(currentLevel);
  const nextLevelXp = xpForLevel(currentLevel + 1);
  const range = nextLevelXp - currentLevelXp;
  if (range <= 0) return 100;
  return Math.min(100, Math.floor(((totalXp - currentLevelXp) / range) * 100));
}

/**
 * Award XP to a user and handle level-up.
 * Returns the new level if leveled up, otherwise null.
 */
export async function awardXp(
  userId: string,
  action: XPAction,
  multiplier = 1,
): Promise<{ newXp: number; newLevel: number; leveledUp: boolean } | null> {
  const pool = getPool();
  if (!pool) return null;

  const xpAmount = XP_REWARDS[action] * multiplier;
  if (xpAmount <= 0) return null;

  try {
    // Atomic XP update + return new values
    const result = await pool.query(
      `UPDATE users 
       SET xp = xp + $1, updated_at = NOW() 
       WHERE id = $2 
       RETURNING xp, level`,
      [xpAmount, userId],
    );

    if (result.rows.length === 0) return null;

    const { xp: newXp, level: currentLevel } = result.rows[0];
    const calculatedLevel = levelFromXp(newXp);

    // Level up check
    if (calculatedLevel > currentLevel && calculatedLevel <= MAX_LEVEL) {
      await pool.query(
        `UPDATE users SET level = $1, updated_at = NOW() WHERE id = $2`,
        [calculatedLevel, userId],
      );

      xpLog.info(`User ${userId} leveled up: ${currentLevel} → ${calculatedLevel} (XP: ${newXp})`);

      return { newXp, newLevel: calculatedLevel, leveledUp: true };
    }

    return { newXp, newLevel: currentLevel, leveledUp: false };
  } catch (err: any) {
    xpLog.error(`Failed to award XP to ${userId}: ${err.message}`);
    return null;
  }
}

/** Get XP leaderboard (top N users by XP) */
export async function getXpLeaderboard(limit = 50): Promise<Array<{ id: string; username: string; displayName: string; level: number; xp: number; avatar: string | null }>> {
  const pool = getPool();
  if (!pool) return [];

  try {
    const result = await pool.query(
      `SELECT id, username, display_name as "displayName", level, xp, avatar 
       FROM users 
       WHERE is_banned = false 
       ORDER BY xp DESC 
       LIMIT $1`,
      [limit],
    );
    return result.rows;
  } catch {
    return [];
  }
}

/** Get level info for a user */
export async function getUserLevelInfo(userId: string): Promise<{
  level: number;
  xp: number;
  xpForCurrentLevel: number;
  xpForNextLevel: number;
  progress: number;
  maxLevel: number;
} | null> {
  const pool = getPool();
  if (!pool) return null;

  try {
    const result = await pool.query(
      `SELECT level, xp FROM users WHERE id = $1`,
      [userId],
    );
    if (result.rows.length === 0) return null;

    const { level, xp } = result.rows[0];
    return {
      level,
      xp,
      xpForCurrentLevel: xpForLevel(level),
      xpForNextLevel: level >= MAX_LEVEL ? xpForLevel(MAX_LEVEL) : xpForLevel(level + 1),
      progress: levelProgress(xp, level),
      maxLevel: MAX_LEVEL,
    };
  } catch {
    return null;
  }
}
