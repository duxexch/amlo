/**
 * Payment Routes — بوابات الدفع (Stripe + PayPal)
 * ═══════════════════════════════════════════
 * Handles coin package purchases via Stripe/PayPal.
 * - POST /checkout  — Create Stripe Checkout session for a coin package
 * - POST /webhook   — Stripe webhook handler (fulfills purchases)
 * - GET  /paypal/return — PayPal return URL that captures payment and fulfills purchase
 * - GET  /packages  — List available coin packages
 * - GET  /history   — User's payment history
 */
import { Router, type Request, type Response } from "express";
import Stripe from "stripe";
import { getPool } from "../db";
import { createLogger } from "../logger";
import { io } from "../index";

const log = createLogger("payments");
const router = Router();

// ── Stripe initialization (lazy — only if configured) ──
let stripe: Stripe | null = null;
let stripeKeyInUse = "";

function getStripe(secretKey?: string): Stripe {
  const key = String(secretKey || process.env.STRIPE_SECRET_KEY || "").trim();
  if (!key) throw new Error("STRIPE_SECRET_KEY not configured");

  if (!stripe || stripeKeyInUse !== key) {
    stripe = new Stripe(key);
    stripeKeyInUse = key;
  }

  return stripe;
}

const SUCCESS_URL = process.env.STRIPE_SUCCESS_URL || "https://mrco.live/wallet?status=success";
const CANCEL_URL = process.env.STRIPE_CANCEL_URL || "https://mrco.live/wallet?status=cancelled";
const PAYPAL_RETURN_URL = process.env.PAYPAL_RETURN_URL || "https://mrco.live/api/v1/payments/paypal/return";

type GatewayConfig = {
  enabled: boolean;
  displayName: string;
  countries: string[];
  mode?: "sandbox" | "live";
  priority?: number;
  credentials: Record<string, string>;
};

type ProviderUnavailableReasonCode =
  | "gateway_disabled"
  | "country_restricted"
  | "credentials_missing"
  | "no_deposit_method"
  | "amount_out_of_range";

type ProviderAvailability = {
  key: string;
  displayName: string;
  mode: string;
  priority: number;
  available: boolean;
  reasonCode?: ProviderUnavailableReasonCode;
  reasonText?: string;
  minAmount?: number;
  maxAmount?: number;
  countries: string[];
  requiredCredentials: string[];
  isReady: boolean;
  hasCredentials: boolean;
  credentialsMask: Record<string, string>;
};

const DEFAULT_GATEWAYS: Record<string, GatewayConfig> = {
  stripe: {
    enabled: true,
    displayName: "Stripe",
    countries: ["*"],
    mode: "live",
    priority: 1,
    credentials: {
      publicKey: "",
      secretKey: "",
      webhookSecret: "",
    },
  },
  paypal: {
    enabled: false,
    displayName: "PayPal",
    countries: ["*"],
    mode: "live",
    priority: 2,
    credentials: {
      clientId: "",
      clientSecret: "",
      webhookId: "",
    },
  },
};

function getRequiredCredentialKeys(provider: string): string[] {
  const key = String(provider || "").toLowerCase();
  if (key === "stripe") return ["secretKey"];
  if (key === "paypal") return ["clientId", "clientSecret"];
  return [];
}

function isGatewayReady(provider: string, cfg: GatewayConfig): boolean {
  const required = getRequiredCredentialKeys(provider);
  if (required.length === 0) return true;
  return required.every((k) => String(cfg?.credentials?.[k] || "").trim().length > 0);
}

function detectCountry(req: Request): string {
  const headerCountry = String(
    req.headers["cf-ipcountry"] ||
    req.headers["x-vercel-ip-country"] ||
    req.headers["x-country-code"] ||
    ""
  ).trim().toUpperCase();
  return headerCountry.length === 2 ? headerCountry : "";
}

function maskSecret(value: string): string {
  if (!value) return "";
  if (value.length <= 6) return "***";
  return `${value.slice(0, 4)}***${value.slice(-2)}`;
}

function normalizeIdempotencyKey(input: unknown): string {
  const raw = String(input || "").trim();
  if (!raw) return "";
  const compact = raw.replace(/[^a-zA-Z0-9._:-]/g, "");
  return compact.slice(0, 120);
}

function providerReasonText(code: ProviderUnavailableReasonCode, lang: "ar" | "en"): string {
  if (lang === "en") {
    if (code === "gateway_disabled") return "Provider is disabled by admin";
    if (code === "country_restricted") return "Not available in your country";
    if (code === "credentials_missing") return "Provider setup is incomplete";
    if (code === "no_deposit_method") return "No active deposit methods for this provider";
    return "Package amount is outside provider limits";
  }
  if (code === "gateway_disabled") return "البوابة معطلة من الإدارة";
  if (code === "country_restricted") return "غير متاحة في دولتك";
  if (code === "credentials_missing") return "إعدادات البوابة غير مكتملة";
  if (code === "no_deposit_method") return "لا توجد وسائل إيداع نشطة لهذه البوابة";
  return "قيمة الباقة خارج حدود البوابة";
}

