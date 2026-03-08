/**
 * Social Routes — Friends, Chat, Calls, Wallet, Streams, etc.
 * All endpoints require user auth via session.
 * Shared helpers are in socialHelpers.ts
 */
import { Router, type Request, type Response } from "express";
import { escapeLike, isValidUuid } from "../utils/validation";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { eq, and, or, desc, asc, sql, count, ne, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { getRedis } from "../redis";
import { createLogger } from "../logger";
const log = (msg: string, _src?: string) => socialLog.info(msg);
const socialLog = createLogger("social");
import { io } from "../index";
import { getUserSocketId, isUserOnline, areUsersOnline, getLastSeen, getLastSeenBatch } from "../onlineUsers";
import * as schema from "../../shared/schema";
import { sendMessageSchema, initiateCallSchema, reportMessageSchema } from "../../shared/schema";
import { storage } from "../storage";
import { encryptMessage, decryptMessage, decryptMessages } from "../utils/encryption";
import { getAllPricing } from "../pricingService";
import { sendLocalizedPush, type LocalizedPushJob } from "../services/notificationDispatch";
import { enqueueNotificationJob } from "../services/notificationQueue";
import {
  generateLiveKitToken,
  getLiveKitPublicUrl,
  createLiveKitRoom,
  deleteLiveKitRoom,
  updateParticipantPermissions,
  removeParticipant,
} from "../utils/livekit";

// ── Shared helpers (centralized in socialHelpers.ts) ──
import {
  paramStr, paramUuid, requireUser,
  isFinancialRateLimited, DAILY_WITHDRAW_LIMIT, WEEKLY_WITHDRAW_LIMIT,
  chargeCoins, isChatBlocked,
} from "./socialHelpers";

const router = Router();

// ── Helper: get the other participant ID in a conversation ──
async function getConversationOtherId(db: any, conversationId: string, userId: string): Promise<string | null> {
  const [conv] = await db.select({
    p1: schema.conversations.participant1Id,
    p2: schema.conversations.participant2Id,
  }).from(schema.conversations).where(eq(schema.conversations.id, conversationId)).limit(1);
  if (!conv) return null;
  return conv.p1 === userId ? conv.p2 : conv.p1;
}

function parsePaymentMethodDetails(raw: unknown): { provider: string; countries: string[]; fee: string; usageTarget: "deposit" | "withdrawal" | "both" } {
  const fallback = { provider: "", countries: ["*"], fee: "0", usageTarget: "both" as const };
  if (!raw) return fallback;
  try {
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw;
    const obj = (parsed && typeof parsed === "object") ? parsed as Record<string, unknown> : {};
    const countries = Array.isArray(obj.countries)
      ? obj.countries.map((c) => String(c || "").toUpperCase()).filter(Boolean)
      : ["*"];
    const usage = String(obj.usageTarget || obj.usage || "both");
    const usageTarget = usage === "deposit" || usage === "withdrawal" ? usage : "both";
    return {
      provider: String(obj.provider || ""),
      countries: countries.length ? countries : ["*"],
      fee: String(obj.fee || "0"),
      usageTarget,
    };
  } catch {
    return fallback;
  }
}

function detectCountry(req: Request, userCountry?: string | null): string {
  const fromProfile = String(userCountry || "").trim().toUpperCase();
  if (fromProfile.length === 2) return fromProfile;
  const headerCountry = String(
    req.headers["cf-ipcountry"] ||
    req.headers["x-vercel-ip-country"] ||
    req.headers["x-country-code"] ||
    ""
  ).trim().toUpperCase();
  return headerCountry.length === 2 ? headerCountry : "";
}

function queueLocalizedPush(job: LocalizedPushJob) {
  void enqueueNotificationJob(job).then((queued) => {
    // Fallback to direct send when queue is unavailable.
    if (!queued) {
      void sendLocalizedPush(job);
    }
  });
}

const WITHDRAW_ACCESS_USERS_SETTING_KEY = "wallet_withdraw_access_user_ids";

async function isWithdrawAccessEnabledForUser(userId: string): Promise<boolean> {
  const setting = await storage.getSetting(WITHDRAW_ACCESS_USERS_SETTING_KEY);
  if (!setting?.value) return false;
  try {
    const parsed = JSON.parse(setting.value);
    if (!Array.isArray(parsed)) return false;
    return parsed.map((v: unknown) => String(v || "").trim()).includes(userId);
  } catch {
    return false;
  }
}

// ── UUID param validation middleware — rejects malformed :id early ──
router.param("id", (req, res, next, value) => {
  if (!isValidUuid(String(value))) {
    return res.status(400).json({ success: false, message: "معرف غير صالح" });
  }
  next();
});

// ════════════════════════════════════════════════════════════
// FRIENDS API
// ════════════════════════════════════════════════════════════

// Get friends list
router.get("/friends", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = (page - 1) * limit;

  try {
    const friendships = await db.select().from(schema.friendships)
      .where(
        and(
          or(
            eq(schema.friendships.senderId, userId),
            eq(schema.friendships.receiverId, userId),
          ),
          eq(schema.friendships.status, "accepted"),
        )
      )
      .orderBy(desc(schema.friendships.updatedAt))
      .limit(limit)
      .offset(offset);

    const friendIds = friendships.map(f => f.senderId === userId ? f.receiverId : f.senderId);
    if (friendIds.length === 0) return res.json({ success: true, data: [] });

    const friends = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
      level: schema.users.level,
      status: schema.users.status,
      isVerified: schema.users.isVerified,
      lastOnlineAt: schema.users.lastOnlineAt,
      country: schema.users.country,
    }).from(schema.users).where(inArray(schema.users.id, friendIds));

    // Batch online status (single HMGET instead of N HEXISTS)
    const onlineMap = await areUsersOnline(friends.map(f => f.id));
    const result = friends.map((f) => ({
      ...f,
      isOnline: onlineMap.get(f.id) || false,
      friendshipId: friendships.find(fs => fs.senderId === f.id || fs.receiverId === f.id)?.id,
    }));

    return res.json({ success: true, data: result });
  } catch (err: any) {
    log(`Friends list error: ${err.message}`, "social");
    return res.status(500).json({ success: false, message: "خطأ في تحميل الأصدقاء" });
  }
});

// Get pending friend requests (received)
router.get("/friends/requests", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
  const offset = (page - 1) * limit;

  try {
    const requests = await db.select().from(schema.friendships)
      .where(
        and(
          eq(schema.friendships.receiverId, userId),
          eq(schema.friendships.status, "pending"),
        )
      )
      .orderBy(desc(schema.friendships.createdAt))
      .limit(limit)
      .offset(offset);

    if (requests.length === 0) return res.json({ success: true, data: [] });

    const senderIds = requests.map(r => r.senderId);
    const senders = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
      level: schema.users.level,
      isVerified: schema.users.isVerified,
      country: schema.users.country,
    }).from(schema.users).where(inArray(schema.users.id, senderIds));

    const result = requests.map(r => ({
      ...r,
      sender: senders.find(s => s.id === r.senderId),
    }));

    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل الطلبات" });
  }
});

// Get sent friend requests
router.get("/friends/sent", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

  try {
    const requests = await db.select().from(schema.friendships)
      .where(
        and(
          eq(schema.friendships.senderId, userId),
          eq(schema.friendships.status, "pending"),
        )
      )
      .orderBy(desc(schema.friendships.createdAt));

    if (requests.length === 0) return res.json({ success: true, data: [] });

    const receiverIds = requests.map(r => r.receiverId);
    const receivers = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
      level: schema.users.level,
      isVerified: schema.users.isVerified,
    }).from(schema.users).where(inArray(schema.users.id, receiverIds));

    const result = requests.map(r => ({
      ...r,
      receiver: receivers.find(s => s.id === r.receiverId),
    }));

    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Send friend request
router.post("/friends/request", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  const { receiverId } = req.body;
  if (!receiverId) return res.status(400).json({ success: false, message: "receiverId مطلوب" });
  if (receiverId === userId) return res.status(400).json({ success: false, message: "لا يمكنك إضافة نفسك" });

  try {
    // Check if already friends or pending
    const existing = await db.select().from(schema.friendships)
      .where(
        or(
          and(eq(schema.friendships.senderId, userId), eq(schema.friendships.receiverId, receiverId)),
          and(eq(schema.friendships.senderId, receiverId), eq(schema.friendships.receiverId, userId)),
        )
      ).limit(1);

    if (existing.length > 0) {
      const f = existing[0];
      if (f.status === "accepted") return res.status(400).json({ success: false, message: "أنتم أصدقاء بالفعل" });
      if (f.status === "pending") return res.status(400).json({ success: false, message: "يوجد طلب صداقة بالفعل" });
      if (f.status === "blocked") return res.status(400).json({ success: false, message: "لا يمكن إرسال الطلب" });
    }

    const [friendship] = await db.insert(schema.friendships).values({
      senderId: userId,
      receiverId,
      status: "pending",
    }).returning();

    // Send real-time notification
    const receiverSocketId = await getUserSocketId(receiverId);
    if (receiverSocketId) {
      const [sender] = await db.select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatar: schema.users.avatar,
        level: schema.users.level,
      }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      io.to(`user:${receiverId}`).emit("friend-request", { friendship, sender });
    }

    const [senderForPush] = await db.select({
      username: schema.users.username,
      displayName: schema.users.displayName,
    }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);

    queueLocalizedPush({
      userId: receiverId,
      preferenceKey: "friendRequests",
      kind: "friend",
      actorName: senderForPush?.displayName || senderForPush?.username || "User",
      url: "/friends",
    });

    return res.status(201).json({ success: true, data: friendship });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في إرسال الطلب" });
  }
});

// Accept friend request
router.post("/friends/:id/accept", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  try {
    const [friendship] = await db.select().from(schema.friendships)
      .where(
        and(
          eq(schema.friendships.id, req.params.id),
          eq(schema.friendships.receiverId, userId),
          eq(schema.friendships.status, "pending"),
        )
      ).limit(1);

    if (!friendship) return res.status(404).json({ success: false, message: "الطلب غير موجود" });

    const [updated] = await db.update(schema.friendships)
      .set({ status: "accepted", updatedAt: new Date() })
      .where(eq(schema.friendships.id, friendship.id))
      .returning();

    // Notify sender
    const senderSocketId = await getUserSocketId(friendship.senderId);
    if (senderSocketId) {
      io.to(`user:${friendship.senderId}`).emit("friend-accepted", { friendshipId: updated.id, userId });
    }

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Reject friend request
router.post("/friends/:id/reject", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  try {
    const [friendship] = await db.select().from(schema.friendships)
      .where(
        and(
          eq(schema.friendships.id, req.params.id),
          eq(schema.friendships.receiverId, userId),
          eq(schema.friendships.status, "pending"),
        )
      ).limit(1);

    if (!friendship) return res.status(404).json({ success: false, message: "الطلب غير موجود" });

    await db.delete(schema.friendships).where(eq(schema.friendships.id, friendship.id));

    // Notify sender that request was rejected
    const senderSocketId = await getUserSocketId(friendship.senderId);
    if (senderSocketId) {
      io.to(`user:${friendship.senderId}`).emit("friend-rejected", {
        friendshipId: friendship.id,
        rejectedBy: userId,
      });
    }

    return res.json({ success: true, message: "تم رفض الطلب" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Remove friend
router.delete("/friends/:id", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  try {
    const [friendship] = await db.select().from(schema.friendships)
      .where(
        and(
          eq(schema.friendships.id, req.params.id),
          or(
            eq(schema.friendships.senderId, userId),
            eq(schema.friendships.receiverId, userId),
          ),
          eq(schema.friendships.status, "accepted"),
        )
      ).limit(1);

    if (!friendship) return res.status(404).json({ success: false, message: "الصداقة غير موجودة" });

    await db.delete(schema.friendships).where(eq(schema.friendships.id, friendship.id));
    return res.json({ success: true, message: "تم إزالة الصديق" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Block user
router.post("/friends/:userId/block", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  const targetId = req.params.userId;

  try {
    // Remove any existing friendship
    await db.delete(schema.friendships).where(
      or(
        and(eq(schema.friendships.senderId, userId), eq(schema.friendships.receiverId, targetId)),
        and(eq(schema.friendships.senderId, targetId), eq(schema.friendships.receiverId, userId)),
      )
    );

    // Create block record
    await db.insert(schema.friendships).values({
      senderId: userId,
      receiverId: targetId,
      status: "blocked",
    });

    return res.json({ success: true, message: "تم حظر المستخدم" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ── Search rate limiting (max 30 searches per minute per user) ──
const searchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.session as any)?.userId || ipKeyGenerator(req.ip || "127.0.0.1"),
  message: { success: false, message: "عدد كبير من طلبات البحث. حاول بعد دقيقة" },
});

// Search users to add as friends
router.get("/users/search", searchLimiter, async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

  const q = req.query.q as string;
  if (!q || q.length < 2) return res.json({ success: true, data: [] });

  try {
    const searchTerm = `%${escapeLike(q)}%`;
    const results = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
      level: schema.users.level,
      isVerified: schema.users.isVerified,
      country: schema.users.country,
    }).from(schema.users)
      .where(
        and(
          ne(schema.users.id, userId),
          eq(schema.users.isBanned, false),
          or(
            sql`${schema.users.username} ILIKE ${searchTerm}`,
            sql`${schema.users.displayName} ILIKE ${searchTerm}`,
          ),
        )
      ).limit(20);

    // Attach friendship status
    const resultIds = results.map(r => r.id);
    const existingFriendships = resultIds.length > 0
      ? await db.select().from(schema.friendships)
        .where(
          or(
            and(eq(schema.friendships.senderId, userId), inArray(schema.friendships.receiverId, resultIds)),
            and(inArray(schema.friendships.senderId, resultIds), eq(schema.friendships.receiverId, userId)),
          )
        )
      : [];

    const onlineMap = await areUsersOnline(resultIds);

    const enriched = results.map((r) => {
      const fs = existingFriendships.find(
        f => (f.senderId === userId && f.receiverId === r.id) || (f.senderId === r.id && f.receiverId === userId)
      );
      return {
        ...r,
        isOnline: onlineMap.get(r.id) || false,
        friendshipStatus: fs?.status || null,
        friendshipId: fs?.id || null,
        friendshipDirection: fs
          ? (fs.senderId === userId ? "outgoing" : "incoming")
          : null,
      };
    });

    return res.json({ success: true, data: enriched });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في البحث" });
  }
});

// ════════════════════════════════════════════════════════════
// CHAT / MESSAGES API
// ════════════════════════════════════════════════════════════

// Get conversations list (paginated)
router.get("/conversations", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

  const page = Math.max(1, parseInt(req.query.page as string) || 1);
  const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
  const offset = (page - 1) * limit;

  try {
    const convs = await db.select().from(schema.conversations)
      .where(
        and(
          or(
            eq(schema.conversations.participant1Id, userId),
            eq(schema.conversations.participant2Id, userId),
          ),
          eq(schema.conversations.isActive, true),
        )
      )
      .orderBy(desc(schema.conversations.lastMessageAt))
      .limit(limit)
      .offset(offset);

    if (convs.length === 0) return res.json({ success: true, data: [] });

    // Get all participants
    const participantIds = convs.map(c => c.participant1Id === userId ? c.participant2Id : c.participant1Id);
    const participants = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
      level: schema.users.level,
      isVerified: schema.users.isVerified,
      status: schema.users.status,
    }).from(schema.users).where(inArray(schema.users.id, participantIds));

    // Get last messages
    const lastMsgIds = convs.map(c => c.lastMessageId).filter(Boolean) as string[];
    const lastMessages = lastMsgIds.length > 0
      ? await db.select().from(schema.messages).where(inArray(schema.messages.id, lastMsgIds))
      : [];

    // Batch online status check (single HMGET instead of N HEXISTS)
    const onlineMap = await areUsersOnline(participantIds);
    const lastSeenMap = await getLastSeenBatch(participantIds);

    const result = convs.map(c => {
      const otherId = c.participant1Id === userId ? c.participant2Id : c.participant1Id;
      const unread = c.participant1Id === userId ? c.participant1Unread : c.participant2Unread;
      const rawLastMessage = lastMessages.find(m => m.id === c.lastMessageId);
      const lastMessage = rawLastMessage
        ? {
          ...rawLastMessage,
          content: rawLastMessage.content ? decryptMessage(rawLastMessage.content, c.id) : rawLastMessage.content,
          isEncrypted: true,
        }
        : null;
      return {
        id: c.id,
        otherUser: participants.find(p => p.id === otherId),
        isOnline: onlineMap.get(otherId) || false,
        lastSeen: lastSeenMap.get(otherId) || null,
        unreadCount: unread,
        lastMessage,
        lastMessageAt: c.lastMessageAt,
      };
    });

    return res.json({ success: true, data: result });
  } catch (err: any) {
    log(`Conversations list error: ${err.message}`, "social");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Get or create conversation with a user
router.post("/conversations", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  const { receiverId } = req.body;
  if (!receiverId) return res.status(400).json({ success: false, message: "receiverId مطلوب" });
  if (receiverId === userId) return res.status(400).json({ success: false, message: "لا يمكن محادثة نفسك" });

  try {
    // Check for block
    const blocked = await db.select().from(schema.friendships)
      .where(
        and(
          or(
            and(eq(schema.friendships.senderId, userId), eq(schema.friendships.receiverId, receiverId)),
            and(eq(schema.friendships.senderId, receiverId), eq(schema.friendships.receiverId, userId)),
          ),
          eq(schema.friendships.status, "blocked"),
        )
      ).limit(1);

    if (blocked.length > 0) return res.status(403).json({ success: false, message: "لا يمكن بدء محادثة مع هذا المستخدم" });

    // Limit: max 200 active conversations per user
    const [convCount] = await db.select({ count: count() }).from(schema.conversations)
      .where(and(
        or(
          eq(schema.conversations.participant1Id, userId),
          eq(schema.conversations.participant2Id, userId),
        ),
        eq(schema.conversations.isActive, true),
      ));
    if (convCount.count >= 200) {
      return res.status(429).json({ success: false, message: "وصلت للحد الأقصى من المحادثات (200)" });
    }

    // Check if conversation already exists
    const existing = await db.select().from(schema.conversations)
      .where(
        or(
          and(eq(schema.conversations.participant1Id, userId), eq(schema.conversations.participant2Id, receiverId)),
          and(eq(schema.conversations.participant1Id, receiverId), eq(schema.conversations.participant2Id, userId)),
        )
      ).limit(1);

    if (existing.length > 0) {
      return res.json({ success: true, data: existing[0] });
    }

    const [conv] = await db.insert(schema.conversations).values({
      participant1Id: userId,
      participant2Id: receiverId,
    }).returning();

    return res.status(201).json({ success: true, data: conv });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Get messages in a conversation
// ── Lightweight chat metrics snapshot (process-local) ──
const chatMetrics = {
  sentTotal: 0,
  sendErrors: 0,
  sendLatencyMsTotal: 0,
  fetchTotal: 0,
  fetchErrors: 0,
  fetchLatencyMsTotal: 0,
};

function avgMs(total: number, count: number): number {
  if (count <= 0) return 0;
  return Math.round((total / count) * 100) / 100;
}

router.get("/conversations/:id/messages", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });
  const startedAt = Date.now();

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = (page - 1) * limit;
  const cursorRaw = typeof req.query.cursor === "string" ? req.query.cursor : "";
  const cursorDate = cursorRaw ? new Date(cursorRaw) : null;
  const hasCursor = !!(cursorDate && !Number.isNaN(cursorDate.getTime()));

  try {
    // Verify user is participant
    const [conv] = await db.select().from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.id, req.params.id),
          or(
            eq(schema.conversations.participant1Id, userId),
            eq(schema.conversations.participant2Id, userId),
          ),
        )
      ).limit(1);

    if (!conv) return res.status(404).json({ success: false, message: "المحادثة غير موجودة" });

    const filters = [
      eq(schema.messages.conversationId, req.params.id),
      eq(schema.messages.isDeleted, false),
      sql`NOT (${schema.messages.hiddenFor} @> ARRAY[${userId}]::text[])`,
    ] as any[];
    if (hasCursor && cursorDate) {
      filters.push(sql`${schema.messages.createdAt} < ${cursorDate}`);
    }

    const baseQuery = db.select().from(schema.messages)
      .where(and(...filters))
      .orderBy(desc(schema.messages.createdAt), desc(schema.messages.id))
      .limit(limit);

    const msgs = hasCursor ? await baseQuery : await baseQuery.offset(offset);

    // Mark messages as read
    const unreadField = conv.participant1Id === userId ? "participant1Unread" : "participant2Unread";
    const otherId = conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;
    await db.update(schema.conversations).set({ [unreadField]: 0 }).where(eq(schema.conversations.id, conv.id));
    const now = new Date();
    const markedRead = await db.update(schema.messages).set({ isRead: true, readAt: now })
      .where(
        and(
          eq(schema.messages.conversationId, conv.id),
          ne(schema.messages.senderId, userId),
          eq(schema.messages.isRead, false),
        )
      ).returning({ id: schema.messages.id });

    // Notify sender that messages were read
    if (markedRead.length > 0) {
      io.to(`user:${otherId}`).emit("messages-read", {
        conversationId: conv.id,
        readBy: userId,
        readAt: now.toISOString(),
        messageIds: markedRead.map(m => m.id),
      });
    }

    const decrypted = decryptMessages(msgs.reverse(), req.params.id);
    chatMetrics.fetchTotal += 1;
    chatMetrics.fetchLatencyMsTotal += Date.now() - startedAt;

    if (hasCursor) {
      const nextCursor = msgs.length > 0 ? (msgs[msgs.length - 1].createdAt?.toISOString?.() || null) : null;
      return res.json({
        success: true,
        data: {
          messages: decrypted,
          nextCursor,
          hasMore: msgs.length >= limit,
        },
      });
    }

    return res.json({ success: true, data: decrypted });
  } catch (err: any) {
    chatMetrics.fetchErrors += 1;
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ── Message send rate limiter ──
const MESSAGE_RATE_MAX = 15;
const MESSAGE_RATE_WINDOW_SEC = 60;
async function isMessageRateLimited(userId: string): Promise<boolean> {
  const redis = getRedis();
  if (!redis) return false;
  try {
    const key = `msg_rl:${userId}`;
    const cnt = await redis.incr(key);
    if (cnt === 1) await redis.expire(key, MESSAGE_RATE_WINDOW_SEC);
    return cnt > MESSAGE_RATE_MAX;
  } catch { return false; }
}

const MAX_MESSAGE_LENGTH = 5000;

// Send a message
router.post("/conversations/:id/messages", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });
  const startedAt = Date.now();

  // Rate limit: max 15 messages per minute per user
  if (await isMessageRateLimited(userId)) {
    return res.status(429).json({ success: false, message: "أنت ترسل بسرعة كبيرة، انتظر قليلاً" });
  }

  try {
    // Verify participant
    const [conv] = await db.select().from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.id, req.params.id),
          or(
            eq(schema.conversations.participant1Id, userId),
            eq(schema.conversations.participant2Id, userId),
          ),
        )
      ).limit(1);

    if (!conv) return res.status(404).json({ success: false, message: "المحادثة غير موجودة" });

    const otherId = conv.participant1Id === userId ? conv.participant2Id : conv.participant1Id;

    // Check chat block
    const blocked = await isChatBlocked(userId, otherId);
    if (blocked) return res.status(403).json({ success: false, message: "لا يمكنك مراسلة هذا المستخدم" });

    // Validate message body
    const parsed = sendMessageSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات الرسالة غير صالحة" });
    const { content, type, mediaUrl, giftId, replyToId, clientMessageId } = parsed.data;
    if (!content && (type === "text" || !type)) return res.status(400).json({ success: false, message: "الرسالة فارغة" });
    // Content length validation
    if (content && content.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ success: false, message: `الرسالة طويلة جداً (الحد ${MAX_MESSAGE_LENGTH} حرف)` });
    }

    // Idempotency guard for weak networks/retries: return existing message if same client message ID was already accepted.
    if (clientMessageId) {
      const [existingMsg] = await db.select().from(schema.messages)
        .where(and(
          eq(schema.messages.conversationId, conv.id),
          eq(schema.messages.senderId, userId),
          eq(schema.messages.clientMessageId, clientMessageId),
        ))
        .limit(1);

      if (existingMsg) {
        const alreadyStored = {
          ...existingMsg,
          content: existingMsg.content ? decryptMessage(existingMsg.content, conv.id) : null,
          isEncrypted: true,
        };
        return res.json({ success: true, data: alreadyStored });
      }
    }

    // Check feature toggles
    const pricing = await getAllPricing();
    if ((type === "image" || type === "video" || type === "voice") && !pricing.messages.media_enabled) {
      return res.status(403).json({ success: false, message: "إرسال الوسائط معطل حالياً" });
    }

    // Check message cost
    const messageCost = pricing.messages.message_cost;
    if (messageCost > 0) {
      const charged = await chargeCoins(userId, messageCost, `رسالة في محادثة`, req.params.id);
      if (!charged) return res.status(402).json({ success: false, message: "رصيدك غير كافٍ لإرسال رسالة", coinsCost: messageCost });
    }

    // Encrypt message content
    const encryptedContent = content ? encryptMessage(content, conv.id) : null;

    const [msg] = await db.insert(schema.messages).values({
      conversationId: conv.id,
      senderId: userId,
      content: encryptedContent,
      type: type || "text",
      mediaUrl: mediaUrl || null,
      giftId: giftId || null,
      clientMessageId: clientMessageId || null,
      replyToId: replyToId || null,
      coinsCost: messageCost,
    }).returning();

    // Update conversation — atomic unread increment (no read-then-write race)
    const isP1 = conv.participant1Id === userId;
    await db.update(schema.conversations).set({
      lastMessageId: msg.id,
      lastMessageAt: new Date(),
      ...(isP1
        ? { participant2Unread: sql`${schema.conversations.participant2Unread} + 1` }
        : { participant1Unread: sql`${schema.conversations.participant1Unread} + 1` }),
    }).where(eq(schema.conversations.id, conv.id));

    // Get sender info for real-time
    const [sender] = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
    }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);

    // Prepare decrypted message for real-time delivery
    const decryptedMsg = { ...msg, content: content || null, isEncrypted: true };

    // Send real-time notification
    io.to(`user:${otherId}`).emit("new-message", {
      message: decryptedMsg,
      conversationId: conv.id,
      sender,
    });

    queueLocalizedPush({
      userId: otherId,
      preferenceKey: "messages",
      kind: "message",
      actorName: sender?.displayName || sender?.username || "User",
      bodyPreview: content || (type === "image" ? "[image]" : type === "video" ? "[video]" : type === "voice" ? "[voice]" : ""),
      url: "/friends",
    });

    // Also notify sender socket for multi-tab sync
    io.to(`user:${userId}`).emit("message-sent", {
      message: decryptedMsg,
      conversationId: conv.id,
    });

    chatMetrics.sentTotal += 1;
    chatMetrics.sendLatencyMsTotal += Date.now() - startedAt;
    return res.status(201).json({ success: true, data: decryptedMsg });
  } catch (err: any) {
    chatMetrics.sendErrors += 1;
    log(`Send message error: ${err.message}`, "social");
    return res.status(500).json({ success: false, message: "خطأ في الإرسال" });
  }
});

