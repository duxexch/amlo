/**
 * Admin Panel API Routes — لوحة التحكم الرئيسية
 * =================================================
 * Fully DB-backed via Drizzle ORM storage methods.
 * No in-memory mock data — all state persisted to PostgreSQL.
 */
import { Router } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin, requireAdminRole, rateLimitLogin } from "../middleware/adminAuth";
import { hashPassword, verifyPassword, hashPasswordAsync, verifyPasswordAsync, generateReferralCode } from "../utils/crypto";
import { createLogger } from "../logger";
const log = (msg: string, _src?: string) => adminLog.info(msg);
const adminLog = createLogger("admin");
import { randomUUID } from "crypto";
import { updateSmtpConfig, updateOtpConfig, sendEmail, isSmtpConfigured } from "../services/email";
import {
  adminLoginSchema,
  createAgentSchema,
  updateAgentSchema,
  createGiftSchema,
  updateUserAdminSchema,
  updateSettingSchema,
  updateReportSchema,
  createUpgradeRequestSchema,
  reviewUpgradeRequestSchema,
  banUserSchema,
  agentApplicationUpdateSchema,
  transactionUpdateSchema,
  fraudAlertUpdateSchema,
  announcementPopupSchema,
  agentAccountCreateSchema,
  releaseBalanceSchema,
  milesPricingSchema,
} from "../../shared/schema";
import { getDb } from "../db";
import { eq, asc, desc, count, sql, and, ne, gte, sum, inArray } from "drizzle-orm";
import * as schema from "../../shared/schema";
import { getAllPricing, invalidatePricingCache } from "../pricingService";
import { getQueueStats } from "../matchingEngine";
import { paramStr } from "./socialHelpers";
import { io } from "../index";
import { getUserSocketId } from "../onlineUsers";
import { decryptMessage } from "../utils/encryption";

const router = Router();

// Financial/admin responses should never be cached by browser or proxies.
router.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, private");
  res.setHeader("Pragma", "no-cache");
  res.setHeader("Expires", "0");
  next();
});

function emitFinanceUpdate(type: string, payload: Record<string, unknown> = {}) {
  io.emit("finance-updated", {
    type,
    ts: Date.now(),
    ...payload,
  });
}

/** Strip sensitive fields from DB objects before sending to client (centralized) */
import { sanitizeUser } from "../utils/sanitize";
const stripSensitive = sanitizeUser;

// ══════════════════════════════════════════════════════════
// AUTH ROUTES — تسجيل دخول / خروج المدير
// ══════════════════════════════════════════════════════════

router.post("/auth/login", rateLimitLogin, async (req, res) => {
  try {
    const parsed = adminLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
    }

    const { username, password } = parsed.data;
    const admin = await storage.getAdminByUsername(username);

    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    const valid = await verifyPasswordAsync(password, admin.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    // Update last login
    await storage.updateAdmin(admin.id, { lastLoginAt: new Date() } as any);

    // Regenerate session to prevent session fixation attacks
    const oldSession = req.session;
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        // Restore data to new session
        req.session.adminId = admin.id;
        req.session.adminUsername = admin.username;
        req.session.adminRole = admin.role;
        req.session.adminDisplayName = admin.displayName;
        resolve();
      });
    });

    log(`Admin login: ${admin.username} (${admin.role})`, "admin");

    await storage.addAdminLog(admin.id, "login", "admin", admin.id, `Admin login: ${admin.username}`);

    return res.json({
      success: true,
      data: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role,
        avatar: admin.avatar,
      },
    });
  } catch (err: any) {
    log(`Admin login error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.post("/auth/logout", requireAdmin, async (req, res) => {
  const adminId = req.session.adminId!;
  await storage.addAdminLog(adminId, "logout", "admin", adminId, "Admin logout");
  req.session.destroy(() => {
    res.clearCookie("ablox.admin.sid");
    res.clearCookie("connect.sid");  // clear legacy cookie
    res.json({ success: true });
  });
});

router.get("/auth/me", requireAdmin, async (req, res) => {
  try {
    const admin = await storage.getAdmin(req.session.adminId!);
    if (!admin) {
      return res.status(401).json({ success: false, message: "جلسة غير صالحة" });
    }
    return res.json({
      success: true,
      data: {
        id: admin.id,
        username: admin.username,
        displayName: admin.displayName,
        role: admin.role,
        avatar: admin.avatar,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// DASHBOARD STATS — إحصائيات لوحة القيادة (DB-backed)
// ══════════════════════════════════════════════════════════

router.get("/stats", requireAdmin, async (_req, res) => {
  try {
    const stats = await storage.getAdminDashboardStats();
    const gifts = await storage.getGifts();
    const packages = await storage.getCoinPackages();
    const weeklyUsers = await storage.getWeeklyUserRegistrations();
    const recentActivity = await storage.getRecentAdminActivity(5);

    // Format weekly users for chart
    const dayNames: Record<number, string> = { 0: "الأحد", 1: "الاثنين", 2: "الثلاثاء", 3: "الأربعاء", 4: "الخميس", 5: "الجمعة", 6: "السبت" };
    const weeklyUsersFormatted = weeklyUsers.map((w: any) => ({
      day: dayNames[new Date(w.day).getDay()] || w.day,
      count: w.count,
    }));

    // Format recent activity
    const recentActivityFormatted = recentActivity.map((a: any) => ({
      type: a.action,
      message: a.details || a.action,
      time: a.createdAt,
    }));

    return res.json({
      success: true,
      data: {
        totalUsers: stats.totalUsers,
        totalAgents: stats.totalAgents,
        activeStreams: stats.activeStreams,
        todayRevenue: stats.todayRevenue,
        totalGifts: gifts.length,
        totalCoinPackages: packages.length,
        weeklyRevenue: stats.weeklyRevenue,
        weeklyUsers: weeklyUsersFormatted,
        recentActivity: recentActivityFormatted,
      },
    });
  } catch (err: any) {
    log(`Stats error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ في تحميل الإحصائيات" });
  }
});

// ══════════════════════════════════════════════════════════
// USERS MANAGEMENT — إدارة المستخدمين
// ══════════════════════════════════════════════════════════

