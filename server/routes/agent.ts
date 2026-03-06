import { Router, type Request, type Response } from "express";
import { requireAgent } from "../middleware/agentAuth";
import { rateLimitLogin } from "../middleware/adminAuth";
import { verifyPasswordAsync } from "../utils/crypto";
import { z } from "zod";
import { createLogger } from "../logger";
import { storage } from "../storage";
import { getPool } from "../db";
const log = (msg: string, _src?: string) => agentLog.info(msg);
const agentLog = createLogger("agent");

const router = Router();

// ── Agent Login Schema ──
const agentLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// Helper to format agent data for API responses
function formatAgentResponse(agent: any) {
  return {
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
  };
}

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
    const agent = await storage.getAgentByEmail(email);

    if (!agent || agent.status !== "active" || !(await verifyPasswordAsync(password, agent.passwordHash))) {
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

    return res.json({ success: true, data: formatAgentResponse(agent) });
  } catch (err: any) {
    log(`Agent login error: ${err.message}`, "agent");
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

router.post("/auth/logout", requireAgent, (req, res) => {
  req.session.destroy(() => {
    res.clearCookie("ablox.sid");
    res.clearCookie("connect.sid");  // clear legacy cookie
    res.json({ success: true });
  });
});

router.get("/auth/me", requireAgent, async (req, res) => {
  const agent = await storage.getAgent(req.session.agentId!);
  if (!agent) return res.status(401).json({ success: false, message: "جلسة غير صالحة" });

  return res.json({ success: true, data: formatAgentResponse(agent) });
});

// ════════════════════════════════════════════════════════════
// AGENT DASHBOARD STATS
// ════════════════════════════════════════════════════════════

router.get("/stats", requireAgent, async (req, res) => {
  const agent = await storage.getAgent(req.session.agentId!);
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

// ════════════════════════════════════════════════════════════
// REFERRED USERS LIST — المستخدمين المُحالين
// ════════════════════════════════════════════════════════════

router.get("/users", requireAgent, async (req: Request, res: Response) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    const agentId = req.session.agentId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    const result = await pool.query(
      `SELECT id, username, display_name as "displayName", avatar, level, xp, coins,
              is_verified as "isVerified", status, country, created_at as "createdAt",
              last_online_at as "lastOnlineAt"
       FROM users
       WHERE referred_by_agent = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset],
    );

    const countResult = await pool.query(
      `SELECT COUNT(*)::int as total FROM users WHERE referred_by_agent = $1`,
      [agentId],
    );

    return res.json({
      success: true,
      data: result.rows,
      pagination: { total: countResult.rows[0].total, page, limit },
    });
  } catch (err: any) {
    agentLog.error(`Agent users list error: ${err.message}`);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ════════════════════════════════════════════════════════════
// COMMISSION TRANSACTIONS LOG — سجل العمولات
// ════════════════════════════════════════════════════════════

router.get("/commissions", requireAgent, async (req: Request, res: Response) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    const agentId = req.session.agentId!;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = (page - 1) * limit;

    // Get gift transactions where sender is referred by this agent
    const result = await pool.query(
      `SELECT gt.id, gt.sender_id as "senderId", gt.receiver_id as "receiverId",
              gt.total_price as "totalPrice", gt.created_at as "createdAt",
              g.name as "giftName", g.icon as "giftIcon",
              u.username as "senderUsername", u.display_name as "senderName"
       FROM gift_transactions gt
       JOIN users u ON u.id = gt.sender_id
       JOIN gifts g ON g.id = gt.gift_id
       WHERE u.referred_by_agent = $1
       ORDER BY gt.created_at DESC
       LIMIT $2 OFFSET $3`,
      [agentId, limit, offset],
    );

    return res.json({ success: true, data: result.rows });
  } catch (err: any) {
    agentLog.error(`Agent commissions error: ${err.message}`);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ════════════════════════════════════════════════════════════
// EARNINGS SUMMARY — ملخص الأرباح
// ════════════════════════════════════════════════════════════

router.get("/earnings", requireAgent, async (req: Request, res: Response) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    const agentId = req.session.agentId!;
    const agent = await storage.getAgent(agentId);
    if (!agent) return res.status(401).json({ success: false, message: "جلسة غير صالحة" });

    // Earnings by period
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(gt.total_price) FILTER (WHERE gt.created_at >= NOW() - INTERVAL '1 day'), 0)::int as "today",
         COALESCE(SUM(gt.total_price) FILTER (WHERE gt.created_at >= NOW() - INTERVAL '7 days'), 0)::int as "thisWeek",
         COALESCE(SUM(gt.total_price) FILTER (WHERE gt.created_at >= NOW() - INTERVAL '30 days'), 0)::int as "thisMonth",
         COALESCE(SUM(gt.total_price), 0)::int as "allTime"
       FROM gift_transactions gt
       JOIN users u ON u.id = gt.sender_id
       WHERE u.referred_by_agent = $1`,
      [agentId],
    );

    const commRate = parseFloat(agent.commissionRate || "10") / 100;
    const raw = result.rows[0];

    return res.json({
      success: true,
      data: {
        commissionRate: agent.commissionRate,
        balance: agent.balance,
        earnings: {
          today: Math.floor(raw.today * commRate),
          thisWeek: Math.floor(raw.thisWeek * commRate),
          thisMonth: Math.floor(raw.thisMonth * commRate),
          allTime: Math.floor(raw.allTime * commRate),
        },
        rawVolume: raw,
      },
    });
  } catch (err: any) {
    agentLog.error(`Agent earnings error: ${err.message}`);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ════════════════════════════════════════════════════════════
// WITHDRAWAL REQUEST — طلب سحب الرصيد
// ════════════════════════════════════════════════════════════

const withdrawalSchema = z.object({
  amount: z.number().positive().max(10000000),
  paymentDetails: z.string().max(2000).optional(),
});

router.post("/withdrawal", requireAgent, async (req: Request, res: Response) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  const parsed = withdrawalSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
  }

  try {
    const agentId = req.session.agentId!;
    const agent = await storage.getAgent(agentId);
    if (!agent) return res.status(401).json({ success: false, message: "جلسة غير صالحة" });

    const balance = parseFloat(agent.balance || "0");
    if (parsed.data.amount > balance) {
      return res.status(400).json({ success: false, message: "الرصيد غير كافي" });
    }

    // Create withdrawal request
    await pool.query(
      `INSERT INTO withdrawal_requests (user_id, amount, payment_details, status)
       VALUES ($1, $2, $3, 'pending')`,
      [agentId, parsed.data.amount, parsed.data.paymentDetails || null],
    );

    log(`Agent ${agentId} requested withdrawal: ${parsed.data.amount}`, "agent");
    return res.json({ success: true, message: "تم إرسال طلب السحب" });
  } catch (err: any) {
    agentLog.error(`Agent withdrawal error: ${err.message}`);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── GET /withdrawals — list agent's withdrawal requests ──
router.get("/withdrawals", requireAgent, async (req: Request, res: Response) => {
  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    const result = await pool.query(
      `SELECT id, amount, amount_usd as "amountUsd", status, admin_notes as "adminNotes",
              processed_at as "processedAt", created_at as "createdAt"
       FROM withdrawal_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 50`,
      [req.session.agentId!],
    );

    return res.json({ success: true, data: result.rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

export default router;