function providerAmountRangeReasonText(lang: "ar" | "en", minAmount: number, maxAmount: number): string {
  const min = Number.isFinite(minAmount) ? minAmount : 0;
  const max = Number.isFinite(maxAmount) ? maxAmount : 0;
  if (lang === "en") {
    return `Package amount must be between ${min} and ${max} USD`;
  }
  return `قيمة الباقة يجب أن تكون بين ${min} و${max} دولار`;
}

function preferEnglish(req: Request): boolean {
  return String(req.headers["accept-language"] || "").toLowerCase().includes("en");
}

async function findExistingOrderByIdempotency(userId: string, idempotencyKey: string) {
  const pool = getPool();
  if (!pool || !idempotencyKey) return null;
  const { rows } = await pool.query(
    `SELECT id, status, provider, provider_reference, checkout_url, fail_reason, created_at
     FROM payment_orders
     WHERE user_id = $1 AND idempotency_key = $2
     LIMIT 1`,
    [userId, idempotencyKey],
  );
  return rows[0] || null;
}

async function createPaymentOrder(params: {
  userId: string;
  packageId: string;
  provider: string;
  amount: number;
  currency: string;
  idempotencyKey: string;
  expiresAt?: Date;
}) {
  const pool = getPool();
  if (!pool) throw new Error("DB_UNAVAILABLE");
  const { userId, packageId, provider, amount, currency, idempotencyKey, expiresAt } = params;

  const { rows } = await pool.query(
    `INSERT INTO payment_orders (user_id, package_id, provider, amount, currency, status, idempotency_key, expires_at)
     VALUES ($1, $2, $3, $4, $5, 'created', $6, $7)
     ON CONFLICT (user_id, idempotency_key) DO NOTHING
     RETURNING id`,
    [userId, packageId, provider, amount, currency, idempotencyKey, expiresAt || null],
  );

  return rows[0]?.id ? String(rows[0].id) : null;
}

async function updatePaymentOrderStatus(orderId: string, patch: {
  status?: string;
  providerReference?: string;
  checkoutUrl?: string;
  failReason?: string;
  metadata?: Record<string, unknown>;
}) {
  const pool = getPool();
  if (!pool) return;

  await pool.query(
    `UPDATE payment_orders
     SET status = COALESCE($2, status),
         provider_reference = COALESCE($3, provider_reference),
         checkout_url = COALESCE($4, checkout_url),
         fail_reason = COALESCE($5, fail_reason),
         metadata = COALESCE($6, metadata),
         updated_at = now()
     WHERE id = $1`,
    [
      orderId,
      patch.status || null,
      patch.providerReference || null,
      patch.checkoutUrl || null,
      patch.failReason || null,
      patch.metadata ? JSON.stringify(patch.metadata) : null,
    ],
  );
}

async function loadGatewayConfig() {
  const pool = getPool();
  if (!pool) return DEFAULT_GATEWAYS;

  try {
    const { rows } = await pool.query(
      `SELECT value FROM system_settings WHERE key = 'payment_gateways_config' LIMIT 1`
    );
    const raw = rows[0]?.value ? JSON.parse(rows[0].value) : {};
    const merged: Record<string, GatewayConfig> = JSON.parse(JSON.stringify(DEFAULT_GATEWAYS));

    if (raw && typeof raw === "object") {
      for (const [provider, cfg] of Object.entries(raw as Record<string, any>)) {
        const base = merged[provider] || {
          enabled: false,
          displayName: provider,
          countries: ["*"],
          mode: "live",
          priority: 99,
          credentials: {},
        };
        merged[provider] = {
          enabled: cfg?.enabled ?? base.enabled,
          displayName: String(cfg?.displayName || base.displayName),
          countries: Array.isArray(cfg?.countries) ? cfg.countries.map((c: unknown) => String(c || "").toUpperCase()) : base.countries,
          mode: cfg?.mode === "sandbox" ? "sandbox" : "live",
          priority: Number.isFinite(Number(cfg?.priority)) ? Number(cfg.priority) : base.priority,
          credentials: {
            ...(base.credentials || {}),
            ...((cfg?.credentials && typeof cfg.credentials === "object") ? cfg.credentials : {}),
          },
        };
      }
    }

    if (merged.stripe) {
      merged.stripe.credentials = {
        ...(merged.stripe.credentials || {}),
        secretKey: String(merged.stripe.credentials?.secretKey || process.env.STRIPE_SECRET_KEY || ""),
        webhookSecret: String(merged.stripe.credentials?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || ""),
      };
    }

    return merged;
  } catch {
    const fallback = JSON.parse(JSON.stringify(DEFAULT_GATEWAYS)) as Record<string, GatewayConfig>;
    if (fallback.stripe) {
      fallback.stripe.credentials = {
        ...(fallback.stripe.credentials || {}),
        secretKey: String(process.env.STRIPE_SECRET_KEY || ""),
        webhookSecret: String(process.env.STRIPE_WEBHOOK_SECRET || ""),
      };
    }
    return fallback;
  }
}

