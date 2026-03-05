/**
 * Payment Routes — بوابة الدفع (Stripe)
 * ═══════════════════════════════════════════
 * Handles coin package purchases via Stripe Checkout.
 * - POST /checkout  — Create Stripe Checkout session for a coin package
 * - POST /webhook   — Stripe webhook handler (fulfills purchases)
 * - GET  /packages  — List available coin packages
 * - GET  /history   — User's payment history
 */
import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { getPool } from "../db";
import { createLogger } from "../logger";

const log = createLogger("payments");
const router = Router();

// ── Stripe initialization (lazy — only if configured) ──
let stripe: Stripe | null = null;

function getStripe(): Stripe {
  if (!stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("STRIPE_SECRET_KEY not configured");
    stripe = new Stripe(key);
  }
  return stripe;
}

const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";
const SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || "https://mrco.live/wallet?status=success";
const CANCEL_URL = process.env.STRIPE_CANCEL_URL || "https://mrco.live/wallet?status=cancelled";

// ── GET /packages — list all active coin packages ──
router.get("/packages", async (_req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });
    const { rows } = await pool.query(
      `SELECT * FROM coin_packages WHERE is_active = true ORDER BY sort_order`
    );
    return res.json({ success: true, data: rows });
  } catch (err: any) {
    log.error(`List packages error: ${err.message}`);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── POST /checkout — create a Stripe Checkout Session ──
router.post("/checkout", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يجب تسجيل الدخول" });

  const { packageId } = req.body;
  if (!packageId) return res.status(400).json({ success: false, message: "packageId مطلوب" });

  try {
    const s = getStripe();

    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    // Find the coin package
    const { rows: pkgs } = await pool.query(
      `SELECT * FROM coin_packages WHERE id = $1 AND is_active = true LIMIT 1`,
      [packageId]
    );
    const pkg = pkgs[0];

    if (!pkg) return res.status(404).json({ success: false, message: "الباقة غير موجودة" });

    const totalCoins = (pkg.coins || 0) + (pkg.bonus_coins || 0);
    const priceInCents = Math.round(parseFloat(String(pkg.price_usd)) * 100);

    // Create Checkout Session
    const session = await s.checkout.sessions.create({
      payment_method_types: ["card"],
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            unit_amount: priceInCents,
            product_data: {
              name: `${totalCoins} كوينز`,
              description: pkg.bonus_coins > 0
                ? `${pkg.coins} كوينز + ${pkg.bonus_coins} بونص`
                : `${pkg.coins} كوينز`,
              images: ["https://mrco.live/icons/coin.png"],
            },
          },
          quantity: 1,
        },
      ],
      metadata: {
        userId,
        packageId: pkg.id,
        coins: String(totalCoins),
      },
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
    });

    log.info(`Checkout session created: ${session.id} for user ${userId}, package ${pkg.id}`);
    return res.json({ success: true, data: { sessionId: session.id, url: session.url } });
  } catch (err: any) {
    log.error(`Checkout error: ${err.message}`);
    if (err.message === "STRIPE_SECRET_KEY not configured") {
      return res.status(503).json({ success: false, message: "بوابة الدفع غير مفعّلة" });
    }
    return res.status(500).json({ success: false, message: "خطأ في إنشاء جلسة الدفع" });
  }
});

// ── POST /webhook — Stripe webhook handler ──
// NOTE: This route needs raw body parsing (not JSON).
// Must be mounted BEFORE express.json() middleware, or use
// express.raw({ type: 'application/json' }) specifically.
router.post("/webhook", async (req: Request, res: Response) => {
  const sig = req.headers["stripe-signature"] as string;
  if (!sig || !WEBHOOK_SECRET) {
    return res.status(400).json({ error: "Missing signature or webhook secret" });
  }

  let event: Stripe.Event;
  try {
    const s = getStripe();
    // req.body should be the raw buffer if configured correctly
    event = s.webhooks.constructEvent(req.body, sig, WEBHOOK_SECRET);
  } catch (err: any) {
    log.error(`Webhook signature verification failed: ${err.message}`);
    return res.status(400).json({ error: "Invalid signature" });
  }

  // Handle the checkout.session.completed event
  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const { userId, packageId, coins } = session.metadata || {};

    if (!userId || !coins) {
      log.error(`Webhook: missing metadata in session ${session.id}`);
      return res.json({ received: true });
    }

    const coinAmount = parseInt(coins, 10);
    if (isNaN(coinAmount) || coinAmount <= 0) {
      log.error(`Webhook: invalid coin amount ${coins}`);
      return res.json({ received: true });
    }

    try {
      const pool = getPool();
      if (!pool) {
        log.error(`Webhook: DB not available for fulfillment`);
        return res.status(500).json({ error: "DB unavailable" });
      }

      // ── Idempotency guard: skip if session already fulfilled ──
      const { rows: existing } = await pool.query(
        `SELECT id FROM wallet_transactions WHERE reference_id = $1 AND type = 'purchase' LIMIT 1`,
        [session.id]
      );
      if (existing.length > 0) {
        log.info(`Webhook: duplicate fulfillment skipped for session ${session.id}`);
        return res.json({ received: true });
      }

      // ── Wrap coin credit + transaction record in DB transaction ──
      const client = await pool.connect();
      try {
        await client.query("BEGIN");

        const { rows } = await client.query(
          `UPDATE users SET coins = coins + $1 WHERE id = $2 RETURNING coins`,
          [coinAmount, userId]
        );

        if (rows[0]) {
          await client.query(
            `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, currency, description, reference_id, payment_method, status)
             VALUES ($1, 'purchase', $2, $3, 'coins', $4, $5, 'stripe', 'completed')`,
            [userId, coinAmount, rows[0].coins, `شراء ${coinAmount} كوينز عبر Stripe`, session.id]
          );
        }

        await client.query("COMMIT");
        log.info(`Payment fulfilled: user ${userId} received ${coinAmount} coins (session ${session.id})`);
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      } finally {
        client.release();
      }
    } catch (err: any) {
      log.error(`Webhook fulfillment error: ${err.message}`);
      // Return 500 so Stripe retries
      return res.status(500).json({ error: "Fulfillment failed" });
    }
  }

  return res.json({ received: true });
});

// ── GET /history — user's payment history ──
router.get("/history", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يجب تسجيل الدخول" });

  try {
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });
    const { rows } = await pool.query(
      `SELECT * FROM wallet_transactions WHERE user_id = $1 AND type = 'purchase' ORDER BY created_at DESC LIMIT 50`,
      [userId]
    );
    return res.json({ success: true, data: rows });
  } catch (err: any) {
    log.error(`Payment history error: ${err.message}`);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

export default router;
