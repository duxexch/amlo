// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

type Check = {
  key: string;
  valid: boolean;
  message?: string;
};

function readEnvFile(filePath: string): Record<string, string> {
  const absPath = path.resolve(filePath);
  if (!fs.existsSync(absPath)) {
    throw new Error(`Env file not found: ${absPath}`);
  }
  const raw = fs.readFileSync(absPath, "utf8");
  return dotenv.parse(raw);
}

function hasNonEmpty(env: Record<string, string>, key: string): Check {
  const value = env[key];
  return {
    key,
    valid: typeof value === "string" && value.trim().length > 0,
    message: value ? undefined : "missing or empty",
  };
}

function validateTurnServers(env: Record<string, string>): Check {
  const key = "LIVEKIT_TURN_SERVERS";
  const raw = (env[key] || "").trim();
  if (!raw) return { key, valid: false, message: "missing or empty" };

  const normalized = raw.toLowerCase();
  const mustHave = [
    "turn:turn.mrco.live:3478?transport=udp",
    "turn:turn.mrco.live:3478?transport=tcp",
    "turns:turn.mrco.live:5349?transport=tcp",
  ];

  const missing = mustHave.filter((item) => !normalized.includes(item));
  if (missing.length > 0) {
    return {
      key,
      valid: false,
      message: `missing required TURN URI(s): ${missing.join(", ")}`,
    };
  }

  return { key, valid: true };
}

function validateCors(env: Record<string, string>): Check {
  const key = "CORS_ORIGIN";
  const raw = (env[key] || "").trim().toLowerCase();
  if (!raw) return { key, valid: false, message: "missing or empty" };

  const required = ["https://mrco.live", "https://www.mrco.live"];
  const missing = required.filter((item) => !raw.includes(item));
  if (missing.length > 0) {
    return {
      key,
      valid: false,
      message: `missing required origin(s): ${missing.join(", ")}`,
    };
  }

  return { key, valid: true };
}

function validateNumericRange(
  env: Record<string, string>,
  key: string,
  min: number,
  max: number
): Check {
  const raw = (env[key] || "").trim();
  if (!raw) return { key, valid: false, message: "missing or empty" };

  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) return { key, valid: false, message: "not a number" };
  if (parsed < min || parsed > max) {
    return { key, valid: false, message: `out of range (${min}-${max})` };
  }
  return { key, valid: true };
}

function validateOtpEmailConfig(env: Record<string, string>): Check[] {
  const otpEnabled = (env.OTP_ENABLED || "").toLowerCase() === "true";
  const otpProvider = (env.OTP_PROVIDER || "").toLowerCase();
  const emailEnabled = (env.OTP_EMAIL_ENABLED || "").toLowerCase() === "true";

  if (!otpEnabled || (otpProvider !== "email" && !emailEnabled)) {
    return [];
  }

  return [
    hasNonEmpty(env, "SMTP_HOST"),
    validateNumericRange(env, "SMTP_PORT", 1, 65535),
    hasNonEmpty(env, "SMTP_USER"),
    hasNonEmpty(env, "SMTP_PASS"),
    hasNonEmpty(env, "SMTP_SENDER_NAME"),
    hasNonEmpty(env, "SMTP_SENDER_EMAIL"),
  ];
}

function main() {
  const args = process.argv.slice(2);
  const envArgIndex = args.findIndex((arg) => arg === "--env");
  const envPath = envArgIndex >= 0 && args[envArgIndex + 1]
    ? args[envArgIndex + 1]
    : ".env.production.recommended";

  const env = readEnvFile(envPath);

  const checks: Check[] = [
    hasNonEmpty(env, "LIVEKIT_PUBLIC_URL"),
    hasNonEmpty(env, "LIVEKIT_URL"),
    hasNonEmpty(env, "TURN_EXTERNAL_IP"),
    hasNonEmpty(env, "LIVEKIT_STUN_SERVERS"),
    hasNonEmpty(env, "APK_URL"),
    hasNonEmpty(env, "AAB_URL"),
    validateCors(env),
    validateTurnServers(env),
    validateNumericRange(env, "CLUSTER_WORKERS", 1, 8),
    validateNumericRange(env, "DB_POOL_MAX", 5, 80),
    validateNumericRange(env, "SOCKET_MAX_CONNECTIONS_PER_IP", 50, 5000),
    validateNumericRange(env, "STREAM_MAX_PARTICIPANTS_PER_ROOM", 5, 5000),
    validateNumericRange(env, "STREAM_ROOM_EMPTY_TIMEOUT_SEC", 60, 3600),
    validateNumericRange(env, "STREAM_FOLLOWER_NOTIFY_LIMIT", 20, 5000),
    validateNumericRange(env, "STREAM_AUTOSTART_BATCH_LIMIT", 1, 200),
    ...validateOtpEmailConfig(env),
  ];

  const failed = checks.filter((c) => !c.valid);

  process.stdout.write(`=== Universal Env Validation ===\n`);
  process.stdout.write(`Target file: ${path.resolve(envPath)}\n`);
  process.stdout.write(`Checks: ${checks.length}, Failed: ${failed.length}\n\n`);

  for (const c of checks) {
    if (c.valid) {
      process.stdout.write(`PASS: ${c.key}\n`);
    } else {
      process.stdout.write(`FAIL: ${c.key} - ${c.message || "invalid"}\n`);
    }
  }

  if (failed.length > 0) {
    process.stdout.write(`\nRESULT: FAILED\n`);
    process.exit(1);
  }

  process.stdout.write(`\nRESULT: PASSED\n`);
}

main();
