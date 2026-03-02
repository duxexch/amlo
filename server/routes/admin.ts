/**
 * Admin Panel API Routes — لوحة التحكم الرئيسية
 * =================================================
 * Hybrid approach: DB-backed for core tables + in-memory mock for complex structures.
 *
 * DB-backed: admins, users, agents, gifts, giftTransactions, walletTransactions,
 *            userReports, systemSettings, adminLogs, coinPackages, streams
 * In-memory: agentApplications, agentAccounts, vipAgents, paymentMethods,
 *            featuredStreams, announcementPopup, fraudAlerts, transactions (mock)
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

const router = Router();

/** Type-safe param extraction (Express 5 types params as string | string[]) */
function paramStr(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : val || "";
}

/** Strip sensitive fields (passwordHash, etc.) from DB objects before sending to client */
function stripSensitive<T extends Record<string, any>>(obj: T): Omit<T, 'passwordHash'> {
  const { passwordHash, ...safe } = obj;
  return safe;
}

// ══════════════════════════════════════════════════════════
// IN-MEMORY MOCK DATA (features without dedicated DB tables)
// ══════════════════════════════════════════════════════════

// ── Agent Applications (طلبات الانضمام كوكيل) ──
export const mockAgentApplications: any[] = [
  {
    id: "app-001",
    referralCode: "",
    fullName: "خالد المنصور",
    email: "khalid@example.com",
    phone: "+966512345678",
    bio: "مسوّق رقمي ذو خبرة 5 سنوات",
    photoUrl: "",
    socialMedia: { whatsapp: "+966512345678", telegram: "@khalid_m", instagram: "@khalid_marketing", twitter: "" },
    accountType: "agent" as const,
    status: "pending" as const,
    adminNotes: "",
    createdAt: new Date(Date.now() - 86400000 * 2),
  },
  {
    id: "app-002",
    referralCode: "AGENT-AFQ-001",
    fullName: "نورة الشمري",
    email: "noura@example.com",
    phone: "+966555123456",
    bio: "صانعة محتوى ومؤثرة بمليون متابع",
    photoUrl: "",
    socialMedia: { whatsapp: "", telegram: "@noura_star", instagram: "@noura_star", twitter: "@noura_star" },
    accountType: "marketer" as const,
    status: "pending" as const,
    adminNotes: "",
    createdAt: new Date(Date.now() - 86400000),
  },
  {
    id: "app-003",
    referralCode: "",
    fullName: "عبدالله الراشد",
    email: "abd@example.com",
    phone: "+966501112222",
    bio: "وكيل توزيع في الخليج",
    photoUrl: "",
    socialMedia: { whatsapp: "+966501112222", telegram: "", instagram: "", twitter: "" },
    accountType: "both" as const,
    status: "approved" as const,
    adminNotes: "تمت الموافقة — كبير الوكلاء",
    createdAt: new Date(Date.now() - 86400000 * 5),
  },
];

// ── Agent Accounts (حسابات الوكلاء) ──
// NOTE: passwordHash fields are populated at startup via initMockAccountHashes()
export const mockAgentAccounts: any[] = [
  {
    id: "acc-001",
    agentId: "", // will be linked later
    agentName: "شركة الأفق للتسويق",
    username: "horizon_live",
    displayName: "أفق لايف",
    email: "horizon.live@ablox.app",
    passwordHash: "__pending__",
    referralCode: "ACC-HORIZON01",
    type: "broadcast",
    status: "active" as const,
    features: ["بث مباشر", "بيع منتجات", "إرسال رصيد"],
    commissionRate: "12",
    discount: "15",
    totalSales: 245,
    totalRevenue: "12500",
    coinsEarned: 75000,
    broadcastHours: 320,
    activeCustomers: 1250,
    balanceSent: "8400",
    createdAt: new Date(Date.now() - 86400000 * 30),
  },
  {
    id: "acc-002",
    agentId: "",
    agentName: "وكالة النجوم",
    username: "stars_broadcast",
    displayName: "نجوم البث",
    email: "stars@ablox.app",
    passwordHash: "__pending__",
    referralCode: "ACC-STARS01",
    type: "broadcast",
    status: "active" as const,
    features: ["بث مباشر", "إرسال رصيد"],
    commissionRate: "10",
    discount: "20",
    totalSales: 180,
    totalRevenue: "9200",
    coinsEarned: 54000,
    broadcastHours: 210,
    activeCustomers: 840,
    balanceSent: "5600",
    createdAt: new Date(Date.now() - 86400000 * 25),
  },
  {
    id: "acc-003",
    agentId: "",
    agentName: "الوسيط الماسي",
    username: "diamond_promo",
    displayName: "الماسي بروموشن",
    email: "diamond@ablox.app",
    passwordHash: "__pending__",
    referralCode: "ACC-DIAMOND01",
    type: "promo",
    status: "active" as const,
    features: ["بيع منتجات", "إرسال رصيد"],
    commissionRate: "8",
    discount: "10",
    totalSales: 120,
    totalRevenue: "6800",
    coinsEarned: 38000,
    broadcastHours: 0,
    activeCustomers: 430,
    balanceSent: "3200",
    createdAt: new Date(Date.now() - 86400000 * 20),
  },
  {
    id: "acc-004",
    agentId: "",
    agentName: "شركة الأفق للتسويق",
    username: "horizon_promo",
    displayName: "أفق بروموشن",
    email: "horizon.promo@ablox.app",
    passwordHash: "__pending__",
    referralCode: "ACC-HORIZON02",
    type: "promo",
    status: "pending" as const,
    features: ["بيع منتجات"],
    commissionRate: "10",
    discount: "20",
    totalSales: 0,
    totalRevenue: "0",
    coinsEarned: 0,
    broadcastHours: 0,
    activeCustomers: 0,
    balanceSent: "0",
    createdAt: new Date(Date.now() - 86400000 * 3),
  },
];

// Hash mock account passwords at startup (async, replaces __pending__ placeholders)
const _mockPasswords: Record<string, string> = { "acc-001": "HL@2026x", "acc-002": "ST@2026x", "acc-003": "DM@2026x", "acc-004": "HP@2026x" };
export async function initMockAccountHashes(): Promise<void> {
  for (const acc of mockAgentAccounts) {
    const plain = _mockPasswords[acc.id];
    if (plain && acc.passwordHash === "__pending__") {
      acc.passwordHash = await hashPasswordAsync(plain);
    }
  }
}

