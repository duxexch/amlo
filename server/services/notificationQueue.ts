import { Redis } from "ioredis";
import { createLogger } from "../logger";
import { createRedisDuplicate, getRedis } from "../redis";
import { type LocalizedPushJob, sendLocalizedPush } from "./notificationDispatch";

const queueLog = createLogger("notification-queue");

const NOTIFICATION_QUEUE_KEY = "ablox:queue:notifications";
const NOTIFICATION_DLQ_KEY = "ablox:queue:notifications:dlq";
const NOTIFICATION_METRICS_KEY = "ablox:queue:notifications:metrics";
const NOTIFICATION_DEDUP_PREFIX = "ablox:queue:notifications:dedup";
const MAX_ATTEMPTS = 5;

type QueuedNotificationJob = {
    payload: LocalizedPushJob;
    attempts: number;
    queuedAt: number;
    idempotencyKey?: string;
};

type QueueMetrics = {
    enqueued: number;
    duplicates: number;
    processed: number;
    failed: number;
    retried: number;
    dropped: number;
    dlq: number;
    queueDepth: number;
    dlqDepth: number;
};

function getQueueClient(): Redis | null {
    return createRedisDuplicate("notifications-queue") || getRedis();
}

function buildIdempotencyKey(payload: LocalizedPushJob): string {
    const raw = String(payload.idempotencyKey || `${payload.userId}:${payload.kind}:${payload.url}:${payload.actorName || ""}:${payload.bodyPreview || ""}`);
    return raw.replace(/\s+/g, " ").trim().slice(0, 240);
}

async function incrMetric(redis: Redis, metric: keyof QueueMetrics, by = 1) {
    try {
        await redis.hincrby(NOTIFICATION_METRICS_KEY, String(metric), by);
    } catch {
        // metrics should never block notification flow
    }
}

async function pushToDlq(redis: Redis, job: QueuedNotificationJob | null, reason: string) {
    if (!job) return;
    try {
        await redis.lpush(NOTIFICATION_DLQ_KEY, JSON.stringify({
            job,
            reason,
            failedAt: Date.now(),
        }));
        await incrMetric(redis, "dlq", 1);
    } catch {
        // ignore DLQ persistence failures
    }
}

export async function enqueueNotificationJob(payload: LocalizedPushJob): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;

    const idempotencyKey = buildIdempotencyKey(payload);
    const dedupKey = `${NOTIFICATION_DEDUP_PREFIX}:${idempotencyKey}`;
    const firstSeen = await redis.set(dedupKey, "1", "EX", 300, "NX");
    if (firstSeen !== "OK") {
        await incrMetric(redis, "duplicates", 1);
        return true;
    }

    const job: QueuedNotificationJob = {
        payload,
        attempts: 0,
        queuedAt: Date.now(),
        idempotencyKey,
    };

    try {
        await redis.lpush(NOTIFICATION_QUEUE_KEY, JSON.stringify(job));
        await incrMetric(redis, "enqueued", 1);
        return true;
    } catch (err: any) {
        queueLog.warn(`Failed to enqueue notification job: ${err?.message || "unknown error"}`);
        return false;
    }
}

function scheduleRetry(redis: Redis, job: QueuedNotificationJob) {
    const nextAttempt = job.attempts + 1;
    if (nextAttempt > MAX_ATTEMPTS) {
        queueLog.warn(`Notification job dropped after ${job.attempts} attempts for user ${job.payload.userId}`);
        void incrMetric(redis, "dropped", 1);
        void pushToDlq(redis, job, "max_attempts_exceeded");
        return;
    }

    const delayMs = Math.min(30000, 1000 * (2 ** (nextAttempt - 1)));
    void incrMetric(redis, "retried", 1);

    setTimeout(() => {
        const retryJob: QueuedNotificationJob = {
            ...job,
            attempts: nextAttempt,
        };
        redis.lpush(NOTIFICATION_QUEUE_KEY, JSON.stringify(retryJob)).catch((err: any) => {
            queueLog.warn(`Failed to requeue notification job: ${err?.message || "unknown error"}`);
            void pushToDlq(redis, retryJob, "retry_enqueue_failed");
        });
    }, delayMs).unref();
}

export async function getNotificationQueueMetrics(): Promise<QueueMetrics> {
    const redis = getRedis();
    if (!redis) {
        return {
            enqueued: 0,
            duplicates: 0,
            processed: 0,
            failed: 0,
            retried: 0,
            dropped: 0,
            dlq: 0,
            queueDepth: 0,
            dlqDepth: 0,
        };
    }

    const [rawMetrics, queueDepthRaw, dlqDepthRaw] = await Promise.all([
        redis.hgetall(NOTIFICATION_METRICS_KEY),
        redis.llen(NOTIFICATION_QUEUE_KEY),
        redis.llen(NOTIFICATION_DLQ_KEY),
    ]);

    const num = (v: unknown) => Number(v || 0);
    return {
        enqueued: num(rawMetrics.enqueued),
        duplicates: num(rawMetrics.duplicates),
        processed: num(rawMetrics.processed),
        failed: num(rawMetrics.failed),
        retried: num(rawMetrics.retried),
        dropped: num(rawMetrics.dropped),
        dlq: num(rawMetrics.dlq),
        queueDepth: Number(queueDepthRaw || 0),
        dlqDepth: Number(dlqDepthRaw || 0),
    };
}

export async function startNotificationWorker() {
    const redis = getQueueClient();
    if (!redis) {
        queueLog.warn("Notification worker started without Redis - idle mode");
        return;
    }

    queueLog.info("Notification worker started");

    while (true) {
        try {
            const res = await redis.brpop(NOTIFICATION_QUEUE_KEY, 5);
            if (!res || res.length < 2) continue;

            const raw = res[1];
            let job: QueuedNotificationJob | null = null;
            try {
                job = JSON.parse(raw) as QueuedNotificationJob;
            } catch {
                queueLog.warn("Skipping malformed notification job payload");
                await pushToDlq(redis, { payload: { userId: "unknown", preferenceKey: "systemUpdates", kind: "message", url: "/" }, attempts: 0, queuedAt: Date.now() }, "malformed_payload");
                continue;
            }

            if (!job?.payload?.userId || !job.payload.kind || !job.payload.preferenceKey) {
                queueLog.warn("Skipping invalid notification job structure");
                await pushToDlq(redis, job, "invalid_structure");
                continue;
            }

            try {
                await sendLocalizedPush(job.payload);
                await incrMetric(redis, "processed", 1);
            } catch (err: any) {
                queueLog.warn(`Notification dispatch failed: ${err?.message || "unknown error"}`);
                await incrMetric(redis, "failed", 1);
                scheduleRetry(redis, job);
            }
        } catch (err: any) {
            queueLog.warn(`Notification worker loop error: ${err?.message || "unknown error"}`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}
