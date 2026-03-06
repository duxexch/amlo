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
import { io, getLiveTelemetrySnapshot } from "../index";
import { getUserSocketId } from "../onlineUsers";
import { decryptMessage } from "../utils/encryption";

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Batch all independent queries in parallel
    const [
      [convCount], [msgCount], [callCount],
      [msgsToday], [callsToday],
      [callRev], [callRevToday],
      [msgRev], [msgRevToday],
      [voiceCalls], [videoCalls],
      [textMsgs], [imageMsgs], [voiceMsgs], [giftMsgs],
      [activeCalls], [avgDur],
    ] = await Promise.all([
      db.select({ count: count() }).from(schema.conversations),
      db.select({ count: count() }).from(schema.messages),
      db.select({ count: count() }).from(schema.calls),
      db.select({ count: count() }).from(schema.messages).where(gte(schema.messages.createdAt, today)),
      db.select({ count: count() }).from(schema.calls).where(gte(schema.calls.createdAt, today)),
      db.select({ total: sql<number>`COALESCE(SUM(coins_charged), 0)` }).from(schema.calls),
      db.select({ total: sql<number>`COALESCE(SUM(coins_charged), 0)` }).from(schema.calls).where(gte(schema.calls.createdAt, today)),
      db.select({ total: sql<number>`COALESCE(SUM(coins_cost), 0)` }).from(schema.messages),
      db.select({ total: sql<number>`COALESCE(SUM(coins_cost), 0)` }).from(schema.messages).where(gte(schema.messages.createdAt, today)),
      db.select({ count: count() }).from(schema.calls).where(eq(schema.calls.type, "voice")),
      db.select({ count: count() }).from(schema.calls).where(eq(schema.calls.type, "video")),
      db.select({ count: count() }).from(schema.messages).where(eq(schema.messages.type, "text")),
      db.select({ count: count() }).from(schema.messages).where(eq(schema.messages.type, "image")),
      db.select({ count: count() }).from(schema.messages).where(eq(schema.messages.type, "voice")),
      db.select({ count: count() }).from(schema.messages).where(eq(schema.messages.type, "gift")),
      db.select({ count: count() }).from(schema.calls).where(eq(schema.calls.status, "active")),
      db.select({ avg: sql<number>`COALESCE(AVG(duration_seconds), 0)` }).from(schema.calls).where(eq(schema.calls.status, "ended")),
    ]);

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

    // Enrich with call counts and total spent per user
    const callStats = await db.select({
      userId: schema.calls.callerId,
      callCount: count(),
      totalSpent: sql<number>`COALESCE(SUM(${schema.calls.coinsCharged}), 0)`,
    }).from(schema.calls)
      .where(inArray(schema.calls.callerId, userIds))
      .groupBy(schema.calls.callerId);

    const msgSpent = await db.select({
      userId: schema.messages.senderId,
      totalMsgSpent: sql<number>`COALESCE(SUM(${schema.messages.coinsCost}), 0)`,
    }).from(schema.messages)
      .where(and(inArray(schema.messages.senderId, userIds), eq(schema.messages.isDeleted, false)))
      .groupBy(schema.messages.senderId);

    for (const r of result) {
      const cs = callStats.find(c => c.userId === r.userId);
      const ms = msgSpent.find(m => m.userId === r.userId);
      r.callCount = cs?.callCount || 0;
      r.totalSpent = (cs?.totalSpent || 0) + (ms?.totalMsgSpent || 0);
    }

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
    // If search is provided, first find matching user IDs, then filter conversations
    let matchingUserIds: string[] = [];
    if (search) {
      const searchUsers = await db.select({ id: schema.users.id }).from(schema.users)
        .where(or(
          sql`${schema.users.username} ILIKE ${'%' + escapeLike(search) + '%'}`,
          sql`${schema.users.displayName} ILIKE ${'%' + escapeLike(search) + '%'}`,
        )).limit(100);
      matchingUserIds = searchUsers.map(u => u.id);
      if (matchingUserIds.length === 0) {
        return res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
    }

    // Build conditions for conversation query
    const conditions = search && matchingUserIds.length > 0
      ? [or(
          inArray(schema.conversations.participant1Id, matchingUserIds),
          inArray(schema.conversations.participant2Id, matchingUserIds),
        )]
      : [];

    const [totalResult] = conditions.length > 0
      ? await db.select({ count: count() }).from(schema.conversations).where(and(...conditions))
      : await db.select({ count: count() }).from(schema.conversations);

    const convs = conditions.length > 0
      ? await db.select().from(schema.conversations)
          .where(and(...conditions))
          .orderBy(desc(schema.conversations.lastMessageAt))
          .limit(limit).offset(offset)
      : await db.select().from(schema.conversations)
          .orderBy(desc(schema.conversations.lastMessageAt))
          .limit(limit).offset(offset);

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

    return res.json({
      success: true,
      data,
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

    const data = msgs.map(m => {
      let content = m.content;
      if (content && !m.isDeleted) {
        try { content = decryptMessage(content, m.conversationId); } catch { /* keep original */ }
      }
      return {
        ...m,
        content,
        senderName: senders.find(s => s.id === m.senderId)?.displayName || "مجهول",
      };
    });

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

    const [conv] = await db.select({ p1: schema.conversations.participant1Id, p2: schema.conversations.participant2Id })
      .from(schema.conversations)
      .where(eq(schema.conversations.id, convId))
      .limit(1);

    await db.update(schema.conversations).set({ isActive: false }).where(eq(schema.conversations.id, convId));
    await db.update(schema.messages).set({ isDeleted: true }).where(eq(schema.messages.conversationId, convId));

    if (conv) {
      for (const uid of [conv.p1, conv.p2]) {
        const sid = await getUserSocketId(uid);
        if (sid) {
          io.to(sid).emit("conversation-deleted", { conversationId: convId });
        }
      }
    }

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
  const limit = Math.min(Math.max(parseInt(req.query.limit as string) || 30, 1), 100);
  const search = (req.query.search as string) || "";
  const type = (req.query.type as string) || "";
  const offset = (page - 1) * limit;

  if (!db) {
    return res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  }

  try {
    const conditions = [eq(schema.messages.isDeleted, false)];
    if (type) conditions.push(eq(schema.messages.type, type));

    // Search by sender name (content is encrypted so we search sender)
    let senderIdFilter: string[] | null = null;
    if (search) {
      const matchedUsers = await db.select({ id: schema.users.id })
        .from(schema.users)
        .where(or(
          like(schema.users.username, `%${escapeLike(search)}%`),
          like(schema.users.displayName, `%${escapeLike(search)}%`)
        ))
        .limit(50);
      senderIdFilter = matchedUsers.map(u => u.id);
      if (senderIdFilter.length > 0) {
        conditions.push(inArray(schema.messages.senderId, senderIdFilter));
      } else {
        // No matching senders — return empty
        return res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
      }
    }

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

    const data = msgs.map(m => {
      let content = m.content;
      if (content && !m.isDeleted) {
        try { content = decryptMessage(content, m.conversationId); } catch { /* keep original */ }
      }
      return {
        ...m,
        content,
        senderName: senders.find(s => s.id === m.senderId)?.displayName || "مجهول",
      };
    });

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
    // Get message details before deleting (for socket notify)
    const [msg] = await db.select({ conversationId: schema.messages.conversationId, senderId: schema.messages.senderId })
      .from(schema.messages).where(eq(schema.messages.id, msgId)).limit(1);
    await db.update(schema.messages).set({ isDeleted: true }).where(eq(schema.messages.id, msgId));
    await storage.addAdminLog(req.session.adminId!, "delete_message", "message", msgId, "حذف رسالة");

    // Notify conversation participants via socket
    if (msg?.conversationId) {
      const [conv] = await db.select({ p1: schema.conversations.participant1Id, p2: schema.conversations.participant2Id })
        .from(schema.conversations)
        .where(eq(schema.conversations.id, msg.conversationId))
        .limit(1);
      if (conv) {
        for (const uid of [conv.p1, conv.p2]) {
          const sid = await getUserSocketId(uid);
          if (sid) io.to(sid).emit("message-deleted", { messageId: msgId, conversationId: msg.conversationId });
        }
      }
    }
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
  if (ids.length > 500) return res.status(400).json({ success: false, message: "الحد الأقصى 500 رسالة" });
  if (!db) return res.json({ success: true, message: "تم حذف الرسائل" });

  try {
    // Fetch message -> conversation mapping before deleting to notify participants
    const toDelete = await db.select({ id: schema.messages.id, conversationId: schema.messages.conversationId })
      .from(schema.messages)
      .where(inArray(schema.messages.id, ids));

    await db.update(schema.messages).set({ isDeleted: true }).where(inArray(schema.messages.id, ids));

    // Notify conversation participants via socket for each deleted message
    const convIds = Array.from(new Set(toDelete.map(m => m.conversationId)));
    const convRows = convIds.length > 0
      ? await db.select({ id: schema.conversations.id, p1: schema.conversations.participant1Id, p2: schema.conversations.participant2Id })
          .from(schema.conversations)
          .where(inArray(schema.conversations.id, convIds))
      : [];
    const convMap = new Map(convRows.map(c => [c.id, c]));

    for (const msg of toDelete) {
      const conv = convMap.get(msg.conversationId);
      if (!conv) continue;
      for (const uid of [conv.p1, conv.p2]) {
        const sid = await getUserSocketId(uid);
        if (sid) io.to(sid).emit("message-deleted", { messageId: msg.id, conversationId: msg.conversationId });
      }
    }

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
    // Get call info before ending to notify both parties
    const [call] = await db.select().from(schema.calls)
      .where(eq(schema.calls.id, callId)).limit(1);

    await db.update(schema.calls).set({ status: "ended", endedAt: new Date() }).where(eq(schema.calls.id, callId));
    await storage.addAdminLog(req.session.adminId!, "force_end_call", "call", callId, "إنهاء مكالمة إجبارياً");

    // Notify both parties via socket
    if (call) {
      for (const uid of [call.callerId, call.receiverId]) {
        const socketId = await getUserSocketId(uid);
        if (socketId) {
          io.to(socketId).emit("call-ended", { callId, durationSeconds: 0, coinsCharged: 0, forcedByAdmin: true });
        }
      }
    }

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
    // Batch upsert using ON CONFLICT instead of N sequential queries
    if (settings.length > 0) {
      await Promise.all(settings.map(({ key, value }: { key: string; value: any }) =>
        db.insert(schema.systemSettings)
          .values({ key, value: String(value), category: "chat" })
          .onConflictDoUpdate({
            target: schema.systemSettings.key,
            set: { value: String(value), updatedAt: new Date() },
          })
      ));
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

const defaultStreamAlertConfig = {
  giftsRateLimited: 10,
  chatBannedWordBlocked: 12,
  chatMutedBlocked: 8,
  giftsSocketRejected: 1,
  joinImbalanceOffset: 40,
  cooldownMinutes: 5,
};

type StreamAlertLevel = "high" | "medium" | "low";

interface StreamAlertEntry {
  id: string;
  level: StreamAlertLevel;
  title: string;
  detail: string;
  value: number;
  threshold: number;
}

interface StreamAlertHistoryEntry {
  id: string;
  level: StreamAlertLevel;
  title: string;
  lastDetail: string;
  hits: number;
  firstSeenAt: string;
  lastSeenAt: string;
  isActive: boolean;
}

const streamAlertHistory = new Map<string, StreamAlertHistoryEntry>();
let streamAlertHistoryHydrated = false;

function buildStreamAlerts(
  telemetry: {
    joins: number;
    leaves: number;
    chatMutedBlocked: number;
    chatBannedWordBlocked: number;
    giftsRateLimited: number;
    giftsSocketRejected: number;
  },
  cfg: typeof defaultStreamAlertConfig,
): StreamAlertEntry[] {
  const alerts: StreamAlertEntry[] = [];

  if (telemetry.giftsRateLimited >= cfg.giftsRateLimited) {
    alerts.push({
      id: "gift-rate-limit-spike",
      level: "high",
      title: "ارتفاع حاد في محاولات الهدايا",
      detail: `القيمة الحالية ${telemetry.giftsRateLimited} مقابل العتبة ${cfg.giftsRateLimited}`,
      value: telemetry.giftsRateLimited,
      threshold: cfg.giftsRateLimited,
    });
  }

  if (telemetry.chatBannedWordBlocked >= cfg.chatBannedWordBlocked) {
    alerts.push({
      id: "banned-words-spike",
      level: "medium",
      title: "ارتفاع رسائل مخالفة الكلمات المحظورة",
      detail: `القيمة الحالية ${telemetry.chatBannedWordBlocked} مقابل العتبة ${cfg.chatBannedWordBlocked}`,
      value: telemetry.chatBannedWordBlocked,
      threshold: cfg.chatBannedWordBlocked,
    });
  }

  if (telemetry.chatMutedBlocked >= cfg.chatMutedBlocked) {
    alerts.push({
      id: "muted-blocked-spike",
      level: "medium",
      title: "نشاط مرتفع لمستخدمين مكتومين",
      detail: `القيمة الحالية ${telemetry.chatMutedBlocked} مقابل العتبة ${cfg.chatMutedBlocked}`,
      value: telemetry.chatMutedBlocked,
      threshold: cfg.chatMutedBlocked,
    });
  }

  if (telemetry.giftsSocketRejected >= cfg.giftsSocketRejected) {
    alerts.push({
      id: "legacy-socket-gift",
      level: "low",
      title: "عملاء قديمة تستخدم مسار هدايا غير مدعوم",
      detail: `القيمة الحالية ${telemetry.giftsSocketRejected} مقابل العتبة ${cfg.giftsSocketRejected}`,
      value: telemetry.giftsSocketRejected,
      threshold: cfg.giftsSocketRejected,
    });
  }

  if (telemetry.joins >= telemetry.leaves * 3 + cfg.joinImbalanceOffset) {
    alerts.push({
      id: "join-leave-imbalance",
      level: "low",
      title: "عدم توازن الانضمام/المغادرة",
      detail: `انضمام ${telemetry.joins} مقابل مغادرة ${telemetry.leaves} (offset=${cfg.joinImbalanceOffset})`,
      value: telemetry.joins - telemetry.leaves,
      threshold: cfg.joinImbalanceOffset,
    });
  }

  return alerts;
}

async function hydrateStreamAlertHistoryIfNeeded() {
  if (streamAlertHistoryHydrated) return;
  streamAlertHistoryHydrated = true;
  try {
    const cfg = await storage.getSystemConfig("stream_alert_history");
    if (!cfg?.configData) return;
    const parsed = typeof cfg.configData === "string" ? JSON.parse(cfg.configData) : cfg.configData;
    const history = Array.isArray(parsed?.history) ? parsed.history : [];
    for (const row of history) {
      if (!row?.id) continue;
      streamAlertHistory.set(String(row.id), {
        id: String(row.id),
        level: row.level === "high" || row.level === "medium" ? row.level : "low",
        title: String(row.title || "تنبيه"),
        lastDetail: String(row.lastDetail || ""),
        hits: Math.max(1, Number(row.hits || 1)),
        firstSeenAt: String(row.firstSeenAt || new Date().toISOString()),
        lastSeenAt: String(row.lastSeenAt || new Date().toISOString()),
        isActive: Boolean(row.isActive),
      });
    }
  } catch (err: any) {
    chatLog.warn(`Failed to hydrate stream alert history: ${err.message}`);
  }
}

async function persistStreamAlertHistory(adminId?: string) {
  const history = Array.from(streamAlertHistory.values())
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
    .slice(0, 200);
  await storage.upsertSystemConfig("stream_alert_history", { history }, adminId);
}

async function updateStreamAlertHistory(activeAlerts: StreamAlertEntry[], adminId?: string): Promise<StreamAlertHistoryEntry[]> {
  await hydrateStreamAlertHistoryIfNeeded();
  const nowIso = new Date().toISOString();
  const activeIds = new Set(activeAlerts.map(a => a.id));
  let changed = false;

  for (const alert of activeAlerts) {
    const existing = streamAlertHistory.get(alert.id);
    if (existing) {
      streamAlertHistory.set(alert.id, {
        ...existing,
        level: alert.level,
        title: alert.title,
        lastDetail: alert.detail,
        hits: existing.hits + 1,
        lastSeenAt: nowIso,
        isActive: true,
      });
      changed = true;
    } else {
      streamAlertHistory.set(alert.id, {
        id: alert.id,
        level: alert.level,
        title: alert.title,
        lastDetail: alert.detail,
        hits: 1,
        firstSeenAt: nowIso,
        lastSeenAt: nowIso,
        isActive: true,
      });
      changed = true;
    }
  }

  for (const [id, entry] of streamAlertHistory.entries()) {
    if (!activeIds.has(id) && entry.isActive) {
      streamAlertHistory.set(id, {
        ...entry,
        isActive: false,
      });
      changed = true;
    }
  }

  if (changed) {
    await persistStreamAlertHistory(adminId);
  }

  return Array.from(streamAlertHistory.values())
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime())
    .slice(0, 100);
}

function getFilteredStreamAlertHistory(status: "all" | "active" | "resolved", level: "all" | "high" | "medium" | "low") {
  const sorted = Array.from(streamAlertHistory.values())
    .sort((a, b) => new Date(b.lastSeenAt).getTime() - new Date(a.lastSeenAt).getTime());

  const statusFiltered = status === "active"
    ? sorted.filter(entry => entry.isActive)
    : status === "resolved"
      ? sorted.filter(entry => !entry.isActive)
      : sorted;

  if (level === "all") return statusFiltered;
  return statusFiltered.filter(entry => entry.level === level);
}

function getStreamAlertSummary(entries: StreamAlertHistoryEntry[]) {
  let active = 0;
  let resolved = 0;
  let high = 0;
  let medium = 0;
  let low = 0;

  for (const entry of entries) {
    if (entry.isActive) active++;
    else resolved++;
    if (entry.level === "high") high++;
    else if (entry.level === "medium") medium++;
    else low++;
  }

  return {
    total: entries.length,
    active,
    resolved,
    high,
    medium,
    low,
  };
}

async function getStreamAlertConfig(): Promise<typeof defaultStreamAlertConfig> {
  try {
    const cfg = await storage.getSystemConfig("stream_alerts");
    if (cfg?.configData) {
      const parsed = typeof cfg.configData === "string" ? JSON.parse(cfg.configData) : cfg.configData;
      return {
        giftsRateLimited: Math.max(0, Number(parsed.giftsRateLimited ?? defaultStreamAlertConfig.giftsRateLimited)),
        chatBannedWordBlocked: Math.max(0, Number(parsed.chatBannedWordBlocked ?? defaultStreamAlertConfig.chatBannedWordBlocked)),
        chatMutedBlocked: Math.max(0, Number(parsed.chatMutedBlocked ?? defaultStreamAlertConfig.chatMutedBlocked)),
        giftsSocketRejected: Math.max(0, Number(parsed.giftsSocketRejected ?? defaultStreamAlertConfig.giftsSocketRejected)),
        joinImbalanceOffset: Math.max(0, Number(parsed.joinImbalanceOffset ?? defaultStreamAlertConfig.joinImbalanceOffset)),
        cooldownMinutes: Math.max(1, Number(parsed.cooldownMinutes ?? defaultStreamAlertConfig.cooldownMinutes)),
      };
    }
  } catch (err: any) {
    chatLog.warn(`Failed to parse stream alerts config: ${err.message}`);
  }
  return { ...defaultStreamAlertConfig };
}

async function saveStreamAlertConfig(config: typeof defaultStreamAlertConfig, adminId?: string) {
  await storage.upsertSystemConfig("stream_alerts", config, adminId);
}

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

    const [
      [activeNow],
      [totalViewers],
      [totalToday],
      [totalGiftsToday],
      [totalRevenueToday],
      [peakConcurrent],
      [avgDuration],
      [avgViewers],
      topCategories,
    ] = await Promise.all([
      db.select({ count: count() }).from(schema.streams).where(eq(schema.streams.status, "active")),
      db.select({ total: sql<number>`COALESCE(SUM(viewer_count), 0)` }).from(schema.streams).where(eq(schema.streams.status, "active")),
      db.select({ count: count() }).from(schema.streams).where(gte(schema.streams.startedAt, today)),
      db.select({ total: sql<number>`COALESCE(SUM(total_gifts), 0)` }).from(schema.streams).where(gte(schema.streams.startedAt, today)),
      db.select({ total: sql<number>`COALESCE(SUM(total_price), 0)` }).from(schema.giftTransactions)
        .where(and(gte(schema.giftTransactions.createdAt, today), sql`${schema.giftTransactions.streamId} IS NOT NULL`)),
      db.select({ peak: sql<number>`COALESCE(MAX(viewer_count), 0)` }).from(schema.streams).where(eq(schema.streams.status, "active")),
      db.select({
        avg: sql<number>`COALESCE(AVG(EXTRACT(EPOCH FROM (COALESCE(${schema.streams.endedAt}, NOW()) - ${schema.streams.startedAt}))), 0)`,
      }).from(schema.streams).where(gte(schema.streams.startedAt, today)),
      db.select({ avg: sql<number>`COALESCE(AVG(peak_viewers), 0)` }).from(schema.streams).where(gte(schema.streams.startedAt, today)),
      db.select({
        name: sql<string>`COALESCE(${schema.streams.category}, 'other')`,
        count: count(),
        viewers: sql<number>`COALESCE(SUM(${schema.streams.peakViewers}), 0)`,
      }).from(schema.streams)
        .where(gte(schema.streams.startedAt, today))
        .groupBy(sql`COALESCE(${schema.streams.category}, 'other')`)
        .orderBy(sql`COUNT(*) DESC`)
        .limit(4),
    ]);

    return res.json({
      success: true,
      data: {
        activeNow: activeNow?.count || 0,
        totalViewers: totalViewers?.total || 0,
        totalToday: totalToday?.count || 0,
        avgDuration: Math.round(Number(avgDuration?.avg || 0)),
        avgViewers: Math.round(Number(avgViewers?.avg || 0)),
        totalGiftsToday: totalGiftsToday?.total || 0,
        totalRevenueToday: Number(totalRevenueToday?.total || 0),
        peakConcurrent: Number(peakConcurrent?.peak || 0),
        topCategories: (topCategories || []).map((c: any) => ({
          name: String(c.name || "other"),
          count: Number(c.count || 0),
          viewers: Number(c.viewers || 0),
        })),
      },
    });
  } catch (err: any) {
    log(`Stream stats error: ${err.message}`, "admin");
    return res.json({ success: true, data: { activeNow: 0, totalViewers: 0, totalToday: 0, avgDuration: 0, avgViewers: 0, totalGiftsToday: 0, totalRevenueToday: 0, peakConcurrent: 0, topCategories: [] } });
  }
});

router.get("/streams/telemetry", requireAdmin, async (_req, res) => {
  try {
    const data = getLiveTelemetrySnapshot();
    return res.json({ success: true, data });
  } catch {
    return res.json({
      success: true,
      data: {
        joins: 0,
        leaves: 0,
        chatMessages: 0,
        chatMutedBlocked: 0,
        chatBannedWordBlocked: 0,
        giftsRateLimited: 0,
        giftsSocketRejected: 0,
        speakerInvites: 0,
        speakerAccepts: 0,
        speakerRejects: 0,
        timestamp: new Date().toISOString(),
      },
    });
  }
});

router.get("/streams/telemetry/alert-config", requireAdmin, async (_req, res) => {
  const data = await getStreamAlertConfig();
  return res.json({ success: true, data });
});

router.get("/streams/telemetry/alerts", requireAdmin, async (req, res) => {
  try {
    const telemetry = getLiveTelemetrySnapshot();
    const config = await getStreamAlertConfig();
    const statusRaw = String(req.query.status || "all");
    const status: "all" | "active" | "resolved" =
      statusRaw === "active" || statusRaw === "resolved" ? statusRaw : "all";
    const levelRaw = String(req.query.level || "all");
    const level: "all" | "high" | "medium" | "low" =
      levelRaw === "high" || levelRaw === "medium" || levelRaw === "low" ? levelRaw : "all";
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 20)));
    const offset = (page - 1) * limit;

    const activeAlerts = buildStreamAlerts({
      joins: telemetry.joins,
      leaves: telemetry.leaves,
      chatMutedBlocked: telemetry.chatMutedBlocked,
      chatBannedWordBlocked: telemetry.chatBannedWordBlocked,
      giftsRateLimited: telemetry.giftsRateLimited,
      giftsSocketRejected: telemetry.giftsSocketRejected,
    }, config);

    await updateStreamAlertHistory(activeAlerts, req.session.adminId);
    const allHistory = Array.from(streamAlertHistory.values());
    const summary = getStreamAlertSummary(allHistory);
    const filteredHistory = getFilteredStreamAlertHistory(status, level);
    const history = filteredHistory.slice(offset, offset + limit);
    return res.json({
      success: true,
      data: {
        activeAlerts,
        history,
        summary,
        generatedAt: new Date().toISOString(),
        pagination: {
          page,
          limit,
          total: filteredHistory.length,
          totalPages: Math.max(1, Math.ceil(filteredHistory.length / limit)),
        },
      },
    });
  } catch {
    return res.json({
      success: true,
      data: {
        activeAlerts: [],
        history: [],
        summary: { total: 0, active: 0, resolved: 0, high: 0, medium: 0, low: 0 },
        generatedAt: new Date().toISOString(),
        pagination: {
          page: 1,
          limit: 20,
          total: 0,
          totalPages: 1,
        },
      },
    });
  }
});

