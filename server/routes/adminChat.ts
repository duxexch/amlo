/**
 * Admin Chat & Broadcast Management API
 * ════════════════════════════════════════
 * Comprehensive endpoints for managing conversations, messages,
 * calls, live streams, and moderation from admin panel.
 */
import { Router, type Request, type Response } from "express";
import { eq, and, or, desc, asc, sql, count, ne, inArray, like, gte, lte, between } from "drizzle-orm";
import { escapeLike } from "../utils/validation";
import { getDb } from "../db";import { requireAdmin } from "../middleware/adminAuth";
import { storage } from "../storage";
import { createLogger } from "../logger";
const log = (msg: string, _src?: string) => chatLog.info(msg);
const chatLog = createLogger("adminChat");
import * as schema from "../../shared/schema";
import { onlineUsersMap, getOnlineUsersCount } from "../onlineUsers";

const router = Router();

// Helper to safely get string param (Express 5 params can be string | string[])
const p = (val: string | string[]): string => Array.isArray(val) ? val[0] : val;

// ══════════════════════════════════════════════════════════
// OVERVIEW — إحصائيات الشات والبث
// ══════════════════════════════════════════════════════════

router.get("/overview/stats", requireAdmin, async (_req, res) => {
  const db = getDb();
  if (!db) {
    // No DB — return zeros
    return res.json({
      success: true,
      data: {
        totalConversations: 0, totalMessages: 0, totalCalls: 0, activeCallsNow: 0,
        messagesToday: 0, callsToday: 0, callRevenueToday: 0, messageRevenueToday: 0,
        totalCallRevenue: 0, totalMessageRevenue: 0, activeChatsNow: 0,
        onlineUsers: await getOnlineUsersCount(),
        avgCallDuration: 0, avgMessagesPerConv: 0,
        voiceCalls: 0, videoCalls: 0, textMessages: 0, imageMessages: 0, voiceMessages: 0, giftMessages: 0,
      },
    });
  }

  try {
    // Total conversations
    const [convCount] = await db.select({ count: count() }).from(schema.conversations);
    // Total messages
    const [msgCount] = await db.select({ count: count() }).from(schema.messages);
    // Total calls
    const [callCount] = await db.select({ count: count() }).from(schema.calls);

    // Today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [msgsToday] = await db.select({ count: count() }).from(schema.messages)
      .where(gte(schema.messages.createdAt, today));
    const [callsToday] = await db.select({ count: count() }).from(schema.calls)
      .where(gte(schema.calls.createdAt, today));

    // Call revenue
    const [callRev] = await db.select({ total: sql<number>`COALESCE(SUM(coins_charged), 0)` }).from(schema.calls);
    const [callRevToday] = await db.select({ total: sql<number>`COALESCE(SUM(coins_charged), 0)` }).from(schema.calls)
      .where(gte(schema.calls.createdAt, today));

    // Message revenue
    const [msgRev] = await db.select({ total: sql<number>`COALESCE(SUM(coins_cost), 0)` }).from(schema.messages);
    const [msgRevToday] = await db.select({ total: sql<number>`COALESCE(SUM(coins_cost), 0)` }).from(schema.messages)
      .where(gte(schema.messages.createdAt, today));

    // Call type breakdown
    const [voiceCalls] = await db.select({ count: count() }).from(schema.calls).where(eq(schema.calls.type, "voice"));
    const [videoCalls] = await db.select({ count: count() }).from(schema.calls).where(eq(schema.calls.type, "video"));

    // Message type breakdown
    const [textMsgs] = await db.select({ count: count() }).from(schema.messages).where(eq(schema.messages.type, "text"));
    const [imageMsgs] = await db.select({ count: count() }).from(schema.messages).where(eq(schema.messages.type, "image"));
    const [voiceMsgs] = await db.select({ count: count() }).from(schema.messages).where(eq(schema.messages.type, "voice"));
    const [giftMsgs] = await db.select({ count: count() }).from(schema.messages).where(eq(schema.messages.type, "gift"));

    // Active calls
    const [activeCalls] = await db.select({ count: count() }).from(schema.calls).where(eq(schema.calls.status, "active"));

    // Average call duration
    const [avgDur] = await db.select({ avg: sql<number>`COALESCE(AVG(duration_seconds), 0)` }).from(schema.calls)
      .where(eq(schema.calls.status, "ended"));

    return res.json({
      success: true,
      data: {
        totalConversations: convCount.count,
        totalMessages: msgCount.count,
        totalCalls: callCount.count,
        activeCallsNow: activeCalls.count,
        messagesToday: msgsToday.count,
        callsToday: callsToday.count,
        callRevenueToday: callRevToday.total || 0,
        messageRevenueToday: msgRevToday.total || 0,
        totalCallRevenue: callRev.total || 0,
        totalMessageRevenue: msgRev.total || 0,
        activeChatsNow: 0,
        onlineUsers: await getOnlineUsersCount(),
        avgCallDuration: Math.round(avgDur.avg || 0),
        avgMessagesPerConv: convCount.count > 0 ? Math.round(msgCount.count / convCount.count) : 0,
        voiceCalls: voiceCalls.count,
        videoCalls: videoCalls.count,
        textMessages: textMsgs.count,
        imageMessages: imageMsgs.count,
        voiceMessages: voiceMsgs.count,
        giftMessages: giftMsgs.count,
      },
    });
  } catch (err: any) {
    log(`Chat stats error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ في تحميل الإحصائيات" });
  }
});

// Trend data (messages + calls per day, last 14 days)
router.get("/overview/trends", requireAdmin, async (_req, res) => {
  const db = getDb();

  // Generate last 14 days with default zeros
  const days: { date: string; messages: number; calls: number; revenue: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = d.toISOString().split("T")[0];
    days.push({ date: dateStr, messages: 0, calls: 0, revenue: 0 });
  }

  if (!db) {
    // No DB — return zeros
    return res.json({ success: true, data: days });
  }

  try {
    const startDate = new Date(days[0].date + "T00:00:00Z");

    // 3 queries instead of 42 — GROUP BY date
    const [msgTrend, callTrend, revTrend] = await Promise.all([
      db.select({
        date: sql<string>`TO_CHAR(${schema.messages.createdAt}, 'YYYY-MM-DD')`,
        count: count(),
      }).from(schema.messages)
        .where(gte(schema.messages.createdAt, startDate))
        .groupBy(sql`TO_CHAR(${schema.messages.createdAt}, 'YYYY-MM-DD')`),

      db.select({
        date: sql<string>`TO_CHAR(${schema.calls.createdAt}, 'YYYY-MM-DD')`,
        count: count(),
      }).from(schema.calls)
        .where(gte(schema.calls.createdAt, startDate))
        .groupBy(sql`TO_CHAR(${schema.calls.createdAt}, 'YYYY-MM-DD')`),

      db.select({
        date: sql<string>`TO_CHAR(${schema.calls.createdAt}, 'YYYY-MM-DD')`,
        total: sql<number>`COALESCE(SUM(coins_charged), 0)`,
      }).from(schema.calls)
        .where(gte(schema.calls.createdAt, startDate))
        .groupBy(sql`TO_CHAR(${schema.calls.createdAt}, 'YYYY-MM-DD')`),
    ]);

    // Merge results into days array
    const msgMap = new Map(msgTrend.map(r => [r.date, r.count]));
    const callMap = new Map(callTrend.map(r => [r.date, r.count]));
    const revMap = new Map(revTrend.map(r => [r.date, r.total]));

    for (const day of days) {
      day.messages = msgMap.get(day.date) || 0;
      day.calls = callMap.get(day.date) || 0;
      day.revenue = revMap.get(day.date) || 0;
    }

    return res.json({ success: true, data: days });
  } catch (err: any) {
    // Fallback to zeros on error
    return res.json({ success: true, data: days });
  }
});

// Top chatters
router.get("/overview/top-chatters", requireAdmin, async (_req, res) => {
  const db = getDb();
  if (!db) {
    return res.json({ success: true, data: [] });
  }

  try {
    const topSenders = await db.select({
      senderId: schema.messages.senderId,
      messageCount: count(),
    }).from(schema.messages)
      .where(eq(schema.messages.isDeleted, false))
      .groupBy(schema.messages.senderId)
      .orderBy(desc(count()))
      .limit(10);

    if (topSenders.length === 0) return res.json({ success: true, data: [] });

    const userIds = topSenders.map(s => s.senderId);
    const users = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
    }).from(schema.users).where(inArray(schema.users.id, userIds));

    const result = topSenders.map(s => {
      const user = users.find(u => u.id === s.senderId);
      return {
        userId: s.senderId,
        username: user?.username || "unknown",
        displayName: user?.displayName || "مستخدم",
        avatar: user?.avatar || null,
        messageCount: s.messageCount,
        callCount: 0,
        totalSpent: 0,
      };
    });

    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.json({ success: true, data: [] });
  }
});

// ══════════════════════════════════════════════════════════
// CONVERSATIONS — إدارة المحادثات
// ══════════════════════════════════════════════════════════

router.get("/conversations", requireAdmin, async (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = (req.query.search as string) || "";
  const offset = (page - 1) * limit;

  if (!db) {
    return res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  }

  try {
    let query = db.select().from(schema.conversations).orderBy(desc(schema.conversations.lastMessageAt));
    const [totalResult] = await db.select({ count: count() }).from(schema.conversations);
    const convs = await query.limit(limit).offset(offset);

    // Fetch participant info
    const allUserIds = Array.from(new Set(convs.flatMap(c => [c.participant1Id, c.participant2Id])));
    const users = allUserIds.length > 0
      ? await db.select({
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        }).from(schema.users).where(inArray(schema.users.id, allUserIds))
      : [];

    // Message counts per conversation — single grouped query instead of N+1
    const convIds = convs.map(c => c.id);
    const msgCounts = convIds.length > 0
      ? await db.select({
          conversationId: schema.messages.conversationId,
          count: count(),
        }).from(schema.messages)
          .where(and(
            inArray(schema.messages.conversationId, convIds),
            eq(schema.messages.isDeleted, false),
          ))
          .groupBy(schema.messages.conversationId)
      : [];
    const countMap = new Map(msgCounts.map(m => [m.conversationId, m.count]));

    const data = convs.map((c) => ({
      id: c.id,
      participant1: users.find(u => u.id === c.participant1Id) || { id: c.participant1Id, username: "unknown", displayName: "محذوف", avatar: null },
      participant2: users.find(u => u.id === c.participant2Id) || { id: c.participant2Id, username: "unknown", displayName: "محذوف", avatar: null },
      messageCount: countMap.get(c.id) ?? 0,
      lastMessageAt: c.lastMessageAt,
      isActive: c.isActive,
    }));

    // Filter by search (participant username/displayName)
    const filtered = search
      ? data.filter(d =>
          d.participant1.username.includes(search) || d.participant1.displayName?.includes(search) ||
          d.participant2.username.includes(search) || d.participant2.displayName?.includes(search))
      : data;

    return res.json({
      success: true,
      data: filtered,
      pagination: { page, limit, total: totalResult.count, totalPages: Math.ceil(totalResult.count / limit) },
    });
  } catch (err: any) {
    log(`Conv list error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Get conversation messages
router.get("/conversations/:id/messages", requireAdmin, async (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 50;
  const offset = (page - 1) * limit;

  if (!db) {
    return res.json({ success: true, data: [] });
  }

  try {
    const msgs = await db.select().from(schema.messages)
      .where(eq(schema.messages.conversationId, p(req.params.id)))
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit)
      .offset(offset);

    const senderIds = Array.from(new Set(msgs.map(m => m.senderId)));
    const senders = senderIds.length > 0
      ? await db.select({
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
        }).from(schema.users).where(inArray(schema.users.id, senderIds))
      : [];

    const data = msgs.map(m => ({
      ...m,
      senderName: senders.find(s => s.id === m.senderId)?.displayName || "مجهول",
    }));

    return res.json({ success: true, data: data.reverse() });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Delete conversation (soft: deactivate + delete messages)
router.delete("/conversations/:id", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ success: true, message: "تم الحذف" });

  try {
    const convId = p(req.params.id);
    await db.update(schema.conversations).set({ isActive: false }).where(eq(schema.conversations.id, convId));
    await db.update(schema.messages).set({ isDeleted: true }).where(eq(schema.messages.conversationId, convId));
    await storage.addAdminLog(req.session.adminId!, "delete_conversation", "conversation", convId, "حذف محادثة");
    return res.json({ success: true, message: "تم حذف المحادثة" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ══════════════════════════════════════════════════════════
// MESSAGES — إدارة الرسائل
// ══════════════════════════════════════════════════════════

router.get("/messages", requireAdmin, async (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 30;
  const search = (req.query.search as string) || "";
  const type = (req.query.type as string) || "";
  const offset = (page - 1) * limit;

  if (!db) {
    return res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  }

  try {
    const conditions = [eq(schema.messages.isDeleted, false)];
    if (type) conditions.push(eq(schema.messages.type, type));

    const [totalResult] = await db.select({ count: count() }).from(schema.messages).where(and(...conditions));
    const msgs = await db.select().from(schema.messages)
      .where(and(...conditions))
      .orderBy(desc(schema.messages.createdAt))
      .limit(limit).offset(offset);

    const senderIds = Array.from(new Set(msgs.map(m => m.senderId)));
    const senders = senderIds.length > 0
      ? await db.select({ id: schema.users.id, username: schema.users.username, displayName: schema.users.displayName })
          .from(schema.users).where(inArray(schema.users.id, senderIds))
      : [];

    const data = msgs.map(m => ({
      ...m,
      senderName: senders.find(s => s.id === m.senderId)?.displayName || "مجهول",
    }));

    return res.json({
      success: true,
      data,
      pagination: { page, limit, total: totalResult.count, totalPages: Math.ceil(totalResult.count / limit) },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Delete message
router.delete("/messages/:id", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ success: true, message: "تم الحذف" });

  try {
    const msgId = p(req.params.id);
    await db.update(schema.messages).set({ isDeleted: true }).where(eq(schema.messages.id, msgId));
    await storage.addAdminLog(req.session.adminId!, "delete_message", "message", msgId, "حذف رسالة");
    return res.json({ success: true, message: "تم حذف الرسالة" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Bulk delete messages
router.post("/messages/bulk-delete", requireAdmin, async (req, res) => {
  const db = getDb();
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ success: false, message: "لا توجد رسائل" });
  if (!db) return res.json({ success: true, message: "تم حذف الرسائل" });

  try {
    await db.update(schema.messages).set({ isDeleted: true }).where(inArray(schema.messages.id, ids));
    await storage.addAdminLog(req.session.adminId!, "bulk_delete_messages", "message", "", `حذف ${ids.length} رسالة`);
    return res.json({ success: true, message: `تم حذف ${ids.length} رسالة` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ══════════════════════════════════════════════════════════
// CALLS — إدارة المكالمات
// ══════════════════════════════════════════════════════════

router.get("/calls", requireAdmin, async (req, res) => {
  const db = getDb();
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const type = (req.query.type as string) || "";
  const status = (req.query.status as string) || "";
  const offset = (page - 1) * limit;

  if (!db) {
    return res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  }

  try {
    const conditions: any[] = [];
    if (type) conditions.push(eq(schema.calls.type, type));
    if (status) conditions.push(eq(schema.calls.status, status));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

    const [totalResult] = await db.select({ count: count() }).from(schema.calls).where(whereClause);
    const callsList = await db.select().from(schema.calls)
      .where(whereClause)
      .orderBy(desc(schema.calls.createdAt))
      .limit(limit).offset(offset);

    const allUserIds = Array.from(new Set(callsList.flatMap(c => [c.callerId, c.receiverId])));
    const users = allUserIds.length > 0
      ? await db.select({ id: schema.users.id, username: schema.users.username, displayName: schema.users.displayName, avatar: schema.users.avatar })
          .from(schema.users).where(inArray(schema.users.id, allUserIds))
      : [];

    const data = callsList.map(c => ({
      id: c.id,
      caller: users.find(u => u.id === c.callerId) || { id: c.callerId, username: "unknown", displayName: "محذوف", avatar: null },
      receiver: users.find(u => u.id === c.receiverId) || { id: c.receiverId, username: "unknown", displayName: "محذوف", avatar: null },
      type: c.type,
      status: c.status,
      durationSeconds: c.durationSeconds,
      coinsCharged: c.coinsCharged,
      coinRate: c.coinRate,
      startedAt: c.startedAt,
      endedAt: c.endedAt,
      createdAt: c.createdAt,
    }));

    return res.json({
      success: true,
      data,
      pagination: { page, limit, total: totalResult.count, totalPages: Math.ceil(totalResult.count / limit) },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Force end a call
router.post("/calls/:id/force-end", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ success: true, message: "تم إنهاء المكالمة" });

  try {
    const callId = p(req.params.id);
    await db.update(schema.calls).set({ status: "ended", endedAt: new Date() }).where(eq(schema.calls.id, callId));
    await storage.addAdminLog(req.session.adminId!, "force_end_call", "call", callId, "إنهاء مكالمة إجبارياً");
    return res.json({ success: true, message: "تم إنهاء المكالمة" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ══════════════════════════════════════════════════════════
// MODERATION — الحظر والرقابة
// ══════════════════════════════════════════════════════════

// Default moderation settings (used as fallback when DB has no config)
const defaultModerationSettings = {
  bannedWords: ["كلمة_محظورة", "spam", "سب", "شتم", "تحرش"],
  autoDelete: true,
  maxMessageLength: 2000,
  maxMessagesPerMinute: 30,
  allowImages: true,
  allowVoice: true,
  allowGifts: true,
  maxCallDuration: 3600,
  minLevelToChat: 1,
  minLevelToCall: 1,
  minLevelToStream: 5,
  maxConcurrentStreams: 100,
  streamMaxViewers: 10000,
  chatCooldown: 2,
  enableProfanityFilter: true,
  enableSpamDetection: true,
  autoMuteSpammers: true,
  spamThreshold: 5,
};

/** Load moderation settings from DB, falling back to defaults */
async function getModerationSettings(): Promise<typeof defaultModerationSettings> {
  try {
    const cfg = await storage.getSystemConfig("moderation");
    if (cfg && cfg.configData) {
      const data = typeof cfg.configData === "string" ? JSON.parse(cfg.configData) : cfg.configData;
      return { ...defaultModerationSettings, ...data };
    }
  } catch (e: any) { chatLog.warn(`Failed to parse moderation config: ${e.message}`); }
  return { ...defaultModerationSettings };
}

/** Save moderation settings to DB */
async function saveModerationSettings(settings: typeof defaultModerationSettings, adminId?: string) {
  await storage.upsertSystemConfig("moderation", settings, adminId);
}

router.get("/moderation/settings", requireAdmin, async (_req, res) => {
  const settings = await getModerationSettings();
  return res.json({ success: true, data: settings });
});

router.put("/moderation/settings", requireAdmin, async (req, res) => {
  const current = await getModerationSettings();
  const allowed = ["bannedWords", "autoDelete", "maxMessageLength", "maxMessagesPerMinute",
    "allowImages", "allowVoice", "allowGifts", "maxCallDuration", "minLevelToChat",
    "minLevelToCall", "minLevelToStream", "maxConcurrentStreams", "streamMaxViewers",
    "chatCooldown", "enableProfanityFilter", "enableSpamDetection", "autoMuteSpammers", "spamThreshold"];
  const updates: Record<string, unknown> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key];
  }
  const updated = { ...current, ...updates } as typeof defaultModerationSettings;
  await saveModerationSettings(updated, req.session.adminId);
  await storage.addAdminLog(req.session.adminId!, "update_moderation", "settings", "", JSON.stringify(Object.keys(updates)));
  return res.json({ success: true, data: updated, message: "تم تحديث إعدادات الرقابة" });
});

// Banned words management
router.get("/moderation/banned-words", requireAdmin, async (_req, res) => {
  const settings = await getModerationSettings();
  return res.json({ success: true, data: settings.bannedWords });
});

router.post("/moderation/banned-words", requireAdmin, async (req, res) => {
  const { word } = req.body;
  if (!word || typeof word !== "string") return res.status(400).json({ success: false, message: "يرجى إدخال كلمة" });
  const settings = await getModerationSettings();
  if (!settings.bannedWords.includes(word.trim())) {
    settings.bannedWords.push(word.trim());
  }
  await saveModerationSettings(settings, req.session.adminId);
  await storage.addAdminLog(req.session.adminId!, "add_banned_word", "moderation", "", word);
  return res.json({ success: true, data: settings.bannedWords });
});

router.delete("/moderation/banned-words/:word", requireAdmin, async (req, res) => {
  const word = p(req.params.word);
  const settings = await getModerationSettings();
  settings.bannedWords = settings.bannedWords.filter(w => w !== word);
  await saveModerationSettings(settings, req.session.adminId);
  await storage.addAdminLog(req.session.adminId!, "remove_banned_word", "moderation", "", word);
  return res.json({ success: true, data: settings.bannedWords });
});

// ══════════════════════════════════════════════════════════
// CHAT & BROADCAST SETTINGS — إعدادات الشات والبث
// ══════════════════════════════════════════════════════════

router.get("/settings", requireAdmin, async (_req, res) => {
  const db = getDb();
  const defaults = {
    voice_call_rate: 5,
    video_call_rate: 10,
    message_cost: 1,
    max_message_length: 2000,
    chat_cooldown: 2,
    max_call_duration: 3600,
    min_level_chat: 1,
    min_level_call: 1,
    min_level_stream: 5,
    allow_images: true,
    allow_voice: true,
    allow_gifts: true,
    max_concurrent_streams: 100,
    stream_max_viewers: 10000,
    enable_profanity_filter: true,
    enable_spam_detection: true,
    video_streaming_enabled: true,
    audio_streaming_enabled: true,
  };

  if (!db) return res.json({ success: true, data: defaults });

  try {
    const settings = await db.select().from(schema.systemSettings);
    const result: Record<string, any> = { ...defaults };
    settings.forEach(s => {
      if (s.key in defaults) {
        const val = s.value;
        if (val === "true") result[s.key] = true;
        else if (val === "false") result[s.key] = false;
        else if (!isNaN(Number(val))) result[s.key] = Number(val);
        else result[s.key] = val;
      }
    });
    return res.json({ success: true, data: result });
  } catch (err: any) {
    return res.json({ success: true, data: defaults });
  }
});

router.put("/settings", requireAdmin, async (req, res) => {
  const db = getDb();
  const { settings } = req.body;
  if (!Array.isArray(settings)) return res.status(400).json({ success: false, message: "بيانات غير صالحة" });

  if (!db) return res.json({ success: true, message: "تم التحديث" });

  try {
    for (const { key, value } of settings) {
      const existing = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, key)).limit(1);
      if (existing.length > 0) {
        await db.update(schema.systemSettings).set({ value: String(value), updatedAt: new Date() }).where(eq(schema.systemSettings.key, key));
      } else {
        await db.insert(schema.systemSettings).values({ key, value: String(value), category: "chat" });
      }
    }
    await storage.addAdminLog(req.session.adminId!, "update_chat_settings", "settings", "", `تحديث ${settings.length} إعدادات`);
    return res.json({ success: true, message: "تم تحديث الإعدادات" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ══════════════════════════════════════════════════════════
// LIVE STREAMS — البث المباشر
// ══════════════════════════════════════════════════════════

router.get("/streams/active", requireAdmin, async (_req, res) => {
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

  try {
    const activeStreams = await db.select().from(schema.streams)
      .where(eq(schema.streams.status, "active"))
      .orderBy(desc(schema.streams.viewerCount));

    // Enrich with user info
    const userIds = activeStreams.map(s => s.userId);
    const users = userIds.length > 0
      ? await db.select({ id: schema.users.id, username: schema.users.username, displayName: schema.users.displayName })
          .from(schema.users).where(inArray(schema.users.id, userIds))
      : [];

    const data = activeStreams.map(s => {
      const user = users.find(u => u.id === s.userId);
      return {
        id: s.id,
        userId: s.userId,
        username: user?.username || "unknown",
        displayName: user?.displayName || "مجهول",
        title: s.title,
        viewers: s.viewerCount,
        peakViewers: s.peakViewers,
        duration: s.startedAt ? Math.floor((Date.now() - new Date(s.startedAt).getTime()) / 1000) : 0,
        giftsReceived: s.totalGifts,
        coinsEarned: 0,
        status: s.status,
        startedAt: s.startedAt,
      };
    });

    return res.json({ success: true, data });
  } catch (err: any) {
    log(`Active streams error: ${err.message}`, "admin");
    return res.json({ success: true, data: [] });
  }
});

router.get("/streams/stats", requireAdmin, async (_req, res) => {
  const db = getDb();
  if (!db) return res.json({ success: true, data: { activeNow: 0, totalViewers: 0, totalToday: 0, avgDuration: 0, avgViewers: 0, totalGiftsToday: 0, totalRevenueToday: 0, peakConcurrent: 0, topCategories: [] } });

  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [activeNow] = await db.select({ count: count() }).from(schema.streams).where(eq(schema.streams.status, "active"));
    const [totalViewers] = await db.select({ total: sql<number>`COALESCE(SUM(viewer_count), 0)` }).from(schema.streams).where(eq(schema.streams.status, "active"));
    const [totalToday] = await db.select({ count: count() }).from(schema.streams).where(gte(schema.streams.startedAt, today));
    const [totalGiftsToday] = await db.select({ total: sql<number>`COALESCE(SUM(total_gifts), 0)` }).from(schema.streams).where(gte(schema.streams.startedAt, today));

    return res.json({
      success: true,
      data: {
        activeNow: activeNow?.count || 0,
        totalViewers: totalViewers?.total || 0,
        totalToday: totalToday?.count || 0,
        avgDuration: 0,
        avgViewers: 0,
        totalGiftsToday: totalGiftsToday?.total || 0,
        totalRevenueToday: 0,
        peakConcurrent: 0,
        topCategories: [],
      },
    });
  } catch (err: any) {
    log(`Stream stats error: ${err.message}`, "admin");
    return res.json({ success: true, data: { activeNow: 0, totalViewers: 0, totalToday: 0, avgDuration: 0, avgViewers: 0, totalGiftsToday: 0, totalRevenueToday: 0, peakConcurrent: 0, topCategories: [] } });
  }
});

router.post("/streams/:id/end", requireAdmin, async (req, res) => {
  const db = getDb();
  const streamId = p(req.params.id);

  if (db) {
    try {
      await db.update(schema.streams).set({ status: "ended", endedAt: new Date() }).where(eq(schema.streams.id, streamId));
    } catch (err: any) {
      log(`Force end stream error: ${err.message}`, "admin");
    }
  }

  await storage.addAdminLog(req.session.adminId!, "force_end_stream", "stream", streamId, "إيقاف بث إجبارياً");
  return res.json({ success: true, message: "تم إيقاف البث" });
});

// ══════════════════════════════════════════════════════════
// ADMIN CHAT SETTINGS — إعدادات الدردشة
// ══════════════════════════════════════════════════════════

// Get all chat settings
router.get("/settings/chat", requireAdmin, async (_req, res) => {
  const db = getDb();
  const defaults = {
    chat_media_enabled: "true",
    chat_voice_call_enabled: "true",
    chat_video_call_enabled: "true",
    chat_time_limit: "0",
    message_cost: "0",
    voice_call_rate: "10",
    video_call_rate: "20",
  };

  if (!db) return res.json({ success: true, data: defaults });

  try {
    const keys = Object.keys(defaults);
    const settings = await db.select().from(schema.systemSettings)
      .where(inArray(schema.systemSettings.key, keys));

    const result: Record<string, string> = { ...defaults };
    settings.forEach(s => { result[s.key] = s.value; });
    return res.json({ success: true, data: result });
  } catch {
    return res.json({ success: true, data: defaults });
  }
});

// Update a chat setting
router.put("/settings/chat", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  const { key, value } = req.body;
  if (!key || value === undefined) return res.status(400).json({ success: false, message: "key و value مطلوبان" });

  const validKeys = [
    "chat_media_enabled", "chat_voice_call_enabled", "chat_video_call_enabled",
    "chat_time_limit", "message_cost", "voice_call_rate", "video_call_rate",
  ];
  if (!validKeys.includes(key)) return res.status(400).json({ success: false, message: "مفتاح غير صالح" });

  try {
    const existing = await db.select().from(schema.systemSettings)
      .where(eq(schema.systemSettings.key, key)).limit(1);

    if (existing.length > 0) {
      await db.update(schema.systemSettings)
        .set({ value: String(value), updatedAt: new Date() })
        .where(eq(schema.systemSettings.key, key));
    } else {
      await db.insert(schema.systemSettings).values({
        key,
        value: String(value),
        category: "chat",
        description: `Chat setting: ${key}`,
      });
    }

    await storage.addAdminLog(req.session.adminId!, "update_chat_setting", "setting", key, `${key} = ${value}`);
    return res.json({ success: true, message: "تم تحديث الإعداد" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ══════════════════════════════════════════════════════════
// MESSAGE REPORTS — بلاغات الرسائل (لوحة الأدمن)
// ══════════════════════════════════════════════════════════

// Get all message reports
router.get("/message-reports", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ success: true, data: [], total: 0 });

  const page = parseInt(req.query.page as string) || 1;
  const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
  const offset = (page - 1) * limit;
  const statusFilter = req.query.status as string;

  try {
    let query = db.select().from(schema.messageReports);
    
    if (statusFilter && statusFilter !== "all") {
      query = query.where(eq(schema.messageReports.status, statusFilter)) as any;
    }

    const reports = await (query as any)
      .orderBy(desc(schema.messageReports.createdAt))
      .limit(limit)
      .offset(offset);

    // Get total count
    const [totalResult] = statusFilter && statusFilter !== "all"
      ? await db.select({ count: count() }).from(schema.messageReports).where(eq(schema.messageReports.status, statusFilter))
      : await db.select({ count: count() }).from(schema.messageReports);

    // Enrich with user info
    const userIds = Array.from(new Set([
      ...reports.map((r: any) => r.reporterId),
      ...reports.map((r: any) => r.reportedUserId),
    ]));

    const users = userIds.length > 0
      ? await db.select({
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        }).from(schema.users).where(inArray(schema.users.id, userIds))
      : [];

    // Get message content (decrypted) for each report
    const { decryptMessage } = await import("../utils/encryption");
    const messageIds = reports.map((r: any) => r.messageId).filter(Boolean);
    const messages = messageIds.length > 0
      ? await db.select().from(schema.messages).where(inArray(schema.messages.id, messageIds))
      : [];

    const enriched = reports.map((r: any) => ({
      ...r,
      reporter: users.find(u => u.id === r.reporterId),
      reportedUser: users.find(u => u.id === r.reportedUserId),
      message: (() => {
        const msg = messages.find(m => m.id === r.messageId);
        if (msg) return { ...msg, content: msg.content ? decryptMessage(msg.content, msg.conversationId) : msg.content };
        return null;
      })(),
    }));

    return res.json({ success: true, data: enriched, total: totalResult?.count || 0 });
  } catch (err: any) {
    log(`Message reports error: ${err.message}`, "admin");
    return res.json({ success: true, data: [], total: 0 });
  }
});

// Get report stats
router.get("/message-reports/stats", requireAdmin, async (_req, res) => {
  const db = getDb();
  if (!db) return res.json({ success: true, data: { pending: 0, reviewed: 0, resolved: 0, dismissed: 0, total: 0 } });

  try {
    const [pending] = await db.select({ count: count() }).from(schema.messageReports).where(eq(schema.messageReports.status, "pending"));
    const [reviewed] = await db.select({ count: count() }).from(schema.messageReports).where(eq(schema.messageReports.status, "reviewed"));
    const [resolved] = await db.select({ count: count() }).from(schema.messageReports).where(eq(schema.messageReports.status, "resolved"));
    const [dismissed] = await db.select({ count: count() }).from(schema.messageReports).where(eq(schema.messageReports.status, "dismissed"));
    const [total] = await db.select({ count: count() }).from(schema.messageReports);

    return res.json({
      success: true,
      data: {
        pending: pending?.count || 0,
        reviewed: reviewed?.count || 0,
        resolved: resolved?.count || 0,
        dismissed: dismissed?.count || 0,
        total: total?.count || 0,
      },
    });
  } catch {
    return res.json({ success: true, data: { pending: 0, reviewed: 0, resolved: 0, dismissed: 0, total: 0 } });
  }
});

// Update report status
router.put("/message-reports/:id", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  const reportId = p(req.params.id);
  const { status, adminNotes } = req.body;

  if (!status) return res.status(400).json({ success: false, message: "الحالة مطلوبة" });

  try {
    const [report] = await db.select().from(schema.messageReports)
      .where(eq(schema.messageReports.id, reportId)).limit(1);

    if (!report) return res.status(404).json({ success: false, message: "البلاغ غير موجود" });

    await db.update(schema.messageReports).set({
      status,
      adminNotes: adminNotes || report.adminNotes,
      reviewedBy: req.session.adminId!,
      reviewedAt: new Date(),
    }).where(eq(schema.messageReports.id, reportId));

    await storage.addAdminLog(req.session.adminId!, "review_message_report", "report", reportId, `Status: ${status}`);

    return res.json({ success: true, message: "تم تحديث البلاغ" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ══════════════════════════════════════════════════════════
// CHAT BLOCKS MANAGEMENT — إدارة حظر الدردشة
// ══════════════════════════════════════════════════════════

// List all chat blocks
router.get("/chat-blocks", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ success: true, data: [], total: 0 });

  const page = parseInt(req.query.page as string) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;

  try {
    const blocks = await db.select().from(schema.chatBlocks)
      .orderBy(desc(schema.chatBlocks.createdAt))
      .limit(limit)
      .offset(offset);

    const [totalResult] = await db.select({ count: count() }).from(schema.chatBlocks);

    const userIds = Array.from(new Set([...blocks.map(b => b.blockerId), ...blocks.map(b => b.blockedId)]));
    const users = userIds.length > 0
      ? await db.select({
          id: schema.users.id,
          username: schema.users.username,
          displayName: schema.users.displayName,
          avatar: schema.users.avatar,
        }).from(schema.users).where(inArray(schema.users.id, userIds))
      : [];

    const enriched = blocks.map(b => ({
      ...b,
      blocker: users.find(u => u.id === b.blockerId),
      blocked: users.find(u => u.id === b.blockedId),
    }));

    return res.json({ success: true, data: enriched, total: totalResult?.count || 0 });
  } catch {
    return res.json({ success: true, data: [], total: 0 });
  }
});

// Force remove a chat block (admin)
router.delete("/chat-blocks/:id", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });

  const blockId = p(req.params.id);

  try {
    await db.delete(schema.chatBlocks).where(eq(schema.chatBlocks.id, blockId));
    await storage.addAdminLog(req.session.adminId!, "remove_chat_block", "block", blockId, "إزالة حظر دردشة");
    return res.json({ success: true, message: "تم إزالة الحظر" });
  } catch {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ════════════════════════════════════════════════════════
// STREAM PERMISSION & WHITELIST — إدارة صلاحيات البث
// ════════════════════════════════════════════════════════

// GET stream whitelist users (users who can stream even when globally disabled)
router.get("/streams/whitelist", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

  try {
    // Get all whitelist entries from systemSettings
    const entries = await db.select().from(schema.systemSettings)
      .where(sql`${schema.systemSettings.key} LIKE 'stream_whitelist_%' AND ${schema.systemSettings.value} = 'true'`);

    if (!entries.length) return res.json({ success: true, data: [] });

    const userIds = entries.map(e => e.key.replace('stream_whitelist_', ''));
    const users = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
      level: schema.users.level,
      canStream: schema.users.canStream,
    }).from(schema.users).where(inArray(schema.users.id, userIds));

    return res.json({ success: true, data: users });
  } catch (err: any) {
    return res.json({ success: true, data: [] });
  }
});

// PUT add/remove user from stream whitelist
router.put("/streams/whitelist/:userId", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB" });

  const userId = p(req.params.userId);
  const { allowed } = req.body; // true or false

  try {
    const key = `stream_whitelist_${userId}`;
    const existing = await db.select().from(schema.systemSettings).where(eq(schema.systemSettings.key, key)).limit(1);

    if (allowed) {
      if (existing.length > 0) {
        await db.update(schema.systemSettings).set({ value: "true", updatedAt: new Date() }).where(eq(schema.systemSettings.key, key));
      } else {
        await db.insert(schema.systemSettings).values({ key, value: "true", category: "streaming" });
      }
    } else {
      if (existing.length > 0) {
        await db.delete(schema.systemSettings).where(eq(schema.systemSettings.key, key));
      }
    }

    await storage.addAdminLog(req.session.adminId!, allowed ? "whitelist_stream_user" : "remove_stream_whitelist", "user", userId, "");
    return res.json({ success: true, message: allowed ? "تمت الإضافة للقائمة البيضاء" : "تمت الإزالة من القائمة البيضاء" });
  } catch {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// PUT toggle user's canStream permission
router.put("/users/:userId/can-stream", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB" });

  const userId = p(req.params.userId);
  const { canStream } = req.body;

  try {
    await db.update(schema.users).set({ canStream: !!canStream }).where(eq(schema.users.id, userId));
    await storage.addAdminLog(req.session.adminId!, canStream ? "enable_user_stream" : "disable_user_stream", "user", userId, "");
    return res.json({ success: true, message: canStream ? "تم تفعيل البث للمستخدم" : "تم تعطيل البث للمستخدم" });
  } catch {
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

// GET search users for whitelist management
router.get("/streams/whitelist/search", requireAdmin, async (req, res) => {
  const db = getDb();
  if (!db) return res.json({ success: true, data: [] });

  const q = (req.query.q as string || "").trim();
  if (!q || q.length < 2) return res.json({ success: true, data: [] });

  try {
    const users = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
      level: schema.users.level,
      canStream: schema.users.canStream,
    }).from(schema.users)
      .where(sql`(${schema.users.username} ILIKE ${'%' + escapeLike(q) + '%'} OR ${schema.users.displayName} ILIKE ${'%' + escapeLike(q) + '%'})`)
      .limit(20);
    return res.json({ success: true, data: users });
  } catch {
    return res.json({ success: true, data: [] });
  }
});

export default router;
