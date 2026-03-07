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
      max: parseInt(process.env.DB_POOL_MAX || "15", 10),  // 15 per worker — safe for cluster mode
      min: parseInt(process.env.DB_POOL_MIN || "2", 10),
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
    // ── Notification preferences extensions (safe migrations) ──
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS chat_auto_translate boolean NOT NULL DEFAULT true;`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS chat_show_original_text boolean NOT NULL DEFAULT true;`,
    `ALTER TABLE notification_preferences ADD COLUMN IF NOT EXISTS chat_translate_lang text NOT NULL DEFAULT 'ar';`,
    // ── Chat/query performance indexes — safe + idempotent ──
    `CREATE INDEX IF NOT EXISTS conv_active_p1_last_idx ON conversations (participant1_id, last_message_at DESC) WHERE is_active = true;`,
    `CREATE INDEX IF NOT EXISTS conv_active_p2_last_idx ON conversations (participant2_id, last_message_at DESC) WHERE is_active = true;`,
    `CREATE INDEX IF NOT EXISTS msg_conv_created_desc_idx ON messages (conversation_id, created_at DESC, id DESC);`,
    `CREATE INDEX IF NOT EXISTS msg_unread_conv_idx ON messages (conversation_id, is_read, created_at DESC) WHERE is_deleted = false;`,
    // ── Daily missions tables (safe bootstrap) ──
    `CREATE TABLE IF NOT EXISTS user_daily_missions (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      user_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      mission_date date NOT NULL,
      streak_count integer NOT NULL DEFAULT 1,
      xp_awarded integer NOT NULL DEFAULT 0,
      coins_awarded integer NOT NULL DEFAULT 0,
      metadata text,
      claimed_at timestamp NOT NULL DEFAULT now(),
      CONSTRAINT uq_user_daily_missions_date UNIQUE (user_id, mission_date)
    );`,
    `CREATE INDEX IF NOT EXISTS user_daily_missions_user_idx ON user_daily_missions (user_id);`,
    `CREATE INDEX IF NOT EXISTS user_daily_missions_date_idx ON user_daily_missions (mission_date);`,
    // ── Smart Director telemetry + auto clips (safe bootstrap) ──
    `CREATE TABLE IF NOT EXISTS stream_director_events (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      stream_id varchar NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
      host_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      tip_id text NOT NULL,
      action text NOT NULL,
      metadata text,
      created_at timestamp NOT NULL DEFAULT now()
    );`,
    `CREATE INDEX IF NOT EXISTS stream_director_events_stream_idx ON stream_director_events (stream_id);`,
    `CREATE INDEX IF NOT EXISTS stream_director_events_host_idx ON stream_director_events (host_id);`,
    `CREATE INDEX IF NOT EXISTS stream_director_events_created_idx ON stream_director_events (created_at);`,
    `CREATE TABLE IF NOT EXISTS stream_auto_clips (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid()::text,
      stream_id varchar NOT NULL REFERENCES streams(id) ON DELETE CASCADE,
      host_id varchar NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      cue_type text NOT NULL,
      title text NOT NULL,
      reason text NOT NULL,
      start_offset_sec integer NOT NULL,
      end_offset_sec integer NOT NULL,
      score integer NOT NULL DEFAULT 0,
      metadata text,
      created_at timestamp NOT NULL DEFAULT now()
    );`,
    `CREATE INDEX IF NOT EXISTS stream_auto_clips_stream_idx ON stream_auto_clips (stream_id);`,
    `CREATE INDEX IF NOT EXISTS stream_auto_clips_host_idx ON stream_auto_clips (host_id);`,
    `CREATE INDEX IF NOT EXISTS stream_auto_clips_created_idx ON stream_auto_clips (created_at);`,
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

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    if (process.env.NODE_ENV === "production") {
      log("ADMIN_PASSWORD env var not set — skipping admin password sync (REQUIRED for first setup)", "db");
      // In production, if admin doesn't exist yet and no password is set, abort
    } else {
      log("⚠️  WARNING: ADMIN_PASSWORD not set — set it in .env for production", "db");
    }
  }

  if (!adminPassword) return; // Don't create/update admin without explicit password

  const adminHash = bcrypt.hashSync(adminPassword, 12);

  try {
    const [existing] = await d
      .select()
      .from(admins)
      .where(eq(admins.username, "admin"))
      .limit(1);

    if (!existing) {
      if (!adminPassword) {
        log("No admin user exists and ADMIN_PASSWORD not set — set ADMIN_PASSWORD env var to create default admin", "db");
        return;
      }
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
      // Only sync password when ADMIN_PASSWORD env var is explicitly set
      if (adminPassword) {
        await d
          .update(admins)
          .set({ passwordHash: adminHash, updatedAt: new Date() })
          .where(eq(admins.username, "admin"));
        log("Admin password synced from ADMIN_PASSWORD env var", "db");
      } else {
        log("Default admin already exists, keeping existing password", "db");
      }
    }
  } catch (err: any) {
    log(`Failed to ensure admin: ${err.message}`, "db");
  }
}
