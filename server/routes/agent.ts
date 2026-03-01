import { Router } from "express";
import { requireAgent } from "../middleware/agentAuth";
import { rateLimitLogin } from "../middleware/adminAuth";
import { verifyPasswordAsync } from "../utils/crypto";
import { z } from "zod";
import { createLogger } from "../logger";
const log = (msg: string, _src?: string) => agentLog.info(msg);
const agentLog = createLogger("agent");

const router = Router();

// ── Agent Login Schema ──
const agentLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// ── Import mock agents from admin routes (shared reference) ──
// We re-export mockAgents from admin routes so agent routes can access them
import { getMockAgents } from "./admin";

// ════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════

router.post("/auth/login", rateLimitLogin, async (req, res) => {
  try {
    const parsed = agentLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
    }

    const { email, password } = parsed.data;
    const mockAgents = getMockAgents();
    const agent = mockAgents.find((a) => a.email === email && a.status === "active");

    if (!agent || !(await verifyPasswordAsync(password, agent.passwordHash))) {
      return res.status(401).json({ success: false, message: "البريد الإلكتروني أو كلمة المرور غير صحيحة" });
    }

    // Regenerate session to prevent session fixation attacks
    await new Promise<void>((resolve, reject) => {
      req.session.regenerate((err) => {
        if (err) return reject(err);
        req.session.agentId = agent.id;
        req.session.agentName = agent.name;
        req.session.agentEmail = agent.email;
        resolve();
      });
    });

    log(`Agent login: ${agent.email}`, "agent");

    return res.json({
      success: true,
      data: {
        id: agent.id,
        name: agent.name,
        email: agent.email,
        phone: agent.phone,
        referralCode: agent.referralCode,
        commissionRate: agent.commissionRate,
        totalUsers: agent.totalUsers,
        totalRevenue: agent.totalRevenue,
        balance: agent.balance,
        status: agent.status,
      },
    });
  } catch (err: any) {
    log(`Agent login error: ${err.message}`, "agent");
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.post("/auth/logout", requireAgent, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("connect.sid");
    res.json({ success: true });
  });
});

router.get("/auth/me", requireAgent, (req, res) => {
  const mockAgents = getMockAgents();
  const agent = mockAgents.find((a) => a.id === req.session.agentId);
  if (!agent) return res.status(401).json({ success: false, message: "جلسة غير صالحة" });

  return res.json({
    success: true,
    data: {
      id: agent.id,
      name: agent.name,
      email: agent.email,
      phone: agent.phone,
      referralCode: agent.referralCode,
      commissionRate: agent.commissionRate,
      totalUsers: agent.totalUsers,
      totalRevenue: agent.totalRevenue,
      balance: agent.balance,
      status: agent.status,
    },
  });
});

// ════════════════════════════════════════════════════════════
// AGENT DASHBOARD STATS
// ════════════════════════════════════════════════════════════

router.get("/stats", requireAgent, (req, res) => {
  const mockAgents = getMockAgents();
  const agent = mockAgents.find((a) => a.id === req.session.agentId);
  if (!agent) return res.status(401).json({ success: false, message: "جلسة غير صالحة" });

  return res.json({
    success: true,
    data: {
      totalUsers: agent.totalUsers,
      totalRevenue: agent.totalRevenue,
      balance: agent.balance,
      commissionRate: agent.commissionRate,
      referralCode: agent.referralCode,
      status: agent.status,
    },
  });
});

export default router;