// Delete a message (soft delete or hide for me)
router.delete("/messages/:id", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });
  const mode = req.query.mode === "forMe" ? "forMe" : "forEveryone";

  try {
    const [msg] = await db.select().from(schema.messages)
      .where(eq(schema.messages.id, req.params.id))
      .limit(1);

    if (!msg) return res.status(404).json({ success: false, message: "الرسالة غير موجودة" });

    // Verify user is a participant
    const [conv] = await db.select().from(schema.conversations)
      .where(and(
        eq(schema.conversations.id, msg.conversationId),
        or(
          eq(schema.conversations.participant1Id, userId),
          eq(schema.conversations.participant2Id, userId),
        ),
      )).limit(1);
    if (!conv) return res.status(403).json({ success: false, message: "غير مصرح" });

    if (mode === "forMe") {
      // Hide the message only for this user — atomic array_append to prevent race condition
      await db.execute(
        sql`UPDATE ${schema.messages} SET hidden_for = array_append(hidden_for, ${userId}) WHERE id = ${msg.id} AND NOT (hidden_for @> ARRAY[${userId}]::text[])`
      );
      return res.json({ success: true, message: "تم إخفاء الرسالة" });
    }

    // Delete for everyone — only the sender can do this
    if (msg.senderId !== userId) {
      return res.status(403).json({ success: false, message: "لا يمكنك حذف رسالة شخص آخر" });
    }

    await db.update(schema.messages).set({ isDeleted: true }).where(eq(schema.messages.id, msg.id));

    // Notify the other participant about the deletion via socket
    const otherId = await getConversationOtherId(db, msg.conversationId, userId);
    if (otherId) {
      const otherSocketId = await getUserSocketId(otherId);
      if (otherSocketId) {
        io.to(`user:${otherId}`).emit("message-deleted", {
          messageId: msg.id,
          conversationId: msg.conversationId,
        });
      }
    }

    return res.json({ success: true, message: "تم حذف الرسالة" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ── Message Reactions ──────────────────────────────────
// Toggle reaction on a message (add or remove)
router.post("/messages/:id/reactions", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  try {
    const { emoji } = req.body;
    // Unicode-aware emoji validation: must be 1-4 grapheme clusters and only emoji characters
    const emojiRegex = /^(\p{Extended_Pictographic}|\p{Emoji_Presentation}|\p{Emoji_Modifier_Base}\p{Emoji_Modifier}?|[\u200D\uFE0F])+$/u;
    if (!emoji || typeof emoji !== "string" || !emojiRegex.test(emoji) || [...emoji].length > 8) {
      return res.status(400).json({ success: false, message: "إيموجي غير صالح" });
    }

    // Check that the message exists
    const [msg] = await db.select({ id: schema.messages.id, conversationId: schema.messages.conversationId })
      .from(schema.messages)
      .where(eq(schema.messages.id, req.params.id))
      .limit(1);
    if (!msg) return res.status(404).json({ success: false, message: "الرسالة غير موجودة" });

    // Verify user is a conversation participant
    const [conv] = await db.select({ id: schema.conversations.id }).from(schema.conversations)
      .where(and(
        eq(schema.conversations.id, msg.conversationId),
        or(
          eq(schema.conversations.participant1Id, userId),
          eq(schema.conversations.participant2Id, userId),
        ),
      )).limit(1);
    if (!conv) return res.status(403).json({ success: false, message: "لا يمكنك التفاعل مع هذه الرسالة" });

    // Check if user already reacted with this emoji
    const [existing] = await db.select({ id: schema.messageReactions.id })
      .from(schema.messageReactions)
      .where(and(
        eq(schema.messageReactions.messageId, req.params.id),
        eq(schema.messageReactions.userId, userId),
        eq(schema.messageReactions.emoji, emoji),
      ))
      .limit(1);

    if (existing) {
      // Remove reaction
      await db.delete(schema.messageReactions).where(eq(schema.messageReactions.id, existing.id));

      // Emit socket event for reaction removed
      const otherId = conv.id ? await getConversationOtherId(db, msg.conversationId, userId) : null;
      if (otherId) {
        const otherSocketId = await getUserSocketId(otherId);
        if (otherSocketId) {
          io.to(`user:${otherId}`).emit("reaction-updated", {
            messageId: req.params.id,
            conversationId: msg.conversationId,
            userId,
            emoji,
            action: "removed",
          });
        }
      }

      return res.json({ success: true, action: "removed" });
    } else {
      // Add reaction
      const [reaction] = await db.insert(schema.messageReactions).values({
        messageId: req.params.id,
        userId,
        emoji,
      }).returning();

      // Emit socket event for reaction added
      const otherId = await getConversationOtherId(db, msg.conversationId, userId);
      if (otherId) {
        const otherSocketId = await getUserSocketId(otherId);
        if (otherSocketId) {
          io.to(`user:${otherId}`).emit("reaction-updated", {
            messageId: req.params.id,
            conversationId: msg.conversationId,
            userId,
            emoji,
            action: "added",
          });
        }
      }

      return res.json({ success: true, action: "added", data: reaction });
    }
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في التفاعل" });
  }
});

// Get reactions for a message
router.get("/messages/:id/reactions", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  try {
    // Verify user is a conversation participant
    const [msg] = await db.select({ conversationId: schema.messages.conversationId })
      .from(schema.messages).where(eq(schema.messages.id, req.params.id)).limit(1);
    if (!msg) return res.status(404).json({ success: false, message: "الرسالة غير موجودة" });

    const [conv] = await db.select({ id: schema.conversations.id }).from(schema.conversations)
      .where(and(
        eq(schema.conversations.id, msg.conversationId),
        or(
          eq(schema.conversations.participant1Id, userId),
          eq(schema.conversations.participant2Id, userId),
        ),
      )).limit(1);
    if (!conv) return res.status(403).json({ success: false, message: "لا يمكنك عرض التفاعلات" });

    const reactions = await db.select({
      id: schema.messageReactions.id,
      emoji: schema.messageReactions.emoji,
      userId: schema.messageReactions.userId,
      username: schema.users.username,
      createdAt: schema.messageReactions.createdAt,
    })
      .from(schema.messageReactions)
      .leftJoin(schema.users, eq(schema.messageReactions.userId, schema.users.id))
      .where(eq(schema.messageReactions.messageId, req.params.id))
      .orderBy(schema.messageReactions.createdAt);

    return res.json({ success: true, data: reactions });
  } catch {
    return res.json({ success: true, data: [] });
  }
});

// Batch get reactions for multiple messages (avoids N+1)
router.post("/messages/reactions/batch", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: {} });

  try {
    const { messageIds } = req.body;
    if (!Array.isArray(messageIds) || messageIds.length === 0 || messageIds.length > 100) {
      return res.status(400).json({ success: false, message: "messageIds مطلوبة (1-100)" });
    }
    // Filter valid UUIDs only
    const validIds = messageIds.filter((id: unknown) => typeof id === "string" && isValidUuid(id));
    if (validIds.length === 0) return res.json({ success: true, data: {} });

    // Verify user is a participant in at least one conversation containing these messages
    const msgConvs = await db.selectDistinct({ conversationId: schema.messages.conversationId })
      .from(schema.messages)
      .where(inArray(schema.messages.id, validIds));
    const convIds = msgConvs.map(m => m.conversationId);
    if (convIds.length > 0) {
      const participantCheck = await db.select({ id: schema.conversations.id })
        .from(schema.conversations)
        .where(and(
          inArray(schema.conversations.id, convIds),
          or(
            eq(schema.conversations.participant1Id, userId),
            eq(schema.conversations.participant2Id, userId),
          ),
        ));
      if (participantCheck.length === 0) {
        return res.status(403).json({ success: false, message: "غير مصرح" });
      }
      // Filter to only messages in conversations user participates in
      const allowedConvIds = new Set(participantCheck.map(c => c.id));
      const allowedMsgConvs = msgConvs.filter(m => allowedConvIds.has(m.conversationId));
      // Get message IDs that belong to allowed conversations
      const allowedMsgIds = await db.select({ id: schema.messages.id })
        .from(schema.messages)
        .where(and(
          inArray(schema.messages.id, validIds),
          inArray(schema.messages.conversationId, allowedMsgConvs.map(m => m.conversationId)),
        ));
      const filteredIds = allowedMsgIds.map(m => m.id);
      if (filteredIds.length === 0) return res.json({ success: true, data: {} });
      // Use filtered IDs for the reaction query
      validIds.length = 0;
      validIds.push(...filteredIds);
    }

    const reactions = await db.select({
      id: schema.messageReactions.id,
      messageId: schema.messageReactions.messageId,
      emoji: schema.messageReactions.emoji,
      userId: schema.messageReactions.userId,
      username: schema.users.username,
    })
      .from(schema.messageReactions)
      .leftJoin(schema.users, eq(schema.messageReactions.userId, schema.users.id))
      .where(inArray(schema.messageReactions.messageId, validIds))
      .orderBy(schema.messageReactions.createdAt);

    // Group by messageId
    const grouped: Record<string, Array<{ emoji: string; userId: string; username?: string; isMine?: boolean }>> = {};
    for (const r of reactions) {
      if (!grouped[r.messageId]) grouped[r.messageId] = [];
      grouped[r.messageId].push({
        emoji: r.emoji,
        userId: r.userId,
        username: r.username || undefined,
        isMine: r.userId === userId,
      });
    }

    return res.json({ success: true, data: grouped });
  } catch {
    return res.json({ success: true, data: {} });
  }
});

// Bulk delete messages (user-side)
router.post("/messages/bulk-delete", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  try {
    const { messageIds } = req.body;
    if (!Array.isArray(messageIds) || messageIds.length === 0 || messageIds.length > 50) {
      return res.status(400).json({ success: false, message: "messageIds مطلوبة (1-50)" });
    }
    const validIds = messageIds.filter((id: unknown) => typeof id === "string" && isValidUuid(id));
    if (validIds.length === 0) return res.status(400).json({ success: false, message: "لا توجد IDs صالحة" });

    // Only delete messages sent by the user
    const deleted = await db.update(schema.messages)
      .set({ isDeleted: true })
      .where(and(
        inArray(schema.messages.id, validIds),
        eq(schema.messages.senderId, userId),
      ))
      .returning({ id: schema.messages.id, conversationId: schema.messages.conversationId });

    // Notify other participants via socket
    for (const msg of deleted) {
      const otherId = await getConversationOtherId(db, msg.conversationId, userId);
      if (otherId) {
        const otherSocketId = await getUserSocketId(otherId);
        if (otherSocketId) {
          io.to(`user:${otherId}`).emit("message-deleted", {
            messageId: msg.id,
            conversationId: msg.conversationId,
          });
        }
      }
    }

    return res.json({ success: true, deletedCount: deleted.length });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الحذف" });
  }
});

