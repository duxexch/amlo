/**
 * Social Routes — Friends, Chat, Calls
 * All endpoints require user auth via session.
 */
import { Router, type Request, type Response } from "express";
import { eq, and, or, desc, asc, sql, count, ne, inArray } from "drizzle-orm";
import { getDb } from "../db";
import { getRedis } from "../redis";
import { createLogger } from "../logger";
const log = (msg: string, _src?: string) => socialLog.info(msg);
const socialLog = createLogger("social");
import { io } from "../index";
import { getUserSocketId, isUserOnline } from "../onlineUsers";
import * as schema from "../../shared/schema";
import { sendMessageSchema, initiateCallSchema, reportMessageSchema } from "../../shared/schema";
import { encryptMessage, decryptMessages } from "../utils/encryption";

const router = Router();

// Express 5: req.params values can be string | string[]
function paramStr(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

// Use shared online tracking from server/index.ts (Redis-backed async API)

// ── Helper: get current user from session ──
function requireUser(req: Request, res: Response): string | null {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });
    return null;
  }
  return userId;
}

// ── Helper: get coin rates from system settings ──
async function getCoinRate(key: string, defaultVal: number): Promise<number> {
  const db = getDb();
  if (!db) return defaultVal;
  const [setting] = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, key)).limit(1);
  return setting ? parseInt(setting.value) || defaultVal : defaultVal;
}

// ── Helper: charge coins (atomic — prevents race condition) ──
async function chargeCoins(userId: string, amount: number, description: string, refId?: string): Promise<boolean> {
  const db = getDb();
  if (!db || amount <= 0) return true;
  
  // Atomic: UPDATE ... WHERE coins >= amount (no separate SELECT)
  const result = await db.update(schema.users)
    .set({
      coins: sql`coins - ${amount}`,
      updatedAt: new Date(),
    })
    .where(and(
      eq(schema.users.id, userId),
      sql`coins >= ${amount}`
    ))
    .returning({ id: schema.users.id, coins: schema.users.coins });

  if (!result.length) return false;

  await db.insert(schema.walletTransactions).values({
    userId,
    type: "call_charge",
    amount: -amount,
    balanceAfter: result[0].coins,
    currency: "coins",
    description,
    referenceId: refId,
    status: "completed",
  });
  return true;
}

// ── Helper: check if feature is enabled ──
async function isChatFeatureEnabled(feature: string): Promise<boolean> {
  const db = getDb();
  if (!db) return true; // default enabled
  const [setting] = await db.select().from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, `chat_${feature}_enabled`)).limit(1);
  return !setting || setting.value !== "false";
}

// ── Helper: get chat time limit (minutes, 0 = unlimited) ──
async function getChatTimeLimit(): Promise<number> {
  const db = getDb();
  if (!db) return 0;
  const [setting] = await db.select().from(schema.systemSettings)
    .where(eq(schema.systemSettings.key, "chat_time_limit")).limit(1);
  return setting ? parseInt(setting.value) || 0 : 0;
}

// ── Helper: check chat block ──
async function isChatBlocked(userId1: string, userId2: string): Promise<boolean> {
  const db = getDb();
  if (!db) return false;
  const [block] = await db.select().from(schema.chatBlocks)
    .where(
      or(
        and(eq(schema.chatBlocks.blockerId, userId1), eq(schema.chatBlocks.blockedId, userId2)),
        and(eq(schema.chatBlocks.blockerId, userId2), eq(schema.chatBlocks.blockedId, userId1)),
      )
    ).limit(1);
  return !!block;
}

// ════════════════════════════════════════════════════════════
// FRIENDS API
// ════════════════════════════════════════════════════════════

