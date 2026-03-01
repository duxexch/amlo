/**
 * Aplo — Production Environment Validation
 * Validates all required environment variables at startup using Zod.
 * Prevents the server from starting with missing/invalid configuration.
 */
import { z } from "zod";

const envSchema = z.object({
  // ── Server ──
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),

  // ── Database ──
  DATABASE_URL: z.string().url().optional(),
  POSTGRES_DB: z.string().optional(),
  POSTGRES_USER: z.string().optional(),
  POSTGRES_PASSWORD: z.string().optional(),

  // ── Redis ──
  REDIS_URL: z.string().optional(),
  REDIS_PASSWORD: z.string().optional(),

  // ── Security — REQUIRED in production ──
  SESSION_SECRET: z.string().min(32).optional(),
  JWT_SECRET: z.string().min(32).optional(),
  JWT_EXPIRES_IN: z.string().default("7d"),
  ENCRYPTION_SECRET: z.string().length(64).optional(), // 32-byte hex

  // ── CORS ──
  CORS_ORIGIN: z.string().url().optional(),

  // ── Admin defaults ──
  ADMIN_USERNAME: z.string().optional(),
  ADMIN_PASSWORD: z.string().optional(),
});

export type EnvConfig = z.infer<typeof envSchema>;

let _config: EnvConfig | null = null;

/**
 * Parse and validate environment variables.
 * In production, enforces mandatory fields.
 */
export function validateEnv(): EnvConfig {
  if (_config) return _config;

  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    console.error(`\n❌ Invalid environment configuration:\n${formatted}\n`);
    process.exit(1);
  }

  const config = result.data;

  // ── Production-only mandatory checks ──
  if (config.NODE_ENV === "production") {
    const missing: string[] = [];

    if (!config.DATABASE_URL) missing.push("DATABASE_URL");
    if (!config.REDIS_URL) missing.push("REDIS_URL");
    if (!config.SESSION_SECRET) missing.push("SESSION_SECRET");
    if (!config.JWT_SECRET) missing.push("JWT_SECRET");
    if (!config.ENCRYPTION_SECRET) missing.push("ENCRYPTION_SECRET");
    if (!config.CORS_ORIGIN) missing.push("CORS_ORIGIN");

    if (missing.length > 0) {
      console.error(
        `\n❌ Missing required production env vars:\n${missing.map((m) => `  • ${m}`).join("\n")}\n` +
        `Copy .env.example to .env and fill in all values.\n`
      );
      process.exit(1);
    }

    // Warn about weak secrets
    if (config.SESSION_SECRET && config.SESSION_SECRET.length < 48) {
      console.warn("⚠️  SESSION_SECRET should be at least 48 characters for production");
    }
    if (config.JWT_SECRET && config.JWT_SECRET.length < 48) {
      console.warn("⚠️  JWT_SECRET should be at least 48 characters for production");
    }
  }

  _config = config;
  return config;
}

/**
 * Get validated config (must call validateEnv() first).
 */
export function getConfig(): EnvConfig {
  if (!_config) return validateEnv();
  return _config;
}
