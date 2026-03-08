import { Redis } from "ioredis";
import { createLogger } from "../logger";
import { createRedisDuplicate, getRedis } from "../redis";
import { type LocalizedPushJob, sendLocalizedPush } from "./notificationDispatch";

const queueLog = createLogger("notification-queue");

const NOTIFICATION_QUEUE_KEY = "ablox:queue:notifications";
const MAX_ATTEMPTS = 5;

type QueuedNotificationJob = {
    payload: LocalizedPushJob;
    attempts: number;
    queuedAt: number;
};

function getQueueClient(): Redis | null {
    return createRedisDuplicate("notifications-queue") || getRedis();
}

export async function enqueueNotificationJob(payload: LocalizedPushJob): Promise<boolean> {
    const redis = getRedis();
    if (!redis) return false;

    const job: QueuedNotificationJob = {
        payload,
        attempts: 0,
        queuedAt: Date.now(),
    };

    try {
        await redis.lpush(NOTIFICATION_QUEUE_KEY, JSON.stringify(job));
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
        return;
    }

    const delayMs = Math.min(30000, 1000 * (2 ** (nextAttempt - 1)));

    setTimeout(() => {
        const retryJob: QueuedNotificationJob = {
            ...job,
            attempts: nextAttempt,
        };
        redis.lpush(NOTIFICATION_QUEUE_KEY, JSON.stringify(retryJob)).catch((err: any) => {
            queueLog.warn(`Failed to requeue notification job: ${err?.message || "unknown error"}`);
        });
    }, delayMs).unref();
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
                continue;
            }

            if (!job?.payload?.userId || !job.payload.kind || !job.payload.preferenceKey) {
                queueLog.warn("Skipping invalid notification job structure");
                continue;
            }

            try {
                await sendLocalizedPush(job.payload);
            } catch (err: any) {
                queueLog.warn(`Notification dispatch failed: ${err?.message || "unknown error"}`);
                scheduleRetry(redis, job);
            }
        } catch (err: any) {
            queueLog.warn(`Notification worker loop error: ${err?.message || "unknown error"}`);
            await new Promise((resolve) => setTimeout(resolve, 1000));
        }
    }
}