// Get unread count across all conversations
router.get("/unread-count", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: { unread: 0, friendRequests: 0 } });

  try {
    // Unread messages — single aggregate SQL instead of fetching all conversations
    const [unreadResult] = await db.select({
      total: sql<number>`COALESCE(SUM(
        CASE WHEN ${schema.conversations.participant1Id} = ${userId}
          THEN ${schema.conversations.participant1Unread}
          ELSE ${schema.conversations.participant2Unread}
        END
      ), 0)::int`,
    }).from(schema.conversations)
      .where(
        or(
          eq(schema.conversations.participant1Id, userId),
          eq(schema.conversations.participant2Id, userId),
        )
      );

    // Pending friend requests
    const [reqCount] = await db.select({ count: count() }).from(schema.friendships)
      .where(
        and(
          eq(schema.friendships.receiverId, userId),
          eq(schema.friendships.status, "pending"),
        )
      );

    return res.json({ success: true, data: { unread: unreadResult?.total || 0, friendRequests: reqCount?.count || 0 } });
  } catch (err: any) {
    return res.json({ success: true, data: { unread: 0, friendRequests: 0 } });
  }
});

// Chat metrics snapshot (auth required)
router.get("/chat/metrics", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  return res.json({
    success: true,
    data: {
      sentTotal: chatMetrics.sentTotal,
      sendErrors: chatMetrics.sendErrors,
      avgSendLatencyMs: avgMs(chatMetrics.sendLatencyMsTotal, chatMetrics.sentTotal),
      fetchTotal: chatMetrics.fetchTotal,
      fetchErrors: chatMetrics.fetchErrors,
      avgFetchLatencyMs: avgMs(chatMetrics.fetchLatencyMsTotal, chatMetrics.fetchTotal),
      timestamp: new Date().toISOString(),
    },
  });
});

// ════════════════════════════════════════════════════════════
// CALLS API
// ════════════════════════════════════════════════════════════

// Initiate a call
router.post("/calls", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  const parsed = initiateCallSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة" });

  const { receiverId, type } = parsed.data;
  if (receiverId === userId) return res.status(400).json({ success: false, message: "لا يمكنك الاتصال بنفسك" });

  try {
    // Check feature toggle (from cached pricing)
    const callPricing = await getAllPricing();
    const featureEnabled = type === "video" ? callPricing.messages.video_call_enabled : callPricing.messages.voice_call_enabled;
    if (!featureEnabled) {
      return res.status(403).json({ success: false, message: `${type === "video" ? "مكالمات الفيديو" : "المكالمات الصوتية"} معطلة حالياً` });
    }

    // Check chat block
    const chatBlocked = await isChatBlocked(userId, receiverId);
    if (chatBlocked) return res.status(403).json({ success: false, message: "لا يمكنك الاتصال بهذا المستخدم" });

    // Check block status
    const blocked = await db.select().from(schema.friendships)
      .where(
        and(
          or(
            and(eq(schema.friendships.senderId, userId), eq(schema.friendships.receiverId, receiverId)),
            and(eq(schema.friendships.senderId, receiverId), eq(schema.friendships.receiverId, userId)),
          ),
          eq(schema.friendships.status, "blocked"),
        )
      ).limit(1);

    if (blocked.length > 0) return res.status(403).json({ success: false, message: "لا يمكن الاتصال" });

    // Check if receiver is online
    const receiverOnline = await isUserOnline(receiverId);

    // Get coin rate (from cached pricing)
    const coinRate = type === "video" ? callPricing.calls.video_call_rate : callPricing.calls.voice_call_rate;

    // Check coins (minimum 1 minute charge)
    const [caller] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!caller || caller.coins < coinRate) {
      return res.status(402).json({ success: false, message: "رصيدك غير كافٍ للمكالمة", coinRate });
    }

    const [call] = await db.insert(schema.calls).values({
      callerId: userId,
      receiverId,
      type,
      status: receiverOnline ? "ringing" : "missed",
      coinRate,
    }).returning();

    if (receiverOnline) {
      // Get caller info for notification
      const callerInfo = {
        id: caller.id,
        username: caller.username,
        displayName: caller.displayName,
        avatar: caller.avatar,
        level: caller.level,
      };

      const receiverSocketId = await getUserSocketId(receiverId);
      if (receiverSocketId) {
        io.to(`user:${receiverId}`).emit("incoming-call", {
          call,
          caller: callerInfo,
        });
      }

      queueLocalizedPush({
        userId: receiverId,
        preferenceKey: "calls",
        kind: "call",
        actorName: caller.displayName || caller.username || "User",
        url: "/friends",
        persistent: true,
      });
    } else {
      socialLog.info({ callId: call.id, callerId: userId, receiverId, type: "missed" }, "Call missed — receiver offline");
    }

    socialLog.info({ callId: call.id, callerId: userId, receiverId, type, coinRate }, "Call initiated");
    return res.status(201).json({ success: true, data: call });
  } catch (err: any) {
    log(`Call initiate error: ${err.message}`, "social");
    return res.status(500).json({ success: false, message: "خطأ في بدء المكالمة" });
  }
});