function getPayPalBaseUrl(mode: "sandbox" | "live" = "live") {
  return mode === "sandbox"
    ? "https://api-m.sandbox.paypal.com"
    : "https://api-m.paypal.com";
}

async function getPayPalAccessToken(cfg: GatewayConfig): Promise<string> {
  const clientId = String(cfg.credentials?.clientId || "").trim();
  const clientSecret = String(cfg.credentials?.clientSecret || "").trim();
  if (!clientId || !clientSecret) throw new Error("PAYPAL_CREDENTIALS_MISSING");

  const auth = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const resp = await fetch(`${getPayPalBaseUrl(cfg.mode || "live")}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      Authorization: `Basic ${auth}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
  });

  if (!resp.ok) throw new Error("PAYPAL_AUTH_FAILED");
  const json = await resp.json();
  const token = String(json?.access_token || "");
  if (!token) throw new Error("PAYPAL_TOKEN_EMPTY");
  return token;
}

type PurchaseMeta = {
  userId: string;
  packageId: string;
  coins: number;
};

function encodePayPalCustomMeta(meta: PurchaseMeta) {
  return `u:${meta.userId}|p:${meta.packageId}|c:${meta.coins}`;
}

function decodePayPalCustomMeta(value: string): PurchaseMeta | null {
  try {
    const parts = String(value || "").split("|");
    const map = Object.fromEntries(parts.map((x) => x.split(":")));
    const userId = String(map.u || "");
    const packageId = String(map.p || "");
    const coins = Number(map.c || 0);
    if (!userId || !packageId || !Number.isFinite(coins) || coins <= 0) return null;
    return { userId, packageId, coins };
  } catch {
    return null;
  }
}

