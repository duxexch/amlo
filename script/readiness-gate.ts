// @ts-nocheck
import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

type GateCheck = {
    name: string;
    pass: boolean;
    details?: string;
};

function loadEnv(filePath: string): Record<string, string> {
    const abs = path.resolve(filePath);
    if (!fs.existsSync(abs)) {
        throw new Error(`Missing env file: ${abs}`);
    }
    const raw = fs.readFileSync(abs, "utf8");
    return dotenv.parse(raw);
}

function asInt(v: string | undefined): number {
    if (!v) return Number.NaN;
    return Number.parseInt(v, 10);
}

function runChecks(env: Record<string, string>, strictSecrets: boolean): GateCheck[] {
    const checks: GateCheck[] = [];

    const clusterWorkers = asInt(env.CLUSTER_WORKERS);
    checks.push({
        name: "Cluster workers in safe range",
        pass: Number.isFinite(clusterWorkers) && clusterWorkers >= 1 && clusterWorkers <= 8,
        details: `CLUSTER_WORKERS=${env.CLUSTER_WORKERS || "missing"}`,
    });

    const dbPoolMax = asInt(env.DB_POOL_MAX);
    checks.push({
        name: "DB pool max configured",
        pass: Number.isFinite(dbPoolMax) && dbPoolMax >= 10 && dbPoolMax <= 80,
        details: `DB_POOL_MAX=${env.DB_POOL_MAX || "missing"}`,
    });

    const socketCap = asInt(env.SOCKET_MAX_CONNECTIONS_PER_IP);
    checks.push({
        name: "Socket per-IP cap configured",
        pass: Number.isFinite(socketCap) && socketCap >= 50 && socketCap <= 5000,
        details: `SOCKET_MAX_CONNECTIONS_PER_IP=${env.SOCKET_MAX_CONNECTIONS_PER_IP || "missing"}`,
    });

    const streamCap = asInt(env.STREAM_MAX_PARTICIPANTS_PER_ROOM);
    checks.push({
        name: "Stream participant cap configured",
        pass: Number.isFinite(streamCap) && streamCap >= 5 && streamCap <= 5000,
        details: `STREAM_MAX_PARTICIPANTS_PER_ROOM=${env.STREAM_MAX_PARTICIPANTS_PER_ROOM || "missing"}`,
    });

    const turnServers = (env.LIVEKIT_TURN_SERVERS || "").toLowerCase();
    checks.push({
        name: "TURN transport triple configured (udp+tcp+tls)",
        pass:
            turnServers.includes("transport=udp") &&
            turnServers.includes("transport=tcp") &&
            turnServers.includes("turns:"),
        details: "LIVEKIT_TURN_SERVERS",
    });

    const turnIp = (env.TURN_EXTERNAL_IP || "").trim();
    checks.push({
        name: strictSecrets ? "TURN external IP is real value" : "TURN external IP is configured",
        pass: strictSecrets
            ? (!!turnIp && !turnIp.includes("REPLACE") && !turnIp.includes("CHANGE_ME"))
            : !!turnIp,
        details: `TURN_EXTERNAL_IP=${env.TURN_EXTERNAL_IP || "missing"}`,
    });

    checks.push({
        name: "CORS includes primary+www domains",
        pass:
            (env.CORS_ORIGIN || "").includes("https://mrco.live") &&
            (env.CORS_ORIGIN || "").includes("https://www.mrco.live"),
        details: `CORS_ORIGIN=${env.CORS_ORIGIN || "missing"}`,
    });

    checks.push({
        name: "APK/AAB publication enabled",
        pass: (env.APP_DOWNLOAD_ENABLED || "").toLowerCase() === "true" &&
            (env.APK_ENABLED || "").toLowerCase() === "true" &&
            (env.AAB_ENABLED || "").toLowerCase() === "true",
        details: `APP_DOWNLOAD_ENABLED=${env.APP_DOWNLOAD_ENABLED || "missing"}`,
    });

    checks.push({
        name: "APK/AAB URLs are HTTPS",
        pass:
            (env.APK_URL || "").startsWith("https://") &&
            (env.AAB_URL || "").startsWith("https://"),
        details: "APK_URL/AAB_URL",
    });

    const secretsPass = strictSecrets
        ? (
            !!(env.SESSION_SECRET || "") && !(env.SESSION_SECRET || "").startsWith("REPLACE") && !(env.SESSION_SECRET || "").startsWith("CHANGE_ME") &&
            !!(env.JWT_SECRET || "") && !(env.JWT_SECRET || "").startsWith("REPLACE") && !(env.JWT_SECRET || "").startsWith("CHANGE_ME") &&
            !!(env.ENCRYPTION_SECRET || "") && !(env.ENCRYPTION_SECRET || "").startsWith("REPLACE") && !(env.ENCRYPTION_SECRET || "").startsWith("CHANGE_ME") &&
            !!(env.TURN_SECRET || "") && !(env.TURN_SECRET || "").startsWith("REPLACE") && !(env.TURN_SECRET || "").startsWith("CHANGE_ME")
        )
        : (
            !!(env.SESSION_SECRET || "") &&
            !!(env.JWT_SECRET || "") &&
            !!(env.ENCRYPTION_SECRET || "") &&
            !!(env.TURN_SECRET || "")
        );

    checks.push({
        name: strictSecrets ? "Core security secrets are real values" : "Core security secrets are present",
        pass: secretsPass,
        details: "SESSION_SECRET/JWT_SECRET/ENCRYPTION_SECRET/TURN_SECRET",
    });

    return checks;
}

function main() {
    const args = process.argv.slice(2);
    const envArgIdx = args.findIndex((a) => a === "--env");
    const strictSecrets = args.includes("--strict-secrets");
    const envPath = envArgIdx >= 0 && args[envArgIdx + 1]
        ? args[envArgIdx + 1]
        : ".env.production.recommended";

    const env = loadEnv(envPath);
    const checks = runChecks(env, strictSecrets);
    const failed = checks.filter((c) => !c.pass);

    process.stdout.write("=== AMLO Production Readiness Gate ===\n");
    process.stdout.write(`Target env: ${path.resolve(envPath)}\n`);
    process.stdout.write(`Secret mode: ${strictSecrets ? "strict" : "template-safe"}\n`);
    process.stdout.write(`Checks: ${checks.length}, Failed: ${failed.length}\n\n`);

    for (const c of checks) {
        process.stdout.write(`${c.pass ? "PASS" : "FAIL"}: ${c.name}`);
        if (c.details) {
            process.stdout.write(` (${c.details})`);
        }
        process.stdout.write("\n");
    }

    if (failed.length > 0) {
        process.stdout.write("\nRESULT: FAILED\n");
        process.exit(1);
    }

    process.stdout.write("\nRESULT: PASSED\n");
}

main();
