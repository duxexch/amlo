/**
 * PricingService — خدمة التسعير الموحدة
 * ════════════════════════════════════════
 * Single source of truth for all pricing in the app.
 * Reads from DB, caches in memory + Redis for 5 minutes.
 * Admin changes invalidate the cache.
 */
import { getRedis, cacheGet, cacheSet, cacheDel } from "./redis";
import { getDb } from "./db";
import { eq, asc } from "drizzle-orm";
import * as schema from "../shared/schema";
import { createLogger } from "./logger";

const log = createLogger("pricing");

// ── Types ──
export interface AllPricing {
  // World/Random chat filter pricing
  filters: {
    spin_cost: number;
    gender_both: number;
    gender_male: number;
    gender_female: number;
    age_range: number;
    country_specific: number;
    country_all: number;
    miles_per_minute: number;
  };
  // Call rates (per minute)
  calls: {
    voice_call_rate: number;
    video_call_rate: number;
  };
  // Message costs
  messages: {
    message_cost: number;
    media_enabled: boolean;
    voice_call_enabled: boolean;
    video_call_enabled: boolean;
    time_limit: number;
  };
  // Coin packages
  coinPackages: Array<{
    id: string;
    coins: number;
    bonusCoins: number;
    priceUsd: string;
    isPopular: boolean;
    isActive: boolean;
    sortOrder: number;
  }>;
  // Gift categories summary
  giftCount: number;
}

// ── Cache ──
const CACHE_KEY = "ablox:pricing:all";
const CACHE_TTL = 5 * 60; // 5 minutes
let memCache: { data: AllPricing; ts: number } | null = null;
const MEM_CACHE_TTL = 60_000; // 1 minute in-memory

/**
 * Get all pricing data (cached).
 * Used by both client API and internal matching engine.
 */
export async function getAllPricing(): Promise<AllPricing> {
  // 1. In-memory cache (fastest)
  if (memCache && Date.now() - memCache.ts < MEM_CACHE_TTL) {
    return memCache.data;
  }

  // 2. Redis cache
  const redis = getRedis();
  if (redis) {
    try {
      const cached = await redis.get(CACHE_KEY);
      if (cached) {
        const data = JSON.parse(cached) as AllPricing;
        memCache = { data, ts: Date.now() };
        return data;
      }
    } catch {}
  }

  // 3. Build from DB
  const pricing = await buildPricingFromDb();

  // Store in caches
  memCache = { data: pricing, ts: Date.now() };
  if (redis) {
    redis.setex(CACHE_KEY, CACHE_TTL, JSON.stringify(pricing)).catch(() => {});
  }

  return pricing;
}

/**
 * Invalidate all pricing caches (call after admin updates).
 */
export async function invalidatePricingCache(): Promise<void> {
  memCache = null;
  const redis = getRedis();
  if (redis) {
    await redis.del(CACHE_KEY).catch(() => {});
  }
  log.info("Pricing cache invalidated");
}

/**
 * Build pricing data fresh from the database.
 */
async function buildPricingFromDb(): Promise<AllPricing> {
  const db = getDb();
  const defaults: AllPricing = {
    filters: {
      spin_cost: 10,
      gender_both: 0,
      gender_male: 5,
      gender_female: 5,
      age_range: 10,
      country_specific: 15,
      country_all: 0,
      miles_per_minute: 1,
    },
    calls: {
      voice_call_rate: 5,
      video_call_rate: 10,
    },
    messages: {
      message_cost: 0,
      media_enabled: true,
      voice_call_enabled: true,
      video_call_enabled: true,
      time_limit: 0,
    },
    coinPackages: [],
    giftCount: 0,
  };

  if (!db) return defaults;

  try {
    // World pricing (filters)
    const worldPricing = await db.select().from(schema.worldPricing).where(eq(schema.worldPricing.isActive, true));
    for (const wp of worldPricing) {
      const key = wp.filterType as keyof typeof defaults.filters;
      if (key in defaults.filters) {
        (defaults.filters as any)[key] = wp.priceCoins;
      }
    }

    // System settings (calls, messages)
    const settings = await db.select().from(schema.systemSettings);
    const settingsMap = new Map(settings.map(s => [s.key, s.value]));

    defaults.calls.voice_call_rate = parseInt(settingsMap.get("voice_call_rate") || "5");
    defaults.calls.video_call_rate = parseInt(settingsMap.get("video_call_rate") || "10");
    defaults.messages.message_cost = parseInt(settingsMap.get("chat_message_cost") || "0");
    defaults.messages.media_enabled = settingsMap.get("chat_media_enabled") !== "false";
    defaults.messages.voice_call_enabled = settingsMap.get("chat_voice_call_enabled") !== "false";
    defaults.messages.video_call_enabled = settingsMap.get("chat_video_call_enabled") !== "false";
    defaults.messages.time_limit = parseInt(settingsMap.get("chat_time_limit") || "0");

    // Coin packages
    const packages = await db.select().from(schema.coinPackages).orderBy(asc(schema.coinPackages.sortOrder));
    defaults.coinPackages = packages.map(p => ({
      id: p.id,
      coins: p.coins,
      bonusCoins: p.bonusCoins,
      priceUsd: p.priceUsd as string,
      isPopular: p.isPopular,
      isActive: p.isActive,
      sortOrder: p.sortOrder,
    }));

    // Gift count
    const gifts = await db.select({ id: schema.gifts.id }).from(schema.gifts).where(eq(schema.gifts.isActive, true));
    defaults.giftCount = gifts.length;

  } catch (err) {
    log.error({ err }, "Error building pricing from DB");
  }

  return defaults;
}
