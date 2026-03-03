/**
 * ═══════════════════════════════════════════════════════════
 * Ablox — Cluster Mode (Step 22: Multi-core utilization)
 * ═══════════════════════════════════════════════════════════
 * 
 * Uses Node.js cluster module to spawn workers on all CPU cores.
 * Each worker runs the full Express + Socket.io server.
 * Redis adapter ensures Socket.io events are shared across workers.
 * 
 * Usage:
 *   NODE_ENV=production node --import tsx server/cluster.ts
 *   Or with PM2: pm2 start server/index.ts --instances max -i max
 * 
 * In production: PM2 with `--instances max` is preferred over
 * this file since PM2 handles process management, restarts, and logs.
 */

import cluster from "node:cluster";
import os from "node:os";

const WORKER_COUNT = parseInt(process.env.CLUSTER_WORKERS || String(os.cpus().length), 10);

if (cluster.isPrimary) {
  console.log(`[cluster] Primary ${process.pid} starting ${WORKER_COUNT} workers...`);

  // Fork workers
  for (let i = 0; i < WORKER_COUNT; i++) {
    cluster.fork();
  }

  // Restart crashed workers (with backoff to prevent restart storms)
  let restartsInWindow = 0;
  const RESTART_WINDOW_MS = 60_000;
  const MAX_RESTARTS_PER_WINDOW = WORKER_COUNT * 3;

  setInterval(() => { restartsInWindow = 0; }, RESTART_WINDOW_MS);

  cluster.on("exit", (worker, code, signal) => {
    console.log(`[cluster] Worker ${worker.process.pid} died (code=${code}, signal=${signal})`);
    
    if (restartsInWindow >= MAX_RESTARTS_PER_WINDOW) {
      console.error(`[cluster] Too many restarts (${restartsInWindow}/${MAX_RESTARTS_PER_WINDOW}). Not restarting.`);
      return;
    }

    // Wait a bit before restarting to prevent CPU thrashing
    const delay = Math.min(1000 * (restartsInWindow + 1), 10_000);
    setTimeout(() => {
      restartsInWindow++;
      console.log(`[cluster] Restarting worker after ${delay}ms...`);
      cluster.fork();
    }, delay);
  });

  // Graceful shutdown
  const shutdown = (signal: string) => {
    console.log(`[cluster] ${signal} received — shutting down all workers...`);
    for (const id in cluster.workers) {
      cluster.workers[id]?.process.kill(signal as NodeJS.Signals);
    }
    setTimeout(() => {
      console.log("[cluster] Force exit after 15s");
      process.exit(1);
    }, 15_000).unref();
  };

  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));

} else {
  // Worker: import and run the main server
  // In production (CJS build): ./index.cjs, in dev (TSX): ./index.js
  const entry = process.env.NODE_ENV === "production" ? "./index.cjs" : "./index.js";
  import(entry);
  console.log(`[cluster] Worker ${process.pid} started`);
}
