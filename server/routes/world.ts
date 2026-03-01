/**
 * World Routes — حول العالم (Around the World)
 * Random matching with 3D globe, filters, live-style chat
 */
import { Router, type Request, type Response } from "express";
import { eq, and, or, ne, desc, asc, sql, gte, lte, count } from "drizzle-orm";
import { getDb } from "../db";
import { createLogger } from "../logger";
const log = (msg: string, _src?: string) => worldLog.info(msg);
const worldLog = createLogger("world");
import { io } from "../index";
import { getUserSocketId, getOnlineUserIds } from "../onlineUsers";
import * as schema from "../../shared/schema";
import { worldSearchSchema, worldMessageSchema } from "../../shared/schema";

const router = Router();

// Express 5: req.params values can be string | string[]
function paramStr(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v[0] ?? "";
  return v ?? "";
}

// ── Helper: require admin session ──
function requireAdmin(req: Request, res: Response): boolean {
  if (!req.session?.adminId) {
    res.status(401).json({ success: false, message: "غير مصرح" });
    return false;
  }
  return true;
}

// ── Helper: get current user from session ──
function requireUser(req: Request, res: Response): string | null {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });
    return null;
  }
  return userId;
}

// ── Helper: get world pricing from DB ──
async function getWorldPricing(): Promise<schema.WorldPricing[]> {
  const db = getDb();
  if (!db) return [];
  return db.select().from(schema.worldPricing).where(eq(schema.worldPricing.isActive, true));
}

// ── Helper: calculate total search cost ──
async function calculateSearchCost(filters: { genderFilter: string; ageMin: number; ageMax: number; countryFilter?: string }): Promise<number> {
  const pricing = await getWorldPricing();
  let total = 0;

  // Base spin cost
  const spinCost = pricing.find(p => p.filterType === "spin_cost");
  total += spinCost?.priceCoins || 0;

  // Gender filter cost
  const genderKey = `gender_${filters.genderFilter}`;
  const genderCost = pricing.find(p => p.filterType === genderKey);
  total += genderCost?.priceCoins || 0;

  // Age range cost (if different from default)
  if (filters.ageMin !== 18 || filters.ageMax !== 60) {
    const ageCost = pricing.find(p => p.filterType === "age_range");
    total += ageCost?.priceCoins || 0;
  }

  // Country filter cost
  if (filters.countryFilter) {
    const countryCost = pricing.find(p => p.filterType === "country_specific");
    total += countryCost?.priceCoins || 0;
  }

  return total;
}

// ── Helper: charge coins atomically ──
async function chargeCoins(userId: string, amount: number, description: string, refId?: string): Promise<boolean> {
  const db = getDb();
  if (!db || amount <= 0) return true;

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
    type: "world_search",
    amount: -amount,
    balanceAfter: result[0].coins,
    currency: "coins",
    description,
    referenceId: refId,
    status: "completed",
  });

  return true;
}

// ════════════════════════════════════════════════════════════
// WORLD PRICING API
// ════════════════════════════════════════════════════════════

// Get all pricing
router.get("/pricing", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;

  try {
    const pricing = await getWorldPricing();
    res.json({ success: true, data: pricing });
  } catch (err) {
    log(`World pricing error: ${err}`, "world");
    res.status(500).json({ success: false, message: "خطأ في جلب الأسعار" });
  }
});

// ════════════════════════════════════════════════════════════
// WORLD SEARCH & MATCHING
// ════════════════════════════════════════════════════════════

