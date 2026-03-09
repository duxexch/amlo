#!/usr/bin/env tsx
import "dotenv/config";
import autocannon from "autocannon";
import bcrypt from "bcryptjs";
import { Client } from "pg";

type Scenario = {
    key: string;
    label: string;
    path: string;
    method: "GET" | "POST";
    bodyFactory?: (idx: number) => any;
    cookieByConnection?: boolean;
    conversationByConnection?: boolean;
};

type BenchRow = {
    scenario: string;
    connections: number;
    rps: number;
    p95: number;
    p99: number;
    avg: number;
    errors: number;
    timeouts: number;
    non2xx: number;
    fiveXx: number;
    passed: boolean;
};

const args = process.argv.slice(2);
const TARGET = args.find((a) => a.startsWith("--target="))?.split("=")[1]
    || args[args.indexOf("--target") + 1]
    || "http://localhost:3000";
const DURATION = Number(args.find((a) => a.startsWith("--duration="))?.split("=")[1]
    || args[args.indexOf("--duration") + 1]
    || "10");
const MAX_CONN = Number(args.find((a) => a.startsWith("--max-conn="))?.split("=")[1]
    || args[args.indexOf("--max-conn") + 1]
    || "200");
const POOL_SIZE = Number(args.find((a) => a.startsWith("--pool="))?.split("=")[1]
    || args[args.indexOf("--pool") + 1]
    || "40");

const CONNECT_LEVELS = [10, 25, 50, 75, 100, 150, 200, 300, 400].filter((n) => n <= MAX_CONN);
const PASSWORD = "LoadTest2026!";
const DATABASE_URL = process.env.DATABASE_URL || "";

function log(msg: string) {
    console.log(msg);
}

function nowTag() {
    return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
}

async function registerOrLoginUser(username: string, email: string): Promise<string> {
    if (!DATABASE_URL) {
        throw new Error("DATABASE_URL is required for load-test user bootstrap");
    }

    const client = new Client({ connectionString: DATABASE_URL });
    await client.connect();
    try {
        const passwordHash = await bcrypt.hash(PASSWORD, 10);
        await client.query(
            `INSERT INTO users (username, email, password_hash, display_name)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (username)
             DO UPDATE SET email = EXCLUDED.email, password_hash = EXCLUDED.password_hash, display_name = EXCLUDED.display_name`,
            [username, email, passwordHash, username],
        );
    } finally {
        await client.end();
    }

    const loginRes = await fetch(`${TARGET}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: username, password: PASSWORD }),
    });

    const setCookie = loginRes.headers.get("set-cookie") || "";
    const cookie = setCookie.split(",").map((s) => s.trim())[0]?.split(";")[0] || "";
    if (!cookie) {
        const txt = await loginRes.text().catch(() => "");
        throw new Error(`Login failed for ${username}: ${loginRes.status} ${txt.slice(0, 200)}`);
    }
    return cookie;
}

async function setupUsersAndConversations(poolSize: number): Promise<{ cookies: string[]; convIds: string[]; receiverId: string }> {
    const seed = nowTag();
    const senderUsername = `lts_${seed}`.slice(0, 40);
    const senderEmail = `${senderUsername}@test.ablox.dev`;
    const senderCookie = await registerOrLoginUser(senderUsername, senderEmail);

    const receiverUsername = `ltr_${seed}`.slice(0, 40);
    const receiverEmail = `${receiverUsername}@test.ablox.dev`;
    await registerOrLoginUser(receiverUsername, receiverEmail);

    const meRes = await fetch(`${TARGET}/api/auth/check-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: receiverEmail }),
    });
    const _ignore = await meRes.json().catch(() => ({}));

    const receiverMe = await fetch(`${TARGET}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login: receiverUsername, password: PASSWORD }),
    });
    const receiverCookie = (receiverMe.headers.get("set-cookie") || "").split(",")[0]?.split(";")[0] || "";
    const meRes2 = await fetch(`${TARGET}/api/auth/me`, { headers: { Cookie: receiverCookie } });
    const meJson = await meRes2.json();
    const receiverId = String(meJson?.data?.user?.id || "");
    if (!receiverId) throw new Error("Failed to resolve receiverId from /api/auth/me");

    const convRes = await fetch(`${TARGET}/api/social/conversations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Cookie: senderCookie },
        body: JSON.stringify({ receiverId }),
    });
    const convJson = await convRes.json().catch(() => ({}));
    const convId = String(convJson?.data?.id || "");
    if (!convId) throw new Error("Failed creating sender->receiver conversation");

    const cookies = Array.from({ length: Math.max(1, poolSize) }, () => senderCookie);
    const convIds = Array.from({ length: Math.max(1, poolSize) }, () => convId);

    return { cookies, convIds, receiverId };
}

