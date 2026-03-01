import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import adminRoutes, { mockAgentApplications, mockAgentAccounts, mockFeaturedStreams, mockAnnouncementPopup } from "./routes/admin";
import agentRoutes from "./routes/agent";
import socialRoutes from "./routes/social";
import adminChatRoutes from "./routes/adminChat";
import worldRoutes from "./routes/world";
import { createLogger } from "./logger";
const log = (msg: string, _src?: string) => routesLog.info(msg);
const routesLog = createLogger("routes");
import { randomUUID } from "crypto";
import { agentApplicationSubmitSchema, accountApplicationSubmitSchema } from "../shared/schema";

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // ── Admin Panel API ──
  app.use("/api/admin", adminRoutes);
  log("Admin API routes registered at /api/admin", "routes");

  // ── Admin Chat & Broadcast Management API ──
  app.use("/api/admin/chat", adminChatRoutes);
  log("Admin Chat Management routes registered at /api/admin/chat", "routes");

  // ── Agent Panel API ──
  app.use("/api/agent", agentRoutes);
  log("Agent API routes registered at /api/agent", "routes");

  // ── Social API (Friends, Chat, Calls) ──
  app.use("/api/social", socialRoutes);
  log("Social API routes registered at /api/social", "routes");

  // ── World API (Around the World — حول العالم) ──
  app.use("/api/social/world", worldRoutes);
  app.use("/api/admin/world", worldRoutes);
  log("World API routes registered at /api/social/world & /api/admin/world", "routes");

  // ── Public API routes (for the app) ──

  // Public: submit agent application (no auth required)
  app.post("/api/agent-applications", (req, res) => {
    const parsed = agentApplicationSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }
    const { fullName, email, phone, bio, photoUrl, whatsapp, telegram, instagram, twitter, accountType, referralCode } = parsed.data;

    const newApp = {
      id: `app-${randomUUID().slice(0, 8)}`,
      referralCode: referralCode || "",
      fullName,
      email,
      phone,
      bio: bio || "",
      photoUrl: photoUrl || "",
      socialMedia: {
        whatsapp: whatsapp || "",
        telegram: telegram || "",
        instagram: instagram || "",
        twitter: twitter || "",
      },
      accountType: accountType as "marketer" | "agent" | "both",
      status: "pending" as const,
      adminNotes: "",
      createdAt: new Date(),
    };

    mockAgentApplications.push(newApp);
    log(`New agent application: ${fullName} (${email}) — type: ${accountType}`, "routes");
    return res.status(201).json({ success: true, data: newApp });
  });

  // Public: submit account application (via account referral link — no auth)
  app.post("/api/account-applications", async (req, res) => {
    const parsed = accountApplicationSubmitSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }
    const { fullName, email, phone, bio, accountReferralCode } = parsed.data;

    // Find the account by referral code
    const parentAccount = mockAgentAccounts.find(a => a.referralCode === accountReferralCode);

    // Create a pending account
    const generatedUsername = `user_${randomUUID().slice(0, 6)}`;
    const generatedPassword = `UP${randomUUID().slice(0, 6).toUpperCase()}@`;
    // Hash the password before storing (SECURITY)
    const { hashPassword } = await import("./utils/crypto");
    const passwordHash = hashPassword(generatedPassword);

    const newAcc = {
      id: `acc-${randomUUID().slice(0, 8)}`,
      agentId: parentAccount?.agentId || "",
      agentName: parentAccount?.agentName || "—",
      username: generatedUsername,
      displayName: fullName,
      email,
      passwordHash,
      referralCode: `ACC-${randomUUID().slice(0, 8).toUpperCase()}`,
      type: "broadcast",
      status: "pending" as const,
      features: ["بث مباشر", "بيع منتجات", "إرسال رصيد"],
      commissionRate: "10",
      discount: "20",
      totalSales: 0,
      totalRevenue: "0",
      coinsEarned: 0,
      broadcastHours: 0,
      activeCustomers: 0,
      balanceSent: "0",
      createdAt: new Date(),
    };

    mockAgentAccounts.push(newAcc);
    log(`New account application: ${fullName} (${email}) via ref: ${accountReferralCode || "direct"}`, "routes");
    return res.status(201).json({ success: true, data: { id: newAcc.id }, message: "تم إرسال طلبك بنجاح" });
  });

  // Public: Get featured streams for the homepage
  app.get("/api/featured-streams", (_req, res) => {
    const active = mockFeaturedStreams
      .filter(f => f.isActive)
      .sort((a, b) => a.sortOrder - b.sortOrder);
    return res.json({ success: true, data: active });
  });

  // Public: Get followed accounts (mock – returns accounts the user follows with live status)
  app.get("/api/followed-accounts", (_req, res) => {
    const followed = [
      { id: "fol-001", username: "horizon_live", displayName: "أفق لايف", avatar: null, isLive: true, viewers: 1205, lastSeen: new Date().toISOString(), streamTitle: "سهرة موسيقية 🎵" },
      { id: "fol-002", username: "stars_broadcast", displayName: "نجوم البث", avatar: null, isLive: true, viewers: 3400, lastSeen: new Date().toISOString(), streamTitle: "حفلة دي جي 🎧" },
      { id: "fol-003", username: "diamond_promo", displayName: "الماسي بروموشن", avatar: null, isLive: false, viewers: 0, lastSeen: new Date(Date.now() - 3600000).toISOString(), streamTitle: "" },
      { id: "fol-004", username: "horizon_promo", displayName: "أفق بروموشن", avatar: null, isLive: true, viewers: 450, lastSeen: new Date().toISOString(), streamTitle: "عروض وخصومات 🔥" },
      { id: "fol-005", username: "stars_vip", displayName: "نجوم VIP", avatar: null, isLive: false, viewers: 0, lastSeen: new Date(Date.now() - 7200000).toISOString(), streamTitle: "" },
      { id: "fol-006", username: "riada_live", displayName: "ريادة لايف", avatar: null, isLive: true, viewers: 670, lastSeen: new Date().toISOString(), streamTitle: "كوميديا ليلية 😂" },
      { id: "fol-007", username: "sarah_singer", displayName: "سارة المغنية", avatar: null, isLive: false, viewers: 0, lastSeen: new Date(Date.now() - 1800000).toISOString(), streamTitle: "" },
      { id: "fol-008", username: "gamer_ali", displayName: "علي جيمر", avatar: null, isLive: true, viewers: 2100, lastSeen: new Date().toISOString(), streamTitle: "تحدي الألعاب 🎮" },
    ];
    // Sort: live first, then by viewers desc, then offline sorted by lastSeen desc
    const sorted = followed.sort((a, b) => {
      if (a.isLive && !b.isLive) return -1;
      if (!a.isLive && b.isLive) return 1;
      if (a.isLive && b.isLive) return b.viewers - a.viewers;
      return new Date(b.lastSeen).getTime() - new Date(a.lastSeen).getTime();
    });
    return res.json({ success: true, data: sorted });
  });

  // Public: Get announcement popup settings (only if enabled)
  app.get("/api/announcement-popup", (_req, res) => {
    if (!mockAnnouncementPopup.enabled) {
      return res.json({ success: true, data: null });
    }
    return res.json({ success: true, data: mockAnnouncementPopup });
  });

  return httpServer;
}
