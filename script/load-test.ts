#!/usr/bin/env tsx
/**
 * ═══════════════════════════════════════════════════════════
 * Ablox — اختبار الضغط والتحمّل الشامل
 * Comprehensive Load & Stress Test Suite
 * ═══════════════════════════════════════════════════════════
 *
 * Tests:
 *  1. HTTP API Throughput (autocannon) — public + auth endpoints
 *  2. WebSocket Concurrency (socket.io-client) — concurrent connections + messaging
 *  3. Database Connection Pool stress
 *  4. Memory & CPU profiling under load
 *  5. Rate Limiter validation
 *
 * Usage:
 *   npx tsx script/load-test.ts [--target http://localhost:3000] [--duration 30]
 */

import autocannon from "autocannon";
import { io as ioClient, Socket } from "socket.io-client";
import http from "http";
import https from "https";
import os from "os";

// ── Configuration ──
const args = process.argv.slice(2);
const TARGET = args.find(a => a.startsWith("--target="))?.split("=")[1]
  || args[args.indexOf("--target") + 1]
  || "http://localhost:3000";
const DURATION = parseInt(
  args.find(a => a.startsWith("--duration="))?.split("=")[1]
  || args[args.indexOf("--duration") + 1]
  || "30", 10);

const isHTTPS = TARGET.startsWith("https");
const agent = isHTTPS
  ? new https.Agent({ rejectUnauthorized: false, keepAlive: true, maxSockets: 500 })
  : new http.Agent({ keepAlive: true, maxSockets: 500 });

// ── Colors / Formatting ──
const c = {
  reset: "\x1b[0m", bold: "\x1b[1m", dim: "\x1b[2m",
  red: "\x1b[31m", green: "\x1b[32m", yellow: "\x1b[33m",
  blue: "\x1b[34m", magenta: "\x1b[35m", cyan: "\x1b[36m",
  white: "\x1b[37m", bg: "\x1b[44m",
};

function header(text: string) {
  const line = "═".repeat(60);
  console.log(`\n${c.cyan}${line}${c.reset}`);
  console.log(`${c.bold}${c.white}  ${text}${c.reset}`);
  console.log(`${c.cyan}${line}${c.reset}\n`);
}

function subHeader(text: string) {
  console.log(`${c.yellow}  ▸ ${text}${c.reset}`);
}

function result(label: string, value: string | number, unit = "") {
  console.log(`    ${c.dim}${label}:${c.reset} ${c.bold}${c.green}${value}${c.reset} ${c.dim}${unit}${c.reset}`);
}

function warn(label: string, value: string | number, unit = "") {
  console.log(`    ${c.dim}${label}:${c.reset} ${c.bold}${c.yellow}${value}${c.reset} ${c.dim}${unit}${c.reset}`);
}

function fail(label: string, value: string | number, unit = "") {
  console.log(`    ${c.dim}${label}:${c.reset} ${c.bold}${c.red}${value}${c.reset} ${c.dim}${unit}${c.reset}`);
}

// ── Results storage ──
interface TestResult {
  name: string;
  category: string;
  requests?: number;
  rps?: number;
  latencyAvg?: number;
  latencyP99?: number;
  errors?: number;
  timeouts?: number;
  throughput?: number;
  connections?: number;
  messagesPerSec?: number;
  maxConcurrent?: number;
  notes?: string;
}

const results: TestResult[] = [];

// ── Helper: run autocannon ──
function runAutocannon(opts: {
  title: string;
  url: string;
  method?: string;
  body?: string;
  headers?: Record<string, string>;
  connections: number;
  duration: number;
  pipelining?: number;
  setupClient?: (client: any) => void;
}): Promise<autocannon.Result> {
  return new Promise((resolve, reject) => {
    const instance = autocannon({
      url: opts.url,
      method: (opts.method || "GET") as any,
      body: opts.body,
      headers: {
        "Content-Type": "application/json",
        ...(opts.headers || {}),
      },
      connections: opts.connections,
      duration: opts.duration,
      pipelining: opts.pipelining || 1,
      timeout: 10,
      setupClient: opts.setupClient,
    }, (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
    autocannon.track(instance, { renderProgressBar: true });
  });
}

// ── Helper: fetch JSON ──
async function fetchJson(url: string, opts?: RequestInit): Promise<any> {
  const res = await fetch(url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...opts?.headers },
  });
  return res.json();
}