function getCounts(result: autocannon.Result): { non2xx: number; fiveXx: number } {
    const r: any = result as any;
    const s1 = Number(r["1xx"] || 0);
    const s2 = Number(r["2xx"] || 0);
    const s3 = Number(r["3xx"] || 0);
    const s4 = Number(r["4xx"] || 0);
    const s5 = Number(r["5xx"] || 0);
    const total = s1 + s2 + s3 + s4 + s5;
    const non2xx = total > 0 ? total - s2 : 0;
    return { non2xx, fiveXx: s5 };
}

async function runAutocannonScenario(
    scenario: Scenario,
    connections: number,
    cookies: string[],
    convIds: string[],
): Promise<BenchRow> {
    return new Promise((resolve, reject) => {
        const instance = autocannon({
            url: `${TARGET}${scenario.path}`,
            method: scenario.method,
            connections,
            duration: DURATION,
            pipelining: 1,
            timeout: 15,
            setupClient: (client: any) => {
                const idx = Number(client?.id || 0) % Math.max(1, cookies.length);
                const cookie = scenario.cookieByConnection ? cookies[idx] : cookies[0];
                const convId = scenario.conversationByConnection ? convIds[idx % Math.max(1, convIds.length)] : convIds[0];

                const headers: Record<string, string> = {
                    "Content-Type": "application/json",
                    Cookie: cookie,
                };
                client.setHeaders(headers);

                if (scenario.method === "POST" && scenario.bodyFactory) {
                    const rawBody = scenario.bodyFactory(idx);
                    const body = JSON.parse(JSON.stringify(rawBody).replaceAll("__CONV_ID__", convId));
                    client.setBody(JSON.stringify(body));
                }
            },
        }, (err, result) => {
            if (err) {
                reject(err);
                return;
            }

            const { non2xx, fiveXx } = getCounts(result);
            const row: BenchRow = {
                scenario: scenario.label,
                connections,
                rps: Math.round(result.requests.average),
                avg: Number(result.latency.average.toFixed(2)),
                p95: Number((result.latency as any).p97_5?.toFixed?.(2) ?? result.latency.p99.toFixed(2)),
                p99: Number(result.latency.p99.toFixed(2)),
                errors: result.errors,
                timeouts: result.timeouts,
                non2xx,
                fiveXx,
                passed: result.timeouts === 0 && result.errors === 0 && fiveXx === 0 && result.latency.p99 < 1200,
            };
            resolve(row);
        });

        autocannon.track(instance, { renderProgressBar: true, renderLatencyTable: false, renderResultsTable: false });
    });
}

async function runCapacitySweep(scenario: Scenario, cookies: string[], convIds: string[]): Promise<{ rows: BenchRow[]; maxStable: number }> {
    const rows: BenchRow[] = [];
    let maxStable = 0;

    for (const c of CONNECT_LEVELS) {
        log(`\n[${scenario.label}] Running at ${c} connections for ${DURATION}s ...`);
        const row = await runAutocannonScenario(scenario, c, cookies, convIds);
        rows.push(row);

        log(`  RPS=${row.rps} avg=${row.avg}ms p99=${row.p99}ms non2xx=${row.non2xx} 5xx=${row.fiveXx} errors=${row.errors} timeouts=${row.timeouts}`);

        if (row.passed) {
            maxStable = c;
        } else {
            log(`  -> stop escalation for ${scenario.label} (threshold exceeded)`);
            break;
        }
    }

    return { rows, maxStable };
}

