/**
 * Email & OTP Service — خدمة البريد الإلكتروني ورمز التحقق
 * ═══════════════════════════════════════════════════════════
 * Uses Nodemailer with configurable SMTP (Hostinger Titan / Gmail / etc.)
 * OTP codes stored in Redis with TTL.
 */
import nodemailer from "nodemailer";
import type { Transporter } from "nodemailer";
import { createLogger } from "../logger";
import { cacheGet, cacheSet, cacheDel } from "../redis";
import { randomInt } from "crypto";

const emailLog = createLogger("email");

function isOtpDevFallbackEnabled(): boolean {
  const flag = (process.env.OTP_DEV_FALLBACK || "").toLowerCase();
  if (flag === "true" || flag === "1") return true;
  if (flag === "false" || flag === "0") return false;
  return process.env.NODE_ENV !== "production";
}

function shouldLogDevOtpCode(): boolean {
  const flag = (process.env.OTP_DEV_LOG_OTP || "").toLowerCase();
  if (flag === "false" || flag === "0") return false;
  return isOtpDevFallbackEnabled();
}

// ── SMTP Config (from env, overridable by admin settings) ──
interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user: string;
  pass: string;
  senderName: string;
  senderEmail: string;
}

interface OtpConfig {
  codeLength: number;
  expiryMinutes: number;
  maxAttempts: number;
  cooldownMinutes: number;
}

// Default config from env
let smtpConfig: SmtpConfig = {
  host: process.env.SMTP_HOST || "smtp.hostinger.com",
  port: parseInt(process.env.SMTP_PORT || "465"),
  secure: (process.env.SMTP_SECURE ?? "true") === "true",
  user: process.env.SMTP_USER || "",
  pass: process.env.SMTP_PASS || "",
  senderName: process.env.SMTP_SENDER_NAME || "MRCO",
  senderEmail: process.env.SMTP_SENDER_EMAIL || process.env.SMTP_USER || "",
};

let otpConfig: OtpConfig = {
  codeLength: 6,
  expiryMinutes: 5,
  maxAttempts: 5,
  cooldownMinutes: 5,
};

let transporter: Transporter | null = null;

type LocalOtpRecord = {
  code: string;
  attempts: number;
  expiresAt: number;
  cooldownUntil: number;
};

const localOtpStore = new Map<string, LocalOtpRecord>();

function getLocalOtpRecord(emailLower: string): LocalOtpRecord | null {
  const rec = localOtpStore.get(emailLower);
  if (!rec) return null;
  const now = Date.now();
  if (rec.expiresAt <= now) {
    localOtpStore.delete(emailLower);
    return null;
  }
  return rec;
}

function setLocalOtpRecord(emailLower: string, code: string) {
  const now = Date.now();
  localOtpStore.set(emailLower, {
    code,
    attempts: 0,
    expiresAt: now + otpConfig.expiryMinutes * 60_000,
    cooldownUntil: now + otpConfig.cooldownMinutes * 60_000,
  });
}

function clearLocalOtpRecord(emailLower: string) {
  localOtpStore.delete(emailLower);
}

/**
 * Check if SMTP is configured and transport is available.
 */
export function isSmtpConfigured(): boolean {
  return transporter !== null;
}

/**
 * Initialize or reinitialize SMTP transport.
 */
function createTransport(): Transporter | null {
  if (!smtpConfig.user || !smtpConfig.pass) {
    emailLog.warn("⚠️ SMTP credentials not configured — email sending disabled. Set SMTP_USER and SMTP_PASS in .env");
    return null;
  }

  try {
    const t = nodemailer.createTransport({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: {
        user: smtpConfig.user,
        pass: smtpConfig.pass,
      },
      tls: {
        // Enforce TLS certificate verification in production to prevent MITM attacks
        rejectUnauthorized: process.env.NODE_ENV === "production"
          ? (process.env.SMTP_TLS_REJECT_UNAUTHORIZED !== "false")
          : false,
      },
    });

    emailLog.info(`SMTP transport created: ${smtpConfig.host}:${smtpConfig.port} (user: ${smtpConfig.user})`);
    return t;
  } catch (err: any) {
    emailLog.error({ err }, "Failed to create SMTP transport");
    return null;
  }
}

