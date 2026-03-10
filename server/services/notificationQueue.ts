import { Redis } from "ioredis";
import { createLogger } from "../logger";
import { createRedisDuplicate, getRedis } from "../redis";
import { type LocalizedPushJob, sendLocalizedPush } from "./notificationDispatch";
import { socialStabilityMetrics } from "./socialMetrics";

const queueLog = createLogger("notification-queue");

const NOTIFICATION_QUEUE_KEY = "ablox:queue:notifications";
const NOTIFICATION_DEAD_LETTER_KEY = "ablox:queue:notifications:dead-letter";
const MAX_ATTEMPTS = 5;
const DEAD_LETTER_MAX_ITEMS = 2000;

type QueuedNotificationJob = {
    payload: LocalizedPushJob;
    attempts: number;
    queuedAt: number;
};

type NotificationDeadLetterJob = QueuedNotificationJob & {
    failedAt: number;
    reason: string;
};

export type NotificationQueueStats = {
    mainQueueDepth: number;
    deadLetterDepth: number;
};

function dedupPart(value: unknown, max = 80): string {
    return String(value || "")
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, max);
}

function buildDedupKey(payload: LocalizedPushJob): string {
    const actor = dedupPart(payload.actorName, 40);
    const preview = dedupPart(payload.bodyPreview, 80);
    const target = dedupPart(payload.url, 120);
    return `ablox:notif:dedup:${payload.userId}:${payload.kind}:${payload.preferenceKey}:${actor}:${preview}:${target}`;
}

function getQueueClient(): Redis | null {
    return createRedisDuplicate("notifications-queue") || getRedis();
}

export async function enqueueNotificationJob(payload: LocalizedPushJob): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;

    // Dedup: prevent identical notifications within a short window
    const dedupKey = buildDedupKey(payload);
    const isNew = await redis.set(dedupKey, "1", "EX", 60, "NX");
    if (!isNew) {
        socialStabilityMetrics.notificationQueueDeduplicated += 1;
        return true; // Duplicate already handled, do not fallback to direct push
    }

    const job: QueuedNotificationJob = {
        payload,
        attempts: 0,
        queuedAt: Date.now(),
    };

    try {
        await redis.lpush(NOTIFICATION_QUEUE_KEY, JSON.stringify(job));
        socialStabilityMetrics.notificationQueueEnqueued += 1;
        return true;
    } catch (err: any) {
        queueLog.warn(`Failed to enqueue notification job: ${err?.message || "unknown error"}`);
        return false;
    }
}

async function pushToDeadLetter(redis: Redis, job: QueuedNotificationJob, reason: string): Promise<void> {
    const deadLetterJob: NotificationDeadLetterJob = {
        ...job,
        failedAt: Date.now(),
        reason,
    };

    try {
        const tx = redis.multi();
        tx.lpush(NOTIFICATION_DEAD_LETTER_KEY, JSON.stringify(deadLetterJob));
        tx.ltrim(NOTIFICATION_DEAD_LETTER_KEY, 0, DEAD_LETTER_MAX_ITEMS - 1);
        await tx.exec();
        socialStabilityMetrics.notificationQueueDeadLettered += 1;
    } catch (err: any) {
        queueLog.warn(`Failed to push dead-letter notification job: ${err?.message || "unknown error"}`);
    }
}

function scheduleRetry(redis: Redis, job: QueuedNotificationJob) {
    const nextAttempt = job.attempts + 1;
    if (nextAttempt > MAX_ATTEMPTS) {
        queueLog.warn(`Notification job dropped after ${job.attempts} attempts for user ${job.payload.userId}`);
        socialStabilityMetrics.notificationQueueDropped += 1;
        void pushToDeadLetter(redis, job, "max_attempts_exceeded");
        return;
    }

    const delayMs = Math.min(30000, 1000 * (2 ** (nextAttempt - 1)));

    setTimeout(() => {
        const retryJob: QueuedNotificationJob = {
            ...job,
            attempts: nextAttempt,
        };
        socialStabilityMetrics.notificationQueueRetries += 1;
        redis.lpush(NOTIFICATION_QUEUE_KEY, JSON.stringify(retryJob)).catch((err: any) => {
            queueLog.warn(`Failed to requeue notification job: ${err?.message || "unknown error"}`);
        });
    }, delayMs).unref();
}

export async function getNotificationQueueStats(): Promise<NotificationQueueStats> {
    const redis = getRedis();
    if (!redis) {
        return { mainQueueDepth: 0, deadLetterDepth: 0 };
    }

    try {
        const [mainQueueDepth, deadLetterDepth] = await Promise.all([
            redis.llen(NOTIFICATION_QUEUE_KEY),
            redis.llen(NOTIFICATION_DEAD_LETTER_KEY),
        ]);
        return { mainQueueDepth, deadLetterDepth };
    } catch {
        return { mainQueueDepth: 0, deadLetterDepth: 0 };
    }
}

export async function startNotificationWorker() {
    const WORKER_CONCURRENCY = 4;

    const workers = Array.from({ length: WORKER_CONCURRENCY }, (_, i) => runWorkerLoop(i));
    await Promise.all(workers);
}

async function runWorkerLoop(workerId: number) {
    const redis = getQueueClient();
    if (!redis) {
        queueLog.warn(`Notification worker ${workerId} started without Redis - idle mode`);
        return;
    }

    queueLog.info(`Notification worker ${workerId} started`);

    while (true) {
        try {
            const res = await redis.brpop(NOTIFICATION_QUEUE_KEY, 5);
            if (!res || res.length < 2) continue;

            const raw = res[1];
            let job: QueuedNotificationJob | null = null;
            try {
                job = JSON.parse(raw) as QueuedNotificationJob;
            } catch {
                queueLog.warn(`Worker ${workerId}: Skipping malformed notification job payload`);
                continue;
            }

            if (!job?.payload?.userId || !job.payload.kind || !job.payload.preferenceKey) {
                queueLog.warn(`Worker ${workerId}: Skipping invalid notification job structure`);
                continue;
            }

            try {
                await sendLocalizedPush(job.payload);
                socialStabilityMetrics.notificationQueueDispatchSuccess += 1;
            } catch (err: any) {
                socialStabilityMetrics.notificationQueueDispatchFailures += 1;
                queueLog.warn(`Worker ${workerId}: Notification dispatch failed: ${err?.message || "unknown error"}`);
                scheduleRetry(redis, job);
            }
        } catch (err: any) {
            queueLog.warn(`Worker ${workerId}: loop error: ${err?.message || "unknown error"}`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}