// ── VIP Agents (وكلاء VIP) ──
const mockVipAgents: any[] = [
  {
    id: "vip-001",
    name: "حسين الكبير VIP",
    email: "hussein.vip@ablox.app",
    phone: "+966500001111",
    tier: "platinum",
    commissionRate: "18",
    referralCode: "VIP-HUSSEIN",
    totalUsers: 2500,
    totalRevenue: "125000",
    balance: "25000",
    monthlyTarget: "50000",
    achievedTarget: "38000",
    status: "active" as const,
    specialPerks: ["عمولة مرتفعة", "دعم مخصص 24/7", "تقارير مفصلة", "أولوية في الميزات"],
    createdAt: new Date(Date.now() - 86400000 * 90),
  },
  {
    id: "vip-002",
    name: "لمى الذهبية VIP",
    email: "lama.vip@ablox.app",
    phone: "+966500002222",
    tier: "gold",
    commissionRate: "15",
    referralCode: "VIP-LAMA",
    totalUsers: 1200,
    totalRevenue: "68000",
    balance: "12000",
    monthlyTarget: "30000",
    achievedTarget: "22000",
    status: "active" as const,
    specialPerks: ["عمولة مرتفعة", "دعم مخصص", "تقارير أسبوعية"],
    createdAt: new Date(Date.now() - 86400000 * 60),
  },
];

// ── Featured Streams (البثوث المميزة) ──
export const mockFeaturedStreams: any[] = [
  {
    id: "feat-001",
    accountId: "acc-001",
    username: "horizon_live",
    displayName: "أفق لايف",
    avatar: null,
    title: "سهرة موسيقية 🎵",
    tags: ["موسيقى", "ترفيه"],
    viewers: 1205,
    isActive: true,
    sortOrder: 1,
    addedAt: new Date(Date.now() - 3600000),
  },
  {
    id: "feat-002",
    accountId: "acc-002",
    username: "stars_broadcast",
    displayName: "نجوم البث",
    avatar: null,
    title: "حفلة دي جي 🎧",
    tags: ["موسيقى", "حفلة"],
    viewers: 3400,
    isActive: true,
    sortOrder: 2,
    addedAt: new Date(Date.now() - 7200000),
  },
  {
    id: "feat-003",
    accountId: "acc-003",
    username: "diamond_promo",
    displayName: "الماسي بروموشن",
    avatar: null,
    title: "عروض حصرية 🔥",
    tags: ["عروض", "تسوق"],
    viewers: 450,
    isActive: true,
    sortOrder: 3,
    addedAt: new Date(Date.now() - 1800000),
  },
];

// ── Announcement Popup (الإشعار المنبثق) ──
export const mockAnnouncementPopup: any = {
  enabled: true,
  imageUrl: "",
  title: "🎉 مرحباً بكم في Ablox!",
  subtitle: "استمتعوا بالبث المباشر والهدايا الافتراضية مع أصدقائكم",
  buttons: [
    { label: "ابدأ البث الآن", url: "/room", style: "primary" },
    { label: "اكتشف المزيد", url: "/wallet", style: "secondary" },
  ],
  showOnce: true,
  delaySeconds: 8,
};

// ── Payment Methods (طرق الدفع) ──
const mockPaymentMethods: any[] = [
  { id: "pm-001", name: "Apple Pay", nameAr: "آبل باي", icon: "🍎", type: "wallet", provider: "apple", countries: ["SA", "AE", "KW", "BH", "QA", "OM"], minAmount: 1, maxAmount: 5000, fee: "0", instructions: "", isActive: true, sortOrder: 1 },
  { id: "pm-002", name: "Google Pay", nameAr: "جوجل باي", icon: "🔵", type: "wallet", provider: "google", countries: ["SA", "AE", "EG", "JO"], minAmount: 1, maxAmount: 5000, fee: "0", instructions: "", isActive: true, sortOrder: 2 },
  { id: "pm-003", name: "STC Pay", nameAr: "اس تي سي باي", icon: "💜", type: "wallet", provider: "stcpay", countries: ["SA"], minAmount: 5, maxAmount: 10000, fee: "1.5%", instructions: "ادخل رقم جوالك المرتبط بـ STC Pay", isActive: true, sortOrder: 3 },
  { id: "pm-004", name: "Credit Card", nameAr: "بطاقة ائتمان", icon: "💳", type: "card", provider: "stripe", countries: ["*"], minAmount: 1, maxAmount: 50000, fee: "2.9% + $0.30", instructions: "", isActive: true, sortOrder: 4 },
  { id: "pm-005", name: "PayPal", nameAr: "باي بال", icon: "🅿️", type: "wallet", provider: "paypal", countries: ["*"], minAmount: 5, maxAmount: 10000, fee: "3.4% + $0.49", instructions: "", isActive: true, sortOrder: 5 },
  { id: "pm-006", name: "Bank Transfer", nameAr: "تحويل بنكي", icon: "🏦", type: "bank", provider: "manual", countries: ["SA", "AE", "EG"], minAmount: 50, maxAmount: 100000, fee: "0", instructions: "IBAN: SA8220000001234567891234\nBank: الراجحي", isActive: true, sortOrder: 6 },
];

// ── Fraud Alerts (تنبيهات الاحتيال) ──
const mockFraudAlerts: any[] = [
  {
    id: "fraud-001",
    userId: "usr-temp-001",
    username: "suspicious_user1",
    displayName: "مستخدم مشبوه 1",
    type: "multiple_accounts",
    severity: "high",
    category: "account",
    description: "تم اكتشاف 5 حسابات مختلفة من نفس الـ IP خلال 24 ساعة",
    evidence: ["IP: 192.168.1.100", "Device fingerprint متطابق", "أنماط استخدام متشابهة"],
    status: "pending" as const,
    adminNotes: "",
    detectedAt: new Date(Date.now() - 3600000),
    resolvedAt: null,
    resolvedBy: null,
  },
  {
    id: "fraud-002",
    userId: "usr-temp-002",
    username: "coin_washer",
    displayName: "غسيل كوينز",
    type: "coin_laundering",
    severity: "critical",
    category: "financial",
    description: "تحويلات دائرية بين 3 حسابات بقيمة 500,000 كوين خلال ساعة",
    evidence: ["الحسابات: acc-x1, acc-x2, acc-x3", "مبلغ التحويل: 500,000 كوين", "نمط: A→B→C→A"],
    status: "investigating" as const,
    adminNotes: "جاري التحقيق مع فريق مكافحة الاحتيال",
    detectedAt: new Date(Date.now() - 7200000),
    resolvedAt: null,
    resolvedBy: null,
  },
  {
    id: "fraud-003",
    userId: "usr-temp-003",
    username: "chargebacker",
    displayName: "مسترجع المبالغ",
    type: "chargeback",
    severity: "medium",
    category: "financial",
    description: "طلب استرجاع 3 عمليات شراء بعد استهلاك الكوينز",
    evidence: ["Transaction IDs: tx-001, tx-002, tx-003", "إجمالي المبالغ: $150", "الكوينز مستهلكة بالكامل"],
    status: "resolved" as const,
    adminNotes: "تم حظر الحساب واسترداد الكوينز",
    detectedAt: new Date(Date.now() - 86400000 * 3),
    resolvedAt: new Date(Date.now() - 86400000 * 2),
    resolvedBy: "admin",
  },
  {
    id: "fraud-004",
    userId: "",
    username: "",
    displayName: "وكيل مشبوه",
    type: "agent_abuse",
    severity: "high",
    category: "agent",
    description: "وكيل يقوم بإنشاء حسابات وهمية لزيادة عمولته",
    evidence: ["50 حساب جديد في يوم واحد", "جميعها من نفس الـ IP range", "لا يوجد نشاط حقيقي"],
    status: "pending" as const,
    adminNotes: "",
    detectedAt: new Date(Date.now() - 43200000),
    resolvedAt: null,
    resolvedBy: null,
  },
];

