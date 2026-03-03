import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "@shared/schema";
import { createLogger } from "./logger";
const log = (msg: string, _src?: string) => dbLog.info(msg);
const dbLog = createLogger("db");

const { Pool } = pg;

let pool: pg.Pool | null = null;
let db: ReturnType<typeof drizzle> | null = null;

/**
 * Initialize database connection pool.
 * Returns null if DATABASE_URL is not set or connection fails.
 * This allows the app to run without a database (using mock data).
 */
export function getPool(): pg.Pool | null {
  if (pool) return pool;

  const url = process.env.DATABASE_URL;
  if (!url) {
    log("DATABASE_URL not set — running without database", "db");
    return null;
  }

  try {
    pool = new Pool({
      connectionString: url,
      max: parseInt(process.env.DB_POOL_MAX || "50", 10),  // 50 is enough with 3-tier caching
      min: parseInt(process.env.DB_POOL_MIN || "5", 10),
      idleTimeoutMillis: 20000,
      connectionTimeoutMillis: 5000,
      allowExitOnIdle: false,
      statement_timeout: 10000, // 10s query timeout — prevents DB locks
      query_timeout: 15000,
    });

    pool.on("error", (err) => {
      log(`Database pool error: ${err.message}`, "db");
      // Pool auto-reconnects — no need to crash
    });

    log("Database pool initialized", "db");
    return pool;
  } catch (err: any) {
    log(`Failed to create database pool: ${err.message}`, "db");
    return null;
  }
}

/**
 * Get Drizzle ORM instance.
 * Returns null if database is not available.
 */
export function getDb() {
  if (db) return db;

  const p = getPool();
  if (!p) return null;

  db = drizzle(p, { schema });
  return db;
}

/**
 * Check if database is connected and reachable.
 * Caches result for 10 seconds to avoid pool exhaustion under load.
 */
let _dbConnectedCache: { ok: boolean; ts: number } = { ok: false, ts: 0 };
const DB_HEALTH_CACHE_MS = 10_000; // 10 seconds

export async function isDatabaseConnected(): Promise<boolean> {
  const now = Date.now();
  if (now - _dbConnectedCache.ts < DB_HEALTH_CACHE_MS) return _dbConnectedCache.ok;

  const p = getPool();
  if (!p) { _dbConnectedCache = { ok: false, ts: now }; return false; }

  try {
    const client = await p.connect();
    await client.query("SELECT 1");
    client.release();
    _dbConnectedCache = { ok: true, ts: now };
    return true;
  } catch {
    _dbConnectedCache = { ok: false, ts: now };
    return false;
  }
}

/**
 * Apply DB-level CHECK constraints (idempotent — safe to call on every startup).
 * Prevents coins/diamonds/miles from going negative at the database level.
 */
export async function applyDatabaseConstraints(): Promise<void> {
  const p = getPool();
  if (!p) return;

  const constraints = [
    // ── CHECK constraints — prevent invalid values ──
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_coins_non_negative') THEN
         ALTER TABLE users ADD CONSTRAINT users_coins_non_negative CHECK (coins >= 0);
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_diamonds_non_negative') THEN
         ALTER TABLE users ADD CONSTRAINT users_diamonds_non_negative CHECK (diamonds >= 0);
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_miles_non_negative') THEN
         ALTER TABLE users ADD CONSTRAINT users_miles_non_negative CHECK (miles >= 0);
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_level_positive') THEN
         ALTER TABLE users ADD CONSTRAINT users_level_positive CHECK (level >= 1);
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_xp_non_negative') THEN
         ALTER TABLE users ADD CONSTRAINT users_xp_non_negative CHECK (xp >= 0);
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gifts_price_positive') THEN
         ALTER TABLE gifts ADD CONSTRAINT gifts_price_positive CHECK (price > 0);
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gift_transactions_quantity_positive') THEN
         ALTER TABLE gift_transactions ADD CONSTRAINT gift_transactions_quantity_positive CHECK (quantity > 0);
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'gift_transactions_total_positive') THEN
         ALTER TABLE gift_transactions ADD CONSTRAINT gift_transactions_total_positive CHECK (total_price > 0);
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'wallet_tx_amount_not_zero') THEN
         ALTER TABLE wallet_transactions ADD CONSTRAINT wallet_tx_amount_not_zero CHECK (amount != 0);
       END IF;
     END $$;`,
    // ── UNIQUE constraints — prevent duplicate relationships ──
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_follows_unique_pair') THEN
         ALTER TABLE user_follows ADD CONSTRAINT user_follows_unique_pair UNIQUE (follower_id, following_id);
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_blocks_unique_pair') THEN
         ALTER TABLE chat_blocks ADD CONSTRAINT chat_blocks_unique_pair UNIQUE (blocker_id, blocked_id);
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'user_follows_no_self') THEN
         ALTER TABLE user_follows ADD CONSTRAINT user_follows_no_self CHECK (follower_id != following_id);
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chat_blocks_no_self') THEN
         ALTER TABLE chat_blocks ADD CONSTRAINT chat_blocks_no_self CHECK (blocker_id != blocked_id);
       END IF;
     END $$;`,
    `DO $$ BEGIN
       IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'friendships_no_self') THEN
         ALTER TABLE friendships ADD CONSTRAINT friendships_no_self CHECK (sender_id != receiver_id);
       END IF;
     END $$;`,
  ];

  try {
    const client = await p.connect();
    for (const sql of constraints) {
      await client.query(sql);
    }
    client.release();
    log("Database constraints applied", "db");
  } catch (err: any) {
    log(`Failed to apply constraints: ${err.message}`, "db");
  }
}

/**
 * Ensure a default admin user exists on every startup.
 * - If no admin with username "admin" exists, create one.
 * - If it exists, update the password to match ADMIN_PASSWORD env var.
 * This guarantees admin panel access even after fresh deployments.
 */
export async function ensureDefaultAdmin(): Promise<void> {
  const d = getDb();
  if (!d) return;

  const bcrypt = await import("bcryptjs");
  const { admins } = await import("@shared/schema");
  const { eq } = await import("drizzle-orm");

  const adminPassword = process.env.ADMIN_PASSWORD || "admin123";
  const adminHash = bcrypt.hashSync(adminPassword, 12);

  try {
    const [existing] = await d
      .select()
      .from(admins)
      .where(eq(admins.username, "admin"))
      .limit(1);

    if (!existing) {
      await d.insert(admins).values({
        username: "admin",
        email: "admin@ablox.app",
        passwordHash: adminHash,
        displayName: "مدير النظام",
        role: "super_admin",
        isActive: true,
      });
      log("Default admin user created (admin)", "db");
    } else {
      // Always sync password with env var
      await d
        .update(admins)
        .set({ passwordHash: adminHash, isActive: true, updatedAt: new Date() })
        .where(eq(admins.username, "admin"));
      log("Default admin password synced", "db");
    }
  } catch (err: any) {
    log(`Failed to ensure admin: ${err.message}`, "db");
  }
}