// Answer a call
router.post("/calls/:id/answer", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  try {
    const [call] = await db.select().from(schema.calls)
      .where(
        and(
          eq(schema.calls.id, req.params.id),
          eq(schema.calls.receiverId, userId),
          eq(schema.calls.status, "ringing"),
        )
      ).limit(1);

    if (!call) return res.status(404).json({ success: false, message: "المكالمة غير موجودة" });

    const [updated] = await db.update(schema.calls)
      .set({ status: "active", startedAt: new Date() })
      .where(eq(schema.calls.id, call.id))
      .returning();

    // Notify caller
    const callerSocketId = await getUserSocketId(call.callerId);
    if (callerSocketId) {
      io.to(`user:${call.callerId}`).emit("call-answered", { callId: call.id });
    }

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    socialLog.error({ err, callId: req.params.id }, "Call answer error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Reject a call
router.post("/calls/:id/reject", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  try {
    const [call] = await db.select().from(schema.calls)
      .where(
        and(
          eq(schema.calls.id, req.params.id),
          eq(schema.calls.receiverId, userId),
          eq(schema.calls.status, "ringing"),
        )
      ).limit(1);

    if (!call) return res.status(404).json({ success: false, message: "المكالمة غير موجودة" });

    await db.update(schema.calls).set({ status: "rejected", endedAt: new Date() }).where(eq(schema.calls.id, call.id));

    socialLog.info({ callId: call.id, receiverId: userId, callerId: call.callerId }, "Call rejected");

    const callerSocketId = await getUserSocketId(call.callerId);
    if (callerSocketId) io.to(`user:${call.callerId}`).emit("call-rejected", { callId: call.id });

    return res.json({ success: true, message: "تم رفض المكالمة" });
  } catch (err: any) {
    socialLog.error({ err, callId: req.params.id }, "Call reject error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// End a call (either party)
router.post("/calls/:id/end", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  try {
    // Atomic status update — prevents double-end/double-charge race condition
    const endedAt = new Date();

    // First, get call info for charging calculation
    const [call] = await db.select().from(schema.calls)
      .where(
        and(
          eq(schema.calls.id, req.params.id),
          or(eq(schema.calls.callerId, userId), eq(schema.calls.receiverId, userId)),
          or(eq(schema.calls.status, "active"), eq(schema.calls.status, "ringing")),
        )
      ).limit(1);

    if (!call) return res.status(404).json({ success: false, message: "المكالمة غير موجودة" });

    let durationSeconds = 0;
    let coinsCharged = 0;

    if (call.status === "active" && call.startedAt) {
      durationSeconds = Math.ceil((endedAt.getTime() - call.startedAt.getTime()) / 1000);
      const minutes = Math.ceil(durationSeconds / 60);
      coinsCharged = minutes * call.coinRate;
    }

    // Wrap status update + charge in a transaction for atomicity
    const updated = await db.transaction(async (tx: any) => {
      // Atomically end the call — only if still active (prevents double-ending)
      const [ended] = await tx.update(schema.calls).set({
        status: "ended",
        endedAt,
        durationSeconds,
        coinsCharged,
      }).where(
        and(
          eq(schema.calls.id, call.id),
          or(eq(schema.calls.status, "active"), eq(schema.calls.status, "ringing")),
        )
      ).returning();

      if (!ended) return null;

      // Charge within same transaction — if charge fails, status update rolls back too
      if (coinsCharged > 0) {
        await chargeCoins(call.callerId, coinsCharged, `مكالمة ${call.type === "video" ? "فيديو" : "صوتية"} (${Math.ceil(durationSeconds / 60)} دقيقة)`, call.id, tx);
      }

      return ended;
    });

    if (!updated) {
      return res.json({ success: true, message: "المكالمة منتهية بالفعل" });
    }

    socialLog.info({ callId: call.id, userId, durationSeconds, coinsCharged, type: call.type }, "Call ended");

    // Notify other party
    const otherId = call.callerId === userId ? call.receiverId : call.callerId;
    const otherSocketId = await getUserSocketId(otherId);
    if (otherSocketId) {
      io.to(`user:${otherId}`).emit("call-ended", { callId: call.id, durationSeconds, coinsCharged });
    }

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    socialLog.error({ err, callId: req.params.id }, "Call end error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Get call history
router.get("/calls/history", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

  const page = parseInt(req.query.page as string) || 1;
  const limit = 30;
  const offset = (page - 1) * limit;

  try {
    const callsList = await db.select().from(schema.calls)
      .where(
        or(
          eq(schema.calls.callerId, userId),
          eq(schema.calls.receiverId, userId),
        )
      )
      .orderBy(desc(schema.calls.createdAt))
      .limit(limit)
      .offset(offset);

    if (callsList.length === 0) return res.json({ success: true, data: [] });

    const otherIds = Array.from(new Set(callsList.map(c => c.callerId === userId ? c.receiverId : c.callerId)));
    const others = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
      level: schema.users.level,
      isVerified: schema.users.isVerified,
    }).from(schema.users).where(inArray(schema.users.id, otherIds));

    const result = callsList.map(c => ({
      ...c,
      direction: c.callerId === userId ? "outgoing" : "incoming",
      otherUser: others.find(u => u.id === (c.callerId === userId ? c.receiverId : c.callerId)),
    }));

    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Get miles pricing (public)
router.get("/miles-pricing", async (_req, res) => {
  const defaultPackages = [
    { id: "miles_10", miles: 10, price: "0.99" },
    { id: "miles_50", miles: 50, price: "3.99" },
    { id: "miles_100", miles: 100, price: "6.99" },
    { id: "miles_250", miles: 250, price: "14.99" },
    { id: "miles_500", miles: 500, price: "24.99" },
    { id: "miles_1000", miles: 1000, price: "44.99" },
  ];
  const defaults = { cost_per_mile: 5, packages: defaultPackages };
  const db = getDb();
  if (!db) return res.json({ success: true, data: defaults });

  try {
    const settings = await db.select().from(schema.systemSettings)
      .where(
        or(
          eq(schema.systemSettings.key, "miles_cost_per_mile"),
          eq(schema.systemSettings.key, "miles_packages"),
        )
      );

    const result: any = { ...defaults };
    settings.forEach(s => {
      if (s.key === "miles_cost_per_mile") result.cost_per_mile = parseInt(s.value) || 5;
      if (s.key === "miles_packages") {
        try { result.packages = JSON.parse(s.value); } catch (e: any) { socialLog.warn(`Invalid miles_packages JSON: ${e.message}`); }
      }
    });
    return res.json({ success: true, data: result });
  } catch {
    return res.json({ success: true, data: defaults });
  }
});

// Purchase miles with coins
router.post("/miles/purchase", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  const { packageId } = req.body;
  if (!packageId || typeof packageId !== "string") {
    return res.status(400).json({ success: false, message: "packageId مطلوب" });
  }

  try {
    // Fetch miles packages from settings
    const [setting] = await db.select().from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, "miles_packages")).limit(1);

    let packages: Array<{ id: string; miles: number; price: string }> = [
      { id: "miles_10", miles: 10, price: "0.99" },
      { id: "miles_50", miles: 50, price: "3.99" },
      { id: "miles_100", miles: 100, price: "6.99" },
      { id: "miles_250", miles: 250, price: "14.99" },
      { id: "miles_500", miles: 500, price: "24.99" },
      { id: "miles_1000", miles: 1000, price: "44.99" },
    ];
    if (setting?.value) {
      try { packages = JSON.parse(setting.value); } catch (e: any) { socialLog.warn(`Invalid miles_packages JSON: ${e.message}`); }
    }

    const pkg = packages.find(p => p.id === packageId);
    if (!pkg) return res.status(404).json({ success: false, message: "الباقة غير موجودة" });

    // Cost per mile from settings
    const [costSetting] = await db.select().from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, "miles_cost_per_mile")).limit(1);
    const costPerMile = costSetting ? parseInt(costSetting.value) || 5 : 5;
    const totalCost = pkg.miles * costPerMile;

    // Check user balance
    const [user] = await db.select({ coins: schema.users.coins }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!user || user.coins < totalCost) {
      return res.status(400).json({ success: false, message: "رصيد غير كافٍ", required: totalCost, current: user?.coins || 0 });
    }

    // Wrap deduct + record in a DB transaction for atomicity
    const result = await db.transaction(async (tx) => {
      // Deduct coins + add miles
      const [updated] = await tx.update(schema.users).set({
        coins: sql`coins - ${totalCost}`,
        miles: sql`miles + ${pkg.miles}`,
      }).where(eq(schema.users.id, userId)).returning({ coins: schema.users.coins, miles: schema.users.miles });

      // Record transaction
      await tx.insert(schema.walletTransactions).values({
        userId,
        type: "purchase",
        amount: -totalCost,
        balanceAfter: updated.coins,
        currency: "coins",
        description: `شراء ${pkg.miles} ميل`,
        paymentMethod: "coins",
        status: "completed",
      });

      return updated;
    });

    return res.json({ success: true, data: { miles: result.miles, coins: result.coins, milesAdded: pkg.miles, coinsDeducted: totalCost } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الشراء" });
  }
});

// Get pricing info (public)
router.get("/pricing", async (_req, res) => {
  try {
    const pricing = await getAllPricing();
    return res.json({
      success: true, data: {
        voice_call_rate: pricing.calls.voice_call_rate,
        video_call_rate: pricing.calls.video_call_rate,
        message_cost: pricing.messages.message_cost,
      }
    });
  } catch {
    return res.json({ success: true, data: { voice_call_rate: 5, video_call_rate: 10, message_cost: 0 } });
  }
});

// Get all pricing (authenticated users)
router.get("/pricing/all", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const pricing = await getAllPricing();
    return res.json({ success: true, data: pricing });
  } catch {
    return res.status(500).json({ success: false, message: "خطأ في جلب الأسعار" });
  }
});

// ════════════════════════════════════════════════════════════
// CHAT BLOCKS — حظر الدردشة (يبقى متابعاً)
// ════════════════════════════════════════════════════════════

// Block a user from chat (without removing follow)
router.post("/chat/block/:userId", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  const targetId = typeof req.params.userId === "string" ? req.params.userId : req.params.userId[0];
  if (targetId === userId) return res.status(400).json({ success: false, message: "لا يمكنك حظر نفسك" });

  try {
    // Check if already blocked
    const existing = await db.select().from(schema.chatBlocks)
      .where(and(eq(schema.chatBlocks.blockerId, userId), eq(schema.chatBlocks.blockedId, targetId)))
      .limit(1);

    if (existing.length > 0) return res.json({ success: true, message: "المستخدم محظور بالفعل" });

    await db.insert(schema.chatBlocks).values({ blockerId: userId, blockedId: targetId });

    // Notify blocked user via socket
    const blockedSocketId = await getUserSocketId(targetId);
    if (blockedSocketId) {
      io.to(`user:${targetId}`).emit("chat-blocked", { blockerId: userId });
    }

    return res.status(201).json({ success: true, message: "تم حظر المستخدم من الدردشة" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الحظر" });
  }
});

// Unblock a user from chat
router.delete("/chat/block/:userId", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  const targetId = typeof req.params.userId === "string" ? req.params.userId : req.params.userId[0];

  try {
    await db.delete(schema.chatBlocks)
      .where(and(eq(schema.chatBlocks.blockerId, userId), eq(schema.chatBlocks.blockedId, targetId)));

    return res.json({ success: true, message: "تم إلغاء حظر المستخدم" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Get blocked users list
router.get("/chat/blocked", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

  try {
    const blocks = await db.select().from(schema.chatBlocks)
      .where(eq(schema.chatBlocks.blockerId, userId))
      .orderBy(desc(schema.chatBlocks.createdAt));

    if (blocks.length === 0) return res.json({ success: true, data: [] });

    const blockedIds = blocks.map(b => b.blockedId);
    const blockedUsers = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
      level: schema.users.level,
    }).from(schema.users).where(inArray(schema.users.id, blockedIds));

    const result = blocks.map(b => ({
      ...b,
      user: blockedUsers.find(u => u.id === b.blockedId),
    }));

    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Check if a specific user is blocked
router.get("/chat/block-status/:userId", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: { isBlocked: false, blockedByMe: false, blockedByThem: false } });

  const targetId = typeof req.params.userId === "string" ? req.params.userId : req.params.userId[0];

  try {
    const blocks = await db.select().from(schema.chatBlocks)
      .where(
        or(
          and(eq(schema.chatBlocks.blockerId, userId), eq(schema.chatBlocks.blockedId, targetId)),
          and(eq(schema.chatBlocks.blockerId, targetId), eq(schema.chatBlocks.blockedId, userId)),
        )
      );

    const blockedByMe = blocks.some(b => b.blockerId === userId);
    const blockedByThem = blocks.some(b => b.blockerId === targetId);

    return res.json({ success: true, data: { isBlocked: blockedByMe || blockedByThem, blockedByMe, blockedByThem } });
  } catch {
    return res.json({ success: true, data: { isBlocked: false, blockedByMe: false, blockedByThem: false } });
  }
});

// ════════════════════════════════════════════════════════════
// MESSAGE REPORTS — بلاغات الرسائل
// ════════════════════════════════════════════════════════════

// Report a message
router.post("/messages/report", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  const parsed = reportMessageSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة" });

  const { messageId, conversationId, reportedUserId, category, reason } = parsed.data;

  try {
    // Verify the reporter is part of the conversation
    const [conv] = await db.select().from(schema.conversations)
      .where(
        and(
          eq(schema.conversations.id, conversationId),
          or(
            eq(schema.conversations.participant1Id, userId),
            eq(schema.conversations.participant2Id, userId),
          ),
        )
      ).limit(1);

    if (!conv) return res.status(404).json({ success: false, message: "المحادثة غير موجودة" });

    // Verify message exists
    const [msg] = await db.select().from(schema.messages)
      .where(and(eq(schema.messages.id, messageId), eq(schema.messages.conversationId, conversationId)))
      .limit(1);

    if (!msg) return res.status(404).json({ success: false, message: "الرسالة غير موجودة" });

    // Check for duplicate report
    const existingReport = await db.select().from(schema.messageReports)
      .where(and(eq(schema.messageReports.reporterId, userId), eq(schema.messageReports.messageId, messageId)))
      .limit(1);

    if (existingReport.length > 0) return res.status(400).json({ success: false, message: "تم الإبلاغ عن هذه الرسالة بالفعل" });

    const [report] = await db.insert(schema.messageReports).values({
      reporterId: userId,
      messageId,
      conversationId,
      reportedUserId,
      category: category || "other",
      reason: reason || null,
    }).returning();

    // Notify admins via socket (only to admin-connected sockets)
    for (const [, s] of io.sockets.sockets) {
      if (s.data.isAdmin) {
        s.emit("admin-notification", {
          type: "message_report",
          report,
          message: "بلاغ جديد على رسالة",
        });
      }
    }

    return res.status(201).json({ success: true, data: report, message: "تم إرسال البلاغ بنجاح" });
  } catch (err: any) {
    log(`Report message error: ${err.message}`, "social");
    return res.status(500).json({ success: false, message: "خطأ في إرسال البلاغ" });
  }
});

// ════════════════════════════════════════════════════════════
// CHAT SETTINGS — إعدادات الدردشة (قراءة فقط للمستخدمين)
// ════════════════════════════════════════════════════════════

// Get chat feature settings (public)
router.get("/chat/settings", async (_req, res) => {
  const db = getDb();
  const defaults = {
    chat_media_enabled: true,
    chat_voice_call_enabled: true,
    chat_video_call_enabled: true,
    chat_time_limit: 0,
    message_cost: 0,
    voice_call_rate: 10,
    video_call_rate: 20,
  };

  if (!db) return res.json({ success: true, data: defaults });

  try {
    const keys = Object.keys(defaults);
    const settings = await db.select().from(schema.systemSettings)
      .where(inArray(schema.systemSettings.key, keys));

    const result: any = { ...defaults };
    settings.forEach(s => {
      if (s.value === "true") result[s.key] = true;
      else if (s.value === "false") result[s.key] = false;
      else result[s.key] = parseInt(s.value) || s.value;
    });

    return res.json({ success: true, data: result });
  } catch {
    return res.json({ success: true, data: defaults });
  }
});

// ════════════════════════════════════════════════════════════
// WALLET — المحفظة
// ════════════════════════════════════════════════════════════

/** Helper: get coins-to-USD conversion rate from DB settings */
async function getConversionRate(): Promise<number> {
  try {
    const setting = await storage.getSetting("coins_per_usd");
    if (setting?.value) {
      const n = parseInt(setting.value);
      if (n > 0) return n;
    }
  } catch { }
  return 100; // default 100 coins = $1
}

/**
 * GET /social/wallet/conversion-rate — سعر التحويل
 */
router.get("/wallet/conversion-rate", async (_req: Request, res: Response) => {
  try {
    const rate = await getConversionRate();
    return res.json({ success: true, data: { coinsPerUsd: rate } });
  } catch {
    return res.json({ success: true, data: { coinsPerUsd: 100 } });
  }
});

/**
 * GET /social/wallet/balance — رصيد المحفظة
 */
router.get("/wallet/balance", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    return res.json({
      success: true,
      data: {
        coins: user.coins,
        diamonds: user.diamonds,
        miles: user.miles,
      },
    });
  } catch (err: any) {
    socialLog.error({ err }, "Wallet balance error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

/**
 * GET /social/wallet/transactions — سجل المعاملات
 */
router.get("/wallet/transactions", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const type = req.query.type as string | undefined;
    const result = await storage.getUserTransactions(userId, page, limit, { type });
    return res.json({ success: true, data: result.data, total: result.total, page, limit });
  } catch (err: any) {
    socialLog.error({ err }, "Wallet transactions error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

/**
 * GET /social/wallet/income — ملخص الدخل  
 */
router.get("/wallet/income", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, data: { totalReceived: 0, todayReceived: 0, weekReceived: 0, monthReceived: 0 } });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Single query with CASE WHEN for all time periods (instead of 4 separate queries)
    const [result] = await db.select({
      totalReceived: sql<number>`COALESCE(SUM(amount), 0)`,
      todayReceived: sql<number>`COALESCE(SUM(CASE WHEN ${schema.walletTransactions.createdAt} >= ${todayStart} THEN amount ELSE 0 END), 0)`,
      weekReceived: sql<number>`COALESCE(SUM(CASE WHEN ${schema.walletTransactions.createdAt} >= ${weekStart} THEN amount ELSE 0 END), 0)`,
      monthReceived: sql<number>`COALESCE(SUM(CASE WHEN ${schema.walletTransactions.createdAt} >= ${monthStart} THEN amount ELSE 0 END), 0)`,
    })
      .from(schema.walletTransactions)
      .where(and(
        eq(schema.walletTransactions.userId, userId),
        sql`${schema.walletTransactions.type} IN ('gift_received', 'commission')`,
        eq(schema.walletTransactions.status, "completed")
      ));

    return res.json({
      success: true,
      data: {
        totalReceived: Number(result?.totalReceived || 0),
        todayReceived: Number(result?.todayReceived || 0),
        weekReceived: Number(result?.weekReceived || 0),
        monthReceived: Number(result?.monthReceived || 0),
      },
    });
  } catch (err: any) {
    socialLog.error({ err }, "Wallet income error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

/**
 * GET /social/wallet/payment-methods — طرق الدفع المتاحة حسب الدولة والاستخدام
 */
router.get("/wallet/payment-methods", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const usageRaw = String(req.query.usage || "withdrawal").toLowerCase();
    const usage = usageRaw === "deposit" || usageRaw === "withdrawal" ? usageRaw : "withdrawal";

    if (usage === "withdrawal") {
      const withdrawEnabled = await isWithdrawAccessEnabledForUser(userId);
      if (!withdrawEnabled) {
        return res.json({
          success: true,
          data: [],
          meta: {
            usage,
            country: null,
            total: 0,
            withdrawEnabled: false,
          },
        });
      }
    }

    const user = await storage.getUser(userId);
    const country = detectCountry(req, user?.country || null);

    const methods = await storage.getPaymentMethods(true);
    const normalized = (methods || []).map((m: any) => {
      const details = parsePaymentMethodDetails(m.accountDetails);
      return {
        ...m,
        provider: details.provider,
        countries: details.countries,
        fee: details.fee,
        usageTarget: details.usageTarget,
      };
    });

    const byUsage = normalized.filter((m: any) => m.usageTarget === "both" || m.usageTarget === usage);
    const filtered = country
      ? byUsage.filter((m: any) => (m.countries || []).includes("*") || (m.countries || []).includes(country))
      : byUsage;

    return res.json({
      success: true,
      data: filtered,
      meta: {
        usage,
        country: country || null,
        total: filtered.length,
      },
    });
  } catch (err: any) {
    socialLog.error({ err }, "Wallet payment methods error");
    return res.status(500).json({ success: false, message: "تعذر تحميل وسائل الدفع" });
  }
});

router.get("/wallet/withdraw-access", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const enabled = await isWithdrawAccessEnabledForUser(userId);
    return res.json({ success: true, data: { enabled } });
  } catch {
    return res.status(500).json({ success: false, message: "تعذر تحميل صلاحية السحب" });
  }
});

/**
 * POST /social/wallet/withdraw — طلب سحب (مؤمن ضد السحب المزدوج)
 */
router.post("/wallet/withdraw", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const withdrawEnabled = await isWithdrawAccessEnabledForUser(userId);
  if (!withdrawEnabled) {
    return res.status(403).json({ success: false, message: "خيار السحب غير متاح لحسابك حالياً" });
  }

  // Rate limit financial operations
  if (await isFinancialRateLimited(userId)) {
    return res.status(429).json({ success: false, message: "عدد كبير من الطلبات — حاول بعد قليل" });
  }
  try {
    const parsed = schema.withdrawalRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.flatten() });
    }

    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    // Minimum withdrawal amount
    const MIN_WITHDRAW = 1000;
    if (parsed.data.amount < MIN_WITHDRAW) {
      return res.status(400).json({ success: false, message: `الحد الأدنى للسحب هو ${MIN_WITHDRAW} عملة` });
    }

    // #16: Block if user already has active (pending/processing) withdrawal
    const [activeWr] = await db.select({ cnt: sql<number>`COUNT(*)` })
      .from(schema.withdrawalRequests)
      .where(and(
        eq(schema.withdrawalRequests.userId, userId),
        sql`${schema.withdrawalRequests.status} IN ('pending', 'processing')`
      ));
    if (Number(activeWr?.cnt || 0) > 0) {
      return res.status(400).json({ success: false, message: "لديك طلب سحب قيد المعالجة — انتظر حتى يُعالج أو ألغِه" });
    }

    // ── Daily & Weekly withdrawal limits ──
    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStartDate = new Date(dayStart);
    weekStartDate.setDate(weekStartDate.getDate() - 7);

    const [dailyTotal] = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(schema.withdrawalRequests)
      .where(and(
        eq(schema.withdrawalRequests.userId, userId),
        sql`${schema.withdrawalRequests.createdAt} >= ${dayStart}`,
        ne(schema.withdrawalRequests.status, "rejected")
      ));
    if ((Number(dailyTotal?.total || 0) + parsed.data.amount) > DAILY_WITHDRAW_LIMIT) {
      socialLog.warn({ audit: "withdrawal_limit_hit", userId, limit: "daily", amount: parsed.data.amount }, "Daily withdrawal limit exceeded");
      return res.status(400).json({ success: false, message: `تجاوزت الحد اليومي للسحب (${DAILY_WITHDRAW_LIMIT.toLocaleString()} عملة)` });
    }

    const [weeklyTotal] = await db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
      .from(schema.withdrawalRequests)
      .where(and(
        eq(schema.withdrawalRequests.userId, userId),
        sql`${schema.withdrawalRequests.createdAt} >= ${weekStartDate}`,
        ne(schema.withdrawalRequests.status, "rejected")
      ));
    if ((Number(weeklyTotal?.total || 0) + parsed.data.amount) > WEEKLY_WITHDRAW_LIMIT) {
      socialLog.warn({ audit: "withdrawal_limit_hit", userId, limit: "weekly", amount: parsed.data.amount }, "Weekly withdrawal limit exceeded");
      return res.status(400).json({ success: false, message: `تجاوزت الحد الأسبوعي للسحب (${WEEKLY_WITHDRAW_LIMIT.toLocaleString()} عملة)` });
    }

    // #22: Get conversion rate BEFORE opening transaction (avoid extra DB read inside tx)
    const convRate = await getConversionRate();
    const amountUsd = (parsed.data.amount / convRate).toFixed(2);

    // Use DB transaction to prevent race conditions (double-withdraw)
    const result = await db.transaction(async (tx) => {
      // Lock user row and check balance atomically
      const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      if (!user) throw new Error("USER_NOT_FOUND");

      if (user.coins < parsed.data.amount) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      // Deduct coins first
      const newBalance = user.coins - parsed.data.amount;
      await tx.update(schema.users).set({ coins: newBalance }).where(eq(schema.users.id, userId));

      // Create withdrawal request (encrypt payment details for PII protection)
      const encryptedDetails = parsed.data.paymentDetails
        ? encryptMessage(parsed.data.paymentDetails, `withdrawal:${userId}`)
        : parsed.data.paymentDetails;

      const [withdrawal] = await tx.insert(schema.withdrawalRequests).values({
        userId,
        amount: parsed.data.amount,
        amountUsd,
        paymentMethodId: parsed.data.paymentMethodId,
        paymentDetails: encryptedDetails,
        status: "pending",
      }).returning();

      if (!withdrawal) throw new Error("WITHDRAW_CREATE_FAILED");

      // Create wallet transaction record
      await tx.insert(schema.walletTransactions).values({
        userId,
        type: "withdrawal",
        amount: -parsed.data.amount,
        balanceAfter: newBalance,
        currency: "coins",
        description: `طلب سحب #${withdrawal.id}`,
        referenceId: withdrawal.id,
        status: "pending",
      });

      return withdrawal;
    });

    socialLog.info({ audit: "withdrawal_requested", userId, amount: parsed.data.amount, withdrawalId: result.id }, "Withdrawal requested");

    io.emit("finance-updated", {
      type: "withdrawal-created",
      ts: Date.now(),
      withdrawalId: result.id,
      userId,
      amount: parsed.data.amount,
    });

    // Backward-compatible event for any clients still listening to legacy admin event.
    io.emit("admin:new-withdrawal", {
      id: result.id,
      userId,
      amount: parsed.data.amount,
      createdAt: result.createdAt,
    });

    return res.json({ success: true, data: result, message: "تم إرسال طلب السحب بنجاح" });
  } catch (err: any) {
    if (err.message === "USER_NOT_FOUND") {
      socialLog.warn({ audit: "withdrawal_rejected", userId, reason: "user_not_found" }, "Withdrawal rejected");
      return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    }
    if (err.message === "INSUFFICIENT_BALANCE") {
      socialLog.warn({ audit: "withdrawal_rejected", userId, reason: "insufficient_balance" }, "Withdrawal rejected — insufficient balance");
      return res.status(400).json({ success: false, message: "رصيد غير كافي" });
    }
    if (err.message === "WITHDRAW_CREATE_FAILED") {
      return res.status(500).json({ success: false, message: "حدث خطأ في إنشاء طلب السحب" });
    }
    socialLog.error({ err }, "Wallet withdraw error");
    return res.status(500).json({ success: false, message: "حدث خطأ في طلب السحب" });
  }
});

/**
 * GET /social/wallet/withdrawal-requests — تتبع طلبات السحب الخاصة بالمستخدم
 */
router.get("/wallet/withdrawal-requests", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const withdrawEnabled = await isWithdrawAccessEnabledForUser(userId);
  if (!withdrawEnabled) {
    return res.status(403).json({ success: false, message: "خيار السحب غير متاح لحسابك حالياً" });
  }

  try {
    const page = parseInt(req.query.page as string) || 1;
    const result = await storage.getWithdrawalRequests(page, 20, { userId });
    return res.json({ success: true, data: result.data, total: result.total });
  } catch (err: any) {
    socialLog.error({ err }, "Get user withdrawal requests error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

/**
 * GET /social/wallet/income-chart — بيانات الدخل اليومي (آخر 30 يوم)
 */
router.get("/wallet/income-chart", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, data: [] });

    const days = Math.min(parseInt(req.query.days as string) || 30, 90);
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const dailyIncome = await db.select({
      day: sql<string>`DATE(${schema.walletTransactions.createdAt})`,
      total: sql<number>`COALESCE(SUM(${schema.walletTransactions.amount}), 0)`,
    })
      .from(schema.walletTransactions)
      .where(and(
        eq(schema.walletTransactions.userId, userId),
        sql`${schema.walletTransactions.type} IN ('gift_received', 'commission')`,
        eq(schema.walletTransactions.status, "completed"),
        sql`${schema.walletTransactions.createdAt} >= ${startDate}`
      ))
      .groupBy(sql`DATE(${schema.walletTransactions.createdAt})`)
      .orderBy(sql`DATE(${schema.walletTransactions.createdAt})`);

    return res.json({ success: true, data: dailyIncome.map(d => ({ day: d.day, total: Number(d.total) })) });
  } catch (err: any) {
    socialLog.error({ err }, "Income chart error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

/**
 * POST /social/wallet/cancel-withdrawal — إلغاء طلب سحب معلق
 */
router.post("/wallet/cancel-withdrawal", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const withdrawEnabled = await isWithdrawAccessEnabledForUser(userId);
  if (!withdrawEnabled) {
    return res.status(403).json({ success: false, message: "خيار السحب غير متاح لحسابك حالياً" });
  }

  try {
    const { withdrawalId } = req.body;
    if (!withdrawalId) return res.status(400).json({ success: false, message: "معرف الطلب مطلوب" });

    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    const result = await db.transaction(async (tx) => {
      const [wr] = await tx.select().from(schema.withdrawalRequests)
        .where(and(
          eq(schema.withdrawalRequests.id, withdrawalId),
          eq(schema.withdrawalRequests.userId, userId),
          eq(schema.withdrawalRequests.status, "pending")
        )).limit(1);
      if (!wr) throw new Error("NOT_FOUND");

      // Refund coins
      const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      if (!user) throw new Error("USER_NOT_FOUND");
      const newBalance = user.coins + wr.amount;
      await tx.update(schema.users).set({ coins: newBalance }).where(eq(schema.users.id, userId));

      // Update withdrawal status
      await tx.update(schema.withdrawalRequests)
        .set({ status: "rejected", adminNotes: "Cancelled by user" })
        .where(eq(schema.withdrawalRequests.id, withdrawalId));

      // Create refund transaction
      await tx.insert(schema.walletTransactions).values({
        userId,
        type: "refund",
        amount: wr.amount,
        balanceAfter: newBalance,
        currency: "coins",
        description: `إلغاء طلب سحب #${wr.id}`,
        referenceId: wr.id,
        status: "completed",
      });

      return { newBalance };
    });

    // Emit balance update via socket
    const socketId = await getUserSocketId(userId);
    if (socketId) {
      io.to(`user:${userId}`).emit("balance-update", { coins: result.newBalance });
      io.to(`user:${userId}`).emit("withdrawal-status-change", { withdrawalId, status: "rejected", reason: "Cancelled by user" });
    }

    return res.json({ success: true, message: "تم إلغاء طلب السحب" });
  } catch (err: any) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ success: false, message: "الطلب غير موجود أو لا يمكن إلغاؤه" });
    if (err.message === "USER_NOT_FOUND") return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    socialLog.error({ err }, "Cancel withdrawal error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

/**
 * #14: GET /social/wallet/spending-summary — ملخص الإنفاق (totalSpent + breakdown) في API واحد
 */
router.get("/wallet/spending-summary", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, data: { totalSpent: 0, breakdown: [] } });

    const conditions = and(
      eq(schema.walletTransactions.userId, userId),
      sql`${schema.walletTransactions.amount} < 0`,
      eq(schema.walletTransactions.status, "completed")
    );

    const [[spentResult], breakdown] = await Promise.all([
      db.select({ total: sql<number>`COALESCE(SUM(ABS(amount)), 0)` })
        .from(schema.walletTransactions).where(conditions),
      db.select({
        type: schema.walletTransactions.type,
        total: sql<number>`COALESCE(SUM(ABS(amount)), 0)`,
        count: sql<number>`COUNT(*)`,
      }).from(schema.walletTransactions).where(conditions)
        .groupBy(schema.walletTransactions.type),
    ]);

    return res.json({
      success: true,
      data: {
        totalSpent: Number(spentResult?.total || 0),
        breakdown: breakdown.map(b => ({ type: b.type, total: Number(b.total), count: Number(b.count) })),
      },
    });
  } catch (err: any) {
    socialLog.error({ err }, "Spending summary error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

/**
 * #15: GET /social/wallet/withdraw-limits — الحدود المتبقية للسحب (يومي + أسبوعي)
 */
router.get("/wallet/withdraw-limits", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const withdrawEnabled = await isWithdrawAccessEnabledForUser(userId);
  if (!withdrawEnabled) {
    return res.status(403).json({ success: false, message: "خيار السحب غير متاح لحسابك حالياً" });
  }

  try {
    const db = getDb();
    if (!db) return res.json({ success: true, data: { dailyLimit: DAILY_WITHDRAW_LIMIT, weeklyLimit: WEEKLY_WITHDRAW_LIMIT, dailyUsed: 0, weeklyUsed: 0, dailyRemaining: DAILY_WITHDRAW_LIMIT, weeklyRemaining: WEEKLY_WITHDRAW_LIMIT, hasActiveRequest: false } });

    const now = new Date();
    const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStartDate = new Date(dayStart);
    weekStartDate.setDate(weekStartDate.getDate() - 7);

    const [[dailyResult], [weeklyResult], [activeResult]] = await Promise.all([
      db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(schema.withdrawalRequests)
        .where(and(
          eq(schema.withdrawalRequests.userId, userId),
          sql`${schema.withdrawalRequests.createdAt} >= ${dayStart}`,
          ne(schema.withdrawalRequests.status, "rejected")
        )),
      db.select({ total: sql<number>`COALESCE(SUM(amount), 0)` })
        .from(schema.withdrawalRequests)
        .where(and(
          eq(schema.withdrawalRequests.userId, userId),
          sql`${schema.withdrawalRequests.createdAt} >= ${weekStartDate}`,
          ne(schema.withdrawalRequests.status, "rejected")
        )),
      db.select({ cnt: sql<number>`COUNT(*)` })
        .from(schema.withdrawalRequests)
        .where(and(
          eq(schema.withdrawalRequests.userId, userId),
          sql`${schema.withdrawalRequests.status} IN ('pending', 'processing')`
        )),
    ]);

    const dailyUsed = Number(dailyResult?.total || 0);
    const weeklyUsed = Number(weeklyResult?.total || 0);

    return res.json({
      success: true,
      data: {
        dailyLimit: DAILY_WITHDRAW_LIMIT,
        weeklyLimit: WEEKLY_WITHDRAW_LIMIT,
        dailyUsed,
        weeklyUsed,
        dailyRemaining: Math.max(0, DAILY_WITHDRAW_LIMIT - dailyUsed),
        weeklyRemaining: Math.max(0, WEEKLY_WITHDRAW_LIMIT - weeklyUsed),
        hasActiveRequest: Number(activeResult?.cnt || 0) > 0,
      },
    });
  } catch (err: any) {
    socialLog.error({ err }, "Withdraw limits error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

/**
 * GET /social/wallet/transactions/export — تصدير كل المعاملات CSV
 */
router.get("/wallet/transactions/export", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    const allTx = await db.select().from(schema.walletTransactions)
      .where(eq(schema.walletTransactions.userId, userId))
      .orderBy(desc(schema.walletTransactions.createdAt))
      .limit(10000);

    const csv = ["ID,Type,Amount,BalanceAfter,Currency,Description,Status,Date"]
      .concat(allTx.map(tx =>
        `${tx.id},${tx.type},${tx.amount},${tx.balanceAfter},${tx.currency},"${(tx.description || '').replace(/"/g, '""')}",${tx.status},${tx.createdAt?.toISOString() || ''}`
      ))
      .join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="wallet-transactions-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send("\uFEFF" + csv);
  } catch (err: any) {
    socialLog.error({ err }, "Export transactions error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

// ═══════════════════════════════════════
// GIFT SYSTEM — User-facing endpoints
// ═══════════════════════════════════════

// GET /social/gifts — public gift catalog
router.get("/gifts", async (req: Request, res: Response) => {
  try {
    const gifts = await storage.getGifts();
    const activeGifts = (gifts || []).filter((g: any) => g.isActive !== false);
    return res.json(activeGifts);
  } catch (err: any) {
    socialLog.error({ err }, "Get gifts error");
    return res.status(500).json({ success: false, message: "خطأ في جلب الهدايا" });
  }
});

// POST /social/gifts/send — send gift to another user (deducts coins, creates records)
router.post("/gifts/send", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  // Rate limit financial operations
  if (await isFinancialRateLimited(userId)) {
    return res.status(429).json({ success: false, message: "عدد كبير من الطلبات — حاول بعد قليل" });
  }
  try {
    // Validate input with Zod schema
    const parsed = schema.sendGiftSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.flatten() });
    }
    const { giftId, receiverId, streamId, quantity = 1 } = parsed.data;

    if (receiverId === userId) {
      return res.status(400).json({ success: false, message: "لا يمكنك إرسال هدية لنفسك" });
    }

    const gift = await storage.getGift(giftId);
    if (!gift || gift.isActive === false) {
      return res.status(404).json({ success: false, message: "الهدية غير موجودة" });
    }

    const totalPrice = gift.price * quantity;
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    // Use DB transaction to prevent race conditions (double-spend)
    const result = await db.transaction(async (tx) => {
      // Lock sender row with FOR UPDATE to prevent concurrent double-spend
      const [sender] = await tx.execute(sql`SELECT * FROM users WHERE id = ${userId} FOR UPDATE`) as any;
      if (!sender || sender.coins < totalPrice) {
        throw new Error("INSUFFICIENT_BALANCE");
      }

      const newSenderBalance = sender.coins - totalPrice;

      // Deduct from sender atomically
      await tx.update(schema.users).set({ coins: newSenderBalance }).where(eq(schema.users.id, userId));

      // Add to receiver (also lock to prevent lost updates)
      const [receiver] = await tx.execute(sql`SELECT * FROM users WHERE id = ${receiverId} FOR UPDATE`) as any;
      if (receiver) {
        await tx.update(schema.users).set({ diamonds: (receiver.diamonds || 0) + totalPrice }).where(eq(schema.users.id, receiverId));
      }

      // Create gift transaction record
      await tx.insert(schema.giftTransactions).values({
        senderId: userId,
        receiverId,
        giftId,
        streamId: streamId || null,
        quantity,
        totalPrice,
      });

      // Wallet tx for sender
      await tx.insert(schema.walletTransactions).values({
        userId,
        type: "gift_sent",
        amount: -totalPrice,
        balanceAfter: newSenderBalance,
        currency: "coins",
        description: `إرسال هدية ${gift.name || gift.nameAr}`,
        referenceId: giftId,
        status: "completed",
      });

      // Wallet tx for receiver
      await tx.insert(schema.walletTransactions).values({
        userId: receiverId,
        type: "gift_received",
        amount: totalPrice,
        balanceAfter: (receiver?.diamonds || 0) + totalPrice,
        currency: "diamonds",
        description: `استلام هدية ${gift.name || gift.nameAr}`,
        referenceId: giftId,
        status: "completed",
      });

      // Update stream totalGifts if in a stream
      if (streamId) {
        await tx.update(schema.streams).set({
          totalGifts: sql`${schema.streams.totalGifts} + ${totalPrice}`,
        }).where(eq(schema.streams.id, streamId));
      }

      return newSenderBalance;
    });

    // Audit log for successful gift (fraud detection)
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    socialLog.info({
      audit: "gift_sent",
      senderId: userId,
      receiverId,
      giftId,
      quantity,
      ip,
    }, `Gift sent: ${userId} → ${receiverId} (gift ${giftId} x${quantity})`);

    // Authoritative realtime gift event (server-origin) for stream UIs.
    if (streamId && io) {
      const [senderUser] = await db.select({
        id: schema.users.id,
        displayName: schema.users.displayName,
        username: schema.users.username,
        avatar: schema.users.avatar,
      }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);

      const senderName = senderUser?.displayName || senderUser?.username || "مستخدم";
      const payload = {
        streamId,
        roomId: streamId,
        gift: {
          id: gift.id,
          name: gift.name || gift.nameAr,
          icon: gift.icon || null,
          price: gift.price,
        },
        sender: {
          id: senderUser?.id || userId,
          name: senderName,
          avatar: senderUser?.avatar || null,
        },
        giftName: gift.name || gift.nameAr,
        giftImage: gift.icon || null,
        senderName,
      };
      io.to(`room:${streamId}`).emit("gift-received", payload);
    }

    return res.json({ success: true, message: "تم إرسال الهدية بنجاح", newBalance: result });
  } catch (err: any) {
    if (err.message === "INSUFFICIENT_BALANCE") {
      return res.status(400).json({ success: false, message: "رصيدك غير كافٍ" });
    }
    // Audit log for failed gift operations (fraud detection)
    const ip = req.ip || req.socket?.remoteAddress || "unknown";
    socialLog.error({
      err,
      audit: "gift_send_failed",
      senderId: userId,
      receiverId: req.body?.receiverId,
      giftId: req.body?.giftId,
      quantity: req.body?.quantity,
      ip,
    }, "Send gift error");
    return res.status(500).json({ success: false, message: "خطأ في إرسال الهدية" });
  }
});

// GET /social/gifts/history — user's gift history
router.get("/gifts/history", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const role = (req.query.role as string) === "received" ? "received" : "sent";
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const history = await storage.getUserGiftHistory(userId, role as "sent" | "received", page, 20);
    return res.json(history || []);
  } catch (err: any) {
    socialLog.error({ err }, "Gift history error");
    return res.status(500).json({ success: false, message: "خطأ في جلب سجل الهدايا" });
  }
});

// ═══════════════════════════════════════
// FOLLOW SYSTEM — User-facing endpoints
// ═══════════════════════════════════════

// POST /social/follow/:userId — follow a user
router.post("/follow/:userId", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const targetId = paramStr(req.params.userId);
  if (!targetId || targetId === userId) {
    return res.status(400).json({ success: false, message: "لا يمكن متابعة نفسك" });
  }
  try {
    await storage.followUser(userId, targetId);
    return res.json({ success: true, message: "تمت المتابعة" });
  } catch (err: any) {
    socialLog.error({ err }, "Follow error");
    return res.status(500).json({ success: false, message: "خطأ في المتابعة" });
  }
});

// DELETE /social/follow/:userId — unfollow a user
router.delete("/follow/:userId", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const targetId = paramStr(req.params.userId);
  try {
    await storage.unfollowUser(userId, targetId);
    return res.json({ success: true, message: "تم إلغاء المتابعة" });
  } catch (err: any) {
    socialLog.error({ err }, "Unfollow error");
    return res.status(500).json({ success: false, message: "خطأ في إلغاء المتابعة" });
  }
});

// GET /social/followers — my followers
router.get("/followers", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const followers = await storage.getFollowers(userId, page, 20);
    return res.json(followers || []);
  } catch (err: any) {
    socialLog.error({ err }, "Followers error");
    return res.status(500).json({ success: false, message: "خطأ في جلب المتابعين" });
  }
});