/**
 * Update SMTP config from admin settings (runtime).
 */
export function updateSmtpConfig(config: Partial<SmtpConfig>) {
  smtpConfig = { ...smtpConfig, ...config };
  transporter = createTransport();
  emailLog.info("SMTP config updated from admin settings");
}

/**
 * Update OTP config from admin settings (runtime).
 */
export function updateOtpConfig(config: Partial<OtpConfig>) {
  otpConfig = { ...otpConfig, ...config };
  emailLog.info(`OTP config updated: length=${otpConfig.codeLength}, expiry=${otpConfig.expiryMinutes}m`);
}

/**
 * Get current OTP config.
 */
export function getOtpConfig(): OtpConfig {
  return { ...otpConfig };
}

/**
 * Initialize email service on server startup.
 */
export function initEmailService() {
  transporter = createTransport();
  if (transporter) {
    // Verify connection
    transporter.verify()
      .then(() => emailLog.info("✅ SMTP connection verified successfully"))
      .catch((err) => emailLog.warn({ err: err.message }, "⚠️ SMTP verify failed — emails may not send"));
  }
}

/**
 * Generate OTP code of configured length.
 */
function generateOtp(): string {
  const min = Math.pow(10, otpConfig.codeLength - 1);
  const max = Math.pow(10, otpConfig.codeLength) - 1;
  return String(randomInt(min, max + 1));
}

// ── Redis keys ──
const otpKey = (email: string) => `otp:code:${email.toLowerCase()}`;
const otpAttemptsKey = (email: string) => `otp:attempts:${email.toLowerCase()}`;
const otpCooldownKey = (email: string) => `otp:cooldown:${email.toLowerCase()}`;

/**
 * Send OTP email to user.
 * Returns { success, message, cooldownSeconds? }
 */