// Start a new search — deducts coins, creates session, finds match
router.post("/search", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ في قاعدة البيانات" });

  try {
    const parsed = worldSearchSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صحيحة", errors: parsed.error.flatten() });
    }
    const filters = parsed.data;

    // Check no active session
    const [activeSession] = await db.select().from(schema.worldSessions)
      .where(and(
        eq(schema.worldSessions.userId, userId),
        sql`${schema.worldSessions.status} IN ('searching', 'matched', 'chatting')`
      ))
      .limit(1);

    if (activeSession) {
      return res.status(400).json({ success: false, message: "لديك جلسة نشطة بالفعل", sessionId: activeSession.id });
    }

    // Calculate cost
    const cost = await calculateSearchCost(filters);

    // Charge coins
    if (cost > 0) {
      const charged = await chargeCoins(userId, cost, `بحث حول العالم (${filters.genderFilter}, ${filters.countryFilter || 'الكل'})`);
      if (!charged) {
        return res.status(402).json({ success: false, message: "رصيد غير كافي", required: cost });
      }
    }

    // Build matching conditions
    const conditions: any[] = [
      ne(schema.users.id, userId),
      eq(schema.users.isBanned, false),
    ];

    // Only match online users
    const onlineIds = await getOnlineUserIds();
    if (onlineIds.length === 0) {
      // No one online — create session as searching, return no match
      const [session] = await db.insert(schema.worldSessions).values({
        userId,
        genderFilter: filters.genderFilter,
        ageMin: filters.ageMin,
        ageMax: filters.ageMax,
        countryFilter: filters.countryFilter || null,
        coinsSpent: cost,
        status: "searching",
      }).returning();

      return res.json({
        success: true,
        data: { session, matched: false, message: "لا يوجد مستخدمين متصلين حالياً" },
      });
    }

    conditions.push(sql`${schema.users.id} IN (${sql.join(onlineIds.map(id => sql`${id}`), sql`, `)})`);

    // Gender filter
    if (filters.genderFilter !== "both") {
      conditions.push(eq(schema.users.gender, filters.genderFilter));
    }

    // Age filter
    if (filters.ageMin || filters.ageMax) {
      const now = new Date();
      if (filters.ageMax && filters.ageMax < 100) {
        const minBirthYear = now.getFullYear() - filters.ageMax - 1;
        const minDate = `${minBirthYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        conditions.push(sql`${schema.users.birthDate} >= ${minDate}`);
      }
      if (filters.ageMin && filters.ageMin > 13) {
        const maxBirthYear = now.getFullYear() - filters.ageMin;
        const maxDate = `${maxBirthYear}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        conditions.push(sql`${schema.users.birthDate} <= ${maxDate}`);
      }
    }

    // Country filter
    if (filters.countryFilter) {
      conditions.push(eq(schema.users.country, filters.countryFilter));
    }

    // Exclude recently matched users (last 24h)
    const recentSessions = await db.select({ matchedUserId: schema.worldSessions.matchedUserId })
      .from(schema.worldSessions)
      .where(and(
        eq(schema.worldSessions.userId, userId),
        sql`${schema.worldSessions.matchedUserId} IS NOT NULL`,
        gte(schema.worldSessions.startedAt, sql`NOW() - INTERVAL '24 hours'`)
      ));
    const recentIds = recentSessions.map(s => s.matchedUserId).filter(Boolean) as string[];
    if (recentIds.length > 0) {
      conditions.push(sql`${schema.users.id} NOT IN (${sql.join(recentIds.map(id => sql`${id}`), sql`, `)})`);
    }

    // Random match
    const [match] = await db.select({
      id: schema.users.id,
      username: schema.users.username,
      displayName: schema.users.displayName,
      avatar: schema.users.avatar,
      country: schema.users.country,
      gender: schema.users.gender,
      level: schema.users.level,
      bio: schema.users.bio,
    })
      .from(schema.users)
      .where(and(...conditions))
      .orderBy(sql`RANDOM()`)
      .limit(1);

    if (!match) {
      // No match found — create session as searching
      const [session] = await db.insert(schema.worldSessions).values({
        userId,
        genderFilter: filters.genderFilter,
        ageMin: filters.ageMin,
        ageMax: filters.ageMax,
        countryFilter: filters.countryFilter || null,
        coinsSpent: cost,
        status: "cancelled",
      }).returning();

      return res.json({
        success: true,
        data: { session, matched: false, message: "لا يوجد مستخدمين مطابقين حالياً" },
      });
    }

    // Match found — create session
    const [session] = await db.insert(schema.worldSessions).values({
      userId,
      matchedUserId: match.id,
      genderFilter: filters.genderFilter,
      ageMin: filters.ageMin,
      ageMax: filters.ageMax,
      countryFilter: filters.countryFilter || null,
      coinsSpent: cost,
      status: "matched",
      matchedAt: new Date(),
    }).returning();

    // Update user's totalWorldSessions
    await db.update(schema.users).set({
      totalWorldSessions: sql`total_world_sessions + 1`,
      updatedAt: new Date(),
    }).where(eq(schema.users.id, userId));

    // Emit socket event to matched user
    const matchedSocketId = await getUserSocketId(match.id);
    if (matchedSocketId) {
      io.to(matchedSocketId).emit("world-match-found", {
        sessionId: session.id,
        matchedUser: {
          id: userId,
          // We'll send minimal info, the matched user can fetch more
        },
      });
    }

    // Add system message
    await db.insert(schema.worldMessages).values({
      sessionId: session.id,
      senderId: "system",
      content: "تم التطابق! ابدأ المحادثة 🎉",
      type: "system",
    });

    res.json({
      success: true,
      data: {
        session,
        matched: true,
        matchedUser: match,
      },
    });
  } catch (err) {
    log(`World search error: ${err}`, "world");
    res.status(500).json({ success: false, message: "خطأ في البحث" });
  }
});

