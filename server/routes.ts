import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import adminRoutes from "./routes/admin";
import agentRoutes from "./routes/agent";
import socialRoutes from "./routes/social";
import adminChatRoutes from "./routes/adminChat";
import worldRoutes from "./routes/world";
import userAuthRoutes from "./routes/userAuth";
import { createLogger } from "./logger";
const log = (msg: string, _src?: string) => routesLog.info(msg);
const routesLog = createLogger("routes");
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

  // ── User Auth & Profile API ──
  app.use("/api/auth", userAuthRoutes);
  log("User Auth routes registered at /api/auth", "routes");

  // ── World API (Around the World — حول العالم) ──
  app.use("/api/social/world", worldRoutes);
  app.use("/api/admin/world", worldRoutes);
  log("World API routes registered at /api/social/world & /api/admin/world", "routes");

  // ── Public API routes (for the app) ──

  // Public: submit agent application (no auth required)
  app.post("/api/agent-applications", async (req, res) => {
    try {
      const parsed = agentApplicationSubmitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
      }

      const created = await storage.createAgentApplication({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        bio: parsed.data.bio || null,
        photoUrl: parsed.data.photoUrl || null,
        whatsapp: parsed.data.whatsapp || null,
        telegram: parsed.data.telegram || null,
        instagram: parsed.data.instagram || null,
        twitter: parsed.data.twitter || null,
        accountType: parsed.data.accountType,
        referralCode: parsed.data.referralCode || null,
        status: "pending",
      });

      log(`New agent application: ${parsed.data.fullName} (${parsed.data.email}) — type: ${parsed.data.accountType}`, "routes");
      return res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      log(`Agent application error: ${err.message}`, "routes");
      return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
  });

  // Public: submit account application (via account referral link — no auth)
  app.post("/api/account-applications", async (req, res) => {
    try {
      const parsed = accountApplicationSubmitSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
      }

      const created = await storage.createAccountApplication({
        fullName: parsed.data.fullName,
        email: parsed.data.email,
        phone: parsed.data.phone,
        bio: parsed.data.bio || null,
        accountReferralCode: parsed.data.accountReferralCode || null,
        status: "pending",
      });

      log(`New account application: ${parsed.data.fullName} (${parsed.data.email}) via ref: ${parsed.data.accountReferralCode || "direct"}`, "routes");
      return res.status(201).json({ success: true, data: { id: created?.id }, message: "تم إرسال طلبك بنجاح" });
    } catch (err: any) {
      log(`Account application error: ${err.message}`, "routes");
      return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
  });

  // Public: Get featured streams for the homepage
  app.get("/api/featured-streams", async (_req, res) => {
    try {
      const streams = await storage.getFeaturedStreams();
      res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=120");
      return res.json({ success: true, data: streams });
    } catch (err: any) {
      log(`Featured streams error: ${err.message}`, "routes");
      return res.json({ success: true, data: [] });
    }
  });

  // Public: Get followed accounts (requires auth)
  app.get("/api/followed-accounts", async (req, res) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.json({ success: true, data: [] });
    try {
      const data = await storage.getFollowedAccounts(userId, 50);
      return res.json({ success: true, data: data || [] });
    } catch (err: any) {
      log(`Followed accounts error: ${err.message}`, "routes");
      return res.json({ success: true, data: [] });
    }
  });

  // Public: Get announcement popup settings (only if enabled)
  app.get("/api/announcement-popup", async (_req, res) => {
    try {
      const popup = await storage.getAnnouncementPopup();
      res.setHeader("Cache-Control", "public, max-age=120, stale-while-revalidate=300");
      if (!popup || !popup.enabled) {
        return res.json({ success: true, data: null });
      }
      return res.json({ success: true, data: popup });
    } catch (err: any) {
      log(`Announcement popup error: ${err.message}`, "routes");
      return res.json({ success: true, data: null });
    }
  });

  // Public: Get app download settings (for user-facing download page)
  // Pre-computed default to avoid runtime object construction
  const APP_DOWNLOAD_DEFAULT = {
    enabled: true,
    domain: "https://mrco.live",
    pwa: { enabled: true, url: "https://mrco.live", extension: "/", description: "نسخة الويب — تعمل من المتصفح مباشرة بدون تحميل" },
    apk: { enabled: true, url: "https://mrco.live/download/ablox.apk", extension: ".apk", description: "ملف APK — للتثبيت المباشر على أجهزة أندرويد (1.4 MB)" },
    aab: { enabled: true, url: "https://mrco.live/download/ablox.aab", extension: ".aab", description: "ملف AAB — لرفعه على متجر جوجل بلاي (1.5 MB)" },
  };

  app.get("/api/app-download", async (_req, res) => {
    try {
      const cfg = await storage.getSystemConfig("appDownload");
      let dl: any = cfg?.configData
        ? (typeof cfg.configData === "string" ? JSON.parse(cfg.configData) : cfg.configData)
        : APP_DOWNLOAD_DEFAULT;
      if (!dl?.enabled) {
        return res.json({ success: true, data: { enabled: false } });
      }
      return res.json({
        success: true,
        data: {
          enabled: dl.enabled,
          domain: dl.domain,
          pwa: dl.pwa ? { enabled: dl.pwa.enabled, url: dl.pwa.url, extension: dl.pwa.extension, description: dl.pwa.description } : APP_DOWNLOAD_DEFAULT.pwa,
          apk: dl.apk ? { enabled: dl.apk.enabled, url: dl.apk.url, extension: dl.apk.extension, description: dl.apk.description } : APP_DOWNLOAD_DEFAULT.apk,
          aab: dl.aab ? { enabled: dl.aab.enabled, url: dl.aab.url, extension: dl.aab.extension, description: dl.aab.description } : APP_DOWNLOAD_DEFAULT.aab,
        },
      });
    } catch (err: any) {
      log(`App download config error: ${err.message}`, "routes");
      return res.json({ success: true, data: { enabled: false } });
    }
  });

  return httpServer;
}
