/**
 * Push Notification Service — خدمة الإشعارات
 * ============================================
 * Uses Web Push (VAPID) to send push notifications.
 * Stores subscriptions in Redis with user ID mapping.
 */
import webpush from "web-push";
import { getRedis } from "../redis";
import { createLogger } from "../logger";

const pushLog = createLogger("push");

// ── VAPID Keys ──
// Generate with: npx web-push generate-vapid-keys
const VAPID_PUBLIC = process.env.VAPID_PUBLIC_KEY || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:info@mrco.live";

let pushEnabled = false;

export function initPushService() {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    pushLog.warn("VAPID keys not set — push notifications disabled. Generate with: npx web-push generate-vapid-keys");
    return;
  }

  try {
    webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);
    pushEnabled = true;
    pushLog.info("Push notification service initialized");
  } catch (err: any) {
    pushLog.error(`Failed to initialize push service: ${err.message}`);
  }
}

export function getVapidPublicKey(): string {
  return VAPID_PUBLIC;
}

export function isPushEnabled(): boolean {
  return pushEnabled;
}

// ── Subscription management (Redis-backed) ──
const SUBS_PREFIX = "ablox:push:";

export async function saveSubscription(userId: string, subscription: webpush.PushSubscription): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    // Store subscription JSON keyed by user ID
    // A user can have multiple devices, so we use a Redis set
    await redis.sadd(`${SUBS_PREFIX}${userId}`, JSON.stringify(subscription));
    // Expire after 30 days if not refreshed
    await redis.expire(`${SUBS_PREFIX}${userId}`, 30 * 24 * 60 * 60);
    pushLog.info(`Subscription saved for user ${userId}`);
  } catch (err: any) {
    pushLog.error(`Failed to save subscription: ${err.message}`);
  }
}

export async function removeSubscription(userId: string, endpoint: string): Promise<void> {
  const redis = getRedis();
  if (!redis) return;

  try {
    const subs = await redis.smembers(`${SUBS_PREFIX}${userId}`);
    for (const sub of subs) {
      const parsed = JSON.parse(sub);
      if (parsed.endpoint === endpoint) {
        await redis.srem(`${SUBS_PREFIX}${userId}`, sub);
        break;
      }
    }
  } catch (err: any) {
    pushLog.error(`Failed to remove subscription: ${err.message}`);
  }
}

async function getUserSubscriptions(userId: string): Promise<webpush.PushSubscription[]> {
  const redis = getRedis();
  if (!redis) return [];

  try {
    const subs = await redis.smembers(`${SUBS_PREFIX}${userId}`);
    return subs.map((s) => JSON.parse(s));
  } catch {
    return [];
  }
}

// ── Send push notification ──
export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, any>;
}

export async function sendPushToUser(userId: string, payload: PushPayload): Promise<number> {
  if (!pushEnabled) return 0;

  const subscriptions = await getUserSubscriptions(userId);
  if (subscriptions.length === 0) return 0;

  const payloadStr = JSON.stringify({
    title: payload.title,
    body: payload.body,
    icon: payload.icon || "/icons/icon-192x192.png",
    badge: payload.badge || "/icons/icon-72x72.png",
    tag: payload.tag || "ablox-notification",
    ...(payload.data || {}),
    data: {
      url: payload.url || "/",
      ...payload.data,
    },
  });

  let sent = 0;
  const staleEndpoints: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(sub, payloadStr);
      sent++;
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired or invalid — clean up
        staleEndpoints.push(sub.endpoint);
      } else {
        pushLog.warn(`Push failed for ${userId}: ${err.message}`);
      }
    }
  }

  // Clean up stale subscriptions
  for (const endpoint of staleEndpoints) {
    await removeSubscription(userId, endpoint);
  }

  if (sent > 0) pushLog.info(`Sent ${sent} push notification(s) to user ${userId}`);
  return sent;
}

export async function sendPushToMultiple(userIds: string[], payload: PushPayload): Promise<number> {
  let total = 0;
  // Process in batches to avoid overwhelming
  const batchSize = 50;
  for (let i = 0; i < userIds.length; i += batchSize) {
    const batch = userIds.slice(i, i + batchSize);
    const results = await Promise.allSettled(
      batch.map((uid) => sendPushToUser(uid, payload)),
    );
    total += results.reduce((sum, r) => sum + (r.status === "fulfilled" ? r.value : 0), 0);
  }
  return total;
}