function printSummary(title: string, rows: BenchRow[], maxStable: number) {
    log(`\n==== ${title} ====`);
    for (const r of rows) {
        log(`c=${r.connections} rps=${r.rps} avg=${r.avg} p95=${r.p95} p99=${r.p99} non2xx=${r.non2xx} 5xx=${r.fiveXx} pass=${r.passed ? "yes" : "no"}`);
    }
    log(`MAX_STABLE_CONNECTIONS=${maxStable}`);
}

async function main() {
    log(`Target: ${TARGET}`);
    log(`Duration per step: ${DURATION}s`);
    log(`Max connections: ${MAX_CONN}`);
    log(`User pool size: ${POOL_SIZE}`);

    const health = await fetch(`${TARGET}/api/health`).then((r) => r.ok).catch(() => false);
    if (!health) throw new Error("Target is not healthy: /api/health failed");

    log("\nSetting up authenticated user pool and conversations...");
    const { cookies, convIds } = await setupUsersAndConversations(POOL_SIZE);
    log(`Setup done: cookies=${cookies.length}, conversations=${convIds.length}`);

    const scenarios: Scenario[] = [
        {
            key: "chat-read",
            label: "Chat Read (/social/conversations/:id/messages)",
            path: "/api/social/conversations/__CONV_ID__/messages?limit=30",
            method: "GET",
            cookieByConnection: true,
            conversationByConnection: true,
        },
        {
            key: "friends-list",
            label: "Friends Read (/social/friends)",
            path: "/api/social/friends",
            method: "GET",
            cookieByConnection: true,
        },
        {
            key: "streams-live",
            label: "Stream Create Type=live (scheduled)",
            path: "/api/social/streams/create",
            method: "POST",
            cookieByConnection: true,
            bodyFactory: (idx) => ({
                title: `LT Live ${Date.now()}_${idx}`,
                type: "live",
                category: "chat",
                tags: ["load", "live"],
                scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            }),
        },
        {
            key: "streams-audio",
            label: "Stream Create Type=audio (scheduled)",
            path: "/api/social/streams/create",
            method: "POST",
            cookieByConnection: true,
            bodyFactory: (idx) => ({
                title: `LT Audio ${Date.now()}_${idx}`,
                type: "audio",
                category: "music",
                tags: ["load", "audio"],
                scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            }),
        },
        {
            key: "streams-video-call",
            label: "Stream Create Type=video_call (scheduled)",
            path: "/api/social/streams/create",
            method: "POST",
            cookieByConnection: true,
            bodyFactory: (idx) => ({
                title: `LT VideoCall ${Date.now()}_${idx}`,
                type: "video_call",
                category: "chat",
                tags: ["load", "video_call"],
                scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
            }),
        },
    ];

    const allRows: BenchRow[] = [];
    const maxCaps: Record<string, number> = {};

    for (const scenario of scenarios) {
        const adaptedScenario: Scenario = {
            ...scenario,
            path: scenario.path.includes("__CONV_ID__")
                ? scenario.path.replace("__CONV_ID__", convIds[0])
                : scenario.path,
        };

        const { rows, maxStable } = await runCapacitySweep(adaptedScenario, cookies, convIds);
        allRows.push(...rows);
        maxCaps[scenario.label] = maxStable;
        printSummary(scenario.label, rows, maxStable);
    }

    log("\n================ FINAL CAPACITY SUMMARY ================");
    Object.entries(maxCaps).forEach(([k, v]) => log(`${k}: ${v} concurrent connections (stable threshold)`));

    const failures = allRows.filter((r) => !r.passed);
    if (failures.length > 0) {
        log("\nFirst failure points:");
        for (const f of failures) {
            log(`- ${f.scenario} @ c=${f.connections}: p99=${f.p99}ms, 5xx=${f.fiveXx}, non2xx=${f.non2xx}, errors=${f.errors}, timeouts=${f.timeouts}`);
        }
    }
}

main().catch((err) => {
    console.error("Load test failed:", err?.message || err);
    process.exit(1);
});
