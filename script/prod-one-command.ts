// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import dotenv from "dotenv";

type EnvMap = Record<string, string>;

function run(command: string, env: Record<string, string>, label: string): void {
    process.stdout.write(`\n=== ${label} ===\n`);
    process.stdout.write(`${command}\n`);
    const r = spawnSync(command, {
        shell: true,
        stdio: "inherit",
        env,
    });
    if (r.status !== 0) {
        throw new Error(`${label} failed (exit ${r.status ?? 1})`);
    }
}

function hasPlaceholder(v: string | undefined): boolean {
    const x = String(v || "").trim();
    if (!x) return true;
    return x.startsWith("REPLACE_") || x.startsWith("CHANGE_ME");
}

function isBooleanLike(v: string | undefined): boolean {
    const x = String(v || "").trim().toLowerCase();
    return x === "true" || x === "false";
}

function isIntegerInRange(v: string | undefined, min: number, max: number): boolean {
    const x = String(v || "").trim();
    if (!x) return false;
    const n = Number.parseInt(x, 10);
    return Number.isFinite(n) && n >= min && n <= max;
}

function loadEnvFileMap(filePath: string): EnvMap {
    return dotenv.parse(fs.readFileSync(filePath, "utf8"));
}

function upsertEnvEntriesPreserve(filePath: string, updates: EnvMap): boolean {
    const raw = fs.readFileSync(filePath, "utf8");
    const lines = raw.split(/\r?\n/);
    const lineIndex = new Map<string, number>();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line || line.startsWith("#")) continue;
        const m = /^([A-Za-z_][A-Za-z0-9_]*)=(.*)$/.exec(line);
        if (!m) continue;
        lineIndex.set(m[1], i);
    }

    let changed = false;
    for (const [key, value] of Object.entries(updates)) {
        if (typeof value !== "string") continue;
        const i = lineIndex.get(key);
        const nextLine = `${key}=${value}`;
        if (typeof i === "number") {
            if (lines[i] !== nextLine) {
                lines[i] = nextLine;
                changed = true;
            }
        } else {
            lines.push(nextLine);
            changed = true;
        }
    }

    if (!changed) return false;

    let out = lines.join("\n");
    if (!out.endsWith("\n")) out += "\n";
    fs.writeFileSync(filePath, out, "utf8");
    return true;
}

