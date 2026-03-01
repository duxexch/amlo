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
      max: parseInt(process.env.DB_POOL_MAX || "20", 10),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
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
 */
export async function isDatabaseConnected(): Promise<boolean> {
  const p = getPool();
  if (!p) return false;

  try {
    const client = await p.connect();
    await client.query("SELECT 1");
    client.release();
    return true;
  } catch {
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
  ];

  try {
    const client = await p.connect();
    for (const sql of constraints) {
      await client.query(sql);
    }
    client.release();
    log("Database CHECK constraints applied", "db");
  } catch (err: any) {
    log(`Failed to apply constraints: ${err.message}`, "db");
  }
}
