/**
 * Social Routes — Shared Helpers
 * ═══════════════════════════════
 * Utilities shared across all social sub-route modules.
 */
import { type Request, type Response } from "express";
import { eq, and, or, sql } from "drizzle-orm";
import { isValidUuid } from "../utils/validation";
import { getDb } from "../db";
import { getRedis } from "../redis";
import * as schema from "../../shared/schema";

// ── Express 5 param helpers ──

/** Extract string from Express 5 param (can be string | string[]) */
export function paramStr(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

/** Validate UUID param — returns null + sends 400 if invalid */
export function paramUuid(v: string | string[] | undefined, res: Response, name = "id"): string | null {
  const val = paramStr(v);
  if (!isValidUuid(val)) {
    res.status(400).json({ success: false, message: `${name} غير صالح` });
    return null;
  }
  return val;
}

/** Get session userId or send 401 */
export function requireUser(req: Request, res: Response): string | null {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });
    return null;
  }
  return userId;
}

// ── Financial rate limiter (Redis-backed, cluster-safe) ──
const FINANCIAL_MAX_REQUESTS = 5;
const FINANCIAL_WINDOW_SEC = 60;

export async function isFinancialRateLimited(userId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return isFinancialRateLimitedLocal(userId);
  try {
    const key = `frl:${userId}`;
    const count = await redis.incr(key);
    if (count === 1) await redis.expire(key, FINANCIAL_WINDOW_SEC);
    return count > FINANCIAL_MAX_REQUESTS;
  } catch {
    return isFinancialRateLimitedLocal(userId);
  }
}

// In-memory fallback for when Redis is unavailable
const financialRateLimit = new Map<string, { count: number; windowStart: number }>();

setInterval(() => {
  const now = Date.now();
  for (const [key, v] of financialRateLimit) {
    if (now - v.windowStart > FINANCIAL_WINDOW_SEC * 2000) financialRateLimit.delete(key);
  }
  if (financialRateLimit.size > 50_000) financialRateLimit.clear();
}, 5 * 60_000);

function isFinancialRateLimitedLocal(userId: string): boolean {
  const now = Date.now();
  const entry = financialRateLimit.get(userId);
  if (!entry || now - entry.windowStart > FINANCIAL_WINDOW_SEC * 1000) {
    financialRateLimit.set(userId, { count: 1, windowStart: now });
    return false;
  }
  entry.count++;
  return entry.count > FINANCIAL_MAX_REQUESTS;
}

// ── Withdrawal limits ──
export const DAILY_WITHDRAW_LIMIT = 50_000;
export const WEEKLY_WITHDRAW_LIMIT = 200_000;

// ── Charge coins (atomic) ──
export async function chargeCoins(userId: string, amount: number, description: string, refId?: string, tx?: any): Promise<boolean> {
  const executor = tx || getDb();
  if (!executor || amount <= 0) return true;

  const result = await executor.update(schema.users)
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

  await executor.insert(schema.walletTransactions).values({
    userId,
    type: "call_charge",
    amount: -amount,
    balanceAfter: result[0].coins,
    currency: "coins",
    description,
    referenceId: refId,
    status: "completed",
  });
  return true;
}

// ── Chat block check ──
export async function isChatBlocked(userId1: string, userId2: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [block] = await db.select().from(schema.chatBlocks)
    .where(
      or(
        and(eq(schema.chatBlocks.blockerId, userId1), eq(schema.chatBlocks.blockedId, userId2)),
        and(eq(schema.chatBlocks.blockerId, userId2), eq(schema.chatBlocks.blockedId, userId1)),
      )
    ).limit(1);
  return !!block;
}