router.get("/users", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || "";
    const status = (req.query.status as string) || "";
    const country = (req.query.country as string) || "";
    const banned = (req.query.banned as string) || "";
    const verified = (req.query.verified as string) || "";

    // Use storage to get paginated users
    const result = await storage.getUsersPaginated?.(page, limit, { search, status, country, banned, verified });

    if (result) {
      // Strip passwordHash from user data (SECURITY)
      const safeData = result.data.map((u: any) => stripSensitive(u));
      return res.json({
        success: true,
        data: safeData,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    }

    // Fallback: return empty
    return res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  } catch (err: any) {
    log(`Users list error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ في تحميل المستخدمين" });
  }
});

router.get("/users/:id", requireAdmin, async (req, res) => {
  try {
    const user = await storage.getUser(paramStr(req.params.id));
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    return res.json({ success: true, data: stripSensitive(user) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.patch("/users/:id", requireAdmin, async (req, res) => {
  try {
    const parsed = updateUserAdminSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const updated = await storage.updateUser(paramStr(req.params.id), parsed.data);
    if (!updated) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    await storage.addAdminLog(req.session.adminId!, "update_user", "user", paramStr(req.params.id), JSON.stringify(parsed.data));

    const { passwordHash: _ph2, ...safeUpdated2 } = updated as any;
    return res.json({ success: true, data: safeUpdated2 });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.post("/users/:id/ban", requireAdmin, async (req, res) => {
  try {
    const parsed = banUserSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    const { reason } = parsed.data;
    const updated = await storage.updateUser(paramStr(req.params.id), {
      isBanned: true,
      banReason: reason || "محظور بواسطة الإدارة",
    } as any);
    if (!updated) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    await storage.addAdminLog(req.session.adminId!, "ban_user", "user", paramStr(req.params.id), `Ban reason: ${reason || "N/A"}`);

    return res.json({ success: true, data: stripSensitive(updated), message: "تم حظر المستخدم" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.post("/users/:id/unban", requireAdmin, async (req, res) => {
  try {
    const updated = await storage.updateUser(paramStr(req.params.id), {
      isBanned: false,
      banReason: null,
    } as any);
    if (!updated) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    await storage.addAdminLog(req.session.adminId!, "unban_user", "user", paramStr(req.params.id), "User unbanned");

    return res.json({ success: true, data: stripSensitive(updated), message: "تم إلغاء حظر المستخدم" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// AGENTS MANAGEMENT — إدارة الوكلاء
// ══════════════════════════════════════════════════════════

router.get("/agents", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || "";
    const status = (req.query.status as string) || "";

    // DB-side search, filter, and pagination (no full table scan)
    const { data: agents, total } = await storage.getAgentsFiltered({ search, status, page, limit });
    const data = agents.map((a: any) => stripSensitive(a));

    return res.json({
      success: true,
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (err: any) {
    log(`Agents list error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ في تحميل الوكلاء" });
  }
});

router.get("/agents/:id", requireAdmin, async (req, res) => {
  try {
    const agent = await storage.getAgent(paramStr(req.params.id));
    if (!agent) return res.status(404).json({ success: false, message: "الوكيل غير موجود" });
    return res.json({ success: true, data: stripSensitive(agent as any) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.post("/agents", requireAdmin, async (req, res) => {
  try {
    const parsed = createAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const { name, email, phone, password, commissionRate } = parsed.data;

    // Check duplicate email
    const existing = await storage.getAgentByEmail(email);
    if (existing) {
      return res.status(409).json({ success: false, message: "البريد الإلكتروني مستخدم بالفعل" });
    }

    const passwordHash = await hashPasswordAsync(password);
    const referralCode = generateReferralCode("AGENT");

    const agent = await storage.createAgent({
      name,
      email,
      phone: phone || null,
      passwordHash,
      referralCode,
      commissionRate: commissionRate || "10.00",
      status: "active",
      createdBy: req.session.adminId,
    });

    await storage.addAdminLog(req.session.adminId!, "create_agent", "agent", agent.id, `Created agent: ${name}`);

    return res.status(201).json({ success: true, data: stripSensitive(agent) });
  } catch (err: any) {
    log(`Create agent error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ في إنشاء الوكيل" });
  }
});

router.patch("/agents/:id", requireAdmin, async (req, res) => {
  try {
    const parsed = updateAgentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const updated = await storage.updateAgent(paramStr(req.params.id), parsed.data);
    if (!updated) return res.status(404).json({ success: false, message: "الوكيل غير موجود" });

    await storage.addAdminLog(req.session.adminId!, "update_agent", "agent", paramStr(req.params.id), JSON.stringify(parsed.data));

    return res.json({ success: true, data: stripSensitive(updated) });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.delete("/agents/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await storage.deleteAgent(paramStr(req.params.id));
    if (!deleted) return res.status(404).json({ success: false, message: "الوكيل غير موجود" });

    await storage.addAdminLog(req.session.adminId!, "delete_agent", "agent", paramStr(req.params.id), "Agent deleted");

    return res.json({ success: true, message: "تم حذف الوكيل" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.post("/agents/:id/release-balance", requireAdmin, async (req, res) => {
  try {
    const parsed = releaseBalanceSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    const { amount } = parsed.data;

    const agent = await storage.getAgent(paramStr(req.params.id));
    if (!agent) return res.status(404).json({ success: false, message: "الوكيل غير موجود" });

    const currentBalance = parseFloat(agent.balance as string);
    if (amount > currentBalance) {
      return res.status(400).json({ success: false, message: "المبلغ أكبر من الرصيد المتاح" });
    }

    const updated = await storage.updateAgent(paramStr(req.params.id), {
      balance: (currentBalance - amount).toFixed(2),
    });

    await storage.addAdminLog(req.session.adminId!, "release_agent_balance", "agent", paramStr(req.params.id), `Released $${amount}`);

    return res.json({ success: true, data: updated, message: `تم تحرير $${amount}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// AGENT APPLICATIONS — طلبات الانضمام كوكيل (DB-backed)
// ══════════════════════════════════════════════════════════

router.get("/agent-applications", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || "";
    const search = (req.query.search as string) || "";

    const result = await storage.getAgentApplications(page, limit, { status: status || undefined });

    // Client-side search filter (DB handles pagination)
    let data = result.data;
    if (search) {
      const q = search.toLowerCase();
      data = data.filter(
        (a: any) => a.fullName?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q),
      );
    }

    return res.json({
      success: true,
      data,
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (err: any) {
    log(`Agent applications error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ في تحميل الطلبات" });
  }
});

router.patch("/agent-applications/:id", requireAdmin, async (req, res) => {
  try {
    const app = await storage.getAgentApplication(paramStr(req.params.id));
    if (!app) return res.status(404).json({ success: false, message: "الطلب غير موجود" });

    const parsed = agentApplicationUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    const { status, adminNotes } = parsed.data;

    const updateData: any = {};
    if (status) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    const updated = await storage.updateAgentApplication(paramStr(req.params.id), updateData);

    // If approved, create an agent in the database
    if (status === "approved") {
      try {
        const tempPassword = `Agent_${randomUUID().slice(0, 12)}!`;
        const passwordHash = await hashPasswordAsync(tempPassword);
        const referralCode = generateReferralCode("AGENT");
        await storage.createAgent({
          name: app.fullName,
          email: app.email,
          phone: app.phone,
          passwordHash,
          referralCode,
          commissionRate: "10.00",
          status: "active",
          createdBy: req.session.adminId,
        });

        // Send temp password to agent via email
        const emailSent = await sendEmail(
          app.email,
          "تم قبول طلبك كوكيل — Ablox Agent Account",
          `<div dir="rtl" style="font-family: Arial, sans-serif; padding: 20px;">
            <h2>مبروك! تم قبول طلبك كوكيل في Ablox</h2>
            <p>يمكنك تسجيل الدخول باستخدام:</p>
            <p><strong>البريد:</strong> ${app.email}</p>
            <p><strong>كلمة المرور المؤقتة:</strong> ${tempPassword}</p>
            <p style="color: #e74c3c;"><strong>يرجى تغيير كلمة المرور بعد تسجيل الدخول مباشرة.</strong></p>
          </div>`,
          `تم قبول طلبك. كلمة المرور المؤقتة: ${tempPassword} — يرجى تغييرها بعد تسجيل الدخول.`
        );

        if (emailSent) {
          log(`Agent created from application: ${app.email} — temp password sent via email`, "admin");
        } else {
          log(`Agent created from application: ${app.email} — email NOT sent (SMTP not configured)`, "admin");
        }
      } catch (err: any) {
        log(`Auto-create agent from application failed: ${err.message}`, "admin");
      }
    }

    await storage.addAdminLog(req.session.adminId!, "update_application", "agent_application", paramStr(req.params.id), `Status → ${status}`);

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.delete("/agent-applications/:id", requireAdmin, async (req, res) => {
  try {
    await storage.deleteAgentApplication(paramStr(req.params.id));
    return res.json({ success: true, message: "تم حذف الطلب" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// GIFTS MANAGEMENT — إدارة الهدايا
// ══════════════════════════════════════════════════════════

router.get("/gifts", requireAdmin, async (_req, res) => {
  try {
    const gifts = await storage.getGifts();
    return res.json({ success: true, data: gifts });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل الهدايا" });
  }
});

router.post("/gifts", requireAdmin, async (req, res) => {
  try {
    const parsed = createGiftSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const gift = await storage.createGift({
      ...parsed.data,
      sortOrder: req.body.sortOrder || 0,
      isActive: req.body.isActive !== false,
    });

    await storage.addAdminLog(req.session.adminId!, "create_gift", "gift", gift.id, `Created gift: ${parsed.data.name}`);

    return res.status(201).json({ success: true, data: gift });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في إنشاء الهدية" });
  }
});

router.patch("/gifts/:id", requireAdmin, async (req, res) => {
  try {
    // Only allow known gift fields
    const allowed = ["name", "nameAr", "icon", "price", "category", "sortOrder", "isActive", "imageUrl"];
    const safeBody: Record<string, any> = {};
    for (const k of allowed) { if (req.body[k] !== undefined) safeBody[k] = req.body[k]; }

    const updated = await storage.updateGift(paramStr(req.params.id), safeBody);
    if (!updated) return res.status(404).json({ success: false, message: "الهدية غير موجودة" });

    await storage.addAdminLog(req.session.adminId!, "update_gift", "gift", paramStr(req.params.id), JSON.stringify(req.body));

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.delete("/gifts/:id", requireAdmin, async (req, res) => {
  try {
    const deleted = await storage.deleteGift(paramStr(req.params.id));
    if (!deleted) return res.status(404).json({ success: false, message: "الهدية غير موجودة" });

    await storage.addAdminLog(req.session.adminId!, "delete_gift", "gift", paramStr(req.params.id), "Gift deleted");

    return res.json({ success: true, message: "تم حذف الهدية" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.post("/gifts/:id/send", requireAdmin, async (req, res) => {
  try {
    const sendSchema = z.object({
      userId: z.string().min(1, "معرف المستخدم مطلوب"),
      message: z.string().max(500).optional(),
    });
    const parsed = sendSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "بيانات غير صالحة" });
    const { userId, message } = parsed.data;

    const gift = await storage.getGift(paramStr(req.params.id));
    if (!gift) return res.status(404).json({ success: false, message: "الهدية غير موجودة" });

    const user = await storage.getUser(userId);
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    // Add coins to user
    await storage.updateUser(userId, {
      coins: (user.coins || 0) + gift.price,
    } as any);

    await storage.addAdminLog(
      req.session.adminId!,
      "send_gift",
      "gift",
      paramStr(req.params.id),
      `Sent ${gift.name} (${gift.price} coins) to ${user.username}${message ? ` — ${message}` : ""}`,
    );

    return res.json({ success: true, message: `تم إرسال ${gift.nameAr} إلى ${user.displayName || user.username}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// TRANSACTIONS — المعاملات المالية (DB-backed)
// ══════════════════════════════════════════════════════════

router.get("/transactions", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const type = (req.query.type as string) || "";
    const status = (req.query.status as string) || "";

    const result = await storage.getAllTransactions(page, limit, {
      type: type || undefined,
      status: status || undefined,
    });

    return res.json({
      success: true,
      data: result.data,
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (err: any) {
    log(`Transactions error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ في تحميل المعاملات" });
  }
});

router.get("/transactions/:id", requireAdmin, async (req, res) => {
  try {
    const tx = await storage.getTransaction(paramStr(req.params.id));
    if (!tx) return res.status(404).json({ success: false, message: "المعاملة غير موجودة" });
    return res.json({ success: true, data: tx });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.patch("/transactions/:id", requireAdmin, async (req, res) => {
  try {
    const tx = await storage.getTransaction(paramStr(req.params.id));
    if (!tx) return res.status(404).json({ success: false, message: "المعاملة غير موجودة" });

    const parsed = transactionUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    const { status, adminNotes, rejectionReason, amount, description } = parsed.data;

    if (amount !== undefined) {
      return res.status(400).json({
        success: false,
        message: "لا يمكن تعديل مبلغ المعاملة مباشرة لأسباب أمنية",
      });
    }

    if (status && !["pending", "completed", "rejected"].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "حالة غير مدعومة لهذا المسار",
      });
    }

    const updateData: any = {};
    if (status) updateData.status = status;
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;
    if (rejectionReason) updateData.adminNotes = `رفض: ${rejectionReason}`;
    if (description !== undefined) updateData.description = description;

    const updated = await storage.updateTransaction(paramStr(req.params.id), updateData);

    await storage.addAdminLog(req.session.adminId!, "update_transaction", "transaction", paramStr(req.params.id), `Status → ${status || "unchanged"}`);

    emitFinanceUpdate("transaction-updated", { transactionId: paramStr(req.params.id), status: updateData.status || null });

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// WALLETS — المحافظ
// ══════════════════════════════════════════════════════════

router.get("/wallets", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = (req.query.search as string) || "";

    // Get users as wallet data
    const result = await storage.getUsersPaginated?.(page, limit, { search });

    if (result) {
      const wallets = result.data.map((u: any) => ({
        userId: u.id,
        username: u.username,
        displayName: u.displayName,
        coins: u.coins,
        diamonds: u.diamonds,
        level: u.level,
        isVerified: u.isVerified,
        isBanned: u.isBanned,
        country: u.country,
        lastOnlineAt: u.lastOnlineAt,
      }));

      return res.json({
        success: true,
        data: wallets,
        pagination: {
          page,
          limit,
          total: result.total,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    }

    return res.json({ success: true, data: [], pagination: { page, limit, total: 0, totalPages: 0 } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل المحافظ" });
  }
});

router.get("/wallets/:userId", requireAdmin, async (req, res) => {
  try {
    const user = await storage.getUser(paramStr(req.params.userId));
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    // Get real transactions from DB
    const txResult = await storage.getUserTransactions(paramStr(req.params.userId), 1, 50);

    return res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          username: user.username,
          displayName: user.displayName,
          coins: user.coins,
          diamonds: user.diamonds,
          level: user.level,
        },
        transactions: txResult.data,
        stats: {
          totalSpent: txResult.data.filter((t: any) => t.type === "purchase").reduce((s: number, t: any) => s + Number(t.amount || 0), 0),
          totalReceived: txResult.data.filter((t: any) => t.type === "gift_received").reduce((s: number, t: any) => s + Number(t.amount || 0), 0),
          totalWithdrawn: txResult.data.filter((t: any) => t.type === "withdrawal").reduce((s: number, t: any) => s + Number(t.amount || 0), 0),
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// #14: Adjustment history endpoint
router.get("/wallets/:userId/adjustments", requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, data: [] });
    const userId = paramStr(req.params.userId);
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const offset = (page - 1) * limit;

    const adjustments = await db.select()
      .from(schema.walletTransactions)
      .where(and(
        eq(schema.walletTransactions.userId, userId),
        sql`${schema.walletTransactions.paymentMethod} = 'admin_adjustment'`
      ))
      .orderBy(sql`${schema.walletTransactions.createdAt} DESC`)
      .limit(limit)
      .offset(offset);

    return res.json({ success: true, data: adjustments });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل سجل التعديلات" });
  }
});

// #11: Admin CSV exports
router.get("/export/transactions", requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;
    const type = req.query.type as string | undefined;

    let conditions: any[] = [];
    if (startDate) conditions.push(sql`${schema.walletTransactions.createdAt} >= ${new Date(startDate)}`);
    if (endDate) { const ed = new Date(endDate); ed.setHours(23, 59, 59, 999); conditions.push(sql`${schema.walletTransactions.createdAt} <= ${ed}`); }
    if (type) conditions.push(eq(schema.walletTransactions.type, type));

    const rows = await db.select()
      .from(schema.walletTransactions)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${schema.walletTransactions.createdAt} DESC`)
      .limit(10000);

    const BOM = "\uFEFF";
    const header = "ID,User ID,Type,Amount,Balance After,Currency,Description,Payment Method,Status,Created At\n";
    const csv = rows.map((r: any) =>
      `"${r.id}","${r.userId}","${r.type}","${r.amount}","${r.balanceAfter}","${r.currency}","${(r.description || "").replace(/"/g, '""')}","${r.paymentMethod || ""}","${r.status}","${r.createdAt}"`
    ).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="transactions_${Date.now()}.csv"`);
    return res.send(BOM + header + csv);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "Export failed" });
  }
});

router.get("/export/withdrawals", requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "DB unavailable" });
    const status = req.query.status as string | undefined;

    let conditions: any[] = [];
    if (status) conditions.push(eq(schema.withdrawalRequests.status, status));

    const rows = await db.select()
      .from(schema.withdrawalRequests)
      .where(conditions.length > 0 ? and(...conditions) : undefined)
      .orderBy(sql`${schema.withdrawalRequests.createdAt} DESC`)
      .limit(10000);

    // #19: Batch user lookup instead of N+1 individual queries
    const uniqueUserIds = [...new Set(rows.map((r: any) => r.userId).filter(Boolean))];
    const usersArr = uniqueUserIds.length > 0
      ? await db.select().from(schema.users).where(inArray(schema.users.id, uniqueUserIds))
      : [];
    const userMap = new Map(usersArr.map(u => [u.id, u]));
    const enriched = rows.map((r: any) => {
      const user = userMap.get(r.userId);
      return { ...r, username: user?.username || "—" };
    });

    const BOM = "\uFEFF";
    const header = "ID,User,Amount,Amount USD,Status,Payment Method,Admin Notes,Created At,Processed At\n";
    const csv = enriched.map((r: any) =>
      `"${r.id}","${r.username}","${r.amount}","${r.amountUsd || ""}","${r.status}","${r.paymentMethod || ""}","${(r.adminNotes || "").replace(/"/g, '""')}","${r.createdAt}","${r.processedAt || ""}"`
    ).join("\n");

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="withdrawals_${Date.now()}.csv"`);
    return res.send(BOM + header + csv);
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "Export failed" });
  }
});

// ══════════════════════════════════════════════════════════
// FINANCIAL DASHBOARD — لوحة الإحصائيات المالية
// ══════════════════════════════════════════════════════════

router.get("/financial-stats", requireAdmin, async (_req, res) => {
  try {
    const db = getDb();
    if (!db) return res.json({ success: true, data: {} });

    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const weekStart = new Date(todayStart);
    weekStart.setDate(weekStart.getDate() - 7);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);

    // Revenue stats (purchases/recharges)
    const [revenueStats] = await db.select({
      totalRevenue: sql<number>`COALESCE(SUM(CASE WHEN type = 'purchase' AND status = 'completed' THEN ABS(amount) ELSE 0 END), 0)`,
      todayRevenue: sql<number>`COALESCE(SUM(CASE WHEN type = 'purchase' AND status = 'completed' AND ${schema.walletTransactions.createdAt} >= ${todayStart} THEN ABS(amount) ELSE 0 END), 0)`,
      weekRevenue: sql<number>`COALESCE(SUM(CASE WHEN type = 'purchase' AND status = 'completed' AND ${schema.walletTransactions.createdAt} >= ${weekStart} THEN ABS(amount) ELSE 0 END), 0)`,
      monthRevenue: sql<number>`COALESCE(SUM(CASE WHEN type = 'purchase' AND status = 'completed' AND ${schema.walletTransactions.createdAt} >= ${monthStart} THEN ABS(amount) ELSE 0 END), 0)`,
      totalGiftVolume: sql<number>`COALESCE(SUM(CASE WHEN type = 'gift_sent' AND status = 'completed' THEN ABS(amount) ELSE 0 END), 0)`,
      totalWithdrawn: sql<number>`COALESCE(SUM(CASE WHEN type = 'withdrawal' AND status = 'completed' THEN ABS(amount) ELSE 0 END), 0)`,
      totalTransactions: sql<number>`COUNT(*)`,
    }).from(schema.walletTransactions);

    // Withdrawal requests stats
    const [wrStats] = await db.select({
      pendingCount: sql<number>`COALESCE(SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END), 0)`,
      pendingAmount: sql<number>`COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0)`,
      processingCount: sql<number>`COALESCE(SUM(CASE WHEN status = 'processing' THEN 1 ELSE 0 END), 0)`,
      completedCount: sql<number>`COALESCE(SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END), 0)`,
      rejectedCount: sql<number>`COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0)`,
      totalRequests: sql<number>`COUNT(*)`,
    }).from(schema.withdrawalRequests);

    // Total coins in circulation
    const [coinStats] = await db.select({
      totalCoins: sql<number>`COALESCE(SUM(coins), 0)`,
      totalDiamonds: sql<number>`COALESCE(SUM(diamonds), 0)`,
    }).from(schema.users);

    // #18: Weekly/monthly comparison
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevMonthStart = new Date(monthStart);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);

    const [comparisonStats] = await db.select({
      prevWeekRevenue: sql<number>`COALESCE(SUM(CASE WHEN type = 'purchase' AND status = 'completed' AND ${schema.walletTransactions.createdAt} >= ${prevWeekStart} AND ${schema.walletTransactions.createdAt} < ${weekStart} THEN ABS(amount) ELSE 0 END), 0)`,
      prevMonthRevenue: sql<number>`COALESCE(SUM(CASE WHEN type = 'purchase' AND status = 'completed' AND ${schema.walletTransactions.createdAt} >= ${prevMonthStart} AND ${schema.walletTransactions.createdAt} < ${monthStart} THEN ABS(amount) ELSE 0 END), 0)`,
      prevWeekWithdrawals: sql<number>`COALESCE(SUM(CASE WHEN type = 'withdrawal' AND status = 'completed' AND ${schema.walletTransactions.createdAt} >= ${prevWeekStart} AND ${schema.walletTransactions.createdAt} < ${weekStart} THEN ABS(amount) ELSE 0 END), 0)`,
      prevMonthWithdrawals: sql<number>`COALESCE(SUM(CASE WHEN type = 'withdrawal' AND status = 'completed' AND ${schema.walletTransactions.createdAt} >= ${prevMonthStart} AND ${schema.walletTransactions.createdAt} < ${monthStart} THEN ABS(amount) ELSE 0 END), 0)`,
    }).from(schema.walletTransactions);

    const weekRev = Number(revenueStats?.weekRevenue || 0);
    const monthRev = Number(revenueStats?.monthRevenue || 0);
    const prevWeekRev = Number(comparisonStats?.prevWeekRevenue || 0);
    const prevMonthRev = Number(comparisonStats?.prevMonthRevenue || 0);
    const calcGrowth = (cur: number, prev: number) => prev === 0 ? (cur > 0 ? 100 : 0) : Math.round(((cur - prev) / prev) * 100);

    return res.json({
      success: true,
      data: {
        revenue: {
          total: Number(revenueStats?.totalRevenue || 0),
          today: Number(revenueStats?.todayRevenue || 0),
          week: weekRev,
          month: monthRev,
        },
        giftVolume: Number(revenueStats?.totalGiftVolume || 0),
        withdrawn: Number(revenueStats?.totalWithdrawn || 0),
        totalTransactions: Number(revenueStats?.totalTransactions || 0),
        withdrawals: {
          pending: Number(wrStats?.pendingCount || 0),
          pendingAmount: Number(wrStats?.pendingAmount || 0),
          processing: Number(wrStats?.processingCount || 0),
          completed: Number(wrStats?.completedCount || 0),
          rejected: Number(wrStats?.rejectedCount || 0),
          total: Number(wrStats?.totalRequests || 0),
        },
        circulation: {
          totalCoins: Number(coinStats?.totalCoins || 0),
          totalDiamonds: Number(coinStats?.totalDiamonds || 0),
        },
        comparison: {
          weekGrowth: calcGrowth(weekRev, prevWeekRev),
          monthGrowth: calcGrowth(monthRev, prevMonthRev),
          prevWeekRevenue: prevWeekRev,
          prevMonthRevenue: prevMonthRev,
          prevWeekWithdrawals: Number(comparisonStats?.prevWeekWithdrawals || 0),
          prevMonthWithdrawals: Number(comparisonStats?.prevMonthWithdrawals || 0),
        },
      },
    });
  } catch (err: any) {
    log(`Financial stats error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ في تحميل الإحصائيات المالية" });
  }
});

// ══════════════════════════════════════════════════════════
// WITHDRAWAL REQUESTS — إدارة طلبات السحب
// ══════════════════════════════════════════════════════════

router.get("/withdrawal-requests", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || "";
    const search = (req.query.search as string) || "";
    const startDate = req.query.startDate as string | undefined;
    const endDate = req.query.endDate as string | undefined;

    const result = await storage.getWithdrawalRequests(page, limit, { status: status || undefined });

    // #3: Decrypt payment details for admin, #19: batch user lookup
    const wrData = result.data || [];
    const uniqueUserIds = [...new Set(wrData.map((wr: any) => wr.userId).filter(Boolean))];
    const db = getDb();
    const usersArr = (db && uniqueUserIds.length > 0)
      ? await db.select().from(schema.users).where(inArray(schema.users.id, uniqueUserIds))
      : [];
    const userMap = new Map(usersArr.map(u => [u.id, u]));

    let enriched = wrData.map((wr: any) => {
      let decryptedDetails = wr.paymentDetails;
      if (decryptedDetails && typeof decryptedDetails === "string" && decryptedDetails.includes(":")) {
        try {
          decryptedDetails = decryptMessage(decryptedDetails, `withdrawal:${wr.userId}`);
        } catch { /* keep as-is */ }
      }
      const user = userMap.get(wr.userId);
      return { ...wr, paymentDetails: decryptedDetails, user: user ? { id: user.id, username: user.username, displayName: user.displayName, avatar: user.avatar } : null };
    });

    // #7: Apply search filter
    if (search) {
      const q = search.toLowerCase();
      enriched = enriched.filter((wr: any) =>
        wr.user?.username?.toLowerCase().includes(q) ||
        wr.user?.displayName?.toLowerCase().includes(q) ||
        wr.id?.toLowerCase().includes(q)
      );
    }

    // #10: Apply date filters
    if (startDate) {
      const sd = new Date(startDate);
      enriched = enriched.filter((wr: any) => new Date(wr.createdAt) >= sd);
    }
    if (endDate) {
      const ed = new Date(endDate);
      ed.setHours(23, 59, 59, 999);
      enriched = enriched.filter((wr: any) => new Date(wr.createdAt) <= ed);
    }

    return res.json({
      success: true,
      data: enriched,
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (err: any) {
    log(`Withdrawal requests error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ في تحميل طلبات السحب" });
  }
});

router.patch("/withdrawal-requests/:id", requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    const wrId = paramStr(req.params.id);
    const { status, adminNotes } = req.body;

    if (!status || !["completed", "rejected", "processing"].includes(status)) {
      return res.status(400).json({ success: false, message: "حالة غير صالحة" });
    }

    const result = await db.transaction(async (tx) => {
      const [wr] = await tx.select().from(schema.withdrawalRequests).where(eq(schema.withdrawalRequests.id, wrId)).limit(1);
      if (!wr) throw new Error("NOT_FOUND");
      if (wr.status === "completed") throw new Error("ALREADY_COMPLETED");

      const updateData: any = {
        status,
        processedBy: req.session.adminId,
        processedAt: new Date(),
      };
      if (adminNotes) updateData.adminNotes = adminNotes;

      // If rejecting a pending request, refund coins
      if (status === "rejected" && (wr.status === "pending" || wr.status === "processing")) {
        const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, wr.userId)).limit(1);
        if (user) {
          const newBalance = user.coins + wr.amount;
          await tx.update(schema.users).set({ coins: newBalance }).where(eq(schema.users.id, wr.userId));
          // Create refund transaction
          await tx.insert(schema.walletTransactions).values({
            userId: wr.userId,
            type: "refund",
            amount: wr.amount,
            balanceAfter: newBalance,
            currency: "coins",
            description: `استرجاع طلب سحب مرفوض #${wr.id}`,
            referenceId: wr.id,
            status: "completed",
          });
        }
      }

      // If completing, also update the related wallet transaction
      if (status === "completed") {
        await tx.update(schema.walletTransactions)
          .set({ status: "completed" })
          .where(and(
            eq(schema.walletTransactions.referenceId, wrId),
            eq(schema.walletTransactions.type, "withdrawal"),
          ));
      }

      await tx.update(schema.withdrawalRequests).set(updateData).where(eq(schema.withdrawalRequests.id, wrId));

      return { ...wr, ...updateData };
    });

    await storage.addAdminLog(req.session.adminId!, "update_withdrawal", "withdrawal", wrId, `Status → ${status}`);
    emitFinanceUpdate("withdrawal-updated", { withdrawalId: wrId, status });

    // #2: Notify user via Socket.io when admin changes withdrawal status
    try {
      const wr = result;
      const socketId = await getUserSocketId(wr.userId);
      if (socketId) {
        io.to(socketId).emit("withdrawal-status-change", { withdrawalId: wrId, status });
        // If rejected with refund, also update balance
        if (status === "rejected") {
          const user = await storage.getUser(wr.userId);
          if (user) io.to(socketId).emit("balance-update", { coins: user.coins });
        }
      }
    } catch { /* non-critical */ }

    return res.json({ success: true, data: result });
  } catch (err: any) {
    if (err.message === "NOT_FOUND") return res.status(404).json({ success: false, message: "الطلب غير موجود" });
    if (err.message === "ALREADY_COMPLETED") return res.status(400).json({ success: false, message: "الطلب مكتمل بالفعل" });
    log(`Update withdrawal error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ في تحديث طلب السحب" });
  }
});

// ══════════════════════════════════════════════════════════
// ADJUST USER BALANCE — تعديل رصيد المستخدم
// ══════════════════════════════════════════════════════════

router.post("/wallets/:userId/adjust", requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    const adjustSchema = z.object({
      amount: z.number().int().min(-1000000).max(1000000),
      reason: z.string().min(1).max(500),
      currency: z.enum(["coins", "diamonds"]).default("coins"),
    });

    const parsed = adjustSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });

    const { amount, reason, currency } = parsed.data;
    const userId = paramStr(req.params.userId);

    const result = await db.transaction(async (tx) => {
      const [user] = await tx.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
      if (!user) throw new Error("USER_NOT_FOUND");

      let newBalance: number;
      if (currency === "coins") {
        newBalance = user.coins + amount;
        if (newBalance < 0) throw new Error("NEGATIVE_BALANCE");
        await tx.update(schema.users).set({ coins: newBalance }).where(eq(schema.users.id, userId));
      } else {
        newBalance = user.diamonds + amount;
        if (newBalance < 0) throw new Error("NEGATIVE_BALANCE");
        await tx.update(schema.users).set({ diamonds: newBalance }).where(eq(schema.users.id, userId));
      }

      // Record transaction
      await tx.insert(schema.walletTransactions).values({
        userId,
        type: amount > 0 ? "bonus" : "withdrawal",
        amount,
        balanceAfter: newBalance,
        currency,
        description: `تعديل يدوي بواسطة الأدمن: ${reason}`,
        paymentMethod: "admin_adjustment",
        status: "completed",
      });

      return { newBalance, username: user.username };
    });

    await storage.addAdminLog(
      req.session.adminId!,
      amount > 0 ? "add_balance" : "deduct_balance",
      "user",
      userId,
      `${amount > 0 ? "+" : ""}${amount} ${currency} — ${reason} (new: ${result.newBalance})`,
    );

    emitFinanceUpdate("wallet-adjusted", {
      userId,
      currency,
      amount,
      newBalance: result.newBalance,
    });

    io.to(`user:${userId}`).emit("balance-update", {
      [currency]: result.newBalance,
    });

    return res.json({
      success: true,
      data: { newBalance: result.newBalance, currency },
      message: `تم تعديل رصيد @${result.username} بنجاح`,
    });
  } catch (err: any) {
    if (err.message === "USER_NOT_FOUND") return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    if (err.message === "NEGATIVE_BALANCE") return res.status(400).json({ success: false, message: "لا يمكن أن يصبح الرصيد سالباً" });
    log(`Adjust balance error: ${err.message}`, "admin");
    return res.status(500).json({ success: false, message: "خطأ في تعديل الرصيد" });
  }
});

// ══════════════════════════════════════════════════════════
// PAYMENT METHODS — طرق الدفع (DB-backed)
// ══════════════════════════════════════════════════════════

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

router.get("/payment-methods", requireAdmin, async (_req, res) => {
  try {
    const methods = await storage.getPaymentMethods();
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
    return res.json({ success: true, data: normalized });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل طرق الدفع" });
  }
});

router.post("/payment-methods", requireAdmin, async (req, res) => {
  try {
    const paymentMethodSchema = z.object({
      name: z.string().min(1).max(100),
      nameAr: z.string().min(1).max(100),
      icon: z.string().max(10).default("💳"),
      type: z.string().min(1).max(60).default("manual"),
      usageTarget: z.enum(["deposit", "withdrawal", "both"]).default("both"),
      provider: z.string().max(100).optional(),
      countries: z.array(z.string()).optional(),
      minAmount: z.number().int().min(1).default(1),
      maxAmount: z.number().int().min(1).default(50000),
      fee: z.string().max(20).default("0"),
      instructions: z.string().max(2000).optional(),
      isActive: z.boolean().optional(),
    });
    const parsed = paymentMethodSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.issues[0]?.message || "بيانات غير صالحة" });
    const { name, nameAr, icon, type, usageTarget, provider, countries, minAmount, maxAmount, fee, instructions, isActive } = parsed.data;

    const pm = await storage.createPaymentMethod({
      name,
      nameAr,
      icon: icon || "💳",
      type,
      accountDetails: JSON.stringify({ provider: provider || "", countries: (countries || ["*"]).map((c) => String(c).toUpperCase()), fee: fee || "0", usageTarget }),
      minAmount: String(minAmount || 1),
      maxAmount: String(maxAmount || 50000),
      instructions: instructions || "",
      isActive: isActive ?? true,
    });

    await storage.addAdminLog(req.session.adminId!, "create_payment_method", "payment_method", pm?.id || "", `Created: ${name}`);

    emitFinanceUpdate("payment-methods-updated", { action: "created", id: pm?.id || null });
    io.emit("payment-methods-updated", { ts: Date.now() });

    return res.status(201).json({ success: true, data: pm });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في إنشاء طريقة الدفع" });
  }
});

router.patch("/payment-methods/:id", requireAdmin, async (req, res) => {
  try {
    const pm = await storage.getPaymentMethod(paramStr(req.params.id));
    if (!pm) return res.status(404).json({ success: false, message: "طريقة الدفع غير موجودة" });

    const allowed = ["name", "nameAr", "icon", "type", "isActive", "minAmount", "maxAmount", "instructions"];
    const updateData: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    const existingDetails = parsePaymentMethodDetails((pm as any).accountDetails);
    const nextDetails = {
      provider: req.body.provider !== undefined ? String(req.body.provider || "") : existingDetails.provider,
      countries: req.body.countries !== undefined
        ? (Array.isArray(req.body.countries) ? req.body.countries : ["*"]).map((c: unknown) => String(c || "").toUpperCase()).filter(Boolean)
        : existingDetails.countries,
      fee: req.body.fee !== undefined ? String(req.body.fee || "0") : existingDetails.fee,
      usageTarget: req.body.usageTarget === "deposit" || req.body.usageTarget === "withdrawal" || req.body.usageTarget === "both"
        ? req.body.usageTarget
        : existingDetails.usageTarget,
    };
    updateData.accountDetails = JSON.stringify({
      provider: nextDetails.provider,
      countries: nextDetails.countries.length ? nextDetails.countries : ["*"],
      fee: nextDetails.fee,
      usageTarget: nextDetails.usageTarget,
    });

    const updated = await storage.updatePaymentMethod(paramStr(req.params.id), updateData);
    if (!updated) return res.status(404).json({ success: false, message: "طريقة الدفع غير موجودة" });
    const details = parsePaymentMethodDetails((updated as any).accountDetails);
    emitFinanceUpdate("payment-methods-updated", { action: "updated", id: paramStr(req.params.id) });
    io.emit("payment-methods-updated", { ts: Date.now() });
    return res.json({
      success: true,
      data: { ...updated, provider: details.provider, countries: details.countries, fee: details.fee, usageTarget: details.usageTarget },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.delete("/payment-methods/:id", requireAdmin, async (req, res) => {
  try {
    const id = paramStr(req.params.id);
    await storage.deletePaymentMethod(id);
    emitFinanceUpdate("payment-methods-updated", { action: "deleted", id });
    io.emit("payment-methods-updated", { ts: Date.now() });
    return res.json({ success: true, message: "تم حذف طريقة الدفع" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// REPORTS — البلاغات والتقارير (DB-backed)
// ══════════════════════════════════════════════════════════

router.get("/reports", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || "";
    const type = (req.query.type as string) || "";

    const result = await storage.getReports(page, limit, {
      status: status || undefined,
      type: type || undefined,
    });

    return res.json({
      success: true,
      data: result.data,
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل البلاغات" });
  }
});

router.patch("/reports/:id", requireAdmin, async (req, res) => {
  try {
    const report = await storage.getReport(paramStr(req.params.id));
    if (!report) return res.status(404).json({ success: false, message: "البلاغ غير موجود" });

    const parsed = updateReportSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    const { status, adminNotes } = parsed.data;

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      updateData.reviewedBy = req.session.adminUsername;
      updateData.reviewedAt = new Date();
    }
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    const updated = await storage.updateReport(paramStr(req.params.id), updateData);

    await storage.addAdminLog(req.session.adminId!, "update_report", "report", paramStr(req.params.id), `Status → ${status}`);

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// SETTINGS — إعدادات النظام
// ══════════════════════════════════════════════════════════

router.get("/settings", requireAdmin, async (_req, res) => {
  try {
    const settings = await storage.getSettings();
    return res.json({ success: true, data: settings });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل الإعدادات" });
  }
});

router.patch("/settings", requireAdmin, async (req, res) => {
  try {
    const parsed = updateSettingSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const { key, value } = parsed.data;

    const setting = await storage.upsertSetting(key, value);

    await storage.addAdminLog(req.session.adminId!, "update_setting", "setting", key, `${key} = ${value}`);

    return res.json({ success: true, data: setting });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// ADVANCED SETTINGS — إعدادات متقدمة (DB-backed via systemConfig)
// ══════════════════════════════════════════════════════════

// Default advanced settings (used as fallback when DB is empty)
const defaultAdvancedSettings: Record<string, any> = {
  seo: {
    metaTitle: "Ablox — بث مباشر وهدايا",
    metaDescription: "Ablox — منصة البث المباشر العربية الأولى. شارك لحظاتك مع أصدقائك.",
    metaKeywords: "بث مباشر, هدايا افتراضية, دردشة, ترفيه, عرب",
    ogImage: "",
    canonicalUrl: "https://mrco.live",
    robotsTxt: "User-agent: *\nAllow: /\nSitemap: https://mrco.live/sitemap.xml",
    sitemapEnabled: true,
    googleAnalyticsId: "",
    googleSearchConsoleId: "",
  },
  aso: {
    appName: "Ablox - بث مباشر وهدايا",
    shortDescription: "بث مباشر وهدايا افتراضية",
    longDescription: "Ablox هي منصة البث المباشر العربية. شاهد بثوثاً مباشرة، أرسل هدايا، ودردش مع أصدقائك.",
    keywords: ["بث مباشر", "هدايا", "دردشة", "ترفيه", "تواصل اجتماعي"],
    category: "Social Networking",
    contentRating: "Teen",
    screenshots: [],
    promoVideo: "",
    supportUrl: "https://mrco.live/support",
    privacyUrl: "https://mrco.live/privacy",
  },
  socialLogin: {
    google: { enabled: true, clientId: "", clientSecret: "" },
    apple: { enabled: true, serviceId: "", teamId: "", keyId: "" },
    facebook: { enabled: false, appId: "", appSecret: "" },
    twitter: { enabled: false, apiKey: "", apiSecret: "" },
    tiktok: { enabled: false, clientKey: "", clientSecret: "" },
    snapchat: { enabled: false, clientId: "", clientSecret: "" },
    instagram: { enabled: false, appId: "", appSecret: "" },
    huawei: { enabled: false, appId: "", appSecret: "" },
  },
  otp: {
    provider: "email",
    enabled: true,
    gmail: {
      enabled: true,
      host: process.env.SMTP_HOST || "smtp.hostinger.com",
      port: parseInt(process.env.SMTP_PORT || "465"),
      username: process.env.SMTP_USER || "",
      password: process.env.SMTP_PASS || "",
      senderName: process.env.SMTP_SENDER_NAME || "Ablox",
      senderEmail: process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER || "",
    },
    sms: {
      enabled: false,
      provider: "twilio",
      phoneNumber: "",
      apiKey: "",
      apiSecret: "",
      senderId: "",
    },
    otpConfig: {
      codeLength: 6,
      expiryMinutes: 5,
      maxAttempts: 5,
      cooldownMinutes: 5,
    },
  },
  branding: {
    appNameEn: "Ablox",
    appNameAr: "Ablox",
    primaryColor: "#a855f7",
    secondaryColor: "#ec4899",
    logoUrl: "",
    faviconUrl: "",
    splashScreenUrl: "",
    darkModeDefault: true,
  },
  seoTexts: {
    homeTitle: "Ablox — بث مباشر وهدايا",
    homeDescription: "استمتعوا بأفضل تجربة بث مباشر عربية",
    aboutTitle: "عن Ablox",
    aboutDescription: "Ablox هي المنصة الأولى للبث المباشر في الوطن العربي",
    contactTitle: "تواصل معنا",
    contactDescription: "نسعد بتواصلكم معنا عبر قنواتنا المتاحة",
  },
  policies: {
    privacyPolicy: {
      title: "سياسة الخصوصية",
      content: "نحترم خصوصيتكم ونلتزم بحماية بياناتكم الشخصية...",
      lastUpdated: new Date().toISOString(),
    },
    termsOfService: {
      title: "شروط الاستخدام",
      content: "باستخدامك لتطبيق Ablox، فإنك توافق على الشروط والأحكام التالية...",
      lastUpdated: new Date().toISOString(),
    },
    communityGuidelines: {
      title: "إرشادات المجتمع",
      content: "نسعى لتوفير بيئة آمنة ومحترمة لجميع المستخدمين...",
      lastUpdated: new Date().toISOString(),
    },
    refundPolicy: {
      title: "سياسة الاسترجاع",
      content: "يمكن طلب استرجاع المبالغ خلال 14 يوماً من تاريخ الشراء...",
      lastUpdated: new Date().toISOString(),
    },
  },
  appDownload: {
    enabled: true,
    domain: "https://mrco.live",
    pwa: {
      enabled: true,
      url: "",
      extension: "/",
      description: "نسخة الويب — تعمل من المتصفح مباشرة بدون تحميل",
    },
    apk: {
      enabled: false,
      url: "",
      extension: "/download/ablox.apk",
      description: "ملف APK — للتثبيت المباشر على أجهزة أندرويد",
    },
    aab: {
      enabled: false,
      url: "",
      extension: "/download/ablox.aab",
      description: "ملف AAB — لرفعه على متجر جوجل بلاي",
    },
  },
};

/** Load a settings category from DB, falling back to defaults */
async function getAdvancedSettingsCategory(category: string): Promise<any> {
  try {
    const cfg = await storage.getSystemConfig(category);
    if (cfg && cfg.configData) {
      return typeof cfg.configData === "string" ? JSON.parse(cfg.configData) : cfg.configData;
    }
  } catch (err) {
    // Fall back to defaults
  }
  return defaultAdvancedSettings[category] || {};
}

/** Load ALL advanced settings from DB, merging with defaults */
async function getAllAdvancedSettings(): Promise<Record<string, any>> {
  const result: Record<string, any> = {};
  for (const category of Object.keys(defaultAdvancedSettings)) {
    result[category] = await getAdvancedSettingsCategory(category);
  }
  return result;
}

router.get("/settings/advanced", requireAdmin, async (_req, res) => {
  try {
    const settings = await getAllAdvancedSettings();

    // Strip sensitive credentials before sending to client
    const safe = JSON.parse(JSON.stringify(settings));
    // Mask social login secrets
    for (const provider of Object.keys(safe.socialLogin || {})) {
      const p = safe.socialLogin[provider];
      for (const key of Object.keys(p)) {
        if (key.toLowerCase().includes("secret") || key.toLowerCase().includes("token") || key.toLowerCase().includes("key")) {
          if (typeof p[key] === "string" && p[key].length > 0) {
            p[key] = p[key].slice(0, 4) + "••••••••";
          }
        }
      }
    }
    // Mask OTP/SMTP secrets
    if (safe.otp?.gmail) {
      if (safe.otp.gmail.password && safe.otp.gmail.password.length > 0) safe.otp.gmail.password = safe.otp.gmail.password.slice(0, 2) + "••••••••";
    }
    if (safe.otp?.sms) {
      if (safe.otp.sms.apiKey && safe.otp.sms.apiKey.length > 0) safe.otp.sms.apiKey = safe.otp.sms.apiKey.slice(0, 4) + "••••••••";
      if (safe.otp.sms.apiSecret && safe.otp.sms.apiSecret.length > 0) safe.otp.sms.apiSecret = safe.otp.sms.apiSecret.slice(0, 4) + "••••••••";
    }
    // Add SMTP status so admin sees whether email is working
    safe.smtpStatus = isSmtpConfigured() ? "connected" : "not_configured";
    return res.json({ success: true, data: safe });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل الإعدادات المتقدمة" });
  }
});

router.put("/settings/seo", requireAdmin, async (req, res) => {
  try {
    const current = await getAdvancedSettingsCategory("seo");
    const allowed = ["appTitle", "appDescription", "keywords", "ogImage", "twitterHandle", "canonicalUrl", "robots", "metaTitle", "metaDescription", "metaKeywords", "robotsTxt", "sitemapEnabled", "googleAnalyticsId", "googleSearchConsoleId"];
    for (const k of allowed) { if (req.body[k] !== undefined) current[k] = req.body[k]; }
    await storage.upsertSystemConfig("seo", current, req.session.adminId);
    await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "seo", "SEO settings updated");
    return res.json({ success: true, data: current });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.put("/settings/aso", requireAdmin, async (req, res) => {
  try {
    const current = await getAdvancedSettingsCategory("aso");
    const allowed = ["appStoreName", "appStoreSubtitle", "playStoreName", "playStoreShortDesc", "playStoreLongDesc", "category", "contentRating", "screenshots", "promoVideo", "supportUrl", "privacyUrl", "appName", "shortDescription", "longDescription", "keywords"];
    for (const k of allowed) { if (req.body[k] !== undefined) current[k] = req.body[k]; }
    await storage.upsertSystemConfig("aso", current, req.session.adminId);
    await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "aso", "ASO settings updated");
    return res.json({ success: true, data: current });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.put("/settings/social-login", requireAdmin, async (req, res) => {
  try {
    const current = await getAdvancedSettingsCategory("socialLogin");
    const { provider, ...data } = req.body;
    if (provider && current[provider]) {
      const allowed = ["enabled", "clientId", "clientSecret", "serviceId", "teamId", "keyId", "appId", "appSecret", "apiKey", "apiSecret", "clientKey"];
      for (const k of allowed) { if (data[k] !== undefined) current[provider][k] = data[k]; }
    }
    await storage.upsertSystemConfig("socialLogin", current, req.session.adminId);
    await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "social-login", `Provider: ${provider}`);
    return res.json({ success: true, data: current });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.put("/settings/otp", requireAdmin, async (req, res) => {
  try {
    const current = await getAdvancedSettingsCategory("otp");
    const { gmail, sms, otpConfig: otpCfg } = req.body;

    // Update gmail/SMTP settings
    if (gmail && typeof gmail === "object") {
      const gmailAllowed = ["enabled", "host", "port", "username", "password", "senderName", "senderEmail"];
      for (const k of gmailAllowed) {
        if (gmail[k] !== undefined) current.gmail[k] = gmail[k];
      }
      // Wire to email service
      if (current.gmail.enabled) {
        updateSmtpConfig({
          host: current.gmail.host,
          port: current.gmail.port,
          user: current.gmail.username,
          pass: current.gmail.password,
          senderName: current.gmail.senderName,
          senderEmail: current.gmail.senderEmail,
          secure: current.gmail.port === 465,
        });
      }
    }

    // Update SMS settings
    if (sms && typeof sms === "object") {
      const smsAllowed = ["enabled", "provider", "phoneNumber", "apiKey", "apiSecret", "senderId"];
      for (const k of smsAllowed) {
        if (sms[k] !== undefined) current.sms[k] = sms[k];
      }
    }

    // Update OTP config
    if (otpCfg && typeof otpCfg === "object") {
      const cfgAllowed = ["codeLength", "expiryMinutes", "maxAttempts", "cooldownMinutes"];
      for (const k of cfgAllowed) {
        if (otpCfg[k] !== undefined) current.otpConfig[k] = otpCfg[k];
      }
      // Wire to email service
      updateOtpConfig(current.otpConfig);
    }

    await storage.upsertSystemConfig("otp", current, req.session.adminId);
    await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "otp", "OTP settings updated");
    return res.json({ success: true, data: current });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.put("/settings/branding", requireAdmin, async (req, res) => {
  try {
    const current = await getAdvancedSettingsCategory("branding");
    const allowed = ["appNameEn", "appNameAr", "primaryColor", "secondaryColor", "logoUrl", "faviconUrl", "splashScreenUrl", "darkModeDefault"];
    for (const k of allowed) { if (req.body[k] !== undefined) current[k] = req.body[k]; }
    await storage.upsertSystemConfig("branding", current, req.session.adminId);
    await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "branding", "Branding updated");
    return res.json({ success: true, data: current });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.put("/settings/seo-texts", requireAdmin, async (req, res) => {
  try {
    const current = await getAdvancedSettingsCategory("seoTexts");
    const allowed = ["homeTitle", "homeDescription", "aboutTitle", "aboutDescription", "contactTitle", "contactDescription"];
    for (const k of allowed) { if (req.body[k] !== undefined) current[k] = req.body[k]; }
    await storage.upsertSystemConfig("seoTexts", current, req.session.adminId);
    await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "seo-texts", "SEO texts updated");
    return res.json({ success: true, data: current });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.put("/settings/policies", requireAdmin, async (req, res) => {
  try {
    const current = await getAdvancedSettingsCategory("policies");
    const { documentKey, ...data } = req.body;
    if (documentKey && current[documentKey]) {
      const allowed = ["title", "content"];
      for (const k of allowed) { if (data[k] !== undefined) current[documentKey][k] = data[k]; }
      current[documentKey].lastUpdated = new Date().toISOString();
    }
    await storage.upsertSystemConfig("policies", current, req.session.adminId);
    await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "policies", `Document: ${documentKey}`);
    return res.json({ success: true, data: current });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.put("/settings/app-download", requireAdmin, async (req, res) => {
  try {
    const current = await getAdvancedSettingsCategory("appDownload");
    const { enabled, domain, pwa, apk, aab } = req.body;
    if (typeof enabled === "boolean") current.enabled = enabled;
    if (typeof domain === "string") current.domain = domain;
    for (const key of ["pwa", "apk", "aab"] as const) {
      const incoming = req.body[key];
      if (incoming && typeof incoming === "object") {
        if (!current[key]) current[key] = {};
        if (typeof incoming.enabled === "boolean") current[key].enabled = incoming.enabled;
        if (typeof incoming.url === "string") current[key].url = incoming.url;
        if (typeof incoming.extension === "string") current[key].extension = incoming.extension;
        if (typeof incoming.description === "string") current[key].description = incoming.description;
      }
    }
    await storage.upsertSystemConfig("appDownload", current, req.session.adminId);
    await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "app-download", "App download settings updated");
    return res.json({ success: true, data: current });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// FEATURED STREAMS — البثوث المميزة (DB-backed)
// ══════════════════════════════════════════════════════════

router.get("/featured-streams", requireAdmin, async (_req, res) => {
  try {
    const streams = await storage.getAllFeaturedStreams();
    return res.json({ success: true, data: streams });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل البثوث المميزة" });
  }
});

router.post("/featured-streams", requireAdmin, async (req, res) => {
  try {
    const { streamerName, title, image, streamId } = req.body;

    const featured = await storage.createFeaturedStream({
      streamerName: streamerName || "—",
      title: title || "بث مميز",
      image: image || "",
      streamId: streamId || null,
      isActive: true,
    });

    await storage.addAdminLog(req.session.adminId!, "create_featured_stream", "featured_stream", featured?.id || "", `Created featured stream`);

    return res.status(201).json({ success: true, data: featured });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في إنشاء البث المميز" });
  }
});

router.patch("/featured-streams/:id", requireAdmin, async (req, res) => {
  try {
    const allowed = ["title", "titleAr", "streamerName", "image", "streamId", "isActive", "sortOrder", "viewerCount", "isLive"];
    const updateData: any = {};
    for (const key of allowed) {
      if (req.body[key] !== undefined) updateData[key] = req.body[key];
    }

    const updated = await storage.updateFeaturedStream(paramStr(req.params.id), updateData);
    if (!updated) return res.status(404).json({ success: false, message: "البث المميز غير موجود" });

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.delete("/featured-streams/:id", requireAdmin, async (req, res) => {
  try {
    await storage.deleteFeaturedStream(paramStr(req.params.id));
    return res.json({ success: true, message: "تم إزالة البث المميز" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.put("/featured-streams/reorder", requireAdmin, async (req, res) => {
  try {
    const { order } = req.body; // [{ id, sortOrder }]
    if (!Array.isArray(order)) return res.status(400).json({ success: false, message: "ترتيب غير صالح" });

    const orderedIds = order.sort((a: any, b: any) => a.sortOrder - b.sortOrder).map((item: any) => item.id);
    await storage.reorderFeaturedStreams(orderedIds);

    return res.json({ success: true, message: "تم إعادة الترتيب" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// ANNOUNCEMENT POPUP — الإشعار المنبثق (DB-backed)
// ══════════════════════════════════════════════════════════

router.get("/announcement-popup", requireAdmin, async (_req, res) => {
  try {
    const popup = await storage.getAnnouncementPopup();
    if (!popup) {
      // Return a default empty popup
      return res.json({
        success: true,
        data: {
          enabled: false,
          imageUrl: "",
          title: "",
          subtitle: "",
          buttons: [],
          showOnce: true,
          delaySeconds: 8,
        },
      });
    }
    // Parse JSON fields if stored as strings
    const data = {
      ...popup,
      buttons: typeof popup.buttons === "string" ? JSON.parse(popup.buttons) : popup.buttons,
    };
    return res.json({ success: true, data });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل الإشعار" });
  }
});

router.put("/announcement-popup", requireAdmin, async (req, res) => {
  try {
    const parsed = announcementPopupSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });

    const updated = await storage.upsertAnnouncementPopup({
      enabled: parsed.data.enabled,
      imageUrl: parsed.data.imageUrl || "",
      title: parsed.data.title || "",
      subtitle: parsed.data.subtitle || "",
      buttons: JSON.stringify(parsed.data.buttons || []),
      showOnce: parsed.data.showOnce,
      delaySeconds: parsed.data.delaySeconds,
    });

    await storage.addAdminLog(req.session.adminId!, "update_announcement_popup", "setting", "popup", JSON.stringify(req.body));

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// FRAUD DETECTION — كشف الاحتيال (DB-backed)
// ══════════════════════════════════════════════════════════

router.get("/fraud/stats", requireAdmin, async (_req, res) => {
  try {
    const stats = await storage.getFraudStats();
    return res.json({ success: true, data: stats });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل الإحصائيات" });
  }
});

router.get("/fraud/alerts", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || "";
    const severity = (req.query.severity as string) || "";

    const result = await storage.getFraudAlerts(page, limit, {
      status: status || undefined,
      severity: severity || undefined,
    });

    return res.json({
      success: true,
      data: result.data,
      pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل التنبيهات" });
  }
});

router.get("/fraud/alerts/:id", requireAdmin, async (req, res) => {
  try {
    const alert = await storage.getFraudAlert(paramStr(req.params.id));
    if (!alert) return res.status(404).json({ success: false, message: "التنبيه غير موجود" });
    return res.json({ success: true, data: alert });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.patch("/fraud/alerts/:id", requireAdmin, async (req, res) => {
  try {
    const alert = await storage.getFraudAlert(paramStr(req.params.id));
    if (!alert) return res.status(404).json({ success: false, message: "التنبيه غير موجود" });

    const parsed = fraudAlertUpdateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    const { status, adminNotes } = parsed.data;

    const updateData: any = {};
    if (status) {
      updateData.status = status;
      if (status === "resolved") {
        updateData.reviewedAt = new Date();
        updateData.reviewedBy = req.session.adminUsername;
      }
    }
    if (adminNotes !== undefined) updateData.adminNotes = adminNotes;

    const updated = await storage.updateFraudAlert(paramStr(req.params.id), updateData);

    await storage.addAdminLog(req.session.adminId!, "update_fraud_alert", "fraud", paramStr(req.params.id), `Status → ${status}`);

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.post("/fraud/alerts/:id/ban-user", requireAdmin, async (req, res) => {
  try {
    const alert = await storage.getFraudAlert(paramStr(req.params.id));
    if (!alert) return res.status(404).json({ success: false, message: "التنبيه غير موجود" });

    // Ban the user in DB
    if (alert.userId) {
      await storage.updateUser(alert.userId, { isBanned: true, banReason: `حظر بسبب: ${alert.type}` } as any);
    }

    const updated = await storage.updateFraudAlert(paramStr(req.params.id), {
      status: "resolved",
      reviewedAt: new Date(),
      reviewedBy: req.session.adminUsername,
      adminNotes: ((alert.adminNotes as string) || "") + "\n✅ تم حظر المستخدم",
    });

    await storage.addAdminLog(req.session.adminId!, "fraud_ban_user", "fraud", paramStr(req.params.id), `Banned user: ${alert.userId}`);

    return res.json({ success: true, data: updated, message: "تم حظر المستخدم" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.post("/fraud/alerts/:id/suspend-agent", requireAdmin, async (req, res) => {
  try {
    const alert = await storage.getFraudAlert(paramStr(req.params.id));
    if (!alert) return res.status(404).json({ success: false, message: "التنبيه غير موجود" });

    const updated = await storage.updateFraudAlert(paramStr(req.params.id), {
      status: "resolved",
      reviewedAt: new Date(),
      reviewedBy: req.session.adminUsername,
      adminNotes: ((alert.adminNotes as string) || "") + "\n✅ تم إيقاف الوكيل",
    });

    await storage.addAdminLog(req.session.adminId!, "fraud_suspend_agent", "fraud", paramStr(req.params.id), "Agent suspended");

    return res.json({ success: true, data: updated, message: "تم إيقاف الوكيل" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// ADMIN LOGS — سجل العمليات
// ══════════════════════════════════════════════════════════

router.get("/logs", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;

    const result = await storage.getAdminLogs(page, limit);

    return res.json({
      success: true,
      data: result.data,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل السجلات" });
  }
});

// ══════════════════════════════════════════════════════════
// UPGRADE REQUESTS — طلبات الترقية
// ══════════════════════════════════════════════════════════

// List all upgrade requests (paginated, with filters)
router.get("/upgrade-requests", requireAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = (req.query.status as string) || undefined;
    const userId = (req.query.userId as string) || undefined;

    const result = await storage.getUpgradeRequestsPaginated(page, limit, { status, userId });

    // Fetch user info for each request
    const enriched = await Promise.all(
      result.data.map(async (req: any) => {
        const user = await storage.getUser(req.userId);
        return {
          ...req,
          user: user ? {
            id: user.id,
            username: user.username,
            displayName: user.displayName,
            avatar: user.avatar,
            level: user.level,
            xp: user.xp,
            isVerified: user.isVerified,
          } : null,
        };
      })
    );

    return res.json({
      success: true,
      data: enriched,
      pagination: {
        page,
        limit,
        total: result.total,
        totalPages: Math.ceil(result.total / limit),
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في تحميل طلبات الترقية" });
  }
});

// Get pending upgrade requests count
router.get("/upgrade-requests/pending-count", requireAdmin, async (req, res) => {
  try {
    const count = await storage.getPendingUpgradeRequestsCount();
    return res.json({ success: true, count });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// Get upgrade requests for a specific user
router.get("/users/:id/upgrade-requests", requireAdmin, async (req, res) => {
  try {
    const requests = await storage.getUpgradeRequestsByUser(paramStr(req.params.id));
    return res.json({ success: true, data: requests });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// Review (approve/reject) an upgrade request
router.post("/upgrade-requests/:id/review", requireAdmin, async (req, res) => {
  try {
    const parsed = reviewUpgradeRequestSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const request = await storage.getUpgradeRequest(paramStr(req.params.id));
    if (!request) return res.status(404).json({ success: false, message: "الطلب غير موجود" });
    if (request.status !== "pending") return res.status(400).json({ success: false, message: "تم مراجعة هذا الطلب بالفعل" });

    const updated = await storage.reviewUpgradeRequest(
      paramStr(req.params.id),
      parsed.data.status,
      req.session.adminId!,
      parsed.data.adminNotes
    );

    // If approved, update user level
    if (parsed.data.status === "approved" && request) {
      await storage.updateUser(request.userId, { level: request.requestedLevel });
    }

    await storage.addAdminLog(
      req.session.adminId!,
      `upgrade_${parsed.data.status}`,
      "upgrade_request",
      paramStr(req.params.id),
      JSON.stringify({ userId: request.userId, from: request.currentLevel, to: request.requestedLevel })
    );

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// MILES PRICING — تسعير الأميال
// ══════════════════════════════════════════════════════════

router.put("/settings/miles-pricing", requireAdmin, async (req, res) => {
  try {
    const parsed = milesPricingSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    const { costPerMile, packages } = parsed.data;
    await storage.upsertSetting("miles_cost_per_mile", String(costPerMile || 5), "pricing", "Cost per mile in coins");
    await storage.upsertSetting("miles_packages", JSON.stringify(packages || []), "pricing", "Mile purchase packages");
    await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "miles-pricing", `Cost per mile: ${costPerMile}, ${(packages || []).length} packages`);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// Admin direct level change for a user
router.post("/users/:id/set-level", requireAdmin, async (req, res) => {
  try {
    const { level } = req.body;
    if (!level || typeof level !== "number" || level < 1 || level > 55) {
      return res.status(400).json({ success: false, message: "المستوى يجب أن يكون بين 1 و 55" });
    }

    const user = await storage.getUser(paramStr(req.params.id));
    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });

    const updated = await storage.updateUser(paramStr(req.params.id), { level });

    await storage.addAdminLog(
      req.session.adminId!,
      "set_user_level",
      "user",
      paramStr(req.params.id),
      JSON.stringify({ from: user.level, to: level })
    );

    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// CURRENCIES / PRICING — إدارة العملات والأسعار
// ══════════════════════════════════════════════════════════

// Get all pricing data (unified)
router.get("/pricing/all", requireAdmin, async (_req, res) => {
  try {
    const pricing = await getAllPricing();
    const stats = await getQueueStats();
    return res.json({ success: true, data: { ...pricing, matchingStats: stats } });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في جلب الأسعار" });
  }
});

// ── Coin Packages CRUD ──

// List all coin packages
router.get("/pricing/coin-packages", requireAdmin, async (_req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "خطأ" });
    const packages = await db.select().from(schema.coinPackages).orderBy(asc(schema.coinPackages.sortOrder));
    return res.json({ success: true, data: packages });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// Create coin package
router.post("/pricing/coin-packages", requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "خطأ" });
    const { coins, bonusCoins, priceUsd, isPopular, sortOrder } = req.body;
    if (!coins || !priceUsd) return res.status(400).json({ success: false, message: "بيانات ناقصة" });
    const [pkg] = await db.insert(schema.coinPackages).values({
      coins: parseInt(coins),
      bonusCoins: parseInt(bonusCoins || 0),
      priceUsd: String(priceUsd),
      isPopular: !!isPopular,
      isActive: true,
      sortOrder: parseInt(sortOrder || 0),
    }).returning();
    await invalidatePricingCache();
    await storage.addAdminLog(req.session.adminId!, "create_coin_package", "coin_package", pkg.id, `${coins} coins @ $${priceUsd}`);
    return res.json({ success: true, data: pkg });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// Update coin package
router.patch("/pricing/coin-packages/:id", requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "خطأ" });
    const id = paramStr(req.params.id);
    const { coins, bonusCoins, priceUsd, isPopular, isActive, sortOrder } = req.body;
    const updates: any = {};
    if (coins !== undefined) updates.coins = parseInt(coins);
    if (bonusCoins !== undefined) updates.bonusCoins = parseInt(bonusCoins);
    if (priceUsd !== undefined) updates.priceUsd = String(priceUsd);
    if (isPopular !== undefined) updates.isPopular = !!isPopular;
    if (isActive !== undefined) updates.isActive = !!isActive;
    if (sortOrder !== undefined) updates.sortOrder = parseInt(sortOrder);
    const [updated] = await db.update(schema.coinPackages).set(updates).where(eq(schema.coinPackages.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, message: "غير موجود" });
    await invalidatePricingCache();
    await storage.addAdminLog(req.session.adminId!, "update_coin_package", "coin_package", id, JSON.stringify(updates));
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// Delete coin package
router.delete("/pricing/coin-packages/:id", requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "خطأ" });
    const id = paramStr(req.params.id);
    await db.delete(schema.coinPackages).where(eq(schema.coinPackages.id, id));
    await invalidatePricingCache();
    await storage.addAdminLog(req.session.adminId!, "delete_coin_package", "coin_package", id, "deleted");
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── Call Rates ──

// Update call rates
router.put("/pricing/call-rates", requireAdmin, async (req, res) => {
  try {
    const { voiceCallRate, videoCallRate } = req.body;
    if (voiceCallRate !== undefined) {
      await storage.upsertSetting("voice_call_rate", String(voiceCallRate), "pricing", "Voice call rate (coins/min)");
    }
    if (videoCallRate !== undefined) {
      await storage.upsertSetting("video_call_rate", String(videoCallRate), "pricing", "Video call rate (coins/min)");
    }
    await invalidatePricingCache();
    await storage.addAdminLog(req.session.adminId!, "update_call_rates", "setting", "call-rates", `voice: ${voiceCallRate}, video: ${videoCallRate}`);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── Filter Pricing (World/Random) ──

// Get filter pricing
router.get("/pricing/filters", requireAdmin, async (_req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "خطأ" });
    const pricing = await db.select().from(schema.worldPricing).orderBy(asc(schema.worldPricing.filterType));
    return res.json({ success: true, data: pricing });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// Update filter pricing (single)
router.patch("/pricing/filters/:id", requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "خطأ" });
    const id = paramStr(req.params.id);
    const { priceCoins, isActive, description, descriptionAr } = req.body;
    const updates: any = { updatedAt: new Date() };
    if (priceCoins !== undefined) updates.priceCoins = parseInt(priceCoins);
    if (isActive !== undefined) updates.isActive = !!isActive;
    if (description !== undefined) updates.description = description;
    if (descriptionAr !== undefined) updates.descriptionAr = descriptionAr;
    const [updated] = await db.update(schema.worldPricing).set(updates).where(eq(schema.worldPricing.id, id)).returning();
    if (!updated) return res.status(404).json({ success: false, message: "غير موجود" });
    await invalidatePricingCache();
    await storage.addAdminLog(req.session.adminId!, "update_filter_pricing", "world_pricing", id, JSON.stringify(updates));
    return res.json({ success: true, data: updated });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// Bulk update filter pricing
router.put("/pricing/filters", requireAdmin, async (req, res) => {
  try {
    const db = getDb();
    if (!db) return res.status(500).json({ success: false, message: "خطأ" });
    const { prices } = req.body;
    if (!Array.isArray(prices)) return res.status(400).json({ success: false, message: "بيانات غير صحيحة" });
    for (const p of prices) {
      await db.update(schema.worldPricing)
        .set({ priceCoins: parseInt(p.priceCoins), updatedAt: new Date() })
        .where(eq(schema.worldPricing.filterType, p.filterType));
    }
    await invalidatePricingCache();
    await storage.addAdminLog(req.session.adminId!, "bulk_update_filter_pricing", "world_pricing", "bulk", `${prices.length} filters updated`);
    const allPricing = await db.select().from(schema.worldPricing).orderBy(asc(schema.worldPricing.filterType));
    return res.json({ success: true, data: allPricing });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── Message Costs ──

// Update message/chat costs
router.put("/pricing/message-costs", requireAdmin, async (req, res) => {
  try {
    const { messageCost, mediaEnabled, voiceCallEnabled, videoCallEnabled, timeLimit } = req.body;
    if (messageCost !== undefined) {
      await storage.upsertSetting("chat_message_cost", String(messageCost), "pricing", "Message cost (coins)");
    }
    if (mediaEnabled !== undefined) {
      await storage.upsertSetting("chat_media_enabled", String(!!mediaEnabled), "chat", "Enable media messages");
    }
    if (voiceCallEnabled !== undefined) {
      await storage.upsertSetting("chat_voice_call_enabled", String(!!voiceCallEnabled), "chat", "Enable voice calls");
    }
    if (videoCallEnabled !== undefined) {
      await storage.upsertSetting("chat_video_call_enabled", String(!!videoCallEnabled), "chat", "Enable video calls");
    }
    if (timeLimit !== undefined) {
      await storage.upsertSetting("chat_time_limit", String(timeLimit), "chat", "Chat time limit (minutes, 0 = unlimited)");
    }
    await invalidatePricingCache();
    await storage.addAdminLog(req.session.adminId!, "update_message_costs", "setting", "message-costs",
      `msg: ${messageCost}, media: ${mediaEnabled}, voice: ${voiceCallEnabled}, video: ${videoCallEnabled}, limit: ${timeLimit}`);
    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

export default router;