async function fulfillPurchase(params: {
  userId: string;
  coinAmount: number;
  referenceId: string;
  paymentMethod: string;
  description: string;
  providerReference?: string;
}) {
  const pool = getPool();
  if (!pool) throw new Error("DB_UNAVAILABLE");

  const { userId, coinAmount, referenceId, paymentMethod, description, providerReference } = params;

  const { rows: existing } = await pool.query(
    `SELECT id FROM wallet_transactions WHERE reference_id = $1 AND type = 'purchase' LIMIT 1`,
    [referenceId]
  );
  if (existing.length > 0) {
    return { duplicate: true };
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { rows } = await client.query(
      `UPDATE users SET coins = coins + $1 WHERE id = $2 RETURNING coins`,
      [coinAmount, userId]
    );

    if (!rows[0]) {
      await client.query("ROLLBACK");
      throw new Error("USER_NOT_FOUND");
    }

    await client.query(
      `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, currency, description, reference_id, payment_method, status)
       VALUES ($1, 'purchase', $2, $3, 'coins', $4, $5, $6, 'completed')`,
      [userId, coinAmount, rows[0].coins, description, referenceId, paymentMethod]
    );

    await client.query("COMMIT");

    try {
      await pool.query(
        `UPDATE payment_orders
         SET status = 'paid', updated_at = now()
         WHERE user_id = $1 AND provider_reference = $2 AND status <> 'paid'`,
        [userId, String(providerReference || referenceId)],
      );
    } catch {
      // Do not fail fulfillment when order sync fails.
    }

    io.to(`user:${userId}`).emit("balance-update", { coins: rows[0].coins });
    io.emit("finance-updated", {
      type: "purchase-completed",
      ts: Date.now(),
      userId,
      transactionRef: referenceId,
    });

    return { duplicate: false, balance: rows[0].coins };
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

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

// ── GET /providers — available deposit providers by country + method bindings ──
router.get("/providers", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يجب تسجيل الدخول" });

  try {
    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    const country = detectCountry(req);
    const gateways = await loadGatewayConfig();

    const { rows: methods } = await pool.query(
      `SELECT id, name, name_ar, icon, type, account_details, min_amount, max_amount, fee, is_active
       FROM payment_methods
       WHERE is_active = true
       ORDER BY sort_order`
    );

    const mappedMethods = methods.map((m: any) => {
      const details = (() => {
        try { return m.account_details ? JSON.parse(m.account_details) : {}; } catch { return {}; }
      })();
      const methodCountries = Array.isArray(details?.countries)
        ? details.countries.map((c: unknown) => String(c || "").toUpperCase())
        : ["*"];
      const usage = String(details?.usageTarget || details?.usage || "both").toLowerCase();
      return {
        id: m.id,
        name: m.name,
        nameAr: m.name_ar,
        icon: m.icon,
        type: m.type,
        provider: String(details?.provider || "").toLowerCase(),
        countries: methodCountries.length > 0 ? methodCountries : ["*"],
        usageTarget: usage === "deposit" || usage === "withdrawal" ? usage : "both",
        minAmount: Number(m.min_amount || 1),
        maxAmount: Number(m.max_amount || 50000),
        fee: String(details?.fee || m.fee || "0"),
      };
    }).filter((m) => m.usageTarget === "both" || m.usageTarget === "deposit")
      .filter((m) => !country || m.countries.includes("*") || m.countries.includes(country));

    const packageId = String(req.query.packageId || "").trim();
    let packageAmountUsd: number | null = null;
    if (packageId) {
      try {
        const { rows: pkgRows } = await pool.query(
          `SELECT price_usd FROM coin_packages WHERE id = $1 AND is_active = true LIMIT 1`,
          [packageId],
        );
        const value = Number(pkgRows[0]?.price_usd || 0);
        if (Number.isFinite(value) && value > 0) {
          packageAmountUsd = value;
        }
      } catch {
        packageAmountUsd = null;
      }
    }

    const lang: "ar" | "en" = preferEnglish(req) ? "en" : "ar";

    const allGatewayStatuses: ProviderAvailability[] = Object.entries(gateways)
      .map(([provider, cfg]) => {
        const requiredCredentials = getRequiredCredentialKeys(provider);
        const isReady = isGatewayReady(provider, cfg);
        const countryAllowed = !country || cfg.countries.includes("*") || cfg.countries.includes(country);
        const enabled = !!cfg.enabled;

        let reasonCode: ProviderUnavailableReasonCode | undefined;
        if (!enabled) reasonCode = "gateway_disabled";
        else if (!countryAllowed) reasonCode = "country_restricted";
        else if (!isReady) reasonCode = "credentials_missing";

        return {
          key: provider,
          displayName: cfg.displayName,
          mode: cfg.mode || "live",
          priority: cfg.priority || 99,
          countries: cfg.countries,
          requiredCredentials,
          isReady,
          available: !reasonCode,
          ...(reasonCode ? { reasonCode, reasonText: providerReasonText(reasonCode, lang) } : {}),
          hasCredentials: Object.values(cfg.credentials || {}).some((v) => String(v || "").trim().length > 0),
          credentialsMask: Object.fromEntries(Object.entries(cfg.credentials || {}).map(([k, v]) => [k, maskSecret(String(v || ""))])),
        };
      })
      .sort((a, b) => a.priority - b.priority);

    const readyProviderKeys = new Set(
      allGatewayStatuses
        .filter((p) => p.available)
        .map((p) => p.key),
    );
    const localProviderKeys = Array.from(new Set(
      mappedMethods
        .map((m) => String(m.provider || "").trim().toLowerCase())
        .filter((provider) => !!provider && !readyProviderKeys.has(provider))
    ));

    const localProviders = localProviderKeys.map((key, idx) => ({
      key,
      displayName: key,
      mode: "manual",
      priority: 200 + idx,
      countries: ["*"],
      requiredCredentials: [],
      isReady: true,
      available: true,
      hasCredentials: true,
      credentialsMask: {},
    })) as ProviderAvailability[];

    const allProviders = [...allGatewayStatuses, ...localProviders]
      .sort((a, b) => Number(a.priority || 99) - Number(b.priority || 99));

    const methodsByProviderCount = mappedMethods.reduce((acc: Record<string, number>, m: any) => {
      const key = String(m.provider || "").trim().toLowerCase();
      if (!key) return acc;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});

    const providerMethodRange = mappedMethods.reduce((acc: Record<string, { min: number; max: number }>, m: any) => {
      const key = String(m.provider || "").trim().toLowerCase();
      if (!key) return acc;
      const minAmount = Number(m.minAmount || 1);
      const maxAmount = Number(m.maxAmount || 50000);
      if (!Number.isFinite(minAmount) || !Number.isFinite(maxAmount) || minAmount > maxAmount) return acc;

      const current = acc[key];
      if (!current) {
        acc[key] = { min: minAmount, max: maxAmount };
      } else {
        acc[key] = {
          min: Math.min(current.min, minAmount),
          max: Math.max(current.max, maxAmount),
        };
      }
      return acc;
    }, {});

    const providersWithMethodCheck = allProviders.map((p) => {
      if (!p.available) return p;
      const key = String(p.key || "").trim().toLowerCase();
      if (!key) return p;
      if ((methodsByProviderCount[key] || 0) <= 0) {
        return {
          ...p,
          available: false,
          reasonCode: "no_deposit_method" as ProviderUnavailableReasonCode,
          reasonText: providerReasonText("no_deposit_method", lang),
        };
      }

      if (packageAmountUsd !== null) {
        const range = providerMethodRange[key];
        if (range && (packageAmountUsd < range.min || packageAmountUsd > range.max)) {
          return {
            ...p,
            available: false,
            reasonCode: "amount_out_of_range" as ProviderUnavailableReasonCode,
            reasonText: providerAmountRangeReasonText(lang, range.min, range.max),
            minAmount: range.min,
            maxAmount: range.max,
          };
        }
      }

      return {
        ...p,
        available: true,
      };
    });

    const availableProviders = providersWithMethodCheck.filter((p) => p.available);
    const unavailableProviders = providersWithMethodCheck.filter((p) => !p.available);

    const enabledProviderKeys = new Set(availableProviders.map((p) => p.key));
    const methodsForReadyProviders = mappedMethods.filter((m) => !m.provider || enabledProviderKeys.has(m.provider));

    let recommendedProvider: string | null = null;
    try {
      const { rows: lastRows } = await pool.query(
        `SELECT payment_method FROM wallet_transactions
         WHERE user_id = $1 AND type = 'purchase' AND status = 'completed'
         ORDER BY created_at DESC LIMIT 1`,
        [userId],
      );
      const lastProvider = String(lastRows[0]?.payment_method || "").trim().toLowerCase();
      if (lastProvider && availableProviders.some((p) => p.key === lastProvider)) {
        recommendedProvider = lastProvider;
      }
    } catch {
      // Ignore recommendation source errors.
    }
    if (!recommendedProvider) {
      recommendedProvider = availableProviders[0]?.key || null;
    }

    return res.json({
      success: true,
      data: {
        country: country || null,
        ...(packageAmountUsd !== null ? { packageAmountUsd } : {}),
        providers: availableProviders,
        unavailableProviders,
        recommendedProvider,
        paymentMethods: methodsForReadyProviders,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "تعذر تحميل مزودي الدفع" });
  }
});

// ── POST /checkout — create a Stripe Checkout Session ──
router.post("/checkout", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يجب تسجيل الدخول" });

  const { packageId, provider, idempotencyKey: bodyIdempotencyKey } = req.body;
  if (!packageId) return res.status(400).json({ success: false, message: "packageId مطلوب" });

  const providerKey = String(provider || "stripe").toLowerCase();
  const idempotencyKey = normalizeIdempotencyKey(
    req.headers["x-idempotency-key"] || bodyIdempotencyKey || `${userId}:${providerKey}:${packageId}`,
  );
  if (!idempotencyKey) {
    return res.status(400).json({ success: false, message: "idempotency key غير صالح" });
  }

  try {
    const existingOrder = await findExistingOrderByIdempotency(userId, idempotencyKey);
    if (existingOrder) {
      const status = String(existingOrder.status || "");
      if ((status === "created" || status === "pending_provider" || status === "processing") && existingOrder.checkout_url) {
        return res.json({
          success: true,
          data: {
            sessionId: existingOrder.provider_reference || existingOrder.id,
            url: existingOrder.checkout_url,
            reused: true,
            orderId: existingOrder.id,
          },
        });
      }
      if (status === "paid") {
        return res.json({
          success: true,
          data: {
            reused: true,
            paid: true,
            orderId: existingOrder.id,
            url: SUCCESS_URL,
          },
        });
      }
      if (status === "failed" || status === "expired" || status === "cancelled") {
        return res.status(409).json({ success: false, message: existingOrder.fail_reason || "محاولة الدفع السابقة انتهت، ابدأ محاولة جديدة" });
      }
    }

    const gateways = await loadGatewayConfig();
    const selectedGateway = gateways[providerKey];
    const country = detectCountry(req);
    const isManagedGateway = !!(selectedGateway && selectedGateway.enabled);

    if (isManagedGateway) {
      if (!isGatewayReady(providerKey, selectedGateway!)) {
        return res.status(400).json({ success: false, message: "بوابة الدفع غير مكتملة الإعداد" });
      }

      if (country && !selectedGateway!.countries.includes("*") && !selectedGateway!.countries.includes(country)) {
        return res.status(403).json({ success: false, message: "بوابة الدفع غير متاحة لدولتك" });
      }
    }

    const pool = getPool();
    if (!pool) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    const { rows: pkgs } = await pool.query(
      `SELECT * FROM coin_packages WHERE id = $1 AND is_active = true LIMIT 1`,
      [packageId]
    );
    const pkg = pkgs[0];
    if (!pkg) return res.status(404).json({ success: false, message: "الباقة غير موجودة" });

    const totalCoins = (pkg.coins || 0) + (pkg.bonus_coins || 0);
    const priceUsd = parseFloat(String(pkg.price_usd || 0));

    const createdOrderId = await createPaymentOrder({
      userId,
      packageId: String(pkg.id),
      provider: providerKey,
      amount: priceUsd,
      currency: "USD",
      idempotencyKey,
      expiresAt: new Date(Date.now() + 1000 * 60 * 30),
    });
    const orderId = createdOrderId || (await findExistingOrderByIdempotency(userId, idempotencyKey))?.id;
    if (!orderId) {
      return res.status(500).json({ success: false, message: "تعذر إنشاء طلب الدفع" });
    }

    // Enforce provider amount limits when deposit methods are configured for this provider.
    const { rows: providerMethods } = await pool.query(
      `SELECT account_details, min_amount, max_amount
       FROM payment_methods
       WHERE is_active = true`,
    );

    const matchingProviderMethods = providerMethods.filter((m: any) => {
      let details: any = {};
      try { details = m.account_details ? JSON.parse(m.account_details) : {}; } catch { details = {}; }
      const methodProvider = String(details?.provider || "").trim().toLowerCase();
      if (!methodProvider || methodProvider !== providerKey) return false;

      const usage = String(details?.usageTarget || details?.usage || "both").toLowerCase();
      const supportsDeposit = usage === "both" || usage === "deposit";
      if (!supportsDeposit) return false;

      const methodCountries = Array.isArray(details?.countries)
        ? details.countries.map((c: unknown) => String(c || "").toUpperCase())
        : ["*"];
      if (country && !methodCountries.includes("*") && !methodCountries.includes(country)) return false;
      return true;
    });

    if (matchingProviderMethods.length > 0) {
      const inRange = matchingProviderMethods.some((m: any) => {
        const minAmount = Number(m.min_amount || 1);
        const maxAmount = Number(m.max_amount || 50000);
        return Number.isFinite(minAmount) && Number.isFinite(maxAmount) && priceUsd >= minAmount && priceUsd <= maxAmount;
      });

      if (!inRange) {
        await updatePaymentOrderStatus(orderId, {
          status: "failed",
          failReason: "AMOUNT_OUT_OF_RANGE",
          metadata: { provider: providerKey, priceUsd },
        });
        return res.status(400).json({
          success: false,
          message: "قيمة الباقة خارج حدود وسيلة الدفع المختارة",
          code: "AMOUNT_OUT_OF_RANGE",
        });
      }
    }

    if (!isManagedGateway) {
      const { rows: localMethods } = await pool.query(
        `SELECT id, name, name_ar, account_details, min_amount, max_amount
         FROM payment_methods
         WHERE is_active = true
         ORDER BY sort_order`,
      );

      const matchedMethod = localMethods.find((m: any) => {
        let details: any = {};
        try { details = m.account_details ? JSON.parse(m.account_details) : {}; } catch { details = {}; }

        const methodProvider = String(details?.provider || "").trim().toLowerCase();
        if (!methodProvider || methodProvider !== providerKey) return false;

        const methodCountries = Array.isArray(details?.countries)
          ? details.countries.map((c: unknown) => String(c || "").toUpperCase())
          : ["*"];
        const usage = String(details?.usageTarget || details?.usage || "both").toLowerCase();
        const supportsDeposit = usage === "both" || usage === "deposit";
        if (!supportsDeposit) return false;
        if (country && !methodCountries.includes("*") && !methodCountries.includes(country)) return false;

        const minAmount = Number(m.min_amount || 1);
        const maxAmount = Number(m.max_amount || 50000);
        return priceUsd >= minAmount && priceUsd <= maxAmount;
      });

      if (!matchedMethod) {
        return res.status(400).json({ success: false, message: "وسيلة الدفع المحلية غير متاحة أو خارج الحدود المسموحة" });
      }

      const { rows: users } = await pool.query(`SELECT coins FROM users WHERE id = $1 LIMIT 1`, [userId]);
      if (!users[0]) {
        return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
      }

      const balanceBefore = Number(users[0].coins || 0);
      const referenceId = `local:${providerKey}:${Date.now()}:${pkg.id}`;
      await pool.query(
        `INSERT INTO wallet_transactions (user_id, type, amount, balance_after, currency, description, reference_id, payment_method, status)
         VALUES ($1, 'purchase', $2, $3, 'coins', $4, $5, $6, 'pending')`,
        [
          userId,
          totalCoins,
          balanceBefore,
          `طلب شحن ${totalCoins} كوينز عبر ${providerKey} — قيد المراجعة`,
          referenceId,
          providerKey,
        ]
      );

      io.emit("finance-updated", {
        type: "local-purchase-pending",
        ts: Date.now(),
        userId,
        provider: providerKey,
      });

      return res.json({
        success: true,
        data: {
          orderId,
          manual: true,
          status: "pending",
          referenceId,
          provider: providerKey,
          message: `تم إنشاء طلب الدفع المحلي عبر ${providerKey}. ستتم المراجعة من الإدارة ثم إضافة الرصيد.`,
          url: `${SUCCESS_URL.replace("status=success", "status=pending-local")}`,
        },
      });
    }

    const gateway = selectedGateway as GatewayConfig;

    if (providerKey === "paypal") {
      const accessToken = await getPayPalAccessToken(gateway);
      const baseUrl = getPayPalBaseUrl(gateway.mode || "live");

      const createResp = await fetch(`${baseUrl}/v2/checkout/orders`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          intent: "CAPTURE",
          purchase_units: [
            {
              amount: {
                currency_code: "USD",
                value: priceUsd.toFixed(2),
              },
              description: `${totalCoins} coins package`,
              custom_id: encodePayPalCustomMeta({ userId, packageId: String(pkg.id), coins: totalCoins }),
            },
          ],
          application_context: {
            return_url: PAYPAL_RETURN_URL,
            cancel_url: CANCEL_URL,
            brand_name: "Ablox",
            user_action: "PAY_NOW",
          },
        }),
      });

      const createJson = await createResp.json().catch(() => ({} as any));
      if (!createResp.ok) {
        log.error(`PayPal create order error: ${JSON.stringify(createJson)}`);
        return res.status(500).json({ success: false, message: "تعذر إنشاء طلب PayPal" });
      }

      const approveUrl = (Array.isArray(createJson?.links) ? createJson.links : []).find((l: any) => l?.rel === "approve")?.href;
      if (!approveUrl) {
        return res.status(500).json({ success: false, message: "تعذر بدء الدفع عبر PayPal" });
      }

      log.info(`PayPal order created: ${createJson.id} for user ${userId}, package ${pkg.id}`);
      await updatePaymentOrderStatus(orderId, {
        status: "pending_provider",
        providerReference: String(createJson.id || ""),
        checkoutUrl: approveUrl,
      });
      return res.json({ success: true, data: { sessionId: createJson.id, url: approveUrl } });
    }

    if (providerKey !== "stripe") {
      return res.status(501).json({ success: false, message: `بوابة ${selectedGateway.displayName || providerKey} غير مدعومة بعد في الشراء المباشر حالياً` });
    }

    const stripeSecret = String(gateway.credentials?.secretKey || "").trim();
    const s = getStripe(stripeSecret);
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
        provider: providerKey,
      },
      success_url: SUCCESS_URL,
      cancel_url: CANCEL_URL,
    });

    log.info(`Checkout session created: ${session.id} for user ${userId}, package ${pkg.id}, provider ${providerKey}`);
    await updatePaymentOrderStatus(orderId, {
      status: "pending_provider",
      providerReference: String(session.id || ""),
      checkoutUrl: String(session.url || ""),
    });
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
  const gateways = await loadGatewayConfig();
  const stripeCfg = gateways.stripe;
  const webhookSecret = String(stripeCfg?.credentials?.webhookSecret || process.env.STRIPE_WEBHOOK_SECRET || "").trim();
  const stripeSecret = String(stripeCfg?.credentials?.secretKey || process.env.STRIPE_SECRET_KEY || "").trim();

  if (!sig || !webhookSecret) {
    return res.status(400).json({ error: "Missing signature or webhook secret" });
  }

  let event: Stripe.Event;
  try {
    const s = getStripe(stripeSecret);
    // req.body should be the raw buffer if configured correctly
    event = s.webhooks.constructEvent(req.body, sig, webhookSecret);
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
      const result = await fulfillPurchase({
        userId,
        coinAmount,
        referenceId: String(session.id),
        paymentMethod: "stripe",
        description: `شراء ${coinAmount} كوينز عبر Stripe`,
        providerReference: String(session.id),
      });

      try {
        const pool = getPool();
        if (pool) {
          await pool.query(
            `UPDATE payment_orders
             SET status = 'paid', updated_at = now()
             WHERE provider_reference = $1 AND status <> 'paid'`,
            [String(session.id)],
          );
        }
      } catch {
        // Do not fail webhook on order sync issues.
      }

      if (result.duplicate) {
        log.info(`Webhook: duplicate fulfillment skipped for session ${session.id}`);
      } else {
        log.info(`Payment fulfilled: user ${userId} received ${coinAmount} coins (session ${session.id})`);
      }
    } catch (err: any) {
      log.error(`Webhook fulfillment error: ${err.message}`);
      // Return 500 so Stripe retries
      return res.status(500).json({ error: "Fulfillment failed" });
    }
  }

  return res.json({ received: true });
});