// ════════════════════════════════════════════════════════════
// WORLD SESSION MANAGEMENT
// ════════════════════════════════════════════════════════════

// Get session details
router.get("/sessions/:id", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ" });

  try {
    const [session] = await db.select().from(schema.worldSessions)
      .where(eq(schema.worldSessions.id, req.params.id))
      .limit(1);

    if (!session) return res.status(404).json({ success: false, message: "الجلسة غير موجودة" });
    if (session.userId !== userId && session.matchedUserId !== userId) {
      return res.status(403).json({ success: false, message: "غير مصرح" });
    }

    // Get matched user info
    let matchedUser = null;
    const otherUserId = session.userId === userId ? session.matchedUserId : session.userId;
    if (otherUserId) {
      const [user] = await db.select({
        id: schema.users.id,
        username: schema.users.username,
        displayName: schema.users.displayName,
        avatar: schema.users.avatar,
        country: schema.users.country,
        gender: schema.users.gender,
        level: schema.users.level,
        bio: schema.users.bio,
      }).from(schema.users).where(eq(schema.users.id, otherUserId)).limit(1);
      matchedUser = user || null;
    }

    res.json({ success: true, data: { session, matchedUser } });
  } catch (err) {
    log(`World session get error: ${err}`, "world");
    res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Cancel session
router.post("/sessions/:id/cancel", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ" });

  try {
    const [session] = await db.select().from(schema.worldSessions)
      .where(eq(schema.worldSessions.id, req.params.id))
      .limit(1);

    if (!session) return res.status(404).json({ success: false, message: "الجلسة غير موجودة" });
    if (session.userId !== userId && session.matchedUserId !== userId) {
      return res.status(403).json({ success: false, message: "غير مصرح" });
    }

    await db.update(schema.worldSessions).set({
      status: "cancelled",
      endedAt: new Date(),
    }).where(eq(schema.worldSessions.id, session.id));

    // Notify other user
    const otherUserId = session.userId === userId ? session.matchedUserId : session.userId;
    if (otherUserId) {
      const otherSocketId = await getUserSocketId(otherUserId);
      if (otherSocketId) {
        io.to(otherSocketId).emit("world-session-ended", {
          sessionId: session.id,
          milesEarned: 0,
          reason: "cancelled",
        });
      }
    }

    res.json({ success: true, data: { message: "تم إلغاء الجلسة" } });
  } catch (err) {
    log(`World cancel error: ${err}`, "world");
    res.status(500).json({ success: false, message: "خطأ" });
  }
});

// End session — calculate miles
router.post("/sessions/:id/end", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ" });

  try {
    const [session] = await db.select().from(schema.worldSessions)
      .where(eq(schema.worldSessions.id, req.params.id))
      .limit(1);

    if (!session) return res.status(404).json({ success: false, message: "الجلسة غير موجودة" });
    if (session.userId !== userId && session.matchedUserId !== userId) {
      return res.status(403).json({ success: false, message: "غير مصرح" });
    }
    if (session.status === "ended" || session.status === "cancelled") {
      return res.json({ success: true, data: { message: "الجلسة منتهية بالفعل", milesEarned: session.milesEarned } });
    }

    // Calculate miles
    const pricing = await getWorldPricing();
    const milesPerMinute = pricing.find(p => p.filterType === "miles_per_minute")?.priceCoins || 1;
    const startTime = session.matchedAt || session.startedAt;
    const durationSeconds = Math.floor((Date.now() - new Date(startTime).getTime()) / 1000);
    const durationMinutes = Math.ceil(durationSeconds / 60);
    const milesEarned = durationMinutes * milesPerMinute;

    // Update session
    await db.update(schema.worldSessions).set({
      status: "ended",
      endedAt: new Date(),
      milesEarned,
    }).where(eq(schema.worldSessions.id, session.id));

    // Award miles to user
    await db.update(schema.users).set({
      miles: sql`miles + ${milesEarned}`,
      updatedAt: new Date(),
    }).where(eq(schema.users.id, userId));

    // Also award miles to matched user
    if (session.matchedUserId && session.matchedUserId !== userId) {
      await db.update(schema.users).set({
        miles: sql`miles + ${milesEarned}`,
        updatedAt: new Date(),
      }).where(eq(schema.users.id, session.matchedUserId));
    }

    // Notify other user
    const otherUserId = session.userId === userId ? session.matchedUserId : session.userId;
    if (otherUserId) {
      const otherSocketId = await getUserSocketId(otherUserId);
      if (otherSocketId) {
        io.to(otherSocketId).emit("world-session-ended", {
          sessionId: session.id,
          milesEarned,
          reason: "ended",
        });
      }
    }

    res.json({ success: true, data: { milesEarned, durationMinutes } });
  } catch (err) {
    log(`World end error: ${err}`, "world");
    res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ════════════════════════════════════════════════════════════
// WORLD CHAT MESSAGES
// ════════════════════════════════════════════════════════════

// Get messages for a session
router.get("/sessions/:id/messages", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ" });

  try {
    const [session] = await db.select().from(schema.worldSessions)
      .where(eq(schema.worldSessions.id, req.params.id))
      .limit(1);

    if (!session) return res.status(404).json({ success: false, message: "الجلسة غير موجودة" });
    if (session.userId !== userId && session.matchedUserId !== userId) {
      return res.status(403).json({ success: false, message: "غير مصرح" });
    }

    const page = parseInt(req.query.page as string) || 1;
    const limit = 30;
    const offset = (page - 1) * limit;

    const msgs = await db.select().from(schema.worldMessages)
      .where(eq(schema.worldMessages.sessionId, session.id))
      .orderBy(asc(schema.worldMessages.createdAt))
      .limit(limit)
      .offset(offset);

    const [{ total }] = await db.select({ total: count() }).from(schema.worldMessages)
      .where(eq(schema.worldMessages.sessionId, session.id));

    res.json({
      success: true,
      data: msgs,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err) {
    log(`World messages error: ${err}`, "world");
    res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Send a message in a world session
router.post("/sessions/:id/messages", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ" });

  try {
    const [session] = await db.select().from(schema.worldSessions)
      .where(eq(schema.worldSessions.id, req.params.id))
      .limit(1);

    if (!session) return res.status(404).json({ success: false, message: "الجلسة غير موجودة" });
    if (session.userId !== userId && session.matchedUserId !== userId) {
      return res.status(403).json({ success: false, message: "غير مصرح" });
    }
    if (session.status === "ended" || session.status === "cancelled") {
      return res.status(400).json({ success: false, message: "الجلسة منتهية" });
    }

    const parsed = worldMessageSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صحيحة" });
    }

    // Update session to chatting if matched
    if (session.status === "matched") {
      await db.update(schema.worldSessions).set({ status: "chatting" }).where(eq(schema.worldSessions.id, session.id));
    }

    const [message] = await db.insert(schema.worldMessages).values({
      sessionId: session.id,
      senderId: userId,
      content: parsed.data.content,
      type: parsed.data.type,
      mediaUrl: parsed.data.mediaUrl,
      giftId: parsed.data.giftId,
    }).returning();

    // Socket emit to both users
    const otherUserId = session.userId === userId ? session.matchedUserId : session.userId;
    if (otherUserId) {
      const otherSocketId = await getUserSocketId(otherUserId);
      if (otherSocketId) {
        io.to(otherSocketId).emit("world-chat-message", {
          sessionId: session.id,
          message,
        });
      }
    }

    res.json({ success: true, data: message });
  } catch (err) {
    log(`World send message error: ${err}`, "world");
    res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ════════════════════════════════════════════════════════════
// WORLD INTERACTIONS (Follow / Friend)
// ════════════════════════════════════════════════════════════

// Follow matched user
router.post("/sessions/:id/follow", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ" });

  try {
    const [session] = await db.select().from(schema.worldSessions)
      .where(eq(schema.worldSessions.id, req.params.id))
      .limit(1);

    if (!session) return res.status(404).json({ success: false, message: "الجلسة غير موجودة" });
    const targetId = session.userId === userId ? session.matchedUserId : session.userId;
    if (!targetId) return res.status(400).json({ success: false, message: "لا يوجد مستخدم مطابق" });

    // Check if already following
    const [existing] = await db.select().from(schema.userFollows)
      .where(and(
        eq(schema.userFollows.followerId, userId),
        eq(schema.userFollows.followingId, targetId),
      ))
      .limit(1);

    if (existing) {
      return res.json({ success: true, data: { message: "أنت تتابع هذا المستخدم بالفعل" } });
    }

    await db.insert(schema.userFollows).values({
      followerId: userId,
      followingId: targetId,
    });

    // Notify
    const targetSocketId = await getUserSocketId(targetId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("world-follow", { sessionId: session.id, userId });
    }

    res.json({ success: true, data: { message: "تم إرسال المتابعة" } });
  } catch (err) {
    log(`World follow error: ${err}`, "world");
    res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Send friend request from world session
router.post("/sessions/:id/friend-request", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ" });

  try {
    const [session] = await db.select().from(schema.worldSessions)
      .where(eq(schema.worldSessions.id, req.params.id))
      .limit(1);

    if (!session) return res.status(404).json({ success: false, message: "الجلسة غير موجودة" });
    const targetId = session.userId === userId ? session.matchedUserId : session.userId;
    if (!targetId) return res.status(400).json({ success: false, message: "لا يوجد مستخدم مطابق" });

    // Check existing friendship
    const [existing] = await db.select().from(schema.friendships)
      .where(or(
        and(eq(schema.friendships.senderId, userId), eq(schema.friendships.receiverId, targetId)),
        and(eq(schema.friendships.senderId, targetId), eq(schema.friendships.receiverId, userId)),
      ))
      .limit(1);

    if (existing) {
      const statusMsg = existing.status === "accepted" ? "أنتم أصدقاء بالفعل" :
        existing.status === "pending" ? "طلب صداقة موجود بالفعل" : "لا يمكن إرسال طلب";
      return res.json({ success: true, data: { message: statusMsg, status: existing.status } });
    }

    const [friendship] = await db.insert(schema.friendships).values({
      senderId: userId,
      receiverId: targetId,
      status: "pending",
    }).returning();

    // Notify
    const targetSocketId = await getUserSocketId(targetId);
    if (targetSocketId) {
      io.to(targetSocketId).emit("world-friend-request", {
        sessionId: session.id,
        userId,
        friendshipId: friendship.id,
      });
      io.to(targetSocketId).emit("friend-request", {
        from: userId,
        to: targetId,
        request: friendship,
      });
    }

    res.json({ success: true, data: { message: "تم إرسال طلب الصداقة", friendshipId: friendship.id } });
  } catch (err) {
    log(`World friend-request error: ${err}`, "world");
    res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ════════════════════════════════════════════════════════════
// WORLD STATS
// ════════════════════════════════════════════════════════════

// User stats
router.get("/stats", async (req, res) => {
  const userId = requireUser(req, res);
  if (!userId) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ" });

  try {
    const [user] = await db.select({
      miles: schema.users.miles,
      totalWorldSessions: schema.users.totalWorldSessions,
      coins: schema.users.coins,
    }).from(schema.users).where(eq(schema.users.id, userId)).limit(1);

    res.json({ success: true, data: user || { miles: 0, totalWorldSessions: 0, coins: 0 } });
  } catch (err) {
    log(`World stats error: ${err}`, "world");
    res.status(500).json({ success: false, message: "خطأ" });
  }
});

// ════════════════════════════════════════════════════════════
// ADMIN: WORLD PRICING MANAGEMENT
// ════════════════════════════════════════════════════════════

// Get all pricing (admin)
router.get("/admin/pricing", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ" });

  try {
    const pricing = await db.select().from(schema.worldPricing).orderBy(asc(schema.worldPricing.filterType));
    res.json({ success: true, data: pricing });
  } catch (err) {
    res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Update pricing (admin)
router.patch("/admin/pricing/:id", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ" });

  try {
    const { priceCoins, isActive, description, descriptionAr } = req.body;

    const updates: any = { updatedAt: new Date() };
    if (priceCoins !== undefined) updates.priceCoins = parseInt(priceCoins);
    if (isActive !== undefined) updates.isActive = isActive;
    if (description !== undefined) updates.description = description;
    if (descriptionAr !== undefined) updates.descriptionAr = descriptionAr;

    const [updated] = await db.update(schema.worldPricing)
      .set(updates)
      .where(eq(schema.worldPricing.id, req.params.id))
      .returning();

    if (!updated) return res.status(404).json({ success: false, message: "غير موجود" });

    res.json({ success: true, data: updated });
  } catch (err) {
    res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Bulk update pricing (admin)
router.put("/admin/pricing", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ" });

  try {
    const { prices } = req.body; // Array of { filterType, priceCoins }
    if (!Array.isArray(prices)) return res.status(400).json({ success: false, message: "بيانات غير صحيحة" });

    for (const p of prices) {
      await db.update(schema.worldPricing)
        .set({ priceCoins: parseInt(p.priceCoins), updatedAt: new Date() })
        .where(eq(schema.worldPricing.filterType, p.filterType));
    }

    const allPricing = await db.select().from(schema.worldPricing).orderBy(asc(schema.worldPricing.filterType));
    res.json({ success: true, data: allPricing });
  } catch (err) {
    res.status(500).json({ success: false, message: "خطأ" });
  }
});

// Admin stats
router.get("/admin/stats", async (req, res) => {
  if (!requireAdmin(req, res)) return;
  const db = getDb();
  if (!db) return res.status(500).json({ success: false, message: "خطأ" });

  try {
    const [totalSessions] = await db.select({ total: count() }).from(schema.worldSessions);
    const [activeSessions] = await db.select({ total: count() }).from(schema.worldSessions)
      .where(sql`${schema.worldSessions.status} IN ('searching', 'matched', 'chatting')`);
    const [coinsData] = await db.select({ total: sql<number>`COALESCE(SUM(coins_spent), 0)` }).from(schema.worldSessions);
    const [milesData] = await db.select({ total: sql<number>`COALESCE(SUM(miles), 0)` }).from(schema.users);

    res.json({
      success: true,
      data: {
        totalSessions: totalSessions.total,
        activeSessions: activeSessions.total,
        totalCoinsSpent: coinsData.total,
        totalMiles: milesData.total,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: "خطأ" });
  }
});

export default router;