// GET /social/following — who I follow
router.get("/following", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const following = await storage.getFollowing(userId, page, 20);
    return res.json(following || []);
  } catch (err: any) {
    socialLog.error({ err }, "Following error");
    return res.status(500).json({ success: false, message: "خطأ في جلب المتابَعين" });
  }
});

// GET /social/follow/count/:userId — follower/following counts for any user
router.get("/follow/count/:userId", async (req: Request, res: Response) => {
  const targetId = paramStr(req.params.userId);
  try {
    const counts = await storage.getFollowCounts(targetId);
    return res.json(counts || { followers: 0, following: 0 });
  } catch (err: any) {
    socialLog.error({ err }, "Follow counts error");
    return res.status(500).json({ success: false, message: "خطأ في جلب الأعداد" });
  }
});

// GET /social/profile/me/stats — consolidated profile stats for current user
router.get("/profile/me/stats", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const db = getDb();
    if (!db) {
      return res.json({
        success: true,
        data: {
          followers: 0,
          following: 0,
          friends: 0,
          giftsSent: 0,
          giftsReceived: 0,
          streamHours: 0,
        },
      });
    }

    const [followersRow, followingRow, friendsRow, giftsSentRow, giftsReceivedRow, streamHoursRow] = await Promise.all([
      db.select({ c: count() }).from(schema.userFollows).where(eq(schema.userFollows.followingId, userId)),
      db.select({ c: count() }).from(schema.userFollows).where(eq(schema.userFollows.followerId, userId)),
      db.select({ c: count() }).from(schema.friendships).where(
        and(
          eq(schema.friendships.status, "accepted"),
          or(
            eq(schema.friendships.senderId, userId),
            eq(schema.friendships.receiverId, userId),
          ),
        ),
      ),
      db.select({ c: count() }).from(schema.walletTransactions).where(
        and(
          eq(schema.walletTransactions.userId, userId),
          eq(schema.walletTransactions.type, "gift_sent"),
          eq(schema.walletTransactions.status, "completed"),
        ),
      ),
      db.select({ c: count() }).from(schema.walletTransactions).where(
        and(
          eq(schema.walletTransactions.userId, userId),
          eq(schema.walletTransactions.type, "gift_received"),
          eq(schema.walletTransactions.status, "completed"),
        ),
      ),
      db.select({
        hours: sql<number>`COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(${schema.streams.endedAt}, NOW()) - ${schema.streams.startedAt}))) / 3600, 0)`,
      }).from(schema.streams).where(
        and(
          eq(schema.streams.userId, userId),
          sql`${schema.streams.startedAt} IS NOT NULL`,
        ),
      ),
    ]);

    const toInt = (v: unknown) => Number(v || 0) || 0;

    return res.json({
      success: true,
      data: {
        followers: toInt(followersRow?.[0]?.c),
        following: toInt(followingRow?.[0]?.c),
        friends: toInt(friendsRow?.[0]?.c),
        giftsSent: toInt(giftsSentRow?.[0]?.c),
        giftsReceived: toInt(giftsReceivedRow?.[0]?.c),
        streamHours: Math.max(0, Math.floor(Number(streamHoursRow?.[0]?.hours || 0))),
      },
    });
  } catch (err: any) {
    socialLog.error({ err, userId }, "Profile stats error");
    return res.status(500).json({ success: false, message: "خطأ في تحميل إحصائيات الحساب" });
  }
});

// GET /social/follow/status/:userId — check if I follow this user
router.get("/follow/status/:userId", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const targetId = paramStr(req.params.userId);
  try {
    const following = await storage.isFollowing(userId, targetId);
    return res.json({ following });
  } catch (err: any) {
    socialLog.error({ err }, "Follow status error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ═══════════════════════════════════════
// STREAMS — Live streaming endpoints
// ═══════════════════════════════════════

// Helper: enrich stream data with host info
async function enrichStream(s: any) {
  const db = getDb();
  if (!db || !s) return s;
  const [host] = await db.select().from(schema.users).where(eq(schema.users.id, s.userId)).limit(1);
  return {
    ...s,
    hostName: host?.displayName || host?.username || "مجهول",
    hostUsername: host?.username || "",
    hostAvatar: host?.avatar || null,
    hostLevel: host?.level || 1,
    tags: s.tags ? (typeof s.tags === "string" ? s.tags.split(",").map((t: string) => t.trim()) : s.tags) : [],
  };
}

type LiveFeatureFlags = {
  liveRecommendationEnabled: boolean;
  postStreamReportEnabled: boolean;
  liveGamificationEnabled: boolean;
  creatorAnalyticsCsvEnabled: boolean;
  smartDirectorTelemetryEnabled: boolean;
  autoClipsEnabled: boolean;
};

async function getLiveFeatureFlags(db: any): Promise<LiveFeatureFlags> {
  if (!db) {
    return {
      liveRecommendationEnabled: true,
      postStreamReportEnabled: true,
      liveGamificationEnabled: true,
      creatorAnalyticsCsvEnabled: true,
      smartDirectorTelemetryEnabled: true,
      autoClipsEnabled: true,
    };
  }

  const keys = [
    "live_recommendation_enabled",
    "post_stream_report_enabled",
    "live_gamification_enabled",
    "creator_analytics_csv_enabled",
    "smart_director_telemetry_enabled",
    "auto_clips_enabled",
  ];
  const rows = await db.select({ key: schema.systemSettings.key, value: schema.systemSettings.value })
    .from(schema.systemSettings)
    .where(inArray(schema.systemSettings.key, keys));

  const values: Record<string, string> = {};
  for (const row of rows) values[row.key] = String(row.value || "").toLowerCase();

  const toBool = (key: string, defaultValue: boolean) => {
    const v = values[key];
    if (v === undefined) return defaultValue;
    if (v === "false" || v === "0" || v === "off" || v === "no") return false;
    if (v === "true" || v === "1" || v === "on" || v === "yes") return true;
    return defaultValue;
  };

  return {
    liveRecommendationEnabled: toBool("live_recommendation_enabled", true),
    postStreamReportEnabled: toBool("post_stream_report_enabled", true),
    liveGamificationEnabled: toBool("live_gamification_enabled", true),
    creatorAnalyticsCsvEnabled: toBool("creator_analytics_csv_enabled", true),
    smartDirectorTelemetryEnabled: toBool("smart_director_telemetry_enabled", true),
    autoClipsEnabled: toBool("auto_clips_enabled", true),
  };
}

// GET /social/feature-flags — lightweight runtime flags for live UX
router.get("/feature-flags", async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    const flags = await getLiveFeatureFlags(db);
    return res.json({ success: true, data: flags });
  } catch (err: any) {
    socialLog.error({ err }, "Feature flags error");
    return res.json({
      success: true,
      data: {
        liveRecommendationEnabled: true,
        postStreamReportEnabled: true,
        liveGamificationEnabled: true,
        creatorAnalyticsCsvEnabled: true,
        smartDirectorTelemetryEnabled: true,
        autoClipsEnabled: true,
      },
    });
  }
});

type DailyMissionState = {
  id: "watch_minutes" | "send_gift" | "follow_user";
  title: string;
  progress: number;
  target: number;
  done: boolean;
  rewardXp: number;
  rewardCoins: number;
};

async function computeDailyMissionState(db: any, userId: string) {
  const [watchRow] = await db.select({
    minutes: sql<number>`COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(${schema.streamViewers.leftAt}, NOW()) - ${schema.streamViewers.joinedAt}))), 0) / 60`,
  }).from(schema.streamViewers)
    .where(and(
      eq(schema.streamViewers.userId, userId),
      sql`${schema.streamViewers.joinedAt} >= CURRENT_DATE`,
    ));

  const [giftRow] = await db.select({ count: count() }).from(schema.giftTransactions)
    .where(and(
      eq(schema.giftTransactions.senderId, userId),
      sql`${schema.giftTransactions.createdAt} >= CURRENT_DATE`,
    ));

  const [followRow] = await db.select({ count: count() }).from(schema.userFollows)
    .where(and(
      eq(schema.userFollows.followerId, userId),
      sql`${schema.userFollows.createdAt} >= CURRENT_DATE`,
    ));

  const watchMinutes = Math.max(0, Math.round(Number(watchRow?.minutes || 0)));
  const giftCount = Math.max(0, Number(giftRow?.count || 0));
  const followCount = Math.max(0, Number(followRow?.count || 0));

  const missions: DailyMissionState[] = [
    { id: "watch_minutes", title: "شاهد بثًا لمدة 20 دقيقة", progress: watchMinutes, target: 20, done: watchMinutes >= 20, rewardXp: 80, rewardCoins: 20 },
    { id: "send_gift", title: "أرسل هدية واحدة", progress: giftCount, target: 1, done: giftCount >= 1, rewardXp: 120, rewardCoins: 35 },
    { id: "follow_user", title: "تابع مستخدمًا جديدًا", progress: followCount, target: 1, done: followCount >= 1, rewardXp: 60, rewardCoins: 15 },
  ];

  return missions;
}

function applyLevelProgression(currentLevel: number, currentXp: number, gainedXp: number) {
  let level = Math.max(1, currentLevel || 1);
  let xp = Math.max(0, currentXp || 0) + Math.max(0, gainedXp || 0);
  let next = level * 1000;
  while (xp >= next && level < 200) {
    xp -= next;
    level += 1;
    next = level * 1000;
  }
  return { level, xp };
}

// GET /social/gamification/daily — mission progress + streak
router.get("/gamification/daily", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    const flags = await getLiveFeatureFlags(db);
    if (!flags.liveGamificationEnabled) {
      return res.json({ success: true, data: { enabled: false, missions: [], canClaim: false, streak: 0 } });
    }

    const missions = await computeDailyMissionState(db, userId);
    const [todayClaim] = await db.select().from(schema.userDailyMissions)
      .where(and(
        eq(schema.userDailyMissions.userId, userId),
        sql`${schema.userDailyMissions.missionDate} = CURRENT_DATE`,
      ))
      .limit(1);

    const [latestClaim] = await db.select().from(schema.userDailyMissions)
      .where(eq(schema.userDailyMissions.userId, userId))
      .orderBy(desc(schema.userDailyMissions.missionDate))
      .limit(1);

    const allDone = missions.every((m) => m.done);
    const baseXp = missions.reduce((sum, m) => sum + m.rewardXp, 0);
    const baseCoins = missions.reduce((sum, m) => sum + m.rewardCoins, 0);

    return res.json({
      success: true,
      data: {
        enabled: true,
        day: new Date().toISOString().slice(0, 10),
        missions,
        canClaim: allDone && !todayClaim,
        claimed: !!todayClaim,
        streak: Number(todayClaim?.streakCount || latestClaim?.streakCount || 0),
        rewardPreview: {
          xp: baseXp,
          coins: baseCoins,
        },
      },
    });
  } catch (err: any) {
    socialLog.error({ err }, "Daily gamification state error");
    return res.status(500).json({ success: false, message: "خطأ في تحميل المهام اليومية" });
  }
});