export async function sendOtp(email: string): Promise<{ success: boolean; message: string; cooldownSeconds?: number }> {
  const emailLower = email.toLowerCase();

  // Check cooldown
  const cooldown = await cacheGet(otpCooldownKey(emailLower));
  const local = getLocalOtpRecord(emailLower);
  if (cooldown) {
    const remaining = parseInt(cooldown);
    return { success: false, message: "يرجى الانتظار قبل إعادة الإرسال", cooldownSeconds: remaining };
  }
  if (local && local.cooldownUntil > Date.now()) {
    const remaining = Math.ceil((local.cooldownUntil - Date.now()) / 1000);
    return { success: false, message: "يرجى الانتظار قبل إعادة الإرسال", cooldownSeconds: remaining };
  }

  // Generate OTP
  const code = generateOtp();

  if (!transporter) {
    if (isOtpDevFallbackEnabled()) {
      // Local/dev fallback: allow OTP flow without SMTP and print code in logs.
      await cacheSet(otpKey(emailLower), code, otpConfig.expiryMinutes * 60);
      await cacheSet(otpAttemptsKey(emailLower), "0", otpConfig.expiryMinutes * 60);
      await cacheSet(otpCooldownKey(emailLower), String(otpConfig.cooldownMinutes * 60), otpConfig.cooldownMinutes * 60);
      setLocalOtpRecord(emailLower, code);
      if (shouldLogDevOtpCode()) {
        emailLog.warn(`DEV OTP for ${emailLower}: ${code}`);
      }
      return {
        success: true,
        message: "تم إرسال رمز التحقق (وضع التطوير)",
        // Exposed only for local temporary testing when fallback mode is enabled.
        ...(process.env.OTP_DEV_LOG_OTP === "true" ? { devCode: code } : {}),
      } as any;
    }
    emailLog.error("Cannot send OTP — SMTP not configured");
    return { success: false, message: "خدمة البريد غير متاحة حالياً" };
  }

  try {
    // Store OTP in Redis
    await cacheSet(otpKey(emailLower), code, otpConfig.expiryMinutes * 60);
    // Reset attempts
    await cacheSet(otpAttemptsKey(emailLower), "0", otpConfig.expiryMinutes * 60);
    // Set cooldown
    await cacheSet(otpCooldownKey(emailLower), String(otpConfig.cooldownMinutes * 60), otpConfig.cooldownMinutes * 60);
    setLocalOtpRecord(emailLower, code);

    // Send email
    await transporter.sendMail({
      from: `"${smtpConfig.senderName}" <${smtpConfig.senderEmail}>`,
      to: emailLower,
      subject: `رمز التحقق الخاص بك — ${smtpConfig.senderName}`,
      html: buildOtpEmailHtml(code),
      text: `رمز التحقق الخاص بك هو: ${code}\nصالح لمدة ${otpConfig.expiryMinutes} دقائق.`,
    });

    emailLog.info(`OTP sent to ${emailLower.slice(0, 3)}***`);
    return { success: true, message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني" };
  } catch (err: any) {
    emailLog.error({ err }, `Failed to send OTP to ${emailLower.slice(0, 3)}***`);
    // Clean up on failure
    await cacheDel(otpKey(emailLower));
    clearLocalOtpRecord(emailLower);
    return { success: false, message: "فشل إرسال رمز التحقق، حاول مرة أخرى" };
  }
}

/**
 * Verify OTP code.
 * Returns { success, message }
 */
export async function verifyOtp(email: string, code: string): Promise<{ success: boolean; message: string }> {
  const emailLower = email.toLowerCase();
  const local = getLocalOtpRecord(emailLower);

  // Check attempts
  const attemptsStr = await cacheGet(otpAttemptsKey(emailLower));
  const attempts = parseInt(attemptsStr || String(local?.attempts || 0));
  if (attempts >= otpConfig.maxAttempts) {
    // Delete the OTP — user exceeded attempts
    await cacheDel(otpKey(emailLower));
    await cacheDel(otpAttemptsKey(emailLower));
    clearLocalOtpRecord(emailLower);
    return { success: false, message: "تجاوزت عدد المحاولات المسموح. أعد إرسال الرمز." };
  }

  // Get stored OTP
  const storedCode = (await cacheGet(otpKey(emailLower))) || local?.code || null;
  if (!storedCode) {
    return { success: false, message: "رمز التحقق منتهي أو غير موجود. أعد الإرسال." };
  }

  // Compare
  if (storedCode !== code.trim()) {
    // Increment attempts
    const newAttempts = attempts + 1;
    await cacheSet(otpAttemptsKey(emailLower), String(newAttempts), otpConfig.expiryMinutes * 60);
    if (local) {
      localOtpStore.set(emailLower, { ...local, attempts: newAttempts });
    }
    const remaining = otpConfig.maxAttempts - newAttempts;
    return { success: false, message: `رمز التحقق غير صحيح. متبقي ${remaining} محاولات.` };
  }

  // Success — clean up
  await cacheDel(otpKey(emailLower));
  await cacheDel(otpAttemptsKey(emailLower));
  await cacheDel(otpCooldownKey(emailLower));
  clearLocalOtpRecord(emailLower);

  emailLog.info(`OTP verified for ${emailLower.slice(0, 3)}***`);
  return { success: true, message: "تم التحقق بنجاح" };
}

/**
 * Send password reset email.
 */
export async function sendPasswordResetEmail(email: string, resetToken: string, resetUrl: string): Promise<boolean> {
  if (!transporter) {
    emailLog.warn("Cannot send reset email — SMTP not configured");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${smtpConfig.senderName}" <${smtpConfig.senderEmail}>`,
      to: email,
      subject: `إعادة تعيين كلمة المرور — ${smtpConfig.senderName}`,
      html: buildResetEmailHtml(resetUrl),
      text: `لإعادة تعيين كلمة المرور، اضغط على الرابط التالي:\n${resetUrl}\n\nصالح لمدة 30 دقيقة.`,
    });
    emailLog.info(`Password reset email sent to ${email.slice(0, 3)}***`);
    return true;
  } catch (err: any) {
    emailLog.error({ err }, "Failed to send password reset email");
    return false;
  }
}

/**
 * Send a generic email (for admin notifications, etc.).
 */