router.delete("/streams/telemetry/alerts/history", requireAdmin, async (req, res) => {
  try {
    await hydrateStreamAlertHistoryIfNeeded();
    const modeRaw = String(req.query.mode || "all");
    const mode: "all" | "resolved" = modeRaw === "resolved" ? "resolved" : "all";

    if (mode === "all") {
      streamAlertHistory.clear();
    } else {
      for (const [id, entry] of streamAlertHistory.entries()) {
        if (!entry.isActive) streamAlertHistory.delete(id);
      }
    }

    await persistStreamAlertHistory(req.session.adminId);
    await storage.addAdminLog(req.session.adminId!, "clear_stream_alert_history", "settings", "", mode);

    return res.json({
      success: true,
      message: mode === "all" ? "تم مسح سجل التنبيهات" : "تم مسح التنبيهات المحلولة",
      data: {
        remaining: streamAlertHistory.size,
      },
    });
  } catch {
    return res.status(500).json({ success: false, message: "تعذر مسح سجل التنبيهات" });
  }
});

router.put("/streams/telemetry/alert-config", requireAdmin, async (req, res) => {
  const current = await getStreamAlertConfig();
  const allowed: (keyof typeof defaultStreamAlertConfig)[] = [
    "giftsRateLimited",
    "chatBannedWordBlocked",
    "chatMutedBlocked",
    "giftsSocketRejected",
    "joinImbalanceOffset",
    "cooldownMinutes",
  ];

  const updates: Partial<typeof defaultStreamAlertConfig> = {};
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      const n = Number(req.body[key]);
      if (!Number.isFinite(n)) continue;
      updates[key] = key === "cooldownMinutes" ? Math.max(1, Math.floor(n)) : Math.max(0, Math.floor(n));
    }
  }

  const next = { ...current, ...updates };
  await saveStreamAlertConfig(next, req.session.adminId);
  await storage.addAdminLog(req.session.adminId!, "update_stream_alert_config", "settings", "", JSON.stringify(Object.keys(updates)));
  return res.json({ success: true, data: next, message: "تم تحديث إعدادات تنبيهات البث" });
});