// POST /social/gamification/claim — claim daily rewards once per day
router.post("/gamification/claim", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    const flags = await getLiveFeatureFlags(db);
    if (!flags.liveGamificationEnabled) {
      return res.status(403).json({ success: false, message: "نظام المهام اليومية غير مفعل" });
    }

    const [alreadyClaimed] = await db.select({ id: schema.userDailyMissions.id })
      .from(schema.userDailyMissions)
      .where(and(
        eq(schema.userDailyMissions.userId, userId),
        sql`${schema.userDailyMissions.missionDate} = CURRENT_DATE`,
      ))
      .limit(1);
    if (alreadyClaimed) {
      return res.status(409).json({ success: false, message: "تم استلام مكافأة اليوم مسبقاً" });
    }

    const missions = await computeDailyMissionState(db, userId);
    if (!missions.every((m) => m.done)) {
      return res.status(400).json({ success: false, message: "لم تكتمل المهام اليومية بعد" });
    }

    const baseXp = missions.reduce((sum, m) => sum + m.rewardXp, 0);
    const baseCoins = missions.reduce((sum, m) => sum + m.rewardCoins, 0);

    const [yesterdayClaim] = await db.select().from(schema.userDailyMissions)
      .where(and(
        eq(schema.userDailyMissions.userId, userId),
        sql`${schema.userDailyMissions.missionDate} = (CURRENT_DATE - INTERVAL '1 day')::date`,
      ))
      .limit(1);

    const nextStreak = yesterdayClaim ? Number(yesterdayClaim.streakCount || 0) + 1 : 1;
    const streakXpBonus = Math.min(150, nextStreak * 10);
    const streakCoinBonus = Math.min(100, nextStreak * 5);
    const totalXp = baseXp + streakXpBonus;
    const totalCoins = baseCoins + streakCoinBonus;

    const [user] = await db.select({
      id: schema.users.id,
      level: schema.users.level,
      xp: schema.users.xp,
      coins: schema.users.coins,
    }).from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    const levelState = applyLevelProgression(Number(user.level || 1), Number(user.xp || 0), totalXp);
    const [updatedUser] = await db.update(schema.users)
      .set({
        xp: levelState.xp,
        level: levelState.level,
        coins: sql`${schema.users.coins} + ${totalCoins}`,
      })
      .where(eq(schema.users.id, userId))
      .returning({ id: schema.users.id, level: schema.users.level, xp: schema.users.xp, coins: schema.users.coins });

    await db.insert(schema.userDailyMissions).values({
      userId,
      missionDate: new Date().toISOString().slice(0, 10),
      streakCount: nextStreak,
      xpAwarded: totalXp,
      coinsAwarded: totalCoins,
      metadata: JSON.stringify({ missions: missions.map((m) => ({ id: m.id, progress: m.progress })) }),
    });

    await db.insert(schema.walletTransactions).values({
      userId,
      type: "bonus",
      amount: totalCoins,
      balanceAfter: Number(updatedUser?.coins || Number(user.coins || 0) + totalCoins),
      currency: "coins",
      description: `Daily missions reward (streak ${nextStreak})`,
      status: "completed",
    });

    return res.json({
      success: true,
      data: {
        streak: nextStreak,
        reward: { xp: totalXp, coins: totalCoins, streakXpBonus, streakCoinBonus },
        user: updatedUser,
      },
    });
  } catch (err: any) {
    socialLog.error({ err }, "Daily claim error");
    return res.status(500).json({ success: false, message: "خطأ في استلام مكافأة اليوم" });
  }
});

// GET /social/streams/active — list active live streams with host info
router.get("/streams/active", async (req: Request, res: Response) => {
  try {
    const category = String(req.query.category || "").trim();
    const db = getDb();
    if (!db) return res.json([]);

    const conditions = [eq(schema.streams.status, "active")];
    if (category && category !== "all") {
      conditions.push(eq(schema.streams.category, category));
    }

    const data = await db.select().from(schema.streams)
      .where(and(...conditions))
      .orderBy(desc(schema.streams.viewerCount)).limit(50);

    if (!data.length) return res.json([]);

    const userIds = data.map((s: any) => s.userId).filter(Boolean);
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const users = await db.select().from(schema.users).where(inArray(schema.users.id, userIds));
      users.forEach((u: any) => { usersMap[u.id] = u; });
    }

    const enriched = data.map((s: any) => {
      const host = usersMap[s.userId];
      return {
        ...s,
        hostName: host?.displayName || host?.username || "مجهول",
        hostUsername: host?.username || "",
        hostAvatar: host?.avatar || null,
        hostLevel: host?.level || 1,
        tags: s.tags ? (typeof s.tags === "string" ? s.tags.split(",").map((t: string) => t.trim()) : s.tags) : [],
      };
    });

    return res.json(enriched);
  } catch (err: any) {
    socialLog.error({ err }, "Active streams error");
    return res.json([]);
  }
});

// GET /social/streams/recommended — personalized discover feed ranking
router.get("/streams/recommended", async (req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.json([]);

    const flags = await getLiveFeatureFlags(db);
    if (!flags.liveRecommendationEnabled) {
      return res.json([]);
    }

    const category = String(req.query.category || "").trim();
    const currentUserId = String((req.session as any)?.userId || "").trim() || null;

    const conditions = [eq(schema.streams.status, "active")];
    if (category && category !== "all") {
      conditions.push(eq(schema.streams.category, category));
    }

    const streams = await db.select().from(schema.streams)
      .where(and(...conditions))
      .orderBy(desc(schema.streams.viewerCount), desc(schema.streams.startedAt))
      .limit(80);

    if (!streams.length) return res.json([]);

    const hostIds = [...new Set(streams.map((s: any) => s.userId).filter(Boolean))] as string[];
    const hosts = hostIds.length
      ? await db.select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatar: schema.users.avatar,
        level: schema.users.level,
      }).from(schema.users).where(inArray(schema.users.id, hostIds))
      : [];
    const hostsMap: Record<string, any> = {};
    for (const host of hosts) hostsMap[host.id] = host;

    let followedHostIds = new Set<string>();
    if (currentUserId && hostIds.length) {
      const follows = await db.select({ followingId: schema.userFollows.followingId })
        .from(schema.userFollows)
        .where(and(
          eq(schema.userFollows.followerId, currentUserId),
          inArray(schema.userFollows.followingId, hostIds),
        ));
      followedHostIds = new Set(follows.map((f: any) => f.followingId));
    }

    const now = Date.now();
    const ranked = streams.map((s: any) => {
      const startedAtMs = s.startedAt ? new Date(s.startedAt).getTime() : now;
      const ageMinutes = Math.max(1, (now - startedAtMs) / 60_000);
      const recencyBoost = Math.max(0.2, 1.4 - ageMinutes / 240);
      const followBoost = currentUserId && followedHostIds.has(s.userId) ? 1.35 : 1;
      const categoryBoost = category && category !== "all" && s.category === category ? 1.08 : 1;

      const base =
        (Number(s.viewerCount || 0) * 3) +
        (Number(s.peakViewers || 0) * 1.25) +
        (Number(s.totalGifts || 0) * 0.8);

      const score = Math.round(base * recencyBoost * followBoost * categoryBoost * 100) / 100;
      const host = hostsMap[s.userId];

      return {
        ...s,
        recommendationScore: score,
        hostName: host?.displayName || host?.username || "مجهول",
        hostUsername: host?.username || "",
        hostAvatar: host?.avatar || null,
        hostLevel: host?.level || 1,
        tags: s.tags ? (typeof s.tags === "string" ? s.tags.split(",").map((t: string) => t.trim()) : s.tags) : [],
      };
    });

    ranked.sort((a: any, b: any) => Number(b.recommendationScore) - Number(a.recommendationScore));
    return res.json(ranked.slice(0, 50));
  } catch (err: any) {
    socialLog.error({ err }, "Recommended streams error");
    return res.json([]);
  }
});

// GET /social/streams/my — get current user's active stream (if any)
router.get("/streams/my", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const stream = await storage.getUserActiveStream(userId);
    if (!stream) return res.json({ data: null });
    const enriched = await enrichStream(stream);
    return res.json({ data: enriched });
  } catch (err: any) {
    socialLog.error({ err }, "My stream error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// GET /social/streams/:id — get stream detail with host info
router.get("/streams/:id", async (req: Request, res: Response) => {
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    const enriched = await enrichStream(stream);
    return res.json({ data: enriched });
  } catch (err: any) {
    socialLog.error({ err }, "Stream detail error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// POST /social/streams/create — start a new live stream
router.post("/streams/create", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    // Permission check: canStream field + admin global toggle
    const db = getDb();
    if (db) {
      const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      if (!user) return res.status(401).json({ success: false, message: "المستخدم غير موجود" });

      // Check per-user canStream flag
      if (!user.canStream) {
        return res.status(403).json({ success: false, message: "تم تعطيل البث لحسابك. تواصل مع الإدارة." });
      }

      // Check admin global streaming toggle
      const { type: reqType } = req.body;
      const settingKey = reqType === "audio" ? "audio_streaming_enabled" : "video_streaming_enabled";
      const [globalSetting] = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, settingKey)).limit(1);
      if (globalSetting && globalSetting.value === "false") {
        // Global streaming disabled — only whitelisted users (canStream=true) with explicit override can bypass
        // Check if user has explicit whitelist entry
        const [whitelistSetting] = await db.select().from(schema.systemSettings)
          .where(eq(schema.systemSettings.key, `stream_whitelist_${userId}`)).limit(1);
        if (!whitelistSetting || whitelistSetting.value !== "true") {
          const msg = reqType === "audio" ? "البث الصوتي معطل حالياً من الإدارة" : "البث المرئي معطل حالياً من الإدارة";
          return res.status(403).json({ success: false, message: msg });
        }
      }
    }

    // Check if user already has an active stream
    const existing = await storage.getUserActiveStream(userId);
    if (existing) {
      return res.status(400).json({ success: false, message: "لديك بث نشط بالفعل", data: existing });
    }

    const { title, type, tags, category, scheduledAt } = req.body;
    if (!title || typeof title !== "string" || title.trim().length < 1) {
      return res.status(400).json({ success: false, message: "عنوان البث مطلوب" });
    }

    const streamType = ["live", "audio", "video_call"].includes(type) ? type : "live";
    const streamTags = Array.isArray(tags) ? tags.filter((t: any) => typeof t === "string").join(",") : (typeof tags === "string" ? tags : "");
    const validCategories = ["chat", "gaming", "music", "education", "sports", "cooking", "art", "other"];
    const streamCategory = validCategories.includes(category) ? category : null;
    const isScheduled = scheduledAt && new Date(scheduledAt) > new Date();

    const stream = await storage.createStream({
      userId,
      title: title.trim().slice(0, 200),
      type: streamType,
      tags: streamTags,
      category: streamCategory,
      status: isScheduled ? "scheduled" : "active",
      scheduledAt: isScheduled ? new Date(scheduledAt) : null,
      viewerCount: 0,
      peakViewers: 0,
      totalGifts: 0,
    } as any);

    if (!stream) {
      return res.status(500).json({ success: false, message: "فشل في إنشاء البث" });
    }

    // Add host as viewer with host role
    await storage.addStreamViewer(stream.id, userId, "host");

    // Create LiveKit room for media streaming
    try {
      await createLiveKitRoom(`stream-${stream.id}`, 300, 500);
    } catch (lkErr: any) {
      socialLog.warn({ err: lkErr }, "LiveKit room creation failed (non-blocking)");
    }

    const enriched = await enrichStream(stream);
    socialLog.info({ streamId: stream.id, userId, type: streamType }, "Stream created");

    // Notify followers that this user started a stream
    if (!isScheduled && io && db) {
      try {
        const followers = await db.select({ followerId: schema.userFollows.followerId })
          .from(schema.userFollows).where(eq(schema.userFollows.followingId, userId)).limit(500);
        const [hostUser] = await db.select({ displayName: schema.users.displayName, avatar: schema.users.avatar })
          .from(schema.users).where(eq(schema.users.id, userId)).limit(1);
        for (const f of followers) {
          const socketId = await getUserSocketId(f.followerId);
          if (socketId) {
            io.to(`user:${f.followerId}`).emit("stream-started", {
              streamId: stream.id,
              hostName: hostUser?.displayName || "مستخدم",
              hostAvatar: hostUser?.avatar || null,
              title: stream.title,
              type: streamType,
            });
          }
        }
      } catch { /* non-blocking */ }
    }

    return res.json({ success: true, data: enriched });
  } catch (err: any) {
    socialLog.error({ err }, "Create stream error");
    return res.status(500).json({ success: false, message: "خطأ في إنشاء البث" });
  }
});

// POST /social/streams/:id/end — end own stream
router.post("/streams/:id/end", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    if (stream.userId !== userId) return res.status(403).json({ success: false, message: "لا يمكنك إنهاء بث شخص آخر" });
    if (stream.status !== "active") return res.status(400).json({ success: false, message: "البث منتهي بالفعل" });

    const ended = await storage.endStream(streamId);

    // Cleanup LiveKit room
    try {
      await deleteLiveKitRoom(`stream-${streamId}`);
    } catch (lkErr: any) {
      socialLog.warn({ err: lkErr }, "LiveKit room deletion failed (non-blocking)");
    }

    socialLog.info({ streamId, userId }, "Stream ended");
    return res.json({ success: true, data: ended });
  } catch (err: any) {
    socialLog.error({ err }, "End stream error");
    return res.status(500).json({ success: false, message: "خطأ في إنهاء البث" });
  }
});

