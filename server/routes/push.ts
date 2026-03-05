/**
 * Push Notification API Routes — إشعارات الويب
 * ================================================
 * POST /api/push/subscribe   — Register push subscription
 * DELETE /api/push/unsubscribe — Remove push subscription
 * GET  /api/push/vapid-key   — Get VAPID public key
 */
import { Router, type Request, type Response } from "express";
import { z } from "zod";
import {
  saveSubscription,
  removeSubscription,
  getVapidPublicKey,
  isPushEnabled,
} from "../services/pushNotification";

const router = Router();

// ── Zod validation for push subscription ──
const pushSubscriptionSchema = z.object({
  endpoint: z.string().url().max(2048),
  keys: z.object({
    p256dh: z.string().min(1).max(500),
    auth: z.string().min(1).max(500),
  }),
  expirationTime: z.number().nullable().optional(),
});

// ── GET /vapid-key — Return the VAPID public key for client-side subscription ──
router.get("/vapid-key", (_req: Request, res: Response) => {
  const key = getVapidPublicKey();
  if (!key) {
    return res.status(503).json({ success: false, message: "Push notifications not configured" });
  }
  return res.json({ success: true, data: { publicKey: key } });
});

// ── POST /subscribe — Register a push subscription for the logged-in user ──
router.post("/subscribe", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });
  }

  if (!isPushEnabled()) {
    return res.status(503).json({ success: false, message: "Push notifications not available" });
  }

  const parsed = pushSubscriptionSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "Invalid subscription data", errors: parsed.error.issues });
  }

  await saveSubscription(userId, parsed.data as any);
  return res.json({ success: true, message: "تم تسجيل الإشعارات بنجاح" });
});

// ── DELETE /unsubscribe — Remove a push subscription ──
router.delete("/unsubscribe", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });
  }

  const { endpoint } = req.body || {};
  if (!endpoint || typeof endpoint !== "string") {
    return res.status(400).json({ success: false, message: "Endpoint required" });
  }

  await removeSubscription(userId, endpoint);
  return res.json({ success: true, message: "تم إلغاء الإشعارات" });
});

export default router;