export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<boolean> {
  if (!transporter) {
    emailLog.warn("Cannot send email — SMTP not configured");
    return false;
  }

  try {
    await transporter.sendMail({
      from: `"${smtpConfig.senderName}" <${smtpConfig.senderEmail}>`,
      to,
      subject,
      html,
      text: text || subject,
    });
    return true;
  } catch (err: any) {
    emailLog.error({ err }, `Failed to send email to ${to.slice(0, 3)}***`);
    return false;
  }
}

// ═══════════════════════════════════════════════════════════
// HTML Email Templates
// ═══════════════════════════════════════════════════════════

function buildOtpEmailHtml(code: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
  <tr><td align="center">
    <table width="460" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:24px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
      <!-- Header gradient -->
      <tr><td style="background:linear-gradient(135deg,#a855f7,#ec4899);padding:32px;text-align:center;">
        <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;margin-bottom:12px;line-height:56px;">A</div>
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">رمز التحقق</h1>
      </td></tr>
      <!-- Body -->
      <tr><td style="padding:32px;text-align:center;">
        <p style="color:rgba(255,255,255,0.7);font-size:15px;margin:0 0 24px;">استخدم الرمز التالي لتأكيد حسابك</p>
        <!-- OTP Code -->
        <div style="background:rgba(168,85,247,0.1);border:2px dashed rgba(168,85,247,0.3);border-radius:16px;padding:20px;margin:0 auto 24px;max-width:280px;">
          <div style="font-size:36px;font-weight:900;letter-spacing:12px;color:#a855f7;font-family:'Courier New',monospace;direction:ltr;">${code}</div>
        </div>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:0;">صالح لمدة <strong style="color:rgba(255,255,255,0.6);">${otpConfig.expiryMinutes} دقائق</strong></p>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
        <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0;">إذا لم تطلب هذا الرمز، تجاهل هذه الرسالة.</p>
      </td></tr>
      <!-- Footer -->
      <tr><td style="background:rgba(0,0,0,0.3);padding:16px;text-align:center;">
        <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:0;">&copy; ${new Date().getFullYear()} ${smtpConfig.senderName} — جميع الحقوق محفوظة</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

function buildResetEmailHtml(resetUrl: string): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#0a0a0a;font-family:'Segoe UI',Tahoma,Arial,sans-serif;">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#0a0a0a;padding:40px 20px;">
  <tr><td align="center">
    <table width="460" cellpadding="0" cellspacing="0" style="background:#1a1a2e;border-radius:24px;border:1px solid rgba(255,255,255,0.08);overflow:hidden;">
      <tr><td style="background:linear-gradient(135deg,#a855f7,#ec4899);padding:32px;text-align:center;">
        <div style="width:56px;height:56px;background:rgba(255,255,255,0.2);border-radius:16px;display:inline-flex;align-items:center;justify-content:center;font-size:28px;font-weight:900;color:#fff;margin-bottom:12px;line-height:56px;">A</div>
        <h1 style="margin:0;color:#fff;font-size:22px;font-weight:800;">إعادة تعيين كلمة المرور</h1>
      </td></tr>
      <tr><td style="padding:32px;text-align:center;">
        <p style="color:rgba(255,255,255,0.7);font-size:15px;margin:0 0 24px;">اضغط الزر أدناه لإعادة تعيين كلمة المرور</p>
        <a href="${resetUrl}" style="display:inline-block;background:linear-gradient(135deg,#a855f7,#ec4899);color:#fff;font-size:16px;font-weight:700;padding:14px 40px;border-radius:14px;text-decoration:none;">إعادة تعيين</a>
        <p style="color:rgba(255,255,255,0.4);font-size:13px;margin:24px 0 0;">صالح لمدة <strong style="color:rgba(255,255,255,0.6);">30 دقيقة</strong></p>
        <hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:24px 0;">
        <p style="color:rgba(255,255,255,0.3);font-size:11px;margin:0;">إذا لم تطلب إعادة التعيين، تجاهل هذه الرسالة.</p>
      </td></tr>
      <tr><td style="background:rgba(0,0,0,0.3);padding:16px;text-align:center;">
        <p style="color:rgba(255,255,255,0.2);font-size:11px;margin:0;">&copy; ${new Date().getFullYear()} ${smtpConfig.senderName}</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}