// POST /social/streams/:id/join — join stream as viewer
router.post("/streams/:id/join", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream || stream.status !== "active") {
      return res.status(404).json({ success: false, message: "البث غير متاح" });
    }

    await storage.addStreamViewer(streamId, userId, "viewer");

    // Update peak viewers if needed
    const db = getDb();
    if (db) {
      await db.update(schema.streams).set({
        peakViewers: sql`GREATEST(${schema.streams.peakViewers}, ${schema.streams.viewerCount})`,
      }).where(eq(schema.streams.id, streamId));
    }

    return res.json({ success: true });
  } catch (err: any) {
    socialLog.error({ err }, "Join stream error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// POST /social/streams/:id/leave — leave stream as viewer
router.post("/streams/:id/leave", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    await storage.removeStreamViewer(streamId, userId);
    return res.json({ success: true });
  } catch (err: any) {
    socialLog.error({ err }, "Leave stream error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// GET /social/streams/:id/viewers — list active viewers of a stream
router.get("/streams/:id/viewers", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const viewers = await storage.getStreamViewers(streamId);
    if (!viewers || !viewers.length) return res.json({ success: true, data: [] });

    const db = getDb();
    if (!db) return res.json({ success: true, data: [] });

    const viewerUserIds = viewers.map((v: any) => v.userId).filter(Boolean);
    const users = viewerUserIds.length > 0
      ? await db.select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatar: schema.users.avatar,
        level: schema.users.level,
      }).from(schema.users).where(inArray(schema.users.id, viewerUserIds))
      : [];

    const data = viewers.map((v: any) => {
      const u = users.find((u: any) => u.id === v.userId);
      return {
        id: v.userId,
        username: u?.username || "unknown",
        displayName: u?.displayName || "مجهول",
        avatar: u?.avatar || null,
        level: u?.level || 1,
        role: v.role || "viewer",
        joinedAt: v.joinedAt,
      };
    });

    return res.json({ success: true, data });
  } catch (err: any) {
    socialLog.error({ err }, "Stream viewers error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ═══════════════════════════════════════════════════════
// ── LiveKit — WebRTC Token Generation ──
// ═══════════════════════════════════════════════════════

/**
 * POST /api/social/streams/:id/token
 * Generate a LiveKit access token for joining a stream room
 * Body: { role?: "host" | "speaker" | "viewer" }
 * Returns: { token: string, wsUrl: string, roomName: string }
 */
router.post("/streams/:id/token", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream || stream.status !== "active") {
      return res.status(404).json({ success: false, message: "البث غير متاح" });
    }

    // Determine role strictly on server-side state (never trust requested role).
    const isHost = stream.userId === userId;
    let isSpeaker = false;

    const db = getDb();
    if (!isHost && db) {
      const [viewerRow] = await db.select({ role: schema.streamViewers.role })
        .from(schema.streamViewers)
        .where(and(
          eq(schema.streamViewers.streamId, streamId),
          eq(schema.streamViewers.userId, userId),
          sql`left_at IS NULL`,
        ))
        .limit(1);
      isSpeaker = viewerRow?.role === "speaker";
    }

    // Get user info for participant name
    let displayName = "مستخدم";
    if (db) {
      const [user] = await db.select({
        displayName: schema.users.displayName,
        username: schema.users.username,
      }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      displayName = user?.displayName || user?.username || "مستخدم";
    }

    // Room name = "stream-{streamId}" to namespace LiveKit rooms
    const roomName = `stream-${streamId}`;

    // Generate token
    const token = await generateLiveKitToken(
      roomName,
      userId,
      displayName,
      isHost,
      isSpeaker,
      12 * 60 * 60 // 12 hours TTL (mitigates long-session expiry)
    );

    const wsUrl = getLiveKitPublicUrl();

    socialLog.info({ streamId, userId, isHost, isSpeaker }, "LiveKit token generated");

    return res.json({
      success: true,
      data: {
        token,
        wsUrl,
        roomName,
        role: isHost ? "host" : isSpeaker ? "speaker" : "viewer",
      },
    });
  } catch (err: any) {
    socialLog.error({ err }, "LiveKit token generation error");
    return res.status(500).json({ success: false, message: "خطأ في إنشاء توكن البث" });
  }
});

/**
 * POST /api/social/streams/:id/promote
 * Promote a viewer to speaker (host only)
 * Body: { targetUserId: string }
 */
router.post("/streams/:id/promote", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    if (stream.userId !== userId) {
      return res.status(403).json({ success: false, message: "فقط المضيف يمكنه ترقية المتحدثين" });
    }

    const { targetUserId } = req.body;
    if (!targetUserId || typeof targetUserId !== "string") {
      return res.status(400).json({ success: false, message: "معرف المستخدم مطلوب" });
    }

    const roomName = `stream-${streamId}`;
    await updateParticipantPermissions(roomName, targetUserId, true);

    // Keep DB role state as the source of truth for future token issuance.
    const db = getDb();
    if (db) {
      await db.update(schema.streamViewers)
        .set({ role: "speaker" })
        .where(and(
          eq(schema.streamViewers.streamId, streamId),
          eq(schema.streamViewers.userId, targetUserId),
          sql`left_at IS NULL`,
        ));
    }

    socialLog.info({ streamId, targetUserId }, "Speaker promoted");
    return res.json({ success: true });
  } catch (err: any) {
    socialLog.error({ err }, "Promote speaker error");
    return res.status(500).json({ success: false, message: "خطأ في ترقية المتحدث" });
  }
});

/**
 * POST /api/social/streams/:id/demote
 * Demote a speaker back to viewer (host only)
 * Body: { targetUserId: string }
 */
router.post("/streams/:id/demote", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    if (stream.userId !== userId) {
      return res.status(403).json({ success: false, message: "فقط المضيف يمكنه تخفيض المتحدثين" });
    }

    const { targetUserId } = req.body;
    if (!targetUserId || typeof targetUserId !== "string") {
      return res.status(400).json({ success: false, message: "معرف المستخدم مطلوب" });
    }

    const roomName = `stream-${streamId}`;
    await updateParticipantPermissions(roomName, targetUserId, false);

    // Revert DB role so speaker tokens cannot be re-issued.
    const db = getDb();
    if (db) {
      await db.update(schema.streamViewers)
        .set({ role: "viewer" })
        .where(and(
          eq(schema.streamViewers.streamId, streamId),
          eq(schema.streamViewers.userId, targetUserId),
          sql`left_at IS NULL`,
        ));
    }

    socialLog.info({ streamId, targetUserId }, "Speaker demoted");
    return res.json({ success: true });
  } catch (err: any) {
    socialLog.error({ err }, "Demote speaker error");
    return res.status(500).json({ success: false, message: "خطأ في تخفيض المتحدث" });
  }
});

/**
 * POST /api/social/streams/:id/kick
 * Kick a participant from the stream (host only)
 * Body: { targetUserId: string }
 */
router.post("/streams/:id/kick", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    if (stream.userId !== userId) {
      return res.status(403).json({ success: false, message: "فقط المضيف يمكنه طرد المشاركين" });
    }

    const { targetUserId } = req.body;
    if (!targetUserId || typeof targetUserId !== "string") {
      return res.status(400).json({ success: false, message: "معرف المستخدم مطلوب" });
    }

    const roomName = `stream-${streamId}`;
    await removeParticipant(roomName, targetUserId);

    socialLog.info({ streamId, targetUserId }, "Participant kicked");
    return res.json({ success: true });
  } catch (err: any) {
    socialLog.error({ err }, "Kick participant error");
    return res.status(500).json({ success: false, message: "خطأ في طرد المشارك" });
  }
});

// ═══════════════════════════════════════════════════════
// ── Scheduled Streams — البثوث المجدولة ──
// ═══════════════════════════════════════════════════════

router.get("/streams/scheduled", async (_req: Request, res: Response) => {
  try {
    const db = getDb();
    if (!db) return res.json([]);
    const data = await db.select().from(schema.streams)
      .where(and(eq(schema.streams.status, "scheduled"), sql`${schema.streams.scheduledAt} > NOW()`))
      .orderBy(asc(schema.streams.scheduledAt));
    const userIds = data.map(s => s.userId).filter(Boolean);
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const users = await db.select().from(schema.users).where(inArray(schema.users.id, userIds));
      users.forEach(u => { usersMap[u.id] = u; });
    }
    const enriched = data.map(s => {
      const host = usersMap[s.userId];
      return { ...s, hostName: host?.displayName || host?.username || "مجهول", hostAvatar: host?.avatar || null, hostLevel: host?.level || 1, tags: s.tags ? s.tags.split(",").map(t => t.trim()) : [] };
    });
    return res.json(enriched);
  } catch (err: any) {
    socialLog.error({ err }, "Scheduled streams error");
    return res.json([]);
  }
});

// GET /streams/search — search streams by title/tags
router.get("/streams/search", searchLimiter, async (req: Request, res: Response) => {
  try {
    const q = String(req.query.q || "").trim().toLowerCase();
    if (!q || q.length < 2) return res.json([]);
    const db = getDb();
    if (!db) return res.json([]);
    const escapedQ = escapeLike(q);
    const data = await db.select().from(schema.streams)
      .where(and(
        eq(schema.streams.status, "active"),
        or(
          sql`LOWER(${schema.streams.title}) LIKE ${"%" + escapedQ + "%"}`,
          sql`LOWER(${schema.streams.tags}) LIKE ${"%" + escapedQ + "%"}`
        )
      ))
      .orderBy(desc(schema.streams.viewerCount)).limit(30);
    const userIds = data.map(s => s.userId).filter(Boolean);
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const users = await db.select().from(schema.users).where(inArray(schema.users.id, userIds));
      users.forEach(u => { usersMap[u.id] = u; });
    }
    const enriched = data.map(s => {
      const host = usersMap[s.userId];
      return { ...s, hostName: host?.displayName || host?.username || "مجهول", hostAvatar: host?.avatar || null, hostLevel: host?.level || 1, tags: s.tags ? s.tags.split(",").map(t => t.trim()) : [] };
    });
    return res.json(enriched);
  } catch (err: any) {
    socialLog.error({ err }, "Stream search error");
    return res.json([]);
  }
});

// GET /streams/:id/stats — host stats dashboard
router.get("/streams/:id/stats", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    if (stream.userId !== userId) return res.status(403).json({ success: false, message: "غير مصرح" });
    const db = getDb();
    if (!db) return res.json({ data: {} });
    // get unique viewers count
    const [uniqueViewers] = await db.select({ count: count() }).from(schema.streamViewers).where(eq(schema.streamViewers.streamId, streamId));
    // top gifter
    const topGifters = await db.select({
      userId: schema.giftTransactions.senderId,
      total: sql<number>`SUM(${schema.giftTransactions.totalPrice})`.as("total"),
    }).from(schema.giftTransactions)
      .where(eq(schema.giftTransactions.streamId, streamId))
      .groupBy(schema.giftTransactions.senderId)
      .orderBy(sql`total DESC`).limit(5);

    // Duration
    const duration = stream.endedAt
      ? Math.round((new Date(stream.endedAt).getTime() - new Date(stream.startedAt).getTime()) / 1000)
      : Math.round((Date.now() - new Date(stream.startedAt).getTime()) / 1000);

    // Enrich top gifters with names
    let enrichedGifters: any[] = [];
    if (topGifters.length > 0) {
      const gifterIds = topGifters.map(g => g.userId).filter(Boolean);
      if (gifterIds.length > 0) {
        const gUsers = await db.select({ id: schema.users.id, displayName: schema.users.displayName, avatar: schema.users.avatar })
          .from(schema.users).where(inArray(schema.users.id, gifterIds as string[]));
        enrichedGifters = topGifters.map(g => {
          const u = gUsers.find(u => u.id === g.userId);
          return { userId: g.userId, total: g.total, name: u?.displayName || "مجهول", avatar: u?.avatar || null };
        });
      }
    }

    return res.json({
      data: {
        peakViewers: stream.peakViewers,
        totalGifts: stream.totalGifts,
        uniqueViewers: uniqueViewers?.count || 0,
        duration,
        topGifters: enrichedGifters,
        startedAt: stream.startedAt,
        endedAt: stream.endedAt,
        viewerCount: stream.viewerCount,
      }
    });
  } catch (err: any) {
    socialLog.error({ err }, "Stream stats error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// GET /streams/:id/report — richer post-stream report for hosts
router.get("/streams/:id/report", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    if (stream.userId !== userId) return res.status(403).json({ success: false, message: "غير مصرح" });

    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

    const flags = await getLiveFeatureFlags(db);
    if (!flags.postStreamReportEnabled) {
      return res.status(403).json({ success: false, message: "تقرير البث غير مفعل حالياً" });
    }

    const [uniqueViewers] = await db.select({ count: count() })
      .from(schema.streamViewers)
      .where(eq(schema.streamViewers.streamId, streamId));

    const [giftSummary] = await db.select({
      total: sql<number>`COALESCE(SUM(${schema.giftTransactions.totalPrice}), 0)`,
      senders: sql<number>`COUNT(DISTINCT ${schema.giftTransactions.senderId})`,
      events: sql<number>`COUNT(*)`,
    }).from(schema.giftTransactions)
      .where(eq(schema.giftTransactions.streamId, streamId));

    const [speakerSummary] = await db.select({
      speakers: sql<number>`COUNT(DISTINCT ${schema.streamViewers.userId})`,
    }).from(schema.streamViewers)
      .where(and(
        eq(schema.streamViewers.streamId, streamId),
        eq(schema.streamViewers.role, "speaker"),
      ));

    const [watchSummary] = await db.select({
      avgWatchSec: sql<number>`AVG(EXTRACT(EPOCH FROM (COALESCE(${schema.streamViewers.leftAt}, NOW()) - ${schema.streamViewers.joinedAt})))`,
      totalWatchSec: sql<number>`COALESCE(SUM(EXTRACT(EPOCH FROM (COALESCE(${schema.streamViewers.leftAt}, NOW()) - ${schema.streamViewers.joinedAt}))), 0)`,
    }).from(schema.streamViewers)
      .where(eq(schema.streamViewers.streamId, streamId));

    const topCountries = await db.select({
      country: schema.users.country,
      viewers: count(),
    }).from(schema.streamViewers)
      .innerJoin(schema.users, eq(schema.users.id, schema.streamViewers.userId))
      .where(and(
        eq(schema.streamViewers.streamId, streamId),
        sql`${schema.users.country} IS NOT NULL AND ${schema.users.country} <> ''`,
      ))
      .groupBy(schema.users.country)
      .orderBy(desc(count()))
      .limit(5);

    const durationSec = stream.endedAt
      ? Math.max(1, Math.round((new Date(stream.endedAt).getTime() - new Date(stream.startedAt).getTime()) / 1000))
      : Math.max(1, Math.round((Date.now() - new Date(stream.startedAt).getTime()) / 1000));

    const uniqueCount = Number(uniqueViewers?.count || 0);
    const avgWatchSec = Math.max(0, Math.round(Number(watchSummary?.avgWatchSec || 0)));
    const giftsTotal = Number(giftSummary?.total || 0);
    const giftsPerViewer = uniqueCount > 0 ? giftsTotal / uniqueCount : 0;
    const avgRetentionPct = Math.min(100, Math.max(0, (avgWatchSec / durationSec) * 100));

    const recommendations: string[] = [];
    if (avgRetentionPct < 20) recommendations.push("ابدأ البث بخطاف أقوى خلال أول دقيقتين لرفع الاحتفاظ.");
    if (giftsPerViewer < 1) recommendations.push("جرّب Call-to-action للهدايا كل 5-8 دقائق مع هدف واضح.");
    if ((speakerSummary?.speakers || 0) <= 1) recommendations.push("زِد التفاعل بإضافة متحدثين أو فقرة أسئلة مباشرة.");
    if (!recommendations.length) recommendations.push("الأداء جيد: كرّر نفس توقيت البث والمحتوى في الجلسة القادمة.");

    return res.json({
      success: true,
      data: {
        streamId,
        startedAt: stream.startedAt,
        endedAt: stream.endedAt,
        durationSec,
        peakViewers: Number(stream.peakViewers || 0),
        uniqueViewers: uniqueCount,
        totalGifts: giftsTotal,
        giftEvents: Number(giftSummary?.events || 0),
        giftSenders: Number(giftSummary?.senders || 0),
        avgWatchSec,
        totalWatchSec: Math.round(Number(watchSummary?.totalWatchSec || 0)),
        avgRetentionPct: Math.round(avgRetentionPct * 10) / 10,
        speakersCount: Number(speakerSummary?.speakers || 0),
        topCountries: topCountries.map((c: any) => ({ country: c.country, viewers: Number(c.viewers || 0) })),
        recommendations,
      },
    });
  } catch (err: any) {
    socialLog.error({ err }, "Post stream report error");
    return res.status(500).json({ success: false, message: "خطأ في بناء التقرير" });
  }
});

async function buildStreamAnalytics(db: any, streamId: string, stream: any) {
  const viewerSessions = await db.select({
    joinedAt: schema.streamViewers.joinedAt,
    leftAt: schema.streamViewers.leftAt,
  }).from(schema.streamViewers)
    .where(eq(schema.streamViewers.streamId, streamId));

  const giftEvents = await db.select({
    createdAt: schema.giftTransactions.createdAt,
    totalPrice: schema.giftTransactions.totalPrice,
  }).from(schema.giftTransactions)
    .where(eq(schema.giftTransactions.streamId, streamId));

  const startedAtMs = new Date(stream.startedAt).getTime();
  const endedAtMs = stream.endedAt ? new Date(stream.endedAt).getTime() : Date.now();
  const durationMs = Math.max(60_000, endedAtMs - startedAtMs);
  const binsCount = 6;
  const bins = Array.from({ length: binsCount }).map((_, idx) => {
    const start = startedAtMs + Math.floor((durationMs * idx) / binsCount);
    const end = idx === binsCount - 1 ? endedAtMs : startedAtMs + Math.floor((durationMs * (idx + 1)) / binsCount);
    const midpoint = Math.floor((start + end) / 2);

    const activeViewers = viewerSessions.filter((session: any) => {
      const joined = session.joinedAt ? new Date(session.joinedAt).getTime() : 0;
      const left = session.leftAt ? new Date(session.leftAt).getTime() : endedAtMs;
      return joined <= midpoint && left >= midpoint;
    }).length;

    const joins = viewerSessions.filter((session: any) => {
      const joined = session.joinedAt ? new Date(session.joinedAt).getTime() : 0;
      return joined >= start && joined < end;
    }).length;

    const gifts = giftEvents.filter((g: any) => {
      const at = g.createdAt ? new Date(g.createdAt).getTime() : 0;
      return at >= start && at < end;
    });

    const giftsValue = gifts.reduce((sum: number, g: any) => sum + Number(g.totalPrice || 0), 0);
    const minuteMark = Math.max(0, Math.round((start - startedAtMs) / 60_000));

    return {
      label: `+${minuteMark}m`,
      activeViewers,
      joins,
      giftsCount: gifts.length,
      giftsValue,
      startIso: new Date(start).toISOString(),
      endIso: new Date(end).toISOString(),
    };
  });

  return {
    streamId,
    startedAt: stream.startedAt,
    endedAt: stream.endedAt,
    durationSec: Math.round(durationMs / 1000),
    bins,
  };
}

// GET /streams/:id/analytics — creator dashboard timeline
router.get("/streams/:id/analytics", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    if (stream.userId !== userId) return res.status(403).json({ success: false, message: "غير مصرح" });

    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

    const flags = await getLiveFeatureFlags(db);
    if (!flags.postStreamReportEnabled) {
      return res.status(403).json({ success: false, message: "تحليلات البث غير مفعلة حالياً" });
    }

    const analytics = await buildStreamAnalytics(db, streamId, stream);
    return res.json({ success: true, data: analytics });
  } catch (err: any) {
    socialLog.error({ err }, "Stream analytics error");
    return res.status(500).json({ success: false, message: "خطأ في تحميل تحليلات البث" });
  }
});

// GET /streams/:id/analytics/export — creator dashboard CSV export
router.get("/streams/:id/analytics/export", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    if (stream.userId !== userId) return res.status(403).json({ success: false, message: "غير مصرح" });

    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

    const flags = await getLiveFeatureFlags(db);
    if (!flags.creatorAnalyticsCsvEnabled) {
      return res.status(403).json({ success: false, message: "تصدير CSV غير مفعل" });
    }

    const analytics = await buildStreamAnalytics(db, streamId, stream);
    const header = "Label,ActiveViewers,Joins,GiftsCount,GiftsValue,Start,End";
    const rows = analytics.bins.map((b: any) => `${b.label},${b.activeViewers},${b.joins},${b.giftsCount},${b.giftsValue},${b.startIso},${b.endIso}`);
    const csv = [header, ...rows].join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="stream-analytics-${streamId}-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.send("\uFEFF" + csv);
  } catch (err: any) {
    socialLog.error({ err }, "Stream analytics export error");
    return res.status(500).json({ success: false, message: "خطأ في تصدير التحليلات" });
  }
});