// ── Mock Transactions (معاملات وهمية حتى يتم ربطها بالـ DB) ──
const mockTransactions: any[] = [
  { id: "tx-001", userId: "usr-001", username: "sara_ahmed", displayName: "سارة أحمد", type: "purchase", amount: 1000, currency: "coins", status: "completed", paymentMethod: "Apple Pay", description: "شراء 1000 كوين", adminNotes: "", createdAt: new Date(Date.now() - 3600000) },
  { id: "tx-002", userId: "usr-002", username: "ahmed_ali", displayName: "أحمد علي", type: "gift_sent", amount: 500, currency: "coins", status: "completed", paymentMethod: "", description: "إرسال هدية ماسة 💎", adminNotes: "", createdAt: new Date(Date.now() - 7200000) },
  { id: "tx-003", userId: "usr-003", username: "layla_star", displayName: "ليلى النجم", type: "withdrawal", amount: 200, currency: "usd", status: "pending", paymentMethod: "Bank Transfer", description: "طلب سحب $200", adminNotes: "", createdAt: new Date(Date.now() - 14400000) },
  { id: "tx-004", userId: "usr-004", username: "tariq_pro", displayName: "طارق المحترف", type: "purchase", amount: 5000, currency: "coins", status: "completed", paymentMethod: "STC Pay", description: "شراء 5000 كوين + 1500 بونص", adminNotes: "", createdAt: new Date(Date.now() - 28800000) },
  { id: "tx-005", userId: "usr-005", username: "nader_live", displayName: "نادر لايف", type: "refund", amount: 50, currency: "usd", status: "completed", paymentMethod: "Credit Card", description: "استرجاع مبلغ — خطأ في الدفع", adminNotes: "تمت الموافقة", createdAt: new Date(Date.now() - 43200000) },
  { id: "tx-006", userId: "usr-006", username: "yasmine_vip", displayName: "ياسمين VIP", type: "gift_received", amount: 10000, currency: "coins", status: "completed", paymentMethod: "", description: "استلام هدية يخت 🛥️", adminNotes: "", createdAt: new Date(Date.now() - 57600000) },
  { id: "tx-007", userId: "usr-007", username: "mohali_gamer", displayName: "محمد علي جيمر", type: "purchase", amount: 100, currency: "coins", status: "failed", paymentMethod: "Google Pay", description: "شراء 100 كوين", adminNotes: "فشل الدفع", createdAt: new Date(Date.now() - 72000000) },
  { id: "tx-008", userId: "usr-008", username: "reem_singer", displayName: "ريم المغنية", type: "withdrawal", amount: 500, currency: "usd", status: "pending", paymentMethod: "PayPal", description: "طلب سحب $500", adminNotes: "", createdAt: new Date(Date.now() - 86400000) },
];

// ══════════════════════════════════════════════════════════
// AGENT CACHE (synced with DB for agent.ts compatibility)
// ══════════════════════════════════════════════════════════

let agentCache: any[] = [];

/** Called by agent.ts for login/auth */
export function getMockAgents(): any[] {
  return agentCache;
}

/** Refresh agent cache from database */
async function refreshAgentCache() {
  try {
    const agents = await storage.getAgents?.();
    if (agents && agents.length > 0) {
      agentCache = agents;
    }
  } catch (err) {
    // Keep existing cache if DB fails
  }
}

// Initialize cache on load
refreshAgentCache();

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
    res.clearCookie("connect.sid");
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
// DASHBOARD STATS — إحصائيات لوحة القيادة
// ══════════════════════════════════════════════════════════