// ── GET /paypal/return — capture PayPal payment and fulfill purchase ──
router.get("/paypal/return", async (req: Request, res: Response) => {
  const orderToken = String(req.query.token || req.query.orderId || "");
  if (!orderToken) return res.redirect(CANCEL_URL);

  try {
    const pool = getPool();
    if (!pool) return res.redirect(CANCEL_URL);

    const referenceId = `paypal:${orderToken}`;
    const { rows: existing } = await pool.query(
      `SELECT id FROM wallet_transactions WHERE reference_id = $1 AND type = 'purchase' LIMIT 1`,
      [referenceId]
    );
    if (existing.length > 0) {
      return res.redirect(SUCCESS_URL);
    }

    const gateways = await loadGatewayConfig();
    const paypalCfg = gateways.paypal;
    if (!paypalCfg || !paypalCfg.enabled) return res.redirect(CANCEL_URL);

    const accessToken = await getPayPalAccessToken(paypalCfg);
    const baseUrl = getPayPalBaseUrl(paypalCfg.mode || "live");

    const captureResp = await fetch(`${baseUrl}/v2/checkout/orders/${encodeURIComponent(orderToken)}/capture`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: "{}",
    });

    const captureJson = await captureResp.json().catch(() => ({} as any));
    if (!captureResp.ok) {
      log.error(`PayPal capture failed for ${orderToken}: ${JSON.stringify(captureJson)}`);
      try {
        await pool.query(
          `UPDATE payment_orders
           SET status = 'failed', fail_reason = $2, updated_at = now()
           WHERE provider_reference = $1 AND status <> 'paid'`,
          [orderToken, "PAYPAL_CAPTURE_FAILED"],
        );
      } catch {
        // Best effort sync.
      }
      return res.redirect(CANCEL_URL);
    }

    const customId = String(captureJson?.purchase_units?.[0]?.custom_id || "");
    const meta = decodePayPalCustomMeta(customId);
    if (!meta) {
      log.error(`PayPal capture missing custom_id for order ${orderToken}`);
      try {
        await pool.query(
          `UPDATE payment_orders
           SET status = 'failed', fail_reason = $2, updated_at = now()
           WHERE provider_reference = $1 AND status <> 'paid'`,
          [orderToken, "PAYPAL_METADATA_MISSING"],
        );
      } catch {
        // Best effort sync.
      }
      return res.redirect(CANCEL_URL);
    }

    const { rows: packages } = await pool.query(
      `SELECT id, price_usd FROM coin_packages WHERE id = $1 LIMIT 1`,
      [meta.packageId]
    );
    const matchedPackage = packages[0];
    if (!matchedPackage) {
      log.error(`PayPal capture package mismatch for order ${orderToken}: package ${meta.packageId} not found`);
      try {
        await pool.query(
          `UPDATE payment_orders
           SET status = 'failed', fail_reason = $2, updated_at = now()
           WHERE provider_reference = $1 AND status <> 'paid'`,
          [orderToken, "PAYPAL_PACKAGE_MISMATCH"],
        );
      } catch {
        // Best effort sync.
      }
      return res.redirect(CANCEL_URL);
    }

    const expectedUsd = Number(matchedPackage.price_usd || 0);
    const captureEntry = captureJson?.purchase_units?.[0]?.payments?.captures?.[0];
    const capturedCurrency = String(captureEntry?.amount?.currency_code || "").toUpperCase();
    const capturedAmount = Number(captureEntry?.amount?.value || 0);
    const captureStatus = String(captureEntry?.status || "").toUpperCase();

    if (captureStatus !== "COMPLETED" || capturedCurrency !== "USD" || !Number.isFinite(capturedAmount) || Math.abs(capturedAmount - expectedUsd) > 0.01) {
      log.error(`PayPal capture amount validation failed for order ${orderToken}: status=${captureStatus}, currency=${capturedCurrency}, captured=${capturedAmount}, expected=${expectedUsd}`);
      try {
        await pool.query(
          `UPDATE payment_orders
           SET status = 'failed', fail_reason = $2, updated_at = now()
           WHERE provider_reference = $1 AND status <> 'paid'`,
          [orderToken, "PAYPAL_VALIDATION_FAILED"],
        );
      } catch {
        // Best effort sync.
      }
      return res.redirect(CANCEL_URL);
    }

    await fulfillPurchase({
      userId: meta.userId,
      coinAmount: meta.coins,
      referenceId,
      paymentMethod: "paypal",
      description: `شراء ${meta.coins} كوينز عبر PayPal`,
      providerReference: orderToken,
    });

    try {
      await pool.query(
        `UPDATE payment_orders
         SET status = 'paid', updated_at = now()
         WHERE provider_reference = $1 AND status <> 'paid'`,
        [orderToken],
      );
    } catch {
      // Best effort sync.
    }

    return res.redirect(SUCCESS_URL);
  } catch (err: any) {
    log.error(`PayPal return error: ${err.message}`);
    try {
      const pool = getPool();
      if (pool && orderToken) {
        await pool.query(
          `UPDATE payment_orders
           SET status = 'failed', fail_reason = $2, updated_at = now()
           WHERE provider_reference = $1 AND status <> 'paid'`,
          [orderToken, String(err?.message || "PAYPAL_RETURN_ERROR")],
        );
      }
    } catch {
      // Ignore sync failure.
    }
    return res.redirect(CANCEL_URL);
  }
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