// Get friends list
router.get("/friends", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

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
      .orderBy(desc(schema.friendships.updatedAt));

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

    // attach online status (async Redis lookup)
    const onlineStatuses = await Promise.all(friends.map(f => isUserOnline(f.id)));
    const result = friends.map((f, i) => ({
      ...f,
      isOnline: onlineStatuses[i],
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

  try {
    const requests = await db.select().from(schema.friendships)
      .where(
        and(
          eq(schema.friendships.receiverId, userId),
          eq(schema.friendships.status, "pending"),
        )
      )
      .orderBy(desc(schema.friendships.createdAt));

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
      io.to(receiverSocketId).emit("friend-request", { friendship, sender });
    }

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
      io.to(senderSocketId).emit("friend-accepted", { friendshipId: updated.id, userId });
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

// Search users to add as friends
router.get("/users/search", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

  const q = req.query.q as string;
  if (!q || q.length < 2) return res.json({ success: true, data: [] });

  try {
    const searchTerm = `%${q}%`;
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

    const enriched = await Promise.all(results.map(async r => {
      const fs = existingFriendships.find(
        f => (f.senderId === userId && f.receiverId === r.id) || (f.senderId === r.id && f.receiverId === userId)
      );
      return {
        ...r,
        isOnline: await isUserOnline(r.id),
        friendshipStatus: fs?.status || null,
        friendshipId: fs?.id || null,
      };
    }));

    return res.json({ success: true, data: enriched });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في البحث" });
  }
});

// ════════════════════════════════════════════════════════════
// CHAT / MESSAGES API
// ════════════════════════════════════════════════════════════

// Get conversations list
router.get("/conversations", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

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
      .orderBy(desc(schema.conversations.lastMessageAt));

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

    const result = await Promise.all(convs.map(async c => {
      const otherId = c.participant1Id === userId ? c.participant2Id : c.participant1Id;
      const unread = c.participant1Id === userId ? c.participant1Unread : c.participant2Unread;
      return {
        id: c.id,
        otherUser: participants.find(p => p.id === otherId),
        isOnline: await isUserOnline(otherId),
        unreadCount: unread,
        lastMessage: lastMessages.find(m => m.id === c.lastMessageId),
        lastMessageAt: c.lastMessageAt,
      };
    }));

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
router.get("/conversations/:id/messages", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
  const offset = (page - 1) * limit;

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

    const msgs = await db.select().from(schema.messages)
      .where(
        and(
          eq(schema.messages.conversationId, req.params.id),
          eq(schema.messages.isDeleted, false),
        )
      )
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit)
      .offset(offset);

    // Mark messages as read
    const unreadField = conv.participant1Id === userId ? "participant1Unread" : "participant2Unread";
    await db.update(schema.conversations).set({ [unreadField]: 0 }).where(eq(schema.conversations.id, conv.id));
    await db.update(schema.messages).set({ isRead: true })
      .where(
        and(
          eq(schema.messages.conversationId, conv.id),
          ne(schema.messages.senderId, userId),
          eq(schema.messages.isRead, false),
        )
      );

    return res.json({ success: true, data: decryptMessages(msgs.reverse(), req.params.id) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Send a message
router.post("/conversations/:id/messages", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

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
    const { content, type, mediaUrl, giftId } = parsed.data;
    if (!content && (type === "text" || !type)) return res.status(400).json({ success: false, message: "الرسالة فارغة" });

    // Check feature toggles
    if ((type === "image" || type === "voice") && !(await isChatFeatureEnabled("media"))) {
      return res.status(403).json({ success: false, message: "إرسال الوسائط معطل حالياً" });
    }

    // Check message cost
    const messageCost = await getCoinRate("message_cost", 0);
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
      coinsCost: messageCost,
    }).returning();

    // Update conversation
    const unreadField = conv.participant1Id === userId ? "participant2Unread" : "participant1Unread";
    const currentUnread = conv.participant1Id === userId ? conv.participant2Unread : conv.participant1Unread;

    await db.update(schema.conversations).set({
      lastMessageId: msg.id,
      lastMessageAt: new Date(),
      [unreadField]: currentUnread + 1,
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
    const receiverSocketId = await getUserSocketId(otherId);
    if (receiverSocketId) {
      io.to(receiverSocketId).emit("new-message", {
        message: decryptedMsg,
        conversationId: conv.id,
        sender,
      });
    }

    // Also notify sender socket for multi-tab sync
    const senderSocketId = await getUserSocketId(userId);
    if (senderSocketId) {
      io.to(senderSocketId).emit("message-sent", {
        message: decryptedMsg,
        conversationId: conv.id,
      });
    }

    return res.status(201).json({ success: true, data: decryptedMsg });
  } catch (err: any) {
    log(`Send message error: ${err.message}`, "social");
    return res.status(500).json({ success: false, message: "خطأ في الإرسال" });
  }
});

// Delete a message (soft delete)
router.delete("/messages/:id", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  try {
    const [msg] = await db.select().from(schema.messages)
      .where(and(eq(schema.messages.id, req.params.id), eq(schema.messages.senderId, userId)))
      .limit(1);

    if (!msg) return res.status(404).json({ success: false, message: "الرسالة غير موجودة" });

    await db.update(schema.messages).set({ isDeleted: true }).where(eq(schema.messages.id, msg.id));
    return res.json({ success: true, message: "تم حذف الرسالة" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Get unread count across all conversations
router.get("/unread-count", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.json({ success: true, data: { unread: 0, friendRequests: 0 } });

  try {
    // Unread messages
    const convs = await db.select().from(schema.conversations)
      .where(
        or(
          eq(schema.conversations.participant1Id, userId),
          eq(schema.conversations.participant2Id, userId),
        )
      );

    let totalUnread = 0;
    for (const c of convs) {
      totalUnread += c.participant1Id === userId ? c.participant1Unread : c.participant2Unread;
    }

    // Pending friend requests
    const [reqCount] = await db.select({ count: count() }).from(schema.friendships)
      .where(
        and(
          eq(schema.friendships.receiverId, userId),
          eq(schema.friendships.status, "pending"),
        )
      );

    return res.json({ success: true, data: { unread: totalUnread, friendRequests: reqCount?.count || 0 } });
  } catch (err: any) {
    return res.json({ success: true, data: { unread: 0, friendRequests: 0 } });
  }
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
    // Check feature toggle
    const featureKey = type === "video" ? "video_call" : "voice_call";
    if (!(await isChatFeatureEnabled(featureKey))) {
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

    // Get coin rate
    const rateKey = type === "video" ? "video_call_rate" : "voice_call_rate";
    const coinRate = await getCoinRate(rateKey, type === "video" ? 20 : 10);

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
        io.to(receiverSocketId).emit("incoming-call", {
          call,
          caller: callerInfo,
        });
      }
    }

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
      io.to(callerSocketId).emit("call-answered", { callId: call.id });
    }

    return res.json({ success: true, data: updated });
  } catch (err: any) {
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

    const callerSocketId = await getUserSocketId(call.callerId);
    if (callerSocketId) io.to(callerSocketId).emit("call-rejected", { callId: call.id });

    return res.json({ success: true, message: "تم رفض المكالمة" });
  } catch (err: any) {
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
    const [call] = await db.select().from(schema.calls)
      .where(
        and(
          eq(schema.calls.id, req.params.id),
          or(eq(schema.calls.callerId, userId), eq(schema.calls.receiverId, userId)),
          or(eq(schema.calls.status, "active"), eq(schema.calls.status, "ringing")),
        )
      ).limit(1);

    if (!call) return res.status(404).json({ success: false, message: "المكالمة غير موجودة" });

    const endedAt = new Date();
    let durationSeconds = 0;
    let coinsCharged = 0;

    if (call.status === "active" && call.startedAt) {
      durationSeconds = Math.ceil((endedAt.getTime() - call.startedAt.getTime()) / 1000);
      const minutes = Math.ceil(durationSeconds / 60);
      coinsCharged = minutes * call.coinRate;

      // Charge the caller
      await chargeCoins(call.callerId, coinsCharged, `مكالمة ${call.type === "video" ? "فيديو" : "صوتية"} (${minutes} دقيقة)`, call.id);
    }

    const [updated] = await db.update(schema.calls).set({
      status: "ended",
      endedAt,
      durationSeconds,
      coinsCharged,
    }).where(eq(schema.calls.id, call.id)).returning();

    // Notify other party
    const otherId = call.callerId === userId ? call.receiverId : call.callerId;
    const otherSocketId = await getUserSocketId(otherId);
    if (otherSocketId) {
      io.to(otherSocketId).emit("call-ended", { callId: call.id, durationSeconds, coinsCharged });
    }

    return res.json({ success: true, data: updated });
  } catch (err: any) {
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
        try { result.packages = JSON.parse(s.value); } catch {}
      }
    });
    return res.json({ success: true, data: result });
  } catch {
    return res.json({ success: true, data: defaults });
  }
});

// Get pricing info (public)
router.get("/pricing", async (_req, res) => {
  const db = getDb();
  const defaults = { voice_call_rate: 10, video_call_rate: 20, message_cost: 0 };
  if (!db) return res.json({ success: true, data: defaults });

  try {
    const settings = await db.select().from(schema.systemSettings)
      .where(
        or(
          eq(schema.systemSettings.key, "voice_call_rate"),
          eq(schema.systemSettings.key, "video_call_rate"),
          eq(schema.systemSettings.key, "message_cost"),
        )
      );

    const result: any = { ...defaults };
    settings.forEach(s => { result[s.key] = parseInt(s.value) || 0; });
    return res.json({ success: true, data: result });
  } catch {
    return res.json({ success: true, data: defaults });
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
      io.to(blockedSocketId).emit("chat-blocked", { blockerId: userId });
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

export default router;