router.post("/streams/:id/end", requireAdmin, async (req, res) => {
  const db = getDb();
  const streamId = p(req.params.id);

  if (db) {
    try {
      // Get stream info before ending to notify the streamer
      const [stream] = await db.select({ userId: schema.streams.userId })
        .from(schema.streams).where(eq(schema.streams.id, streamId)).limit(1);

      await db.update(schema.streams).set({ status: "ended", endedAt: new Date(), viewerCount: 0 }).where(eq(schema.streams.id, streamId));
      await db.update(schema.streamViewers).set({ leftAt: new Date() }).where(and(
        eq(schema.streamViewers.streamId, streamId),
        sql`left_at IS NULL`,
      ));

      // Notify the streamer and all current room participants.
      if (stream) {
        const socketId = await getUserSocketId(stream.userId);
        if (socketId) {
          io.to(socketId).emit("stream-force-ended", { streamId, forcedByAdmin: true });
        }
      }
      io.to(`room:${streamId}`).emit("stream-force-ended", { streamId, forcedByAdmin: true });
    } catch (err: any) {
      log(`Force end stream error: ${err.message}`, "admin");
    }
  }

  await storage.addAdminLog(req.session.adminId!, "force_end_stream", "stream", streamId, "إيقاف بث إجبارياً");
  return res.json({ success: true, message: "تم إيقاف البث" });
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
    const messageIds = reports.map((r: any) => r.messageId).filter(Boolean);
    const messages = messageIds.length > 0
      ? await db.select().from(schema.messages).where(inArray(schema.messages.id, messageIds))
      : [];

    const usersMap = new Map(users.map(u => [u.id, u]));
    const messagesMap = new Map(messages.map(m => [m.id, m]));

    const enriched = reports.map((r: any) => ({
      ...r,
      reporter: usersMap.get(r.reporterId),
      reportedUser: usersMap.get(r.reportedUserId),
      message: (() => {
        const msg = messagesMap.get(r.messageId);
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
    // Single query with CASE WHEN instead of 5 sequential COUNT queries
    const [stats] = await db.select({
      pending: sql<number>`count(*) filter (where ${schema.messageReports.status} = 'pending')`,
      reviewed: sql<number>`count(*) filter (where ${schema.messageReports.status} = 'reviewed')`,
      resolved: sql<number>`count(*) filter (where ${schema.messageReports.status} = 'resolved')`,
      dismissed: sql<number>`count(*) filter (where ${schema.messageReports.status} = 'dismissed')`,
      total: count(),
    }).from(schema.messageReports);

    return res.json({
      success: true,
      data: {
        pending: stats?.pending || 0,
        reviewed: stats?.reviewed || 0,
        resolved: stats?.resolved || 0,
        dismissed: stats?.dismissed || 0,
        total: stats?.total || 0,
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
  const allowedStatuses = new Set(["pending", "reviewed", "resolved", "dismissed"]);
  if (!allowedStatuses.has(status)) {
    return res.status(400).json({ success: false, message: "حالة غير صالحة" });
  }

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

// ── CSV Export Helpers ──────────────────────────────
function toCsv(headers: string[], rows: string[][]): string {
  const BOM = "\uFEFF"; // Excel Arabic support
  const escape = (v: string) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const lines = [headers.map(escape).join(",")];
  for (const row of rows) lines.push(row.map(escape).join(","));
  return BOM + lines.join("\r\n");
}

// Export conversations as CSV
router.get("/export/conversations", requireAdmin, async (_req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });
  try {
    const convs = await db.select({
      id: schema.conversations.id,
      user1: schema.conversations.participant1Id,
      user2: schema.conversations.participant2Id,
      lastMessageId: schema.conversations.lastMessageId,
      lastMessageAt: schema.conversations.lastMessageAt,
      createdAt: schema.conversations.createdAt,
    }).from(schema.conversations)
      .orderBy(desc(schema.conversations.lastMessageAt))
      .limit(5000);

    // Get user names
    const userIds: string[] = [...new Set(convs.flatMap((c: { user1: string; user2: string }) => [c.user1, c.user2]))];
    const users = userIds.length > 0
      ? await db.select({ id: schema.users.id, username: schema.users.username })
          .from(schema.users).where(inArray(schema.users.id, userIds))
      : [];
    const nameMap = new Map(users.map((u: { id: string; username: string }) => [u.id, u.username]));

    const headers = ["ID", "User 1", "User 2", "Last Message ID", "Last Message At", "Created At"];
    const rows = convs.map((c: { id: string; user1: string; user2: string; lastMessageId: string | null; lastMessageAt: Date | null; createdAt: Date }) => [
      String(c.id),
      nameMap.get(c.user1) ?? String(c.user1),
      nameMap.get(c.user2) ?? String(c.user2),
      c.lastMessageId ?? "",
      c.lastMessageAt ? new Date(c.lastMessageAt).toISOString() : "",
      c.createdAt ? new Date(c.createdAt).toISOString() : "",
    ]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=conversations.csv");
    return res.send(toCsv(headers, rows));
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Export messages as CSV
router.get("/export/messages", requireAdmin, async (_req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });
  try {
    const msgs = await db.select({
      id: schema.messages.id,
      conversationId: schema.messages.conversationId,
      senderId: schema.messages.senderId,
      content: schema.messages.content,
      type: schema.messages.type,
      createdAt: schema.messages.createdAt,
    }).from(schema.messages)
      .orderBy(desc(schema.messages.createdAt))
      .limit(10000);

    const senderIds: string[] = [...new Set(msgs.map((m: { senderId: string }) => m.senderId))];
    const users = senderIds.length > 0
      ? await db.select({ id: schema.users.id, username: schema.users.username })
          .from(schema.users).where(inArray(schema.users.id, senderIds))
      : [];
    const nameMap = new Map(users.map((u: { id: string; username: string }) => [u.id, u.username]));

    const headers = ["ID", "Conversation ID", "Sender", "Content", "Type", "Created At"];
    const rows = msgs.map((m: { id: string; conversationId: string; senderId: string; content: string | null; type: string; createdAt: Date }) => {
      // Decrypt content before export
      let decryptedContent = m.content ?? "";
      if (m.content) {
        try { decryptedContent = decryptMessage(m.content, m.conversationId); } catch { decryptedContent = m.content; }
      }
      return [
        String(m.id),
        String(m.conversationId),
        nameMap.get(m.senderId) ?? String(m.senderId),
        decryptedContent,
        m.type ?? "text",
        m.createdAt ? new Date(m.createdAt).toISOString() : "",
      ];
    });

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=messages.csv");
    return res.send(toCsv(headers, rows));
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

// Export reports as CSV
router.get("/export/reports", requireAdmin, async (_req, res) => {
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });
  try {
    const reports = await db.select({
      id: schema.messageReports.id,
      messageId: schema.messageReports.messageId,
      reporterId: schema.messageReports.reporterId,
      reportedUserId: schema.messageReports.reportedUserId,
      reason: schema.messageReports.reason,
      status: schema.messageReports.status,
      createdAt: schema.messageReports.createdAt,
    }).from(schema.messageReports)
      .orderBy(desc(schema.messageReports.createdAt))
      .limit(5000);

    const userIds: string[] = [...new Set(reports.flatMap((r: { reporterId: string; reportedUserId: string }) => [r.reporterId, r.reportedUserId]))];
    const users = userIds.length > 0
      ? await db.select({ id: schema.users.id, username: schema.users.username })
          .from(schema.users).where(inArray(schema.users.id, userIds))
      : [];
    const nameMap = new Map(users.map((u: { id: string; username: string }) => [u.id, u.username]));

    const headers = ["ID", "Message ID", "Reporter", "Reported User", "Reason", "Status", "Created At"];
    const rows = reports.map((r: { id: string; messageId: string; reporterId: string; reportedUserId: string; reason: string | null; status: string | null; createdAt: Date }) => [
      String(r.id),
      String(r.messageId),
      nameMap.get(r.reporterId) ?? String(r.reporterId),
      nameMap.get(r.reportedUserId) ?? String(r.reportedUserId),
      r.reason ?? "",
      r.status ?? "",
      r.createdAt ? new Date(r.createdAt).toISOString() : "",
    ]);

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", "attachment; filename=reports.csv");
    return res.send(toCsv(headers, rows));
  } catch (e: any) {
    return res.status(500).json({ success: false, message: e.message });
  }
});

export default router;