function bootstrapEnvFromTemplate(envPath: string, templatePath: string): { changed: boolean; created: boolean } {
    if (!fs.existsSync(templatePath)) {
        throw new Error("Missing template .env.production.high-power.template");
    }

    if (!fs.existsSync(envPath)) {
        fs.copyFileSync(templatePath, envPath);
        process.stdout.write(`Created ${path.basename(envPath)} from .env.production.high-power.template\n`);
        return { changed: true, created: true };
    }

    const templateEnv = loadEnvFileMap(templatePath);
    const currentEnv = loadEnvFileMap(envPath);
    const updates: EnvMap = {};

    const requiredKeys = [
        "SOCIAL_WRITE_LIMIT_DISABLED",
        "LIVEKIT_PUBLIC_URL",
        "LIVEKIT_URL",
        "TURN_EXTERNAL_IP",
        "LIVEKIT_STUN_SERVERS",
        "CORS_ORIGIN",
        "LIVEKIT_TURN_SERVERS",
        "SOCIAL_WRITE_LIMIT_MAX",
        "SOCIAL_WRITE_LIMIT_WINDOW_MS",
        "STREAM_MAX_PARTICIPANTS_PER_ROOM",
        "STREAM_ROOM_EMPTY_TIMEOUT_SEC",
        "STREAM_FOLLOWER_NOTIFY_LIMIT",
        "STREAM_AUTOSTART_BATCH_LIMIT",
        "SMTP_HOST",
        "SMTP_PORT",
        "SMTP_USER",
        "SMTP_PASS",
        "SMTP_SENDER_NAME",
        "SMTP_SENDER_EMAIL",
    ];

    for (const key of requiredKeys) {
        const value = (currentEnv[key] || "").trim();
        if (!value && typeof templateEnv[key] === "string" && templateEnv[key].trim()) {
            updates[key] = templateEnv[key];
        }
    }

    if (!isBooleanLike(currentEnv.SOCIAL_WRITE_LIMIT_DISABLED) && templateEnv.SOCIAL_WRITE_LIMIT_DISABLED) {
        updates.SOCIAL_WRITE_LIMIT_DISABLED = templateEnv.SOCIAL_WRITE_LIMIT_DISABLED;
    }

    if (!isIntegerInRange(currentEnv.SOCKET_MAX_CONNECTIONS_PER_IP, 50, 5000) && templateEnv.SOCKET_MAX_CONNECTIONS_PER_IP) {
        updates.SOCKET_MAX_CONNECTIONS_PER_IP = templateEnv.SOCKET_MAX_CONNECTIONS_PER_IP;
    }

    if (!isIntegerInRange(currentEnv.SOCIAL_WRITE_LIMIT_MAX, 10, 500) && templateEnv.SOCIAL_WRITE_LIMIT_MAX) {
        updates.SOCIAL_WRITE_LIMIT_MAX = templateEnv.SOCIAL_WRITE_LIMIT_MAX;
    }

    if (!isIntegerInRange(currentEnv.SOCIAL_WRITE_LIMIT_WINDOW_MS, 1000, 300000) && templateEnv.SOCIAL_WRITE_LIMIT_WINDOW_MS) {
        updates.SOCIAL_WRITE_LIMIT_WINDOW_MS = templateEnv.SOCIAL_WRITE_LIMIT_WINDOW_MS;
    }

    if (!isIntegerInRange(currentEnv.STREAM_MAX_PARTICIPANTS_PER_ROOM, 5, 5000) && templateEnv.STREAM_MAX_PARTICIPANTS_PER_ROOM) {
        updates.STREAM_MAX_PARTICIPANTS_PER_ROOM = templateEnv.STREAM_MAX_PARTICIPANTS_PER_ROOM;
    }

    if (!isIntegerInRange(currentEnv.STREAM_ROOM_EMPTY_TIMEOUT_SEC, 60, 3600) && templateEnv.STREAM_ROOM_EMPTY_TIMEOUT_SEC) {
        updates.STREAM_ROOM_EMPTY_TIMEOUT_SEC = templateEnv.STREAM_ROOM_EMPTY_TIMEOUT_SEC;
    }

    if (!isIntegerInRange(currentEnv.STREAM_FOLLOWER_NOTIFY_LIMIT, 20, 5000) && templateEnv.STREAM_FOLLOWER_NOTIFY_LIMIT) {
        updates.STREAM_FOLLOWER_NOTIFY_LIMIT = templateEnv.STREAM_FOLLOWER_NOTIFY_LIMIT;
    }

    if (!isIntegerInRange(currentEnv.STREAM_AUTOSTART_BATCH_LIMIT, 1, 200) && templateEnv.STREAM_AUTOSTART_BATCH_LIMIT) {
        updates.STREAM_AUTOSTART_BATCH_LIMIT = templateEnv.STREAM_AUTOSTART_BATCH_LIMIT;
    }

    if (!isIntegerInRange(currentEnv.SMTP_PORT, 1, 65535) && templateEnv.SMTP_PORT) {
        updates.SMTP_PORT = templateEnv.SMTP_PORT;
    }

    const changed = upsertEnvEntriesPreserve(envPath, updates);

    if (changed) {
        process.stdout.write(`Updated ${path.basename(envPath)} with missing/invalid production keys from template\n`);
    }

    return { changed, created: false };
}

function main() {
    const args = process.argv.slice(2);
    const envIdx = args.findIndex((a) => a === "--env");
    const envFile = envIdx >= 0 && args[envIdx + 1] ? args[envIdx + 1] : ".env.production";
    const dryRun = args.includes("--dry-run");

    const root = process.cwd();
    const envPath = path.resolve(root, envFile);
    const templatePath = path.resolve(root, ".env.production.high-power.template");

    bootstrapEnvFromTemplate(envPath, templatePath);

    const parsed = dotenv.parse(fs.readFileSync(envPath, "utf8"));
    const mergedEnv: Record<string, string> = {
        ...process.env,
        ...parsed,
        NODE_ENV: "production",
        DOTENV_CONFIG_PATH: envPath,
    };

    const strictKeys = [
        "SESSION_SECRET",
        "JWT_SECRET",
        "ENCRYPTION_SECRET",
        "TURN_SECRET",
        "TURN_EXTERNAL_IP",
        "DATABASE_URL",
        "REDIS_URL",
    ];

    const strictReady = strictKeys.every((k) => !hasPlaceholder(mergedEnv[k]));

    // Always validate against target production env file.
    run(`npm run prod:validate:universal -- --env ${envFile}`, mergedEnv, "Universal validation (template-safe)");
    run(`npm run readiness:gate -- --env ${envFile}`, mergedEnv, "Readiness gate (template-safe)");

    if (strictReady) {
        run(`npm run prod:validate:universal:strict -- --env ${envFile}`, mergedEnv, "Universal validation (strict)");
        run(`npm run readiness:gate:strict -- --env ${envFile}`, mergedEnv, "Readiness gate (strict)");
    } else {
        process.stdout.write("\nStrict checks skipped: placeholders still exist in critical production keys.\n");
    }

    run("npm run build", mergedEnv, "Build production bundle");

    if (dryRun) {
        process.stdout.write("\nDry-run complete. Skipping server start.\n");
        return;
    }

    run("npm run start:cluster", mergedEnv, "Start production cluster");
}

try {
    main();
} catch (err: any) {
    process.stderr.write(`\nERROR: ${err?.message || err}\n`);
    process.exit(1);
}