// ── Helper: get server metrics ──
async function getMetrics(): Promise<Record<string, number>> {
  try {
    const res = await fetch(`${TARGET}/api/metrics`);
    const text = await res.text();
    const metrics: Record<string, number> = {};
    for (const line of text.split("\n")) {
      if (line.startsWith("#") || !line.trim()) continue;
      const [key, val] = line.split(" ");
      metrics[key] = parseFloat(val);
    }
    return metrics;
  } catch {
    return {};
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 1: Health Check Baseline
// ═══════════════════════════════════════════════════════════
async function testHealthCheck() {
  subHeader("1.1 Health Check — Baseline (1 connection)");
  const r = await runAutocannon({
    title: "Health Check",
    url: `${TARGET}/api/health`,
    connections: 1,
    duration: 5,
  });
  results.push({
    name: "Health Check (baseline)",
    category: "HTTP",
    requests: r.requests.total,
    rps: Math.round(r.requests.average),
    latencyAvg: r.latency.average,
    latencyP99: r.latency.p99,
    errors: r.errors,
    timeouts: r.timeouts,
    throughput: Math.round(r.throughput.average / 1024),
  });
  result("Avg RPS", Math.round(r.requests.average), "req/s");
  result("Latency (avg)", r.latency.average.toFixed(2), "ms");
  result("Latency (p99)", r.latency.p99.toFixed(2), "ms");
  result("Errors", r.errors);
}

// ═══════════════════════════════════════════════════════════
// TEST 2: Public API Endpoints Under Load
// ═══════════════════════════════════════════════════════════
async function testPublicAPIs() {
  const endpoints = [
    { path: "/api/health", name: "Health Check" },
    { path: "/api/featured-streams", name: "Featured Streams" },
    { path: "/api/announcement-popup", name: "Announcement Popup" },
    { path: "/api/app-download", name: "App Download Config" },
    { path: "/api/social/gifts", name: "Gift Catalog" },
    { path: "/api/social/streams/active", name: "Active Streams" },
  ];

  for (const ep of endpoints) {
    subHeader(`2. Public API: ${ep.name} (${ep.path})`);
    const r = await runAutocannon({
      title: ep.name,
      url: `${TARGET}${ep.path}`,
      connections: 50,
      duration: DURATION,
    });
    results.push({
      name: ep.name,
      category: "Public API",
      requests: r.requests.total,
      rps: Math.round(r.requests.average),
      latencyAvg: r.latency.average,
      latencyP99: r.latency.p99,
      errors: r.errors,
      timeouts: r.timeouts,
      throughput: Math.round(r.throughput.average / 1024),
    });
    result("Avg RPS", Math.round(r.requests.average), "req/s");
    result("Latency (avg/p99)", `${r.latency.average.toFixed(1)} / ${r.latency.p99.toFixed(1)}`, "ms");
    if (r.errors > 0) fail("Errors", r.errors);
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 3: Authentication Stress (Registration + Login)
// ═══════════════════════════════════════════════════════════
async function testAuthEndpoints() {
  subHeader("3.1 Registration Stress (POST /api/auth/register)");
  let regCounter = 0;
  const r1 = await runAutocannon({
    title: "Registration",
    url: `${TARGET}/api/auth/register`,
    method: "POST",
    connections: 20,
    duration: DURATION,
    setupClient: (client: any) => {
      client.setBody(JSON.stringify({
        email: `loadtest_${Date.now()}_${regCounter++}@test.ablox.dev`,
        password: "LoadTest2026!",
        username: `loaduser_${regCounter}`,
        displayName: `Load User ${regCounter}`,
      }));
    },
  });
  results.push({
    name: "User Registration",
    category: "Auth",
    requests: r1.requests.total,
    rps: Math.round(r1.requests.average),
    latencyAvg: r1.latency.average,
    latencyP99: r1.latency.p99,
    errors: r1.errors,
    timeouts: r1.timeouts,
  });
  result("Avg RPS", Math.round(r1.requests.average), "req/s");
  result("Latency (avg/p99)", `${r1.latency.average.toFixed(1)} / ${r1.latency.p99.toFixed(1)}`, "ms");

  subHeader("3.2 Login Stress (POST /api/auth/login)");
  const r2 = await runAutocannon({
    title: "Login",
    url: `${TARGET}/api/auth/login`,
    method: "POST",
    body: JSON.stringify({ login: "loadtest@test.ablox.dev", password: "wrongpassword" }),
    connections: 10,
    duration: 10, // shorter — rate limiting kicks in
  });
  results.push({
    name: "Login Attempts",
    category: "Auth",
    requests: r2.requests.total,
    rps: Math.round(r2.requests.average),
    latencyAvg: r2.latency.average,
    latencyP99: r2.latency.p99,
    errors: r2.errors,
    timeouts: r2.timeouts,
    notes: "Rate limited to 10/15min",
  });
  result("Avg RPS", Math.round(r2.requests.average), "req/s");
  result("Rate limited requests", r2["4xx"] || 0);
}

// ═══════════════════════════════════════════════════════════
// TEST 4: Concurrent Connection Scaling
// ═══════════════════════════════════════════════════════════
async function testConnectionScaling() {
  const levels = [10, 50, 100, 200, 500];
  
  for (const conns of levels) {
    subHeader(`4. Connection Scaling: ${conns} concurrent connections`);
    const r = await runAutocannon({
      title: `${conns} connections`,
      url: `${TARGET}/api/health`,
      connections: conns,
      duration: 15,
    });
    results.push({
      name: `Scaling: ${conns} connections`,
      category: "Scaling",
      connections: conns,
      rps: Math.round(r.requests.average),
      latencyAvg: r.latency.average,
      latencyP99: r.latency.p99,
      errors: r.errors,
      timeouts: r.timeouts,
    });
    result("RPS", Math.round(r.requests.average), "req/s");
    result("Latency (avg/p99)", `${r.latency.average.toFixed(1)} / ${r.latency.p99.toFixed(1)}`, "ms");
    if (r.errors > 0) warn("Errors", r.errors);
    if (r.timeouts > 0) fail("Timeouts", r.timeouts);
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 5: WebSocket Concurrent Connections
// ═══════════════════════════════════════════════════════════
async function testWebSocketConnections() {
  const wsTarget = TARGET.replace("http", "ws");
  const levels = [50, 100, 250, 500, 1000, 2000];
  
  for (const count of levels) {
    subHeader(`5. WebSocket: ${count} concurrent connections`);
    
    const sockets: Socket[] = [];
    let connected = 0;
    let errors = 0;
    const startTime = Date.now();
    
    const connectPromises = Array.from({ length: count }, (_, i) => {
      return new Promise<void>((resolve) => {
        const socket = ioClient(TARGET, {
          transports: ["websocket"],
          reconnection: false,
          timeout: 10000,
          auth: { userId: `loadtest_ws_${i}` },
        });
        
        socket.on("connect", () => {
          connected++;
          socket.emit("user-online", `loadtest_ws_${i}`);
          resolve();
        });
        
        socket.on("connect_error", () => {
          errors++;
          resolve();
        });
        
        sockets.push(socket);
        
        // Timeout after 15s
        setTimeout(() => resolve(), 15000);
      });
    });
    
    await Promise.all(connectPromises);
    const elapsed = Date.now() - startTime;
    
    results.push({
      name: `WebSocket: ${count} connections`,
      category: "WebSocket",
      connections: count,
      maxConcurrent: connected,
      errors: errors,
      notes: `${elapsed}ms to connect all`,
    });
    
    result("Connected", `${connected}/${count}`);
    result("Connection time", elapsed, "ms");
    if (errors > 0) warn("Failed", errors);
    
    // Test messaging throughput with connected sockets
    if (connected > 10) {
      const msgStart = Date.now();
      let msgSent = 0;
      const testRoom = `loadtest_room_${Date.now()}`;
      
      // Join all sockets to a room
      for (const s of sockets.filter(s => s.connected)) {
        s.emit("join-room", testRoom);
      }
      await new Promise(r => setTimeout(r, 500)); // wait for joins
      
      // Send messages for 5 seconds
      const msgInterval = setInterval(() => {
        const s = sockets[Math.floor(Math.random() * sockets.length)];
        if (s?.connected) {
          s.emit("chat-message", {
            roomId: testRoom,
            message: `Load test message ${msgSent}`,
            user: { id: "loadtest", name: "LoadBot" },
          });
          msgSent++;
        }
      }, 2);
      
      await new Promise(r => setTimeout(r, 5000));
      clearInterval(msgInterval);
      const msgElapsed = Date.now() - msgStart - 500;
      const msgPerSec = Math.round(msgSent / (msgElapsed / 1000));
      
      results.push({
        name: `WebSocket Messaging (${connected} clients)`,
        category: "WebSocket",
        connections: connected,
        messagesPerSec: msgPerSec,
        notes: `${msgSent} messages in ${msgElapsed}ms`,
      });
      
      result("Messages sent", msgSent);
      result("Throughput", msgPerSec, "msg/s");
    }
    
    // Cleanup
    for (const s of sockets) {
      try { s.disconnect(); } catch {}
    }
    await new Promise(r => setTimeout(r, 1000)); // let server cleanup
  }
}

// ═══════════════════════════════════════════════════════════
// TEST 6: Heavy DB Queries (Search, Lists)
// ═══════════════════════════════════════════════════════════
async function testDatabaseLoad() {
  subHeader("6.1 User Search — DB Query Load");
  const r1 = await runAutocannon({
    title: "User Search",
    url: `${TARGET}/api/social/users/search?q=test&limit=20`,
    connections: 30,
    duration: DURATION,
  });
  results.push({
    name: "User Search (DB)",
    category: "Database",
    requests: r1.requests.total,
    rps: Math.round(r1.requests.average),
    latencyAvg: r1.latency.average,
    latencyP99: r1.latency.p99,
    errors: r1.errors,
    timeouts: r1.timeouts,
  });
  result("Avg RPS", Math.round(r1.requests.average), "req/s");
  result("Latency (avg/p99)", `${r1.latency.average.toFixed(1)} / ${r1.latency.p99.toFixed(1)}`, "ms");

  subHeader("6.2 Gift Catalog — Cached Read");
  const r2 = await runAutocannon({
    title: "Gift Catalog",
    url: `${TARGET}/api/social/gifts`,
    connections: 100,
    duration: DURATION,
  });
  results.push({
    name: "Gift Catalog (cached)",
    category: "Database",
    requests: r2.requests.total,
    rps: Math.round(r2.requests.average),
    latencyAvg: r2.latency.average,
    latencyP99: r2.latency.p99,
    errors: r2.errors,
    timeouts: r2.timeouts,
  });
  result("Avg RPS", Math.round(r2.requests.average), "req/s");
  result("Latency (avg/p99)", `${r2.latency.average.toFixed(1)} / ${r2.latency.p99.toFixed(1)}`, "ms");
}

// ═══════════════════════════════════════════════════════════
// TEST 7: Maximum Throughput (Pipeline)
// ═══════════════════════════════════════════════════════════
async function testMaxThroughput() {
  subHeader("7. Maximum Throughput — Pipelining 10x, 500 connections");
  const r = await runAutocannon({
    title: "Max Throughput",
    url: `${TARGET}/api/health`,
    connections: 500,
    duration: DURATION,
    pipelining: 10,
  });
  results.push({
    name: "Max Throughput (pipeline)",
    category: "Peak",
    requests: r.requests.total,
    rps: Math.round(r.requests.average),
    latencyAvg: r.latency.average,
    latencyP99: r.latency.p99,
    errors: r.errors,
    timeouts: r.timeouts,
    throughput: Math.round(r.throughput.average / 1024),
  });
  result("Peak RPS", Math.round(r.requests.average), "req/s");
  result("Total Requests", r.requests.total);
  result("Latency (avg/p99)", `${r.latency.average.toFixed(1)} / ${r.latency.p99.toFixed(1)}`, "ms");
  result("Throughput", Math.round(r.throughput.average / 1024), "KB/s");
  if (r.errors > 0) warn("Errors", r.errors);
  if (r.timeouts > 0) fail("Timeouts", r.timeouts);
}

// ═══════════════════════════════════════════════════════════
// TEST 8: Rate Limiter Validation
// ═══════════════════════════════════════════════════════════
async function testRateLimiting() {
  subHeader("8. Rate Limiter — Auth endpoint (10 req/15min limit)");
  
  let successCount = 0;
  let rateLimited = 0;
  
  for (let i = 0; i < 20; i++) {
    try {
      const res = await fetch(`${TARGET}/api/admin/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "test", password: "test" }),
      });
      if (res.status === 429) rateLimited++;
      else successCount++;
    } catch {}
  }
  
  results.push({
    name: "Rate Limiter (auth)",
    category: "Security",
    requests: 20,
    notes: `${successCount} passed, ${rateLimited} rate-limited`,
  });
  
  result("Requests sent", 20);
  result("Passed through", successCount);
  result("Rate limited (429)", rateLimited);
  if (rateLimited > 0) {
    result("Rate limiter", "WORKING ✓");
  } else {
    warn("Rate limiter", "NOT TRIGGERED (may need stricter limits)");
  }
}

// ═══════════════════════════════════════════════════════════
// FINAL REPORT
// ═══════════════════════════════════════════════════════════
function generateReport(metricsBefore: Record<string, number>, metricsAfter: Record<string, number>, totalDuration: number) {
  header("📊 تقرير اختبار الضغط — Ablox Stress Test Report");
  
  // System info
  console.log(`${c.cyan}  System Information${c.reset}`);
  result("OS", `${os.type()} ${os.release()} (${os.arch()})`);
  result("CPUs", `${os.cpus().length}x ${os.cpus()[0]?.model || "Unknown"}`);
  result("Total RAM", `${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB`);
  result("Free RAM", `${(os.freemem() / 1024 / 1024 / 1024).toFixed(1)} GB`);
  result("Target", TARGET);
  result("Test Duration", `${totalDuration}s total`);
  console.log();

  // Server metrics delta
  if (metricsAfter.ablox_memory_rss_bytes) {
    console.log(`${c.cyan}  Server Resource Usage (Before → After)${c.reset}`);
    const rssBefore = (metricsBefore.ablox_memory_rss_bytes || 0) / 1024 / 1024;
    const rssAfter = metricsAfter.ablox_memory_rss_bytes / 1024 / 1024;
    const heapBefore = (metricsBefore.ablox_memory_heap_used_bytes || 0) / 1024 / 1024;
    const heapAfter = metricsAfter.ablox_memory_heap_used_bytes / 1024 / 1024;
    result("RSS Memory", `${rssBefore.toFixed(1)} → ${rssAfter.toFixed(1)} MB (${rssAfter - rssBefore > 0 ? "+" : ""}${(rssAfter - rssBefore).toFixed(1)} MB)`);
    result("Heap Used", `${heapBefore.toFixed(1)} → ${heapAfter.toFixed(1)} MB`);
    result("Socket Connections", metricsAfter.ablox_socket_connections || 0);
    if (metricsAfter.ablox_db_pool_total !== undefined) {
      result("DB Pool", `${metricsAfter.ablox_db_pool_total} total, ${metricsAfter.ablox_db_pool_idle} idle, ${metricsAfter.ablox_db_pool_waiting} waiting`);
    }
    console.log();
  }

  // ── HTTP Results Table ──
  console.log(`${c.cyan}  HTTP API Performance${c.reset}`);
  console.log(`    ${"Test".padEnd(35)} ${"RPS".padStart(8)} ${"Avg(ms)".padStart(8)} ${"P99(ms)".padStart(8)} ${"Errors".padStart(8)} ${"Timeouts".padStart(9)}`);
  console.log(`    ${"─".repeat(35)} ${"─".repeat(8)} ${"─".repeat(8)} ${"─".repeat(8)} ${"─".repeat(8)} ${"─".repeat(9)}`);
  
  for (const r of results.filter(r => r.rps !== undefined)) {
    const errColor = (r.errors || 0) > 0 ? c.red : c.green;
    const toColor = (r.timeouts || 0) > 0 ? c.red : c.green;
    console.log(
      `    ${r.name.padEnd(35)} ${String(r.rps).padStart(8)} ${(r.latencyAvg?.toFixed(1) || "-").padStart(8)} ${(r.latencyP99?.toFixed(1) || "-").padStart(8)} ${errColor}${String(r.errors || 0).padStart(8)}${c.reset} ${toColor}${String(r.timeouts || 0).padStart(9)}${c.reset}`
    );
  }
  console.log();

  // ── WebSocket Results ──
  const wsResults = results.filter(r => r.category === "WebSocket");
  if (wsResults.length > 0) {
    console.log(`${c.cyan}  WebSocket Performance${c.reset}`);
    for (const r of wsResults) {
      if (r.maxConcurrent !== undefined) {
        console.log(`    ${r.name.padEnd(40)} ${c.green}${r.maxConcurrent}/${r.connections} connected${c.reset}  ${c.dim}${r.notes}${c.reset}`);
      }
      if (r.messagesPerSec !== undefined) {
        console.log(`    ${r.name.padEnd(40)} ${c.green}${r.messagesPerSec} msg/s${c.reset}  ${c.dim}${r.notes}${c.reset}`);
      }
    }
    console.log();
  }

  // ── Scaling Analysis ──
  const scalingResults = results.filter(r => r.category === "Scaling");
  if (scalingResults.length > 0) {
    console.log(`${c.cyan}  Connection Scaling Analysis${c.reset}`);
    console.log(`    ${"Connections".padEnd(15)} ${"RPS".padStart(8)} ${"Avg(ms)".padStart(8)} ${"P99(ms)".padStart(8)} ${"Errors".padStart(8)}`);
    console.log(`    ${"─".repeat(15)} ${"─".repeat(8)} ${"─".repeat(8)} ${"─".repeat(8)} ${"─".repeat(8)}`);
    for (const r of scalingResults) {
      console.log(
        `    ${String(r.connections).padEnd(15)} ${String(r.rps).padStart(8)} ${(r.latencyAvg?.toFixed(1) || "-").padStart(8)} ${(r.latencyP99?.toFixed(1) || "-").padStart(8)} ${String(r.errors || 0).padStart(8)}`
      );
    }
    console.log();
  }

  // ── Max Concurrent Users Estimation ──
  header("🎯 تقدير أقصى عدد مستخدمين متزامنين");
  
  const healthRPS = results.find(r => r.name.includes("Health Check") && r.category === "HTTP")?.rps || 0;
  const peakRPS = results.find(r => r.category === "Peak")?.rps || 0;
  const peakErrors = results.find(r => r.category === "Peak")?.errors || 0;
  const peakTimeouts = results.find(r => r.category === "Peak")?.timeouts || 0;
  const maxWS = wsResults.reduce((max, r) => Math.max(max, r.maxConcurrent || 0), 0);
  const maxWSTarget = wsResults.reduce((max, r) => r.maxConcurrent === r.connections ? Math.max(max, r.connections || 0) : max, 0);
  
  // Determine where the system breaks
  const degradationPoint = scalingResults.find(r => (r.latencyP99 || 0) > 1000 || (r.errors || 0) > 10);
  const breakingPoint = scalingResults.find(r => (r.errors || 0) > 50 || (r.timeouts || 0) > 10);
  
  // Each active user makes ~1 API call every 5s + 1 WS connection
  const avgApiCallsPerUser = 0.2; // 1 call per 5 seconds
  const safeHTTPCapacity = Math.floor((peakRPS * 0.7) / avgApiCallsPerUser); // 70% of peak
  const safeWSCapacity = maxWSTarget > 0 ? maxWSTarget : maxWS;
  
  // The bottleneck is the min of HTTP and WS capacity
  const estimatedMaxUsers = Math.min(safeHTTPCapacity, safeWSCapacity || Infinity);
  
  console.log(`${c.cyan}  Capacity Analysis${c.reset}`);
  result("Baseline RPS (health)", healthRPS, "req/s");
  result("Peak RPS (pipelined)", peakRPS, "req/s");
  result("Peak Errors", peakErrors);
  result("Peak Timeouts", peakTimeouts);
  result("Max WebSocket Connections", maxWS);
  console.log();

  if (degradationPoint) {
    warn("Performance Degrades At", `${degradationPoint.connections} concurrent connections`);
    warn("P99 Latency at Degradation", `${degradationPoint.latencyP99?.toFixed(0)} ms`);
  }
  if (breakingPoint) {
    fail("System Breaks At", `${breakingPoint.connections} concurrent connections`);
  }
  
  console.log();
  console.log(`${c.cyan}  ═══ Maximum Estimated Concurrent Users ═══${c.reset}`);
  console.log();
  
  const dbPool = metricsAfter.ablox_db_pool_total || 20;
  
  // Bottleneck analysis
  const bottlenecks = [
    { name: "HTTP Throughput", capacity: safeHTTPCapacity, unit: "users (0.2 req/s each)" },
    { name: "WebSocket Connections", capacity: safeWSCapacity || 999999, unit: "concurrent sockets" },
    { name: "DB Connection Pool", capacity: dbPool * 50, unit: `users (${dbPool} pool × 50 queries ea)` },
    { name: "Rate Limiter (API)", capacity: Math.floor(500 / avgApiCallsPerUser / 15 * 60), unit: "users per IP (500/15min)" },
  ];
  
  for (const b of bottlenecks) {
    result(`  ${b.name}`, `~${b.capacity.toLocaleString()}`, b.unit);
  }
  
  console.log();
  const finalEstimate = Math.min(...bottlenecks.map(b => b.capacity));
  const grade = finalEstimate >= 5000 ? "A+" : finalEstimate >= 2000 ? "A" : finalEstimate >= 1000 ? "B" : finalEstimate >= 500 ? "C" : finalEstimate >= 100 ? "D" : "F";
  
  console.log(`    ${c.bold}${c.bg}${c.white}                                                        ${c.reset}`);
  console.log(`    ${c.bold}${c.bg}${c.white}   📊 الحد الأقصى المقدر: ~${finalEstimate.toLocaleString()} مستخدم متزامن           ${c.reset}`);
  console.log(`    ${c.bold}${c.bg}${c.white}   📊 Estimated Max: ~${finalEstimate.toLocaleString()} concurrent users              ${c.reset}`);
  console.log(`    ${c.bold}${c.bg}${c.white}   📊 Grade: ${grade}                                               ${c.reset}`);
  console.log(`    ${c.bold}${c.bg}${c.white}                                                        ${c.reset}`);
  
  console.log();
  console.log(`${c.cyan}  Bottleneck: ${c.yellow}${bottlenecks.reduce((min, b) => b.capacity < min.capacity ? b : min).name}${c.reset}`);
  
  console.log();
  console.log(`${c.cyan}  Recommendations${c.reset}`);
  if (safeWSCapacity < safeHTTPCapacity) {
    warn("  →", "WebSocket is the bottleneck. Consider sticky sessions + horizontal scaling with Redis adapter");
  }
  if (dbPool <= 20) {
    warn("  →", `DB pool is ${dbPool} connections. Increase DB_POOL_MAX for higher concurrency`);
  }
  if (peakTimeouts > 0) {
    warn("  →", "Timeouts detected at peak — consider connection pooling or caching hot queries");
  }
  if (finalEstimate < 1000) {
    warn("  →", "For 1000+ users: add Redis caching, connection pooling, and consider horizontal scaling");
  }
  result("  →", "Enable PM2 cluster mode (pm2 start --instances max) for multi-core utilization");
  result("  →", "Redis adapter already configured for Socket.io horizontal scaling");
  
  console.log();
  console.log(`${c.dim}  Test completed at ${new Date().toISOString()}${c.reset}`);
  console.log(`${c.dim}  Target: ${TARGET}${c.reset}`);
  console.log();
}

// ═══════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════
async function main() {
  header("🚀 Ablox — اختبار الضغط والتحمّل الشامل");
  console.log(`  Target: ${c.bold}${TARGET}${c.reset}`);
  console.log(`  Duration per test: ${c.bold}${DURATION}s${c.reset}`);
  console.log(`  System: ${c.bold}${os.cpus().length} CPUs, ${(os.totalmem() / 1024 / 1024 / 1024).toFixed(1)} GB RAM${c.reset}`);
  console.log();

  // Verify target is reachable
  try {
    const health = await fetchJson(`${TARGET}/api/health`);
    if (health.status === "healthy") {
      result("Server Status", "HEALTHY ✓");
    } else {
      warn("Server Status", `${health.status} (${JSON.stringify(health.services)})`);
    }
  } catch (err: any) {
    fail("Server Status", `UNREACHABLE — ${err.message}`);
    console.log(`\n${c.red}  Cannot connect to ${TARGET}. Make sure the server is running.${c.reset}\n`);
    process.exit(1);
  }

  const totalStart = Date.now();
  const metricsBefore = await getMetrics();

  // ── Warm-up phase: prime caches and connection pools ──
  subHeader("Warm-up: priming server caches & connection pool...");
  for (let i = 0; i < 50; i++) {
    fetchJson(`${TARGET}/api/health`).catch(() => {});
    fetchJson(`${TARGET}/api/social/gifts`).catch(() => {});
    fetchJson(`${TARGET}/api/featured-streams`).catch(() => {});
  }
  await new Promise(r => setTimeout(r, 2000));
  result("Warm-up", "Complete ✓");

  // ── Run all tests sequentially ──
  header("TEST 1: Health Check Baseline");
  await testHealthCheck();

  header("TEST 2: Public API Endpoints");
  await testPublicAPIs();

  header("TEST 3: Authentication Stress");
  await testAuthEndpoints();

  header("TEST 4: Connection Scaling");
  await testConnectionScaling();

  header("TEST 5: WebSocket Concurrency");
  await testWebSocketConnections();

  header("TEST 6: Database Query Load");
  await testDatabaseLoad();

  header("TEST 7: Maximum Throughput");
  await testMaxThroughput();

  header("TEST 8: Rate Limiter Validation");
  await testRateLimiting();

  const metricsAfter = await getMetrics();
  const totalDuration = Math.round((Date.now() - totalStart) / 1000);

  // ── Final Report ──
  generateReport(metricsBefore, metricsAfter, totalDuration);

  process.exit(0);
}

main().catch((err) => {
  console.error(`${c.red}Fatal error: ${err.message}${c.reset}`);
  console.error(err.stack);
  process.exit(1);
});