router.get("/stats", requireAdmin, async (_req, res) => {
  try {
    const totalUsers = await storage.getUsersCount();
    const gifts = await storage.getGifts();
    const packages = await storage.getCoinPackages();

    // Calculate various stats
    const totalAgents = agentCache.length || (await storage.getAgentsCount?.()) || 0;
    const activeStreams = Math.floor(Math.random() * 50) + 10; // mock live data
    const todayRevenue = Math.floor(Math.random() * 5000) + 1000;

    return res.json({
      success: true,
      data: {
        totalUsers,
        totalAgents,
        activeStreams,
        todayRevenue,
        totalGifts: gifts.length,
        totalCoinPackages: packages.length,
        // Weekly chart data (mock for demo)
        weeklyRevenue: [
          { day: "السبت", amount: 3200 },
          { day: "الأحد", amount: 4100 },
          { day: "الاثنين", amount: 3800 },
          { day: "الثلاثاء", amount: 5200 },
          { day: "الأربعاء", amount: 4600 },
          { day: "الخميس", amount: 6100 },
          { day: "الجمعة", amount: 5500 },
        ],
        weeklyUsers: [
          { day: "السبت", count: 120 },
          { day: "الأحد", count: 145 },
          { day: "الاثنين", count: 132 },
          { day: "الثلاثاء", count: 168 },
          { day: "الأربعاء", count: 155 },
          { day: "الخميس", count: 190 },
          { day: "الجمعة", count: 175 },
        ],
        recentActivity: [
          { type: "user_joined", message: "مستخدم جديد انضم: سارة", time: "منذ 5 دقائق" },
          { type: "gift_sent", message: "تم إرسال هدية ماسة 💎 بقيمة 500 كوين", time: "منذ 12 دقيقة" },
          { type: "stream_started", message: "بث جديد: سهرة موسيقية 🎵", time: "منذ 25 دقيقة" },
          { type: "withdrawal", message: "طلب سحب $200 من ياسمين VIP", time: "منذ 45 دقيقة" },
          { type: "agent_joined", message: "وكيل جديد: شركة الريادة", time: "منذ ساعة" },
        ],
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

    // Refresh cache
    await refreshAgentCache();

    let filtered = [...agentCache];

    if (search) {
      const q = search.toLowerCase();
      filtered = filtered.filter(
        (a) =>
          a.name?.toLowerCase().includes(q) ||
          a.email?.toLowerCase().includes(q) ||
          a.referralCode?.toLowerCase().includes(q),
      );
    }
    if (status) {
      filtered = filtered.filter((a) => a.status === status);
    }

    const total = filtered.length;
    const start = (page - 1) * limit;
    // Strip passwordHash from response (SECURITY)
    const data = filtered.slice(start, start + limit).map((a: any) => stripSensitive(a));

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

    await refreshAgentCache();

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

    await refreshAgentCache();

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

    await refreshAgentCache();

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

    await refreshAgentCache();

    await storage.addAdminLog(req.session.adminId!, "release_agent_balance", "agent", paramStr(req.params.id), `Released $${amount}`);

    return res.json({ success: true, data: updated, message: `تم تحرير $${amount}` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.post("/agents/:id/upgrade-account", requireAdmin, async (req, res) => {
  try {
    const agent = await storage.getAgent(paramStr(req.params.id));
    if (!agent) return res.status(404).json({ success: false, message: "الوكيل غير موجود" });

    // Create an agent account from the agent
    const plainPass = `AP${randomUUID().slice(0, 6).toUpperCase()}@`;
    const newAccount = {
      id: `acc-${randomUUID().slice(0, 8)}`,
      agentId: agent.id,
      agentName: agent.name,
      username: `agent_${agent.referralCode?.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
      displayName: agent.name,
      email: agent.email,
      passwordHash: await hashPasswordAsync(plainPass),
      referralCode: `ACC-${randomUUID().slice(0, 8).toUpperCase()}`,
      type: req.body.type || "broadcast",
      status: "active" as const,
      features: req.body.features || ["بث مباشر", "بيع منتجات", "إرسال رصيد"],
      commissionRate: agent.commissionRate?.toString() || "10",
      discount: req.body.discount || "20",
      totalSales: 0,
      totalRevenue: "0",
      coinsEarned: 0,
      broadcastHours: 0,
      activeCustomers: 0,
      balanceSent: "0",
      createdAt: new Date(),
    };

    mockAgentAccounts.push(newAccount);

    await storage.addAdminLog(req.session.adminId!, "upgrade_agent_to_account", "agent", paramStr(req.params.id), `Upgraded to account: ${newAccount.id}`);

    const { passwordHash: _ph, ...safeAccount } = newAccount;
    return res.json({ success: true, data: safeAccount, message: "تمت ترقية الوكيل لحساب" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// AGENT ACCOUNTS — حسابات الوكلاء
// ══════════════════════════════════════════════════════════

router.get("/agent-accounts", requireAdmin, (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = (req.query.search as string) || "";
  const status = (req.query.status as string) || "";
  const type = (req.query.type as string) || "";

  let filtered = [...mockAgentAccounts];
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.displayName?.toLowerCase().includes(q) ||
        a.username?.toLowerCase().includes(q) ||
        a.email?.toLowerCase().includes(q) ||
        a.agentName?.toLowerCase().includes(q),
    );
  }
  if (status) filtered = filtered.filter((a) => a.status === status);
  if (type) filtered = filtered.filter((a) => a.type === type);

  const total = filtered.length;
  const start = (page - 1) * limit;
  // Strip passwordHash from response (SECURITY: never expose hashes)
  const data = filtered.slice(start, start + limit).map(({ passwordHash, ...rest }) => rest);

  return res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.post("/agent-accounts", requireAdmin, (req, res) => {
  const parsed = agentAccountCreateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
  const { agentId, agentName, displayName, email, type, features, commissionRate, discount } = parsed.data;

  const username = `acc_${randomUUID().slice(0, 6)}`;
  const plainPass = `AP${randomUUID().slice(0, 6).toUpperCase()}@`;

  const newAcc = {
    id: `acc-${randomUUID().slice(0, 8)}`,
    agentId: agentId || "",
    agentName: agentName || "—",
    username,
    displayName,
    email,
    passwordHash: hashPassword(plainPass),
    referralCode: `ACC-${randomUUID().slice(0, 8).toUpperCase()}`,
    type: type || "broadcast",
    status: "active" as const,
    features: features || ["بث مباشر"],
    commissionRate: commissionRate || "10",
    discount: discount || "20",
    totalSales: 0,
    totalRevenue: "0",
    coinsEarned: 0,
    broadcastHours: 0,
    activeCustomers: 0,
    balanceSent: "0",
    createdAt: new Date(),
  };

  mockAgentAccounts.push(newAcc);

  const { passwordHash: _ph, ...safeAcc } = newAcc;
  return res.status(201).json({ success: true, data: safeAcc });
});

router.patch("/agent-accounts/:id", requireAdmin, (req, res) => {
  const idx = mockAgentAccounts.findIndex((a) => a.id === paramStr(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: "الحساب غير موجود" });

  const allowed = ["displayName", "email", "type", "status", "features", "commissionRate", "discount"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) (mockAgentAccounts[idx] as any)[key] = req.body[key];
  }

  const { passwordHash: _ph, ...safe } = mockAgentAccounts[idx];
  return res.json({ success: true, data: safe });
});

router.delete("/agent-accounts/:id", requireAdmin, (req, res) => {
  const idx = mockAgentAccounts.findIndex((a) => a.id === paramStr(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: "الحساب غير موجود" });

  mockAgentAccounts.splice(idx, 1);

  return res.json({ success: true, message: "تم حذف الحساب" });
});

router.post("/agent-accounts/:id/approve", requireAdmin, (req, res) => {
  const acc = mockAgentAccounts.find((a) => a.id === paramStr(req.params.id));
  if (!acc) return res.status(404).json({ success: false, message: "الحساب غير موجود" });

  acc.status = "active";

  return res.json({ success: true, data: acc, message: "تمت الموافقة على الحساب" });
});

router.post("/agent-accounts/:id/upgrade-vip", requireAdmin, (req, res) => {
  const acc = mockAgentAccounts.find((a) => a.id === paramStr(req.params.id));
  if (!acc) return res.status(404).json({ success: false, message: "الحساب غير موجود" });

  // Create a VIP agent from the account
  const vip = {
    id: `vip-${randomUUID().slice(0, 8)}`,
    name: `${acc.displayName} VIP`,
    email: acc.email,
    phone: "",
    tier: req.body.tier || "gold",
    commissionRate: req.body.commissionRate || "15",
    referralCode: `VIP-${randomUUID().slice(0, 6).toUpperCase()}`,
    totalUsers: acc.activeCustomers || 0,
    totalRevenue: acc.totalRevenue || "0",
    balance: "0",
    monthlyTarget: req.body.monthlyTarget || "30000",
    achievedTarget: "0",
    status: "active" as const,
    specialPerks: req.body.perks || ["عمولة مرتفعة", "دعم مخصص"],
    createdAt: new Date(),
  };

  mockVipAgents.push(vip);

  return res.json({ success: true, data: vip, message: "تمت ترقية الحساب لـ VIP" });
});

// ══════════════════════════════════════════════════════════
// VIP AGENTS — الوكلاء المميزين
// ══════════════════════════════════════════════════════════

router.get("/vip-agents", requireAdmin, (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = (req.query.search as string) || "";
  const status = (req.query.status as string) || "";

  let filtered = [...mockVipAgents];
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (v) => v.name?.toLowerCase().includes(q) || v.email?.toLowerCase().includes(q),
    );
  }
  if (status) filtered = filtered.filter((v) => v.status === status);

  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.post("/vip-agents", requireAdmin, (req, res) => {
  const { name, email, phone, tier, commissionRate, monthlyTarget, specialPerks } = req.body;

  if (!name || !email) {
    return res.status(400).json({ success: false, message: "الاسم والبريد مطلوبين" });
  }

  const vip = {
    id: `vip-${randomUUID().slice(0, 8)}`,
    name,
    email,
    phone: phone || "",
    tier: tier || "gold",
    commissionRate: commissionRate || "15",
    referralCode: `VIP-${randomUUID().slice(0, 6).toUpperCase()}`,
    totalUsers: 0,
    totalRevenue: "0",
    balance: "0",
    monthlyTarget: monthlyTarget || "30000",
    achievedTarget: "0",
    status: "active" as const,
    specialPerks: specialPerks || ["عمولة مرتفعة", "دعم مخصص"],
    createdAt: new Date(),
  };

  mockVipAgents.push(vip);

  return res.status(201).json({ success: true, data: vip });
});

router.patch("/vip-agents/:id", requireAdmin, (req, res) => {
  const idx = mockVipAgents.findIndex((v) => v.id === paramStr(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: "الوكيل VIP غير موجود" });

  const allowed = ["name", "status", "commissionRate", "features"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) (mockVipAgents[idx] as any)[key] = req.body[key];
  }

  return res.json({ success: true, data: mockVipAgents[idx] });
});

router.delete("/vip-agents/:id", requireAdmin, (req, res) => {
  const idx = mockVipAgents.findIndex((v) => v.id === paramStr(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: "الوكيل VIP غير موجود" });

  mockVipAgents.splice(idx, 1);

  return res.json({ success: true, message: "تم حذف الوكيل VIP" });
});

router.post("/vip-agents/:id/release-balance", requireAdmin, (req, res) => {
  const vip = mockVipAgents.find((v) => v.id === paramStr(req.params.id));
  if (!vip) return res.status(404).json({ success: false, message: "الوكيل VIP غير موجود" });

  const { amount } = req.body;
  if (!amount || amount <= 0) {
    return res.status(400).json({ success: false, message: "المبلغ غير صالح" });
  }

  const currentBalance = parseFloat(vip.balance);
  if (amount > currentBalance) {
    return res.status(400).json({ success: false, message: "المبلغ أكبر من الرصيد المتاح" });
  }

  vip.balance = (currentBalance - amount).toFixed(2);

  return res.json({ success: true, data: vip, message: `تم تحرير $${amount}` });
});

// ══════════════════════════════════════════════════════════
// AGENT APPLICATIONS — طلبات الانضمام كوكيل
// ══════════════════════════════════════════════════════════

router.get("/agent-applications", requireAdmin, (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const search = (req.query.search as string) || "";
  const status = (req.query.status as string) || "";

  let filtered = [...mockAgentApplications];
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (a) => a.fullName?.toLowerCase().includes(q) || a.email?.toLowerCase().includes(q),
    );
  }
  if (status) filtered = filtered.filter((a) => a.status === status);

  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.patch("/agent-applications/:id", requireAdmin, async (req, res) => {
  const app = mockAgentApplications.find((a) => a.id === paramStr(req.params.id));
  if (!app) return res.status(404).json({ success: false, message: "الطلب غير موجود" });

  const parsed = agentApplicationUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
  const { status, adminNotes } = parsed.data;
  if (status) app.status = status;
  if (adminNotes !== undefined) app.adminNotes = adminNotes;

  // If approved, create an agent in the database
  if (status === "approved") {
    try {
      // Generate a secure random password instead of a hardcoded one
      const { randomUUID } = await import("crypto");
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
      await refreshAgentCache();
      log(`Agent created from application: ${app.email} — temp password sent`, "admin");
    } catch (err: any) {
      log(`Auto-create agent from application failed: ${err.message}`, "admin");
    }
  }

  await storage.addAdminLog(req.session.adminId!, "update_application", "agent_application", paramStr(req.params.id), `Status → ${status}`);

  return res.json({ success: true, data: app });
});

router.delete("/agent-applications/:id", requireAdmin, (req, res) => {
  const idx = mockAgentApplications.findIndex((a) => a.id === paramStr(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: "الطلب غير موجود" });

  mockAgentApplications.splice(idx, 1);

  return res.json({ success: true, message: "تم حذف الطلب" });
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
    const { userId, message } = req.body;
    if (!userId) return res.status(400).json({ success: false, message: "معرف المستخدم مطلوب" });

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
// TRANSACTIONS — المعاملات المالية
// ══════════════════════════════════════════════════════════

router.get("/transactions", requireAdmin, (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const type = (req.query.type as string) || "";
  const status = (req.query.status as string) || "";
  const search = (req.query.search as string) || "";

  let filtered = [...mockTransactions];
  if (type) filtered = filtered.filter((t) => t.type === type);
  if (status) filtered = filtered.filter((t) => t.status === status);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (t) =>
        t.username?.toLowerCase().includes(q) ||
        t.displayName?.toLowerCase().includes(q) ||
        t.description?.toLowerCase().includes(q),
    );
  }

  // Sort by date desc
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.get("/transactions/:id", requireAdmin, (req, res) => {
  const tx = mockTransactions.find((t) => t.id === paramStr(req.params.id));
  if (!tx) return res.status(404).json({ success: false, message: "المعاملة غير موجودة" });
  return res.json({ success: true, data: tx });
});

router.patch("/transactions/:id", requireAdmin, (req, res) => {
  const tx = mockTransactions.find((t) => t.id === paramStr(req.params.id));
  if (!tx) return res.status(404).json({ success: false, message: "المعاملة غير موجودة" });

  const parsed = transactionUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
  const { status, adminNotes, rejectionReason, amount, description } = parsed.data;
  if (status) tx.status = status;
  if (adminNotes !== undefined) tx.adminNotes = adminNotes;
  if (rejectionReason) tx.adminNotes = `رفض: ${rejectionReason}`;
  if (amount !== undefined) tx.amount = amount;
  if (description !== undefined) tx.description = description;

  return res.json({ success: true, data: tx });
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

    // Get mock transactions for this user
    const userTx = mockTransactions.filter((t) => t.userId === paramStr(req.params.userId));

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
        transactions: userTx,
        stats: {
          totalSpent: userTx.filter((t) => t.type === "purchase").reduce((s, t) => s + t.amount, 0),
          totalReceived: userTx.filter((t) => t.type === "gift_received").reduce((s, t) => s + t.amount, 0),
          totalWithdrawn: userTx.filter((t) => t.type === "withdrawal").reduce((s, t) => s + t.amount, 0),
        },
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ══════════════════════════════════════════════════════════
// PAYMENT METHODS — طرق الدفع
// ══════════════════════════════════════════════════════════

router.get("/payment-methods", requireAdmin, (_req, res) => {
  return res.json({ success: true, data: mockPaymentMethods });
});

router.post("/payment-methods", requireAdmin, (req, res) => {
  const { name, nameAr, icon, type, provider, countries, minAmount, maxAmount, fee, instructions } = req.body;

  if (!name || !nameAr || !type) {
    return res.status(400).json({ success: false, message: "الاسم والنوع مطلوبين" });
  }

  const pm = {
    id: `pm-${randomUUID().slice(0, 8)}`,
    name,
    nameAr,
    icon: icon || "💳",
    type,
    provider: provider || "",
    countries: countries || ["*"],
    minAmount: minAmount || 1,
    maxAmount: maxAmount || 50000,
    fee: fee || "0",
    instructions: instructions || "",
    isActive: true,
    sortOrder: mockPaymentMethods.length + 1,
  };

  mockPaymentMethods.push(pm);

  return res.status(201).json({ success: true, data: pm });
});

router.patch("/payment-methods/:id", requireAdmin, (req, res) => {
  const pm = mockPaymentMethods.find((p) => p.id === paramStr(req.params.id));
  if (!pm) return res.status(404).json({ success: false, message: "طريقة الدفع غير موجودة" });

  const allowed = ["name", "nameAr", "type", "isActive", "currencies", "countries", "minAmount", "maxAmount", "fee", "instructions"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) (pm as any)[key] = req.body[key];
  }

  return res.json({ success: true, data: pm });
});

router.delete("/payment-methods/:id", requireAdmin, (req, res) => {
  const idx = mockPaymentMethods.findIndex((p) => p.id === paramStr(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: "طريقة الدفع غير موجودة" });

  mockPaymentMethods.splice(idx, 1);

  return res.json({ success: true, message: "تم حذف طريقة الدفع" });
});

// ══════════════════════════════════════════════════════════
// REPORTS — البلاغات والتقارير
// ══════════════════════════════════════════════════════════

const mockReports: any[] = [
  { id: "rpt-001", reporterId: "usr-001", reporterName: "سارة أحمد", reportedId: "usr-010", reportedName: "مستخدم مخالف", streamId: null, type: "harassment", reason: "تحرش لفظي في البث المباشر", status: "pending", adminNotes: "", reviewedBy: null, reviewedAt: null, createdAt: new Date(Date.now() - 3600000) },
  { id: "rpt-002", reporterId: "usr-002", reporterName: "أحمد علي", reportedId: "usr-011", reportedName: "سبامر", streamId: "str-001", type: "spam", reason: "إرسال رسائل متكررة ومزعجة", status: "reviewed", adminNotes: "تم التحقق — سبام فعلاً", reviewedBy: "admin", reviewedAt: new Date(Date.now() - 1800000), createdAt: new Date(Date.now() - 7200000) },
  { id: "rpt-003", reporterId: "usr-003", reporterName: "ليلى النجم", reportedId: "usr-012", reportedName: "محتال", streamId: null, type: "scam", reason: "يحاول الاحتيال على المستخدمين وطلب تحويلات مالية خارج التطبيق", status: "pending", adminNotes: "", reviewedBy: null, reviewedAt: null, createdAt: new Date(Date.now() - 14400000) },
  { id: "rpt-004", reporterId: "usr-004", reporterName: "طارق المحترف", reportedId: "usr-013", reportedName: "محتوى غير لائق", streamId: "str-002", type: "inappropriate", reason: "محتوى غير لائق في البث المباشر", status: "resolved", adminNotes: "تم حظر المستخدم", reviewedBy: "admin", reviewedAt: new Date(Date.now() - 7200000), createdAt: new Date(Date.now() - 86400000) },
];

router.get("/reports", requireAdmin, (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = (req.query.status as string) || "";
  const type = (req.query.type as string) || "";

  let filtered = [...mockReports];
  if (status) filtered = filtered.filter((r) => r.status === status);
  if (type) filtered = filtered.filter((r) => r.type === type);

  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.patch("/reports/:id", requireAdmin, async (req, res) => {
  const report = mockReports.find((r) => r.id === paramStr(req.params.id));
  if (!report) return res.status(404).json({ success: false, message: "البلاغ غير موجود" });

  const parsed = updateReportSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
  const { status, adminNotes } = parsed.data;
  if (status) {
    report.status = status;
    report.reviewedBy = req.session.adminUsername;
    report.reviewedAt = new Date();
  }
  if (adminNotes !== undefined) report.adminNotes = adminNotes;

  await storage.addAdminLog(req.session.adminId!, "update_report", "report", paramStr(req.params.id), `Status → ${status}`);

  return res.json({ success: true, data: report });
});

// ══════════════════════════════════════════════════════════
// SETTINGS — إعدادات النظام
// ══════════════════════════════════════════════════════════

// In-memory advanced settings (grouped by category)
const advancedSettings: Record<string, any> = {
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
    provider: "twilio",
    enabled: true,
    twilioAccountSid: "",
    twilioAuthToken: "",
    twilioPhoneNumber: "",
    firebaseEnabled: false,
    codeLength: 6,
    expiryMinutes: 5,
    maxAttempts: 3,
    cooldownMinutes: 1,
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
    enabled: false,
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

router.get("/settings/advanced", requireAdmin, (_req, res) => {
  // Strip sensitive credentials before sending to client
  const safe = JSON.parse(JSON.stringify(advancedSettings));
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
  // Mask OTP secrets
  if (safe.otp) {
    if (safe.otp.twilioAuthToken) safe.otp.twilioAuthToken = safe.otp.twilioAuthToken.slice(0, 4) + "••••••••";
    if (safe.otp.twilioAccountSid && safe.otp.twilioAccountSid.length > 4) safe.otp.twilioAccountSid = safe.otp.twilioAccountSid.slice(0, 6) + "••••••••";
  }
  return res.json({ success: true, data: safe });
});

router.put("/settings/seo", requireAdmin, async (req, res) => {
  const allowed = ["appTitle", "appDescription", "keywords", "ogImage", "twitterHandle", "canonicalUrl", "robots"];
  for (const k of allowed) { if (req.body[k] !== undefined) (advancedSettings.seo as any)[k] = req.body[k]; }
  await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "seo", "SEO settings updated");
  return res.json({ success: true, data: advancedSettings.seo });
});

router.put("/settings/aso", requireAdmin, async (req, res) => {
  const allowed = ["appStoreName", "appStoreSubtitle", "playStoreName", "playStoreShortDesc", "playStoreLongDesc", "category", "contentRating", "screenshots", "promoVideo", "supportUrl", "privacyUrl"];
  for (const k of allowed) { if (req.body[k] !== undefined) (advancedSettings.aso as any)[k] = req.body[k]; }
  await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "aso", "ASO settings updated");
  return res.json({ success: true, data: advancedSettings.aso });
});

router.put("/settings/social-login", requireAdmin, async (req, res) => {
  const { provider, ...data } = req.body;
  if (provider && advancedSettings.socialLogin[provider]) {
    const allowed = ["enabled", "clientId", "clientSecret", "serviceId", "teamId", "keyId", "appId", "appSecret", "apiKey", "apiSecret", "clientKey"];
    for (const k of allowed) { if (data[k] !== undefined) advancedSettings.socialLogin[provider][k] = data[k]; }
  }
  await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "social-login", `Provider: ${provider}`);
  return res.json({ success: true, data: advancedSettings.socialLogin });
});

router.put("/settings/otp", requireAdmin, async (req, res) => {
  const allowed = ["provider", "enabled", "twilioAccountSid", "twilioAuthToken", "twilioPhoneNumber", "firebaseEnabled", "codeLength", "expiryMinutes", "maxAttempts", "cooldownMinutes"];
  for (const k of allowed) { if (req.body[k] !== undefined) (advancedSettings.otp as any)[k] = req.body[k]; }
  await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "otp", "OTP settings updated");
  return res.json({ success: true, data: advancedSettings.otp });
});

router.put("/settings/branding", requireAdmin, async (req, res) => {
  const allowed = ["appNameEn", "appNameAr", "primaryColor", "secondaryColor", "logoUrl", "faviconUrl", "splashScreenUrl", "darkModeDefault"];
  for (const k of allowed) { if (req.body[k] !== undefined) (advancedSettings.branding as any)[k] = req.body[k]; }
  await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "branding", "Branding updated");
  return res.json({ success: true, data: advancedSettings.branding });
});

router.put("/settings/seo-texts", requireAdmin, async (req, res) => {
  const allowed = ["homeTitle", "homeDescription", "aboutTitle", "aboutDescription", "contactTitle", "contactDescription"];
  for (const k of allowed) { if (req.body[k] !== undefined) (advancedSettings.seoTexts as any)[k] = req.body[k]; }
  await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "seo-texts", "SEO texts updated");
  return res.json({ success: true, data: advancedSettings.seoTexts });
});

router.put("/settings/policies", requireAdmin, async (req, res) => {
  const { documentKey, ...data } = req.body;
  if (documentKey && advancedSettings.policies[documentKey]) {
    const allowed = ["title", "content"];
    for (const k of allowed) { if (data[k] !== undefined) advancedSettings.policies[documentKey][k] = data[k]; }
    advancedSettings.policies[documentKey].lastUpdated = new Date().toISOString();
  }
  await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "policies", `Document: ${documentKey}`);
  return res.json({ success: true, data: advancedSettings.policies });
});

router.put("/settings/app-download", requireAdmin, async (req, res) => {
  const { enabled, domain, pwa, apk, aab } = req.body;
  if (typeof enabled === "boolean") advancedSettings.appDownload.enabled = enabled;
  if (typeof domain === "string") advancedSettings.appDownload.domain = domain;
  for (const key of ["pwa", "apk", "aab"] as const) {
    const incoming = req.body[key];
    if (incoming && typeof incoming === "object") {
      const target = advancedSettings.appDownload[key];
      if (typeof incoming.enabled === "boolean") target.enabled = incoming.enabled;
      if (typeof incoming.url === "string") target.url = incoming.url;
      if (typeof incoming.extension === "string") target.extension = incoming.extension;
      if (typeof incoming.description === "string") target.description = incoming.description;
    }
  }
  await storage.addAdminLog(req.session.adminId!, "update_settings", "setting", "app-download", "App download settings updated");
  return res.json({ success: true, data: advancedSettings.appDownload });
});

// ══════════════════════════════════════════════════════════
// FEATURED STREAMS — البثوث المميزة
// ══════════════════════════════════════════════════════════

router.get("/featured-streams", requireAdmin, (_req, res) => {
  const sorted = [...mockFeaturedStreams].sort((a, b) => a.sortOrder - b.sortOrder);
  return res.json({ success: true, data: sorted });
});

router.post("/featured-streams", requireAdmin, (req, res) => {
  const { accountId, tags } = req.body;
  if (!accountId) return res.status(400).json({ success: false, message: "معرف الحساب مطلوب" });

  const account = mockAgentAccounts.find((a) => a.id === accountId);

  const featured = {
    id: `feat-${randomUUID().slice(0, 8)}`,
    accountId,
    username: account?.username || "unknown",
    displayName: account?.displayName || "—",
    avatar: null,
    title: account?.displayName ? `بث ${account.displayName}` : "بث مميز",
    tags: tags || [],
    viewers: 0,
    isActive: true,
    sortOrder: mockFeaturedStreams.length + 1,
    addedAt: new Date(),
  };

  mockFeaturedStreams.push(featured);

  return res.status(201).json({ success: true, data: featured });
});

router.patch("/featured-streams/:id", requireAdmin, (req, res) => {
  const feat = mockFeaturedStreams.find((f) => f.id === paramStr(req.params.id));
  if (!feat) return res.status(404).json({ success: false, message: "البث المميز غير موجود" });

  const allowed = ["title", "streamTitle", "category", "isActive", "sortOrder", "thumbnailUrl"];
  for (const key of allowed) {
    if (req.body[key] !== undefined) (feat as any)[key] = req.body[key];
  }

  return res.json({ success: true, data: feat });
});

router.delete("/featured-streams/:id", requireAdmin, (req, res) => {
  const idx = mockFeaturedStreams.findIndex((f) => f.id === paramStr(req.params.id));
  if (idx === -1) return res.status(404).json({ success: false, message: "البث المميز غير موجود" });

  mockFeaturedStreams.splice(idx, 1);

  return res.json({ success: true, message: "تم إزالة البث المميز" });
});

router.put("/featured-streams/reorder", requireAdmin, (req, res) => {
  const { order } = req.body; // [{ id, sortOrder }]
  if (!Array.isArray(order)) return res.status(400).json({ success: false, message: "ترتيب غير صالح" });

  for (const item of order) {
    const feat = mockFeaturedStreams.find((f) => f.id === item.id);
    if (feat) feat.sortOrder = item.sortOrder;
  }

  return res.json({ success: true, message: "تم إعادة الترتيب" });
});

// ══════════════════════════════════════════════════════════
// ANNOUNCEMENT POPUP — الإشعار المنبثق
// ══════════════════════════════════════════════════════════

router.get("/announcement-popup", requireAdmin, (_req, res) => {
  return res.json({ success: true, data: mockAnnouncementPopup });
});

router.put("/announcement-popup", requireAdmin, async (req, res) => {
  const parsed = announcementPopupSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
  Object.assign(mockAnnouncementPopup, parsed.data);

  await storage.addAdminLog(req.session.adminId!, "update_announcement_popup", "setting", "popup", JSON.stringify(req.body));

  return res.json({ success: true, data: mockAnnouncementPopup });
});

// ══════════════════════════════════════════════════════════
// FRAUD DETECTION — كشف الاحتيال
// ══════════════════════════════════════════════════════════

router.get("/fraud/stats", requireAdmin, (_req, res) => {
  const total = mockFraudAlerts.length;
  const pending = mockFraudAlerts.filter((a) => a.status === "pending").length;
  const investigating = mockFraudAlerts.filter((a) => a.status === "investigating").length;
  const resolved = mockFraudAlerts.filter((a) => a.status === "resolved").length;
  const critical = mockFraudAlerts.filter((a) => a.severity === "critical").length;
  const high = mockFraudAlerts.filter((a) => a.severity === "high").length;

  return res.json({
    success: true,
    data: {
      total,
      pending,
      investigating,
      resolved,
      critical,
      high,
      categories: {
        account: mockFraudAlerts.filter((a) => a.category === "account").length,
        financial: mockFraudAlerts.filter((a) => a.category === "financial").length,
        agent: mockFraudAlerts.filter((a) => a.category === "agent").length,
      },
      recentTrend: [
        { date: "2025-01-20", count: 3 },
        { date: "2025-01-21", count: 5 },
        { date: "2025-01-22", count: 2 },
        { date: "2025-01-23", count: 4 },
        { date: "2025-01-24", count: 1 },
        { date: "2025-01-25", count: 6 },
        { date: "2025-01-26", count: 3 },
      ],
    },
  });
});

router.get("/fraud/alerts", requireAdmin, (req, res) => {
  const page = parseInt(req.query.page as string) || 1;
  const limit = parseInt(req.query.limit as string) || 20;
  const status = (req.query.status as string) || "";
  const severity = (req.query.severity as string) || "";
  const category = (req.query.category as string) || "";
  const search = (req.query.search as string) || "";

  let filtered = [...mockFraudAlerts];
  if (status) filtered = filtered.filter((a) => a.status === status);
  if (severity) filtered = filtered.filter((a) => a.severity === severity);
  if (category) filtered = filtered.filter((a) => a.category === category);
  if (search) {
    const q = search.toLowerCase();
    filtered = filtered.filter(
      (a) =>
        a.username?.toLowerCase().includes(q) ||
        a.displayName?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q),
    );
  }

  filtered.sort((a, b) => new Date(b.detectedAt).getTime() - new Date(a.detectedAt).getTime());

  const total = filtered.length;
  const start = (page - 1) * limit;
  const data = filtered.slice(start, start + limit);

  return res.json({
    success: true,
    data,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
});

router.get("/fraud/alerts/:id", requireAdmin, (req, res) => {
  const alert = mockFraudAlerts.find((a) => a.id === paramStr(req.params.id));
  if (!alert) return res.status(404).json({ success: false, message: "التنبيه غير موجود" });
  return res.json({ success: true, data: alert });
});

router.patch("/fraud/alerts/:id", requireAdmin, async (req, res) => {
  const alert = mockFraudAlerts.find((a) => a.id === paramStr(req.params.id));
  if (!alert) return res.status(404).json({ success: false, message: "التنبيه غير موجود" });

  const parsed = fraudAlertUpdateSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
  const { status, adminNotes } = parsed.data;
  if (status) {
    alert.status = status;
    if (status === "resolved") {
      alert.resolvedAt = new Date();
      alert.resolvedBy = req.session.adminUsername;
    }
  }
  if (adminNotes !== undefined) alert.adminNotes = adminNotes;

  await storage.addAdminLog(req.session.adminId!, "update_fraud_alert", "fraud", paramStr(req.params.id), `Status → ${status}`);

  return res.json({ success: true, data: alert });
});

router.post("/fraud/alerts/:id/ban-user", requireAdmin, async (req, res) => {
  const alert = mockFraudAlerts.find((a) => a.id === paramStr(req.params.id));
  if (!alert) return res.status(404).json({ success: false, message: "التنبيه غير موجود" });

  // Try to ban the user in DB
  if (alert.userId) {
    await storage.updateUser(alert.userId, { isBanned: true, banReason: `حظر بسبب: ${alert.type}` } as any);
  }

  alert.status = "resolved";
  alert.resolvedAt = new Date();
  alert.resolvedBy = req.session.adminUsername;
  alert.adminNotes = (alert.adminNotes || "") + "\n✅ تم حظر المستخدم";

  await storage.addAdminLog(req.session.adminId!, "fraud_ban_user", "fraud", paramStr(req.params.id), `Banned user: ${alert.username}`);

  return res.json({ success: true, data: alert, message: "تم حظر المستخدم" });
});

router.post("/fraud/alerts/:id/suspend-agent", requireAdmin, async (req, res) => {
  const alert = mockFraudAlerts.find((a) => a.id === paramStr(req.params.id));
  if (!alert) return res.status(404).json({ success: false, message: "التنبيه غير موجود" });

  alert.status = "resolved";
  alert.resolvedAt = new Date();
  alert.resolvedBy = req.session.adminUsername;
  alert.adminNotes = (alert.adminNotes || "") + "\n✅ تم إيقاف الوكيل";

  await storage.addAdminLog(req.session.adminId!, "fraud_suspend_agent", "fraud", paramStr(req.params.id), "Agent suspended");

  return res.json({ success: true, data: alert, message: "تم إيقاف الوكيل" });
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

export default router;