// POST /streams/:id/director-events — store Smart Director interactions
router.post("/streams/:id/director-events", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    if (stream.userId !== userId) return res.status(403).json({ success: false, message: "غير مصرح" });

    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

    const flags = await getLiveFeatureFlags(db);
    if (!flags.smartDirectorTelemetryEnabled) {
      return res.json({ success: true, data: { stored: false, reason: "disabled" } });
    }

    const tipId = String(req.body?.tipId || "").trim().slice(0, 80);
    const action = String(req.body?.action || "").trim();
    if (!tipId || !["shown", "accepted", "dismissed"].includes(action)) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
    }

    const metadata = req.body?.metadata && typeof req.body.metadata === "object"
      ? JSON.stringify(req.body.metadata)
      : null;

    const [created] = await db.insert(schema.streamDirectorEvents).values({
      streamId,
      hostId: userId,
      tipId,
      action,
      metadata,
    }).returning();

    return res.json({ success: true, data: created });
  } catch (err: any) {
    socialLog.error({ err }, "Director event store error");
    return res.status(500).json({ success: false, message: "خطأ في حفظ الحدث" });
  }
});

// POST /streams/:id/clips/auto — create a clip marker from engagement peaks
router.post("/streams/:id/clips/auto", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    if (stream.userId !== userId) return res.status(403).json({ success: false, message: "غير مصرح" });

    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

    const flags = await getLiveFeatureFlags(db);
    if (!flags.autoClipsEnabled) {
      return res.json({ success: true, data: { stored: false, reason: "disabled" } });
    }

    const cueType = String(req.body?.cueType || "").trim();
    const title = String(req.body?.title || "لقطة تلقائية").trim().slice(0, 120);
    const reason = String(req.body?.reason || "").trim().slice(0, 240);
    const score = Math.max(0, Math.min(100, Number(req.body?.score || 0)));
    const lookbackSec = Math.max(5, Math.min(120, Number(req.body?.lookbackSec || 20)));
    const forwardSec = Math.max(5, Math.min(120, Number(req.body?.forwardSec || 20)));
    const validCueTypes = ["chat_burst", "gift_burst", "viewer_spike", "retention_recovery"];
    if (!validCueTypes.includes(cueType) || !reason) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
    }

    // Cooldown/dedupe: avoid writing noisy clips from repeated triggers.
    const [lastClip] = await db.select({
      id: schema.streamAutoClips.id,
      cueType: schema.streamAutoClips.cueType,
      createdAt: schema.streamAutoClips.createdAt,
    }).from(schema.streamAutoClips)
      .where(eq(schema.streamAutoClips.streamId, streamId))
      .orderBy(desc(schema.streamAutoClips.createdAt))
      .limit(1);

    const now = Date.now();
    if (lastClip?.createdAt) {
      const secondsSinceLast = (now - new Date(lastClip.createdAt).getTime()) / 1000;
      if (secondsSinceLast < 45 && String(lastClip.cueType) === cueType) {
        return res.json({ success: true, data: { stored: false, reason: "cooldown" } });
      }
    }

    const startedAtMs = new Date(stream.startedAt).getTime();
    const currentOffsetSec = Math.max(0, Math.floor((now - startedAtMs) / 1000));
    const startOffsetSec = Math.max(0, currentOffsetSec - lookbackSec);
    const endOffsetSec = currentOffsetSec + forwardSec;

    const metadata = req.body?.metadata && typeof req.body.metadata === "object"
      ? JSON.stringify(req.body.metadata)
      : null;

    const [created] = await db.insert(schema.streamAutoClips).values({
      streamId,
      hostId: userId,
      cueType,
      title,
      reason,
      startOffsetSec,
      endOffsetSec,
      score,
      metadata,
    }).returning();

    return res.json({ success: true, data: created });
  } catch (err: any) {
    socialLog.error({ err }, "Auto clip capture error");
    return res.status(500).json({ success: false, message: "خطأ في إنشاء المقطع التلقائي" });
  }
});

// GET /streams/:id/clips — list generated auto clips for host review
router.get("/streams/:id/clips", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    if (stream.userId !== userId) return res.status(403).json({ success: false, message: "غير مصرح" });

    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

    const clips = await db.select().from(schema.streamAutoClips)
      .where(eq(schema.streamAutoClips.streamId, streamId))
      .orderBy(desc(schema.streamAutoClips.score), desc(schema.streamAutoClips.createdAt))
      .limit(20);

    return res.json({ success: true, data: clips });
  } catch (err: any) {
    socialLog.error({ err }, "List auto clips error");
    return res.status(500).json({ success: false, message: "خطأ في تحميل المقاطع" });
  }
});

// ═══════════════════════════════════════════════════════
// ── Pinned Message — الرسالة المثبتة ──
// ═══════════════════════════════════════════════════════

router.post("/streams/:id/pin", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream) return res.status(404).json({ success: false, message: "البث غير موجود" });
    if (stream.userId !== userId) return res.status(403).json({ success: false, message: "فقط المضيف" });
    const { message } = req.body;
    await storage.updateStream(streamId, { pinnedMessage: message || null } as any);
    // Broadcast to socket room used by live pages + keep legacy event for compatibility.
    if (io) {
      io.to(`room:${streamId}`).emit("stream-pinned", { streamId, message: message || null });
      io.to(`room:${streamId}`).emit("pinned-message", { message: message || null });
    }
    return res.json({ success: true });
  } catch (err: any) {
    socialLog.error({ err }, "Pin message error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

router.delete("/streams/:id/pin", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream || stream.userId !== userId) return res.status(403).json({ success: false });
    await storage.updateStream(streamId, { pinnedMessage: null } as any);
    if (io) {
      io.to(`room:${streamId}`).emit("stream-pinned", { streamId, message: null });
      io.to(`room:${streamId}`).emit("pinned-message", { message: null });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false });
  }
});

// ═══════════════════════════════════════════════════════
// ── Polls — استطلاعات الرأي ──
// ═══════════════════════════════════════════════════════

router.post("/streams/:id/poll", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream || stream.userId !== userId) return res.status(403).json({ success: false, message: "فقط المضيف" });
    const { question, options } = req.body;
    if (!question || !Array.isArray(options) || options.length < 2) {
      return res.status(400).json({ success: false, message: "سؤال و خيارين على الأقل" });
    }
    const db = getDb();
    if (!db) return res.status(500).json({ success: false });
    // End any existing active poll
    await db.update(schema.streamPolls).set({ isActive: false }).where(and(eq(schema.streamPolls.streamId, streamId), eq(schema.streamPolls.isActive, true)));
    const initialVotes: Record<string, number> = {};
    options.forEach((o: string) => { initialVotes[o] = 0; });
    const [poll] = await db.insert(schema.streamPolls).values({
      streamId,
      question,
      options: JSON.stringify(options),
      votes: JSON.stringify(initialVotes),
      voterIds: "[]",
    }).returning();
    if (io) {
      const pollPayload = { ...poll, options: JSON.parse(poll.options), votes: JSON.parse(poll.votes) };
      io.to(`room:${streamId}`).emit("stream-poll-update", { streamId, poll: pollPayload });
      io.to(`room:${streamId}`).emit("poll-created", { poll: pollPayload });
    }
    return res.json({ success: true, data: { ...poll, options: JSON.parse(poll.options), votes: JSON.parse(poll.votes) } });
  } catch (err: any) {
    socialLog.error({ err }, "Create poll error");
    return res.status(500).json({ success: false });
  }
});

router.get("/streams/:id/poll", async (req: Request, res: Response) => {
  try {
    const streamId = paramStr(req.params.id);
    const db = getDb();
    if (!db) return res.json({ data: null });
    const [poll] = await db.select().from(schema.streamPolls)
      .where(and(eq(schema.streamPolls.streamId, streamId), eq(schema.streamPolls.isActive, true)))
      .orderBy(desc(schema.streamPolls.createdAt)).limit(1);
    if (!poll) return res.json({ data: null });
    return res.json({ data: { ...poll, options: JSON.parse(poll.options), votes: JSON.parse(poll.votes), voterIds: JSON.parse(poll.voterIds) } });
  } catch (err: any) {
    return res.json({ data: null });
  }
});

router.post("/streams/:id/poll/:pollId/vote", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const pollId = paramStr(req.params.pollId);
    const { option } = req.body;
    const db = getDb();
    if (!db) return res.status(500).json({ success: false });
    const [poll] = await db.select().from(schema.streamPolls).where(eq(schema.streamPolls.id, pollId)).limit(1);
    if (!poll || !poll.isActive) return res.status(400).json({ success: false, message: "الاستطلاع منتهي" });
    const voterIds: string[] = JSON.parse(poll.voterIds);
    if (voterIds.includes(userId)) return res.status(400).json({ success: false, message: "صوتت بالفعل" });
    const options: string[] = JSON.parse(poll.options);
    if (!options.includes(option)) return res.status(400).json({ success: false, message: "خيار غير صالح" });

    // Atomic vote update — safe parameterized JSON path
    const optionPath = `{${option}}`;
    const [updated] = await db.update(schema.streamPolls).set({
      votes: sql`jsonb_set(${schema.streamPolls.votes}::jsonb, ${optionPath}::text[], (COALESCE((${schema.streamPolls.votes}::jsonb->>${option})::int, 0) + 1)::text::jsonb)`,
      voterIds: sql`(${schema.streamPolls.voterIds}::jsonb || ${sql`${JSON.stringify([userId])}::jsonb`})::text`,
    }).where(
      and(
        eq(schema.streamPolls.id, pollId),
        eq(schema.streamPolls.isActive, true),
        sql`NOT (${schema.streamPolls.voterIds}::jsonb ? ${userId})`,
      )
    ).returning();

    if (!updated) return res.status(400).json({ success: false, message: "صوتت بالفعل أو الاستطلاع منتهي" });

    const votes = JSON.parse(updated.votes);
    const newVoterIds: string[] = JSON.parse(updated.voterIds);
    if (io) {
      const [activePoll] = await db.select().from(schema.streamPolls)
        .where(and(eq(schema.streamPolls.id, pollId), eq(schema.streamPolls.streamId, streamId)))
        .limit(1);
      const pollPayload = activePoll
        ? {
          ...activePoll,
          options: JSON.parse(activePoll.options),
          votes: JSON.parse(activePoll.votes),
          voterIds: JSON.parse(activePoll.voterIds),
        }
        : null;
      io.to(`room:${streamId}`).emit("stream-poll-update", { streamId, poll: pollPayload });
      io.to(`room:${streamId}`).emit("poll-updated", { pollId, votes, totalVoters: newVoterIds.length });
    }
    return res.json({ success: true, data: { votes, totalVoters: newVoterIds.length } });
  } catch (err: any) {
    socialLog.error({ err }, "Vote poll error");
    return res.status(500).json({ success: false });
  }
});

router.post("/streams/:id/poll/:pollId/end", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const pollId = paramStr(req.params.pollId);
    const stream = await storage.getStream(streamId);
    if (!stream || stream.userId !== userId) return res.status(403).json({ success: false });
    const db = getDb();
    if (!db) return res.status(500).json({ success: false });
    await db.update(schema.streamPolls).set({ isActive: false }).where(eq(schema.streamPolls.id, pollId));
    if (io) {
      io.to(`room:${streamId}`).emit("stream-poll-update", { streamId, poll: null });
      io.to(`room:${streamId}`).emit("poll-ended", { pollId });
    }
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false });
  }
});

// ═══════════════════════════════════════════════════════
// ── Chat Moderation — إدارة الشات ──
// ═══════════════════════════════════════════════════════

router.post("/streams/:id/mute", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream || stream.userId !== userId) return res.status(403).json({ success: false });
    const { targetUserId, reason } = req.body;
    const db = getDb();
    if (!db) return res.status(500).json({ success: false });
    await db.insert(schema.streamMutedUsers).values({ streamId, userId: targetUserId, mutedBy: userId, reason: reason || null });
    if (io) io.to(`room:${streamId}`).emit("user-muted", { userId: targetUserId });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false });
  }
});

router.delete("/streams/:id/mute/:targetId", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const targetId = paramStr(req.params.targetId);
    const stream = await storage.getStream(streamId);
    if (!stream || stream.userId !== userId) return res.status(403).json({ success: false });
    const db = getDb();
    if (!db) return res.status(500).json({ success: false });
    await db.delete(schema.streamMutedUsers).where(and(eq(schema.streamMutedUsers.streamId, streamId), eq(schema.streamMutedUsers.userId, targetId)));
    if (io) io.to(`room:${streamId}`).emit("user-unmuted", { userId: targetId });
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false });
  }
});

router.post("/streams/:id/banned-words", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream || stream.userId !== userId) return res.status(403).json({ success: false });
    const { word } = req.body;
    if (!word || typeof word !== "string") return res.status(400).json({ success: false });
    const db = getDb();
    if (!db) return res.status(500).json({ success: false });
    const [created] = await db.insert(schema.streamBannedWords).values({ streamId, word: word.trim().toLowerCase() }).returning();
    return res.json({ success: true, data: created });
  } catch (err: any) {
    return res.status(500).json({ success: false });
  }
});

router.delete("/streams/:id/banned-words/:wordId", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const wordId = paramStr(req.params.wordId);
    const stream = await storage.getStream(streamId);
    if (!stream || stream.userId !== userId) return res.status(403).json({ success: false });
    const db = getDb();
    if (!db) return res.status(500).json({ success: false });
    await db.delete(schema.streamBannedWords).where(and(
      eq(schema.streamBannedWords.id, wordId),
      eq(schema.streamBannedWords.streamId, streamId),
    ));
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false });
  }
});

router.get("/streams/:id/banned-words", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream || stream.userId !== userId) return res.status(403).json({ success: false });
    const db = getDb();
    if (!db) return res.json([]);
    const words = await db.select().from(schema.streamBannedWords).where(eq(schema.streamBannedWords.streamId, streamId));
    return res.json(words);
  } catch { return res.json([]); }
});

// ═══════════════════════════════════════════════════════
// ── Stream Recording — التسجيل ──
// ═══════════════════════════════════════════════════════

router.post("/streams/:id/record/start", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream || stream.userId !== userId) return res.status(403).json({ success: false });
    // In production, this would call LiveKit's Egress API to start recording
    // For now, we flag the stream as being recorded
    await storage.updateStream(streamId, { recordingUrl: "recording" } as any);
    socialLog.info({ streamId }, "Recording started (flagged)");
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false });
  }
});

router.post("/streams/:id/record/stop", async (req: Request, res: Response) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  try {
    const streamId = paramStr(req.params.id);
    const stream = await storage.getStream(streamId);
    if (!stream || stream.userId !== userId) return res.status(403).json({ success: false });
    // In production, this would stop the LiveKit Egress and get the recording URL
    await storage.updateStream(streamId, { recordingUrl: null } as any);
    socialLog.info({ streamId }, "Recording stopped");
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false });
  }
});

// ═══════════════════════════════════════════════════════
// ── Follower Notification on Stream Start ──
// ═══════════════════════════════════════════════════════
// (Integrated into /streams/create above — see socket notification below)

// ═══════════════════════════════════════════════════════
// ── Auto-Translation — الترجمة التلقائية ──
// ═══════════════════════════════════════════════════════

const LANG_CODE_REGEX = /^[a-z]{2,3}(?:-[A-Za-z]{2,8})?$/;

function normalizeLangCode(input: unknown): string | null {
  if (typeof input !== "string") return null;
  const normalized = input.trim().replace(/_/g, "-");
  if (!normalized) return null;
  if (!LANG_CODE_REGEX.test(normalized)) return null;
  const [base, region] = normalized.split("-");
  return region ? `${base.toLowerCase()}-${region.toUpperCase()}` : base.toLowerCase();
}

// ── Translation rate limiting (max 30 per minute per user) ──
const translateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.session as any)?.userId || ipKeyGenerator(req.ip || "127.0.0.1"),
  message: { success: false, message: "عدد كبير من طلبات الترجمة. حاول بعد دقيقة" },
});

/**
 * POST /api/social/translate
 * Body: { text: string, targetLang: string, sourceLang?: string }
 * Returns: { translatedText: string, detectedLang: string }
 */
router.post("/translate", translateLimiter, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).session?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "غير مصرح" });

    const { text, targetLang, sourceLang } = req.body || {};
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      return res.status(400).json({ success: false, message: "النص مطلوب" });
    }
    const normalizedTarget = normalizeLangCode(targetLang);
    if (!normalizedTarget) {
      return res.status(400).json({ success: false, message: "رمز لغة الهدف غير صالح" });
    }
    if (text.length > 5000) {
      return res.status(400).json({ success: false, message: "النص طويل جداً" });
    }

    const normalizedSource = normalizeLangCode(sourceLang);
    const sl = normalizedSource || "auto";
    // Map language codes to Google Translate codes
    const langMap: Record<string, string> = { zh: "zh-CN", fa: "fa" };
    const tl = langMap[normalizedTarget] || normalizedTarget;
    const slMapped = sl === "auto" ? "auto" : (langMap[sl] || sl);

    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${encodeURIComponent(slMapped)}&tl=${encodeURIComponent(tl)}&dt=t&q=${encodeURIComponent(text.trim())}`;

    const resp = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
    });

    if (!resp.ok) {
      socialLog.error(`Translation API error: ${resp.status}`);
      return res.status(502).json({ success: false, message: "خطأ في خدمة الترجمة" });
    }

    const data = await resp.json() as any;
    // Google returns [[["translated","original","","",...],...], null, "detected_lang"]
    let translatedText = "";
    if (Array.isArray(data) && Array.isArray(data[0])) {
      for (const segment of data[0]) {
        if (segment && segment[0]) translatedText += segment[0];
      }
    }
    const detectedLang = Array.isArray(data) && data[2] ? String(data[2]) : sl;

    if (!translatedText) {
      return res.status(502).json({ success: false, message: "لم يتم الحصول على ترجمة" });
    }

    return res.json({
      success: true,
      data: { translatedText, detectedLang },
    });
  } catch (err: any) {
    socialLog.error({ err }, "Translation error");
    return res.status(500).json({ success: false, message: "خطأ في الترجمة" });
  }
});

// ════════════════════════════════════════════════════════════
// XP & LEVEL SYSTEM — نظام النقاط والمستويات
// ════════════════════════════════════════════════════════════
import { getUserLevelInfo, getXpLeaderboard, XP_REWARDS, xpForLevel } from "../services/xpLevel";

// ── GET /xp/me — Get current user's level info ──
router.get("/xp/me", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  const info = await getUserLevelInfo(userId);
  if (!info) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

  return res.json({ success: true, data: info });
});

// ── GET /xp/leaderboard — Top users by XP ──
router.get("/xp/leaderboard", async (req, res) => {
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const leaderboard = await getXpLeaderboard(limit);
  return res.json({ success: true, data: leaderboard });
});

// ── GET /xp/rewards — XP reward table ──
router.get("/xp/rewards", (_req, res) => {
  const rewards = Object.entries(XP_REWARDS).map(([action, xp]) => ({ action, xp }));
  const levels = Array.from({ length: 10 }, (_, i) => ({
    level: (i + 1) * 5,
    xpRequired: xpForLevel((i + 1) * 5),
  }));
  return res.json({ success: true, data: { rewards, sampleLevels: levels } });
});

export default router;
