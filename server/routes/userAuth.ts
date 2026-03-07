/**
 * User Auth & PIN/Profile Routes — تسجيل الدخول + البروفايل المزدوج
 * ================================================================
 * Endpoints:
 *   POST /auth/register       — Create new account
 *   POST /auth/login          — Login with username/email + password
 *   POST /auth/logout         — Destroy session
 *   GET  /auth/me             — Current user + active profile
 *   POST /auth/forgot-password — Request password reset (email)
 *   POST /auth/reset-password  — Reset password with token
 *   POST /auth/pin/setup      — Create a PIN + profile (max 2 per user)
 *   POST /auth/pin/verify     — Verify PIN → switch active profile
 *   GET  /auth/profiles       — Get user's profiles (without PIN hashes)
 *   PUT  /auth/profiles/:index — Update profile data
 *   PUT  /auth/friend-visibility — Set which profile a friend sees
 *   GET  /auth/friend-visibility — Get visibility settings for all friends
 */
import { Router, type Request, type Response } from "express";
import { eq, and, or } from "drizzle-orm";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { getDb } from "../db";
import { cacheGet, cacheSet, cacheDel } from "../redis";
import { createLogger } from "../logger";
import { storage } from "../storage";
import {
  hashPasswordAsync,
  verifyPasswordAsync,
  generateReferralCode,
} from "../utils/crypto";
import * as schema from "../../shared/schema";
import {
  userRegisterSchema,
  userLoginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  setupPinSchema,
  verifyPinSchema,
  updateProfileSchema,
  setFriendVisibilitySchema,
} from "../../shared/schema";
import { randomUUID, randomBytes, createHmac } from "crypto";
import { sendOtp, verifyOtp, sendPasswordResetEmail } from "../services/email";

const router = Router();
const authLog = createLogger("userAuth");
const log = (msg: string) => authLog.info(msg);

// ── Helper: Express 5 param extraction ──
function paramStr(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : val || "";
}

function normalizeOtpCode(value: unknown): string {
  return String(value || "")
    .replace(/[\u0660-\u0669]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[\u06F0-\u06F9]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/\D/g, "")
    .slice(0, 6);
}

// ── Helper: require authenticated user ──
function requireAuth(req: Request, res: Response): string | null {
  const userId = req.session?.userId;
  if (!userId) {
    res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });
    return null;
  }
  return userId;
}

// ── Helper: require PIN verified ──
function requirePinVerified(req: Request, res: Response): string | null {
  const userId = requireAuth(req, res);
  if (!userId) return null;
  if (!req.session.pinVerified) {
    res.status(403).json({ success: false, message: "يرجى إدخال رمز PIN أولاً", code: "PIN_REQUIRED" });
    return null;
  }
  return userId;
}

// ── Helper: strip sensitive fields (centralized) ──
import { sanitizeUser } from "../utils/sanitize";
const stripSensitive = sanitizeUser;

// ── Auth rate limiters ──
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // 15 attempts per window
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip || "127.0.0.1"),
  message: { success: false, message: "عدد كبير من المحاولات — حاول بعد 15 دقيقة" },
});

const strictAuthLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // 5 attempts per hour
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => ipKeyGenerator(req.ip || "127.0.0.1"),
  message: { success: false, message: "عدد كبير من المحاولات — حاول لاحقاً" },
});

// ════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /auth/register — Create a new user account
 */
router.post("/register", authLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = userRegisterSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const { username, email, password, displayName, referralCode } = parsed.data;
    const db = getDb();
    if (!db) {
      return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة حالياً" });
    }

    // Verify OTP was completed for this email
    const otpVerifiedFlag = await cacheGet(`otp:verified:${email.toLowerCase()}`);
    if (!otpVerifiedFlag) {
      return res.status(403).json({ success: false, message: "يرجى تأكيد بريدك الإلكتروني أولاً عبر رمز التحقق", code: "OTP_REQUIRED" });
    }

    // Check if username or email already exists
    const existingUser = await storage.getUserByUsername(username);
    if (existingUser) {
      return res.status(409).json({ success: false, message: "اسم المستخدم مستخدم بالفعل" });
    }
    const existingEmail = await storage.getUserByEmail(email);
    if (existingEmail) {
      return res.status(409).json({ success: false, message: "البريد الإلكتروني مستخدم بالفعل" });
    }

    // Hash password
    const passwordHash = await hashPasswordAsync(password);

    // Generate referral code
    const myReferralCode = generateReferralCode("U");

    // Create user
    const user = await storage.createUser({
      username,
      email,
      passwordHash,
      displayName: displayName || username,
    });

    // Update with referral code and optional referredByAgent
    let updateData: Record<string, any> = { referralCode: myReferralCode };
    if (referralCode) {
      // Find the agent who referred this user
      const referrer = await db.select().from(schema.agents).where(eq(schema.agents.referralCode, referralCode)).limit(1);
      if (referrer.length > 0) {
        updateData.referredByAgent = referrer[0].id;
      }
    }
    await storage.updateUser(user.id, updateData);

    // Clean up OTP verified flag (one-time use)
    await cacheDel(`otp:verified:${email.toLowerCase()}`);

    // Set session — user is logged in immediately, no forced PIN
    req.session.userId = user.id;
    req.session.pinVerified = true; // No profiles yet, no PIN needed

    log(`User registered: ${username} (${email})`);

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        needsPinSetup: false, // No forced PIN setup — user sets up from Profile
      },
    });
  } catch (err: any) {
    authLog.error({ err }, "Registration error");
    return res.status(500).json({ success: false, message: "حدث خطأ في التسجيل" });
  }
});

/**
 * POST /auth/login — Login with username/email + password
 */
router.post("/login", authLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = userLoginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const { login, password } = parsed.data;
    const db = getDb();
    if (!db) {
      return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة حالياً" });
    }

    // Find user by username or email
    const isEmail = login.includes("@");
    const user = isEmail
      ? await storage.getUserByEmail(login)
      : await storage.getUserByUsername(login);

    if (!user) {
      return res.status(401).json({ success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    // Check if banned
    if (user.isBanned) {
      return res.status(403).json({ success: false, message: "تم حظر حسابك", reason: user.banReason });
    }

    // Verify password
    const valid = await verifyPasswordAsync(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "اسم المستخدم أو كلمة المرور غير صحيحة" });
    }

    // Check 2FA — if enabled, require TOTP before setting session
    if (user.twoFactorEnabled) {
      return res.json({ success: true, data: { requires2FA: true, userId: user.id } });
    }

    // Check if user has profiles (PIN setup)
    const profiles = await db
      .select({ id: schema.userProfiles.id, profileIndex: schema.userProfiles.profileIndex })
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, user.id));

    const hasProfiles = profiles.length > 0;

    // Set session — but don't verify PIN yet
    req.session.userId = user.id;
    req.session.pinVerified = !hasProfiles; // If no profiles, skip PIN
    req.session.activeProfileIndex = undefined;

    // Update last login
    await storage.updateUser(user.id, { lastOnlineAt: new Date(), status: "online" });

    log(`User login: ${user.username}`);

    return res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        avatar: user.avatar,
        needsPinSetup: !hasProfiles,
        needsPinVerify: hasProfiles,
        profileCount: profiles.length,
      },
    });
  } catch (err: any) {
    authLog.error({ err }, "Login error");
    return res.status(500).json({ success: false, message: "حدث خطأ في تسجيل الدخول" });
  }
});

/**
 * POST /auth/logout — Destroy session
 */
router.post("/logout", (req: Request, res: Response) => {
  const userId = req.session?.userId;
  req.session.destroy((err: any) => {
    if (err) {
      authLog.error({ err }, "Logout error");
      return res.status(500).json({ success: false, message: "حدث خطأ في تسجيل الخروج" });
    }
    if (userId) log(`User logout: ${userId}`);
    res.clearCookie("ablox.sid");
    res.clearCookie("connect.sid");  // clear legacy cookie
    return res.json({ success: true, message: "تم تسجيل الخروج بنجاح" });
  });
});

/**
 * GET /auth/me — Current user + active profile
 */
router.get("/me", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const user = await storage.getUser(userId);
    if (!user) {
      // Session points to deleted user
      req.session.destroy(() => { });
      return res.status(401).json({ success: false, message: "المستخدم غير موجود" });
    }

    const db = getDb();
    let profiles: any[] = [];
    let activeProfile = null;

    if (db) {
      profiles = await db
        .select()
        .from(schema.userProfiles)
        .where(eq(schema.userProfiles.userId, userId));

      if (req.session.activeProfileIndex) {
        activeProfile = profiles.find(p => p.profileIndex === req.session.activeProfileIndex);
      } else if (profiles.length > 0) {
        activeProfile = profiles.find(p => p.isDefault) || profiles[0];
      }
    }

    return res.json({
      success: true,
      data: {
        user: stripSensitive(user),
        activeProfile: activeProfile ? stripSensitive(activeProfile) : null,
        profiles: profiles.map(p => stripSensitive(p)),
        pinVerified: !!req.session.pinVerified,
        needsPinSetup: profiles.length === 0,
      },
    });
  } catch (err: any) {
    authLog.error({ err }, "Get /me error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

/**
 * POST /auth/forgot-password — Request password reset
 * Generates a token stored in Redis (30 min TTL) or DB
 */
router.post("/forgot-password", strictAuthLimiter, async (req: Request, res: Response) => {
  try {
    const parsed = forgotPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const { email } = parsed.data;
    const user = await storage.getUserByEmail(email);

    // Always return success to prevent email enumeration
    if (!user) {
      return res.json({ success: true, message: "إذا كان البريد الإلكتروني مسجلاً، ستصلك رسالة مع رابط إعادة تعيين كلمة المرور" });
    }

    // Generate reset token
    const token = randomBytes(32).toString("hex");
    const tokenKey = `pwd_reset:${token}`;

    // Store in Redis with 30 min TTL (or fallback to log)
    try {
      await cacheSet(tokenKey, user.id, 1800);
    } catch {
      // Fallback: log the token for manual reset (production should use email service)
      authLog.warn({ userId: user.id, token }, "Could not store reset token in Redis — token logged for manual recovery");
    }

    // Send email with reset link
    const domain = process.env.DOMAIN || "mrco.live";
    const resetUrl = `https://${domain}/reset-password?token=${token}`;
    const emailSent = await sendPasswordResetEmail(email, token, resetUrl);
    if (!emailSent) {
      log(`Password reset requested for: ${email}, token: ${token.substring(0, 8)}... (email not sent — SMTP not configured)`);
    } else {
      log(`Password reset email sent to: ${email}`);
    }

    // Never expose reset token in API response — use server logs for debugging
    if (process.env.NODE_ENV !== "production") {
      authLog.debug({ token: token.substring(0, 8) + "..." }, "Reset token generated (check logs for debugging)");
    }

    return res.json({
      success: true,
      message: "إذا كان البريد الإلكتروني مسجلاً، ستصلك رسالة مع رابط إعادة تعيين كلمة المرور",
    });
  } catch (err: any) {
    authLog.error({ err }, "Forgot password error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

/**
 * POST /auth/reset-password — Reset password with token
 */
router.post("/reset-password", async (req: Request, res: Response) => {
  try {
    const parsed = resetPasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const { token, password } = parsed.data;
    const tokenKey = `pwd_reset:${token}`;

    // Look up token in Redis
    const userId = await cacheGet(tokenKey);
    if (!userId) {
      return res.status(400).json({ success: false, message: "رابط إعادة التعيين غير صالح أو منتهي الصلاحية" });
    }

    // Hash new password and update
    const passwordHash = await hashPasswordAsync(password);
    const updated = await storage.updateUser(userId, { passwordHash });
    if (!updated) {
      return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    }

    // Delete token (one-time use)
    await cacheDel(tokenKey);

    log(`Password reset completed for user: ${userId}`);

    return res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err: any) {
    authLog.error({ err }, "Reset password error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

// ════════════════════════════════════════════════════════════
// PIN & PROFILE ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /auth/pin/setup — Create a PIN + profile (max 2 per user)
 */
router.post("/pin/setup", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const parsed = setupPinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const { pin, profileIndex, displayName, bio, gender, country } = parsed.data;
    const db = getDb();
    if (!db) {
      return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة حالياً" });
    }

    // Check existing profiles count
    const existing = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, userId));

    if (existing.length >= 2) {
      return res.status(400).json({ success: false, message: "لديك بالفعل أقصى عدد من الملفات الشخصية (2)" });
    }

    // Check if this profileIndex already exists
    if (existing.find(p => p.profileIndex === profileIndex)) {
      return res.status(409).json({ success: false, message: `الملف الشخصي رقم ${profileIndex} موجود بالفعل` });
    }

    // Validate PIN is exactly 4 digits
    if (pin.length !== 4 || !/^\d{4}$/.test(pin)) {
      return res.status(400).json({ success: false, message: "رمز PIN يجب أن يكون 4 أرقام بالضبط" });
    }

    // Hash PIN
    const pinHash = await hashPasswordAsync(pin);

    // Create profile
    const isDefault = existing.length === 0; // First profile is default
    const [profile] = await db.insert(schema.userProfiles).values({
      userId,
      profileIndex,
      pinHash,
      displayName,
      bio: bio || null,
      gender: gender || null,
      country: country || null,
      isDefault,
    }).returning();

    // If this is the first profile, auto-verify PIN
    if (isDefault) {
      req.session.pinVerified = true;
      req.session.activeProfileIndex = profileIndex;
    }

    log(`PIN setup for user ${userId}, profile ${profileIndex}`);

    return res.status(201).json({
      success: true,
      data: {
        profile: stripSensitive(profile),
        isDefault,
        totalProfiles: existing.length + 1,
      },
    });
  } catch (err: any) {
    authLog.error({ err }, "PIN setup error");
    return res.status(500).json({ success: false, message: "حدث خطأ في إعداد رمز PIN" });
  }
});

/**
 * POST /auth/pin/verify — Verify PIN → set active profile in session
 */
router.post("/pin/verify", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const parsed = verifyPinSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const { pin } = parsed.data;
    const db = getDb();
    if (!db) {
      return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة حالياً" });
    }

    // Get all profiles for user
    const profiles = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, userId));

    if (profiles.length === 0) {
      return res.status(404).json({ success: false, message: "لم يتم إعداد أي ملف شخصي بعد", code: "NO_PROFILES" });
    }

    // Try PIN against each profile
    for (const profile of profiles) {
      const match = await verifyPasswordAsync(pin, profile.pinHash);
      if (match) {
        req.session.pinVerified = true;
        req.session.activeProfileIndex = profile.profileIndex;

        log(`PIN verified for user ${userId}, profile ${profile.profileIndex}`);

        return res.json({
          success: true,
          data: {
            profileIndex: profile.profileIndex,
            profile: stripSensitive(profile),
          },
        });
      }
    }

    return res.status(401).json({ success: false, message: "رمز PIN غير صحيح" });
  } catch (err: any) {
    authLog.error({ err }, "PIN verify error");
    return res.status(500).json({ success: false, message: "حدث خطأ في التحقق من رمز PIN" });
  }
});

/**
 * GET /auth/profiles — Get user's profiles (without PIN hashes)
 */
router.get("/profiles", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const db = getDb();
    if (!db) {
      return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة حالياً" });
    }

    const profiles = await db
      .select()
      .from(schema.userProfiles)
      .where(eq(schema.userProfiles.userId, userId));

    return res.json({
      success: true,
      data: profiles.map(p => stripSensitive(p)),
    });
  } catch (err: any) {
    authLog.error({ err }, "Get profiles error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

/**
 * PUT /auth/profiles/:index — Update profile data (1 or 2)
 */
router.put("/profiles/:index", async (req: Request, res: Response) => {
  try {
    const userId = requirePinVerified(req, res);
    if (!userId) return;

    const profileIndex = parseInt(paramStr(req.params.index));
    if (profileIndex !== 1 && profileIndex !== 2) {
      return res.status(400).json({ success: false, message: "رقم الملف الشخصي غير صالح (1 أو 2)" });
    }

    const parsed = updateProfileSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const db = getDb();
    if (!db) {
      return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة حالياً" });
    }

    // Find the profile
    const [existing] = await db
      .select()
      .from(schema.userProfiles)
      .where(
        and(
          eq(schema.userProfiles.userId, userId),
          eq(schema.userProfiles.profileIndex, profileIndex),
        ),
      )
      .limit(1);

    if (!existing) {
      return res.status(404).json({ success: false, message: "الملف الشخصي غير موجود" });
    }

    // Update profile
    const updateData: Record<string, any> = { updatedAt: new Date() };
    const data = parsed.data;
    if (data.displayName !== undefined) updateData.displayName = data.displayName;
    if (data.avatar !== undefined) updateData.avatar = data.avatar;
    if (data.bio !== undefined) updateData.bio = data.bio;
    if (data.gender !== undefined) updateData.gender = data.gender;
    if (data.country !== undefined) updateData.country = data.country;
    if (data.birthDate !== undefined) updateData.birthDate = data.birthDate;

    const [updated] = await db
      .update(schema.userProfiles)
      .set(updateData)
      .where(eq(schema.userProfiles.id, existing.id))
      .returning();

    log(`Profile ${profileIndex} updated for user ${userId}`);

    return res.json({
      success: true,
      data: stripSensitive(updated),
    });
  } catch (err: any) {
    authLog.error({ err }, "Update profile error");
    return res.status(500).json({ success: false, message: "حدث خطأ في تحديث الملف الشخصي" });
  }
});

// ════════════════════════════════════════════════════════════
// FRIEND VISIBILITY ROUTES
// ════════════════════════════════════════════════════════════

/**
 * PUT /auth/friend-visibility — Set which profile a specific friend sees
 */
router.put("/friend-visibility", async (req: Request, res: Response) => {
  try {
    const userId = requirePinVerified(req, res);
    if (!userId) return;

    const parsed = setFriendVisibilitySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const { friendId, visibleProfileIndex } = parsed.data;
    const db = getDb();
    if (!db) {
      return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة حالياً" });
    }

    // Verify the profile index exists for this user
    const [profile] = await db
      .select()
      .from(schema.userProfiles)
      .where(
        and(
          eq(schema.userProfiles.userId, userId),
          eq(schema.userProfiles.profileIndex, visibleProfileIndex),
        ),
      )
      .limit(1);

    if (!profile) {
      return res.status(400).json({ success: false, message: "رقم الملف الشخصي غير موجود" });
    }

    // Verify friendship exists (accepted)
    const friendship = await db
      .select()
      .from(schema.friendships)
      .where(
        and(
          or(
            and(eq(schema.friendships.senderId, userId), eq(schema.friendships.receiverId, friendId)),
            and(eq(schema.friendships.senderId, friendId), eq(schema.friendships.receiverId, userId)),
          ),
          eq(schema.friendships.status, "accepted"),
        ),
      )
      .limit(1);

    if (friendship.length === 0) {
      return res.status(404).json({ success: false, message: "هذا الشخص ليس في قائمة أصدقائك" });
    }

    // Upsert the visibility setting
    const [existing] = await db
      .select()
      .from(schema.friendProfileVisibility)
      .where(
        and(
          eq(schema.friendProfileVisibility.userId, userId),
          eq(schema.friendProfileVisibility.friendId, friendId),
        ),
      )
      .limit(1);

    let result;
    if (existing) {
      [result] = await db
        .update(schema.friendProfileVisibility)
        .set({ visibleProfileIndex, updatedAt: new Date() })
        .where(eq(schema.friendProfileVisibility.id, existing.id))
        .returning();
    } else {
      [result] = await db
        .insert(schema.friendProfileVisibility)
        .values({ userId, friendId, visibleProfileIndex })
        .returning();
    }

    log(`Friend visibility set: user ${userId} → friend ${friendId} sees profile ${visibleProfileIndex}`);

    return res.json({ success: true, data: result });
  } catch (err: any) {
    authLog.error({ err }, "Set friend visibility error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

/**
 * GET /auth/friend-visibility — Get visibility settings for all friends
 */
router.get("/friend-visibility", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const db = getDb();
    if (!db) {
      return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة حالياً" });
    }

    const settings = await db
      .select()
      .from(schema.friendProfileVisibility)
      .where(eq(schema.friendProfileVisibility.userId, userId));

    return res.json({ success: true, data: settings });
  } catch (err: any) {
    authLog.error({ err }, "Get friend visibility error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

// ════════════════════════════════════════════════════════════
// OTP — Email Verification (رمز التحقق بالبريد)
// ════════════════════════════════════════════════════════════

/**
 * POST /auth/otp/send — Send OTP to email
 */
router.post("/otp/send", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, message: "يرجى إدخال بريد إلكتروني صالح" });
    }

    const result = await sendOtp(email.trim());
    if (!result.success) {
      const status = result.message.includes("خدمة البريد غير متاحة") ? 503 : 429;
      return res.status(status).json(result);
    }

    return res.json(result);
  } catch (err: any) {
    authLog.error({ err }, "Send OTP error");
    return res.status(500).json({ success: false, message: "حدث خطأ في إرسال رمز التحقق" });
  }
});

/**
 * POST /auth/otp/verify — Verify OTP code
 */
router.post("/otp/verify", async (req: Request, res: Response) => {
  try {
    const { email, code } = req.body;
    if (!email || !code) {
      return res.status(400).json({ success: false, message: "يرجى إدخال البريد والرمز" });
    }

    const normalizedCode = normalizeOtpCode(code);
    if (normalizedCode.length !== 6) {
      return res.status(400).json({ success: false, message: "رمز التحقق يجب أن يكون 6 أرقام" });
    }

    const result = await verifyOtp(email.trim(), normalizedCode);
    if (!result.success) {
      return res.status(400).json(result);
    }

    // Store verified flag in Redis for 15 minutes (used by /register to enforce OTP)
    await cacheSet(`otp:verified:${email.trim().toLowerCase()}`, "1", 900);

    // If user exists, set email verified flag
    const user = await storage.getUserByEmail(email.trim());
    if (user) {
      await storage.updateUser(user.id, { emailVerified: true } as any);
      // If user is logged in, mark in session
      if (req.session?.userId === user.id) {
        (req.session as any).emailVerified = true;
      }
    }

    return res.json({ success: true, message: "تم التحقق بنجاح", verified: true });
  } catch (err: any) {
    authLog.error({ err }, "Verify OTP error");
    return res.status(500).json({ success: false, message: "حدث خطأ في التحقق" });
  }
});

/**
 * POST /auth/otp/send-register — Send OTP for registration (no account required)
 */
router.post("/otp/send-register", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== "string" || !email.includes("@")) {
      return res.status(400).json({ success: false, message: "يرجى إدخال بريد إلكتروني صالح" });
    }

    // Check if email already registered
    const existing = await storage.getUserByEmail(email.trim());
    if (existing) {
      return res.status(409).json({ success: false, message: "البريد الإلكتروني مستخدم بالفعل" });
    }

    const result = await sendOtp(email.trim());
    if (!result.success) {
      const status = result.message.includes("خدمة البريد غير متاحة") ? 503 : 429;
      return res.status(status).json(result);
    }

    return res.json(result);
  } catch (err: any) {
    authLog.error({ err }, "Send register OTP error");
    return res.status(500).json({ success: false, message: "حدث خطأ في إرسال رمز التحقق" });
  }
});

// ════════════════════════════════════════════════════════════
// PIN MANAGEMENT — تغيير وحذف رمز PIN
// ════════════════════════════════════════════════════════════

/**
 * PUT /auth/pin/change — Change PIN for a specific profile
 */
router.put("/pin/change", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { profileIndex, currentPin, newPin } = req.body;
    if (!profileIndex || !currentPin || !newPin) {
      return res.status(400).json({ success: false, message: "بيانات ناقصة" });
    }

    if (!/^\d{4}$/.test(newPin)) {
      return res.status(400).json({ success: false, message: "رمز PIN الجديد يجب أن يكون 4 أرقام بالضبط" });
    }

    const db = getDb();
    if (!db) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    // Find the profile
    const [profile] = await db.select().from(schema.userProfiles)
      .where(and(eq(schema.userProfiles.userId, userId), eq(schema.userProfiles.profileIndex, profileIndex)))
      .limit(1);

    if (!profile) {
      return res.status(404).json({ success: false, message: "الملف الشخصي غير موجود" });
    }

    // Verify current PIN
    const valid = await verifyPasswordAsync(currentPin, profile.pinHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "رمز PIN الحالي غير صحيح" });
    }

    // Check new PIN is different from other profile's PIN
    const allProfiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
    for (const p of allProfiles) {
      if (p.profileIndex !== profileIndex) {
        const sameAsOther = await verifyPasswordAsync(newPin, p.pinHash);
        if (sameAsOther) {
          return res.status(400).json({ success: false, message: "رمز PIN يجب أن يكون مختلف عن الملف الآخر" });
        }
      }
    }

    // Hash and update
    const newPinHash = await hashPasswordAsync(newPin);
    await db.update(schema.userProfiles)
      .set({ pinHash: newPinHash, updatedAt: new Date() })
      .where(eq(schema.userProfiles.id, profile.id));

    log(`PIN changed for user ${userId}, profile ${profileIndex}`);
    return res.json({ success: true, message: "تم تغيير رمز PIN بنجاح" });
  } catch (err: any) {
    authLog.error({ err }, "PIN change error");
    return res.status(500).json({ success: false, message: "حدث خطأ في تغيير رمز PIN" });
  }
});

/**
 * DELETE /auth/pin/profile/:index — Delete a profile (profile 2 only, or profile 1 if it's the only one)
 */
router.delete("/pin/profile/:index", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const profileIndex = parseInt(paramStr(req.params.index));
    if (profileIndex !== 1 && profileIndex !== 2) {
      return res.status(400).json({ success: false, message: "رقم الملف الشخصي غير صالح" });
    }

    const db = getDb();
    if (!db) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    const allProfiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
    const target = allProfiles.find(p => p.profileIndex === profileIndex);
    if (!target) {
      return res.status(404).json({ success: false, message: "الملف الشخصي غير موجود" });
    }

    // Cannot delete profile 1 if profile 2 exists
    if (profileIndex === 1 && allProfiles.length > 1) {
      return res.status(400).json({ success: false, message: "لا يمكن حذف الملف الأول أثناء وجود ملف ثاني. احذف الملف الثاني أولاً" });
    }

    await db.delete(schema.userProfiles).where(eq(schema.userProfiles.id, target.id));

    // Reset session PIN verification
    req.session.pinVerified = allProfiles.length <= 1; // If deleting the only profile, no PIN needed
    req.session.activeProfileIndex = undefined;

    log(`Profile ${profileIndex} deleted for user ${userId}`);
    return res.json({ success: true, message: "تم حذف الملف الشخصي" });
  } catch (err: any) {
    authLog.error({ err }, "Delete profile error");
    return res.status(500).json({ success: false, message: "حدث خطأ في حذف الملف الشخصي" });
  }
});

// ════════════════════════════════════════════════════════════
// LOGIN OTP — تسجيل الدخول عبر OTP بدلاً من PIN
// ════════════════════════════════════════════════════════════

/**
 * POST /auth/login/otp — Send OTP to user's email for login (alternative to PIN)
 * Requires user to be authenticated (password already verified) but PIN not yet verified
 */
router.post("/login/otp", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const user = await storage.getUser(userId);
    if (!user || !user.email) {
      return res.status(400).json({ success: false, message: "لا يوجد بريد إلكتروني مرتبط بالحساب" });
    }

    const result = await sendOtp(user.email);
    if (!result.success) {
      const status = result.message.includes("خدمة البريد غير متاحة") ? 503 : 429;
      return res.status(status).json(result);
    }

    return res.json({
      success: true,
      message: "تم إرسال رمز التحقق إلى بريدك الإلكتروني",
      email: maskEmail(user.email),
      ...(result as any).devCode ? { devCode: (result as any).devCode } : {},
    });
  } catch (err: any) {
    authLog.error({ err }, "Login OTP send error");
    return res.status(500).json({ success: false, message: "حدث خطأ في إرسال رمز التحقق" });
  }
});

/**
 * POST /auth/login/otp-verify — Verify OTP for login (bypass PIN, use default profile)
 */
router.post("/login/otp-verify", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { code } = req.body;
    if (!code) {
      return res.status(400).json({ success: false, message: "يرجى إدخال رمز التحقق" });
    }

    const user = await storage.getUser(userId);
    if (!user || !user.email) {
      return res.status(400).json({ success: false, message: "لا يوجد بريد إلكتروني مرتبط بالحساب" });
    }

    const normalizedCode = normalizeOtpCode(code);
    if (normalizedCode.length !== 6) {
      return res.status(400).json({ success: false, message: "رمز التحقق يجب أن يكون 6 أرقام" });
    }

    const result = await verifyOtp(user.email, normalizedCode);
    if (!result.success) {
      return res.status(400).json(result);
    }

    // OTP verified — set default profile as active
    const db = getDb();
    if (db) {
      const profiles = await db.select().from(schema.userProfiles).where(eq(schema.userProfiles.userId, userId));
      const defaultProfile = profiles.find(p => p.isDefault) || profiles[0];
      if (defaultProfile) {
        req.session.pinVerified = true;
        req.session.activeProfileIndex = defaultProfile.profileIndex;
        return res.json({
          success: true,
          message: "تم التحقق بنجاح",
          data: { profileIndex: defaultProfile.profileIndex, profile: stripSensitive(defaultProfile) },
        });
      }
    }

    req.session.pinVerified = true;
    return res.json({ success: true, message: "تم التحقق بنجاح" });
  } catch (err: any) {
    authLog.error({ err }, "Login OTP verify error");
    return res.status(500).json({ success: false, message: "حدث خطأ في التحقق" });
  }
});

// ════════════════════════════════════════════════════════════
// PUT /auth/change-password — تغيير كلمة المرور
// ════════════════════════════════════════════════════════════
router.put("/change-password", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ success: false, message: "يرجى إدخال كلمة المرور الحالية والجديدة" });
    }
    if (newPassword.length < 6) {
      return res.status(400).json({ success: false, message: "كلمة المرور الجديدة يجب أن تكون 6 أحرف على الأقل" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    }

    const valid = await verifyPasswordAsync(currentPassword, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "كلمة المرور الحالية غير صحيحة" });
    }

    const newHash = await hashPasswordAsync(newPassword);
    await storage.updateUser(userId, { passwordHash: newHash } as any);

    log(`User ${userId} changed password`);
    return res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
  } catch (err: any) {
    authLog.error({ err }, "Change password error");
    return res.status(500).json({ success: false, message: "حدث خطأ في تغيير كلمة المرور" });
  }
});

// ════════════════════════════════════════════════════════════
// DELETE /auth/account — حذف الحساب
// ════════════════════════════════════════════════════════════
router.delete("/account", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: "يرجى إدخال كلمة المرور للتأكيد" });
    }

    const user = await storage.getUser(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    }

    const valid = await verifyPasswordAsync(password, user.passwordHash);
    if (!valid) {
      return res.status(401).json({ success: false, message: "كلمة المرور غير صحيحة" });
    }

    // Delete user and all related data
    await storage.deleteUser(userId);

    // Destroy session
    req.session.destroy(() => { });

    log(`User ${userId} deleted their account`);
    return res.json({ success: true, message: "تم حذف الحساب بنجاح" });
  } catch (err: any) {
    authLog.error({ err }, "Delete account error");
    return res.status(500).json({ success: false, message: "حدث خطأ في حذف الحساب" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /auth/notification-preferences — تفضيلات الإشعارات
// ════════════════════════════════════════════════════════════
router.get("/notification-preferences", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const prefs = await storage.getNotificationPreferences(userId);
    // Return defaults if no preferences exist yet
    return res.json({
      success: true,
      data: {
        messages: prefs?.messages ?? true,
        calls: prefs?.calls ?? true,
        friendRequests: prefs?.friendRequests ?? true,
        gifts: prefs?.gifts ?? true,
        streams: prefs?.streams ?? true,
        systemUpdates: prefs?.systemUpdates ?? true,
        marketing: prefs?.marketing ?? false,
      },
    });
  } catch (err: any) {
    authLog.error({ err }, "Get notification preferences error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

// ════════════════════════════════════════════════════════════
// PUT /auth/notification-preferences — تحديث تفضيلات الإشعارات
// ════════════════════════════════════════════════════════════
router.put("/notification-preferences", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const parsed = schema.updateNotificationPrefsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.flatten() });
    }

    const updated = await storage.upsertNotificationPreferences(userId, parsed.data);
    return res.json({
      success: true,
      data: {
        messages: updated?.messages ?? true,
        calls: updated?.calls ?? true,
        friendRequests: updated?.friendRequests ?? true,
        gifts: updated?.gifts ?? true,
        streams: updated?.streams ?? true,
        systemUpdates: updated?.systemUpdates ?? true,
        marketing: updated?.marketing ?? false,
      },
    });
  } catch (err: any) {
    authLog.error({ err }, "Update notification preferences error");
    return res.status(500).json({ success: false, message: "حدث خطأ في تحديث الإعدادات" });
  }
});

// ════════════════════════════════════════════════════════════
// GET /auth/chat-translation-preferences — تفضيلات ترجمة الشات
// ════════════════════════════════════════════════════════════
router.get("/chat-translation-preferences", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const prefs = await storage.getNotificationPreferences(userId);
    return res.json({
      success: true,
      data: {
        chatAutoTranslate: prefs?.chatAutoTranslate ?? true,
        chatShowOriginalText: prefs?.chatShowOriginalText ?? true,
        chatTranslateLang: prefs?.chatTranslateLang ?? "ar",
      },
    });
  } catch (err: any) {
    authLog.error({ err }, "Get chat translation preferences error");
    return res.status(500).json({ success: false, message: "حدث خطأ" });
  }
});

// ════════════════════════════════════════════════════════════
// PUT /auth/chat-translation-preferences — تحديث تفضيلات ترجمة الشات
// ════════════════════════════════════════════════════════════
router.put("/chat-translation-preferences", async (req: Request, res: Response) => {
  try {
    const userId = requireAuth(req, res);
    if (!userId) return;

    const parsed = schema.updateChatTranslationPrefsSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.flatten() });
    }

    const updated = await storage.upsertNotificationPreferences(userId, parsed.data);
    return res.json({
      success: true,
      data: {
        chatAutoTranslate: updated?.chatAutoTranslate ?? true,
        chatShowOriginalText: updated?.chatShowOriginalText ?? true,
        chatTranslateLang: updated?.chatTranslateLang ?? "ar",
      },
    });
  } catch (err: any) {
    authLog.error({ err }, "Update chat translation preferences error");
    return res.status(500).json({ success: false, message: "حدث خطأ في تحديث إعدادات الترجمة" });
  }
});

/** Helper: mask email for display (e.g., f***@gmail.com) */
function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (local.length <= 2) return `${local[0]}***@${domain}`;
  return `${local[0]}${local[1]}***@${domain}`;
}

// ════════════════════════════════════════════════════════════
// OAUTH ROUTES — Google, Facebook, Apple
// ════════════════════════════════════════════════════════════

/**
 * Helper: Find or create user by OAuth provider
 */
async function oauthFindOrCreateUser(
  db: NonNullable<ReturnType<typeof getDb>>,
  provider: "google" | "facebook" | "apple",
  providerId: string,
  email: string | null,
  displayName: string | null,
  avatar: string | null,
): Promise<{ user: schema.User; isNew: boolean }> {
  const providerField = provider === "google" ? "googleId" : provider === "facebook" ? "facebookId" : "appleId";

  // 1. Check by provider ID
  const [existing] = await db.select().from(schema.users)
    .where(eq(schema.users[providerField], providerId)).limit(1);
  if (existing) return { user: existing, isNew: false };

  // 2. Check by email (link accounts)
  if (email) {
    const [byEmail] = await db.select().from(schema.users)
      .where(eq(schema.users.email, email)).limit(1);
    if (byEmail) {
      // Link OAuth to existing account
      await db.update(schema.users).set({ [providerField]: providerId }).where(eq(schema.users.id, byEmail.id));
      return { user: { ...byEmail, [providerField]: providerId }, isNew: false };
    }
  }

  // 3. Create new user
  const username = `${provider}_${providerId.slice(0, 8)}_${Date.now().toString(36)}`;
  const referralCode = generateReferralCode();
  const passwordHash = await hashPasswordAsync(randomUUID()); // Random password

  const [newUser] = await db.insert(schema.users).values({
    username,
    email,
    passwordHash,
    displayName: displayName || username,
    avatar,
    referralCode,
    [providerField]: providerId,
    isVerified: !!email,
  }).returning();

  return { user: newUser, isNew: true };
}

/**
 * Helper: Set session after OAuth login
 */
async function setOAuthSession(req: Request, user: schema.User, db: NonNullable<ReturnType<typeof getDb>>) {
  const profiles = await db
    .select({ id: schema.userProfiles.id })
    .from(schema.userProfiles)
    .where(eq(schema.userProfiles.userId, user.id));

  req.session.userId = user.id;
  req.session.pinVerified = profiles.length === 0;
  req.session.activeProfileIndex = undefined;

  await db.update(schema.users).set({ lastOnlineAt: new Date(), status: "online" }).where(eq(schema.users.id, user.id));
}

/**
 * POST /auth/oauth/google — Verify Google ID token and login/register
 */
router.post("/oauth/google", async (req: Request, res: Response) => {
  const { idToken } = req.body;
  if (!idToken || typeof idToken !== "string") {
    return res.status(400).json({ success: false, message: "idToken مطلوب" });
  }

  try {
    // Verify token with Google's tokeninfo endpoint
    const googleRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
    if (!googleRes.ok) {
      return res.status(401).json({ success: false, message: "رمز Google غير صالح" });
    }
    const payload = await googleRes.json() as { sub: string; email?: string; name?: string; picture?: string; email_verified?: string };

    if (!payload.sub) {
      return res.status(401).json({ success: false, message: "رمز Google غير صالح" });
    }

    const db = getDb();
    if (!db) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    const { user, isNew } = await oauthFindOrCreateUser(
      db, "google", payload.sub,
      payload.email_verified === "true" ? (payload.email || null) : null,
      payload.name || null,
      payload.picture || null,
    );

    if (user.isBanned) return res.status(403).json({ success: false, message: "تم حظر حسابك", reason: user.banReason });

    // Check 2FA
    if (user.twoFactorEnabled) {
      // Don't set session yet — require 2FA
      return res.json({ success: true, data: { requires2FA: true, userId: user.id, isNew } });
    }

    await setOAuthSession(req, user, db);
    authLog.info({ userId: user.id, provider: "google", isNew }, "OAuth login");

    return res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        isNew,
        needsPinVerify: false,
      },
    });
  } catch (err: any) {
    authLog.error({ err }, "Google OAuth error");
    return res.status(500).json({ success: false, message: "خطأ في تسجيل الدخول عبر Google" });
  }
});

/**
 * POST /auth/oauth/facebook — Verify Facebook access token and login/register
 */
router.post("/oauth/facebook", async (req: Request, res: Response) => {
  const { accessToken } = req.body;
  if (!accessToken || typeof accessToken !== "string") {
    return res.status(400).json({ success: false, message: "accessToken مطلوب" });
  }

  try {
    // Verify token with Facebook Graph API
    const fbRes = await fetch(`https://graph.facebook.com/me?fields=id,name,email,picture.type(large)&access_token=${encodeURIComponent(accessToken)}`);
    if (!fbRes.ok) {
      return res.status(401).json({ success: false, message: "رمز Facebook غير صالح" });
    }
    const payload = await fbRes.json() as { id: string; name?: string; email?: string; picture?: { data?: { url?: string } } };

    if (!payload.id) {
      return res.status(401).json({ success: false, message: "رمز Facebook غير صالح" });
    }

    const db = getDb();
    if (!db) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    const { user, isNew } = await oauthFindOrCreateUser(
      db, "facebook", payload.id,
      payload.email || null,
      payload.name || null,
      payload.picture?.data?.url || null,
    );

    if (user.isBanned) return res.status(403).json({ success: false, message: "تم حظر حسابك", reason: user.banReason });

    if (user.twoFactorEnabled) {
      return res.json({ success: true, data: { requires2FA: true, userId: user.id, isNew } });
    }

    await setOAuthSession(req, user, db);
    authLog.info({ userId: user.id, provider: "facebook", isNew }, "OAuth login");

    return res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        isNew,
        needsPinVerify: false,
      },
    });
  } catch (err: any) {
    authLog.error({ err }, "Facebook OAuth error");
    return res.status(500).json({ success: false, message: "خطأ في تسجيل الدخول عبر Facebook" });
  }
});

/**
 * POST /auth/oauth/apple — Verify Apple identity token and login/register
 */
router.post("/oauth/apple", async (req: Request, res: Response) => {
  const { identityToken, fullName } = req.body;
  if (!identityToken || typeof identityToken !== "string") {
    return res.status(400).json({ success: false, message: "identityToken مطلوب" });
  }

  try {
    // Decode JWT (Apple identity token is a standard JWT)
    // We verify by decoding and checking the 'sub' claim
    // In production, you'd verify with Apple's public keys from https://appleid.apple.com/auth/keys
    const parts = identityToken.split(".");
    if (parts.length !== 3) {
      return res.status(401).json({ success: false, message: "رمز Apple غير صالح" });
    }

    const payloadStr = Buffer.from(parts[1], "base64url").toString("utf-8");
    const payload = JSON.parse(payloadStr) as { sub: string; email?: string; iss?: string; aud?: string };

    if (!payload.sub || payload.iss !== "https://appleid.apple.com") {
      return res.status(401).json({ success: false, message: "رمز Apple غير صالح" });
    }

    const db = getDb();
    if (!db) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });

    const name = fullName ? `${fullName.givenName || ""} ${fullName.familyName || ""}`.trim() : null;

    const { user, isNew } = await oauthFindOrCreateUser(
      db, "apple", payload.sub,
      payload.email || null,
      name,
      null,
    );

    if (user.isBanned) return res.status(403).json({ success: false, message: "تم حظر حسابك", reason: user.banReason });

    if (user.twoFactorEnabled) {
      return res.json({ success: true, data: { requires2FA: true, userId: user.id, isNew } });
    }

    await setOAuthSession(req, user, db);
    authLog.info({ userId: user.id, provider: "apple", isNew }, "OAuth login");

    return res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
        isNew,
        needsPinVerify: false,
      },
    });
  } catch (err: any) {
    authLog.error({ err }, "Apple OAuth error");
    return res.status(500).json({ success: false, message: "خطأ في تسجيل الدخول عبر Apple" });
  }
});

// ════════════════════════════════════════════════════════════
// 2FA / TOTP — المصادقة الثنائية
// ════════════════════════════════════════════════════════════

/**
 * Generate a random base32-encoded TOTP secret
 */
function generateTotpSecret(): string {
  const bytes = randomBytes(20);
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let secret = "";
  for (let i = 0; i < bytes.length; i++) {
    secret += base32Chars[bytes[i] & 31];
    if ((i + 1) % 4 === 0 && i + 1 < bytes.length) secret += "";
  }
  return secret.slice(0, 32);
}

/**
 * Decode a base32 string to Buffer
 */
function base32Decode(s: string): Buffer {
  const base32Chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  let bits = "";
  for (const c of s.toUpperCase()) {
    const idx = base32Chars.indexOf(c);
    if (idx === -1) continue;
    bits += idx.toString(2).padStart(5, "0");
  }
  const bytes: number[] = [];
  for (let i = 0; i + 8 <= bits.length; i += 8) {
    bytes.push(parseInt(bits.slice(i, i + 8), 2));
  }
  return Buffer.from(bytes);
}

/**
 * Generate TOTP code for a given secret + time
 */
function generateTotp(secret: string, time: number = Date.now()): string {
  const counter = Math.floor(time / 30000);
  const counterBuf = Buffer.alloc(8);
  counterBuf.writeUInt32BE(0, 0);
  counterBuf.writeUInt32BE(counter, 4);

  const key = base32Decode(secret);
  const hmac = createHmac("sha1", key).update(counterBuf).digest();
  const offset = hmac[hmac.length - 1] & 0x0f;
  const code = ((hmac[offset] & 0x7f) << 24 | hmac[offset + 1] << 16 | hmac[offset + 2] << 8 | hmac[offset + 3]) % 1000000;
  return code.toString().padStart(6, "0");
}

/**
 * Verify a TOTP code (allows ±1 time step)
 */
function verifyTotp(secret: string, code: string): boolean {
  const now = Date.now();
  for (const offset of [-30000, 0, 30000]) {
    if (generateTotp(secret, now + offset) === code) return true;
  }
  return false;
}

/**
 * POST /auth/2fa/setup — Generate a TOTP secret and provisioning URI
 */
router.post("/2fa/setup", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const db = getDb();
  if (!db) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });

  try {
    const [user] = await db.select({ twoFactorEnabled: schema.users.twoFactorEnabled, email: schema.users.email })
      .from(schema.users).where(eq(schema.users.id, userId)).limit(1);

    if (!user) return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
    if (user.twoFactorEnabled) return res.status(400).json({ success: false, message: "المصادقة الثنائية مفعّلة بالفعل" });

    const secret = generateTotpSecret();

    // Store secret (not yet enabled)
    await db.update(schema.users).set({ twoFactorSecret: secret }).where(eq(schema.users.id, userId));

    // Build otpauth:// URI for QR code
    const label = encodeURIComponent(user.email || userId);
    const otpauthUri = `otpauth://totp/Ablox:${label}?secret=${secret}&issuer=Ablox&algorithm=SHA1&digits=6&period=30`;

    return res.json({
      success: true,
      data: { secret, otpauthUri },
    });
  } catch (err: any) {
    authLog.error({ err }, "2FA setup error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

/**
 * POST /auth/2fa/verify-setup — Verify the TOTP code and enable 2FA
 */
router.post("/2fa/verify-setup", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { code } = req.body;
  if (!code || typeof code !== "string" || code.length !== 6) {
    return res.status(400).json({ success: false, message: "رمز التحقق غير صالح" });
  }

  const db = getDb();
  if (!db) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });

  try {
    const [user] = await db.select({ twoFactorSecret: schema.users.twoFactorSecret, twoFactorEnabled: schema.users.twoFactorEnabled })
      .from(schema.users).where(eq(schema.users.id, userId)).limit(1);

    if (!user || !user.twoFactorSecret) {
      return res.status(400).json({ success: false, message: "يرجى إعداد المصادقة الثنائية أولاً" });
    }
    if (user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: "المصادقة الثنائية مفعّلة بالفعل" });
    }

    if (!verifyTotp(user.twoFactorSecret, code)) {
      return res.status(400).json({ success: false, message: "رمز التحقق غير صحيح" });
    }

    // Enable 2FA
    await db.update(schema.users).set({ twoFactorEnabled: true }).where(eq(schema.users.id, userId));
    authLog.info({ userId }, "2FA enabled");

    return res.json({ success: true, message: "تم تفعيل المصادقة الثنائية بنجاح" });
  } catch (err: any) {
    authLog.error({ err }, "2FA verify-setup error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

/**
 * POST /auth/2fa/verify — Verify 2FA code during login
 */
router.post("/2fa/verify", async (req: Request, res: Response) => {
  const { userId, code } = req.body;
  if (!userId || !code || typeof code !== "string" || code.length !== 6) {
    return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
  }

  const db = getDb();
  if (!db) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });

  try {
    const [user] = await db.select().from(schema.users).where(eq(schema.users.id, userId)).limit(1);
    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: "المصادقة الثنائية غير مفعّلة" });
    }

    if (!verifyTotp(user.twoFactorSecret, code)) {
      return res.status(401).json({ success: false, message: "رمز التحقق غير صحيح" });
    }

    // 2FA passed — set session
    await setOAuthSession(req, user, db);
    authLog.info({ userId }, "2FA verified at login");

    return res.json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        displayName: user.displayName,
        avatar: user.avatar,
      },
    });
  } catch (err: any) {
    authLog.error({ err }, "2FA verify error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

/**
 * POST /auth/2fa/disable — Disable 2FA
 */
router.post("/2fa/disable", async (req: Request, res: Response) => {
  const userId = requireAuth(req, res);
  if (!userId) return;

  const { code } = req.body;
  if (!code || typeof code !== "string" || code.length !== 6) {
    return res.status(400).json({ success: false, message: "رمز التحقق مطلوب" });
  }

  const db = getDb();
  if (!db) return res.status(503).json({ success: false, message: "قاعدة البيانات غير متاحة" });

  try {
    const [user] = await db.select({ twoFactorSecret: schema.users.twoFactorSecret, twoFactorEnabled: schema.users.twoFactorEnabled })
      .from(schema.users).where(eq(schema.users.id, userId)).limit(1);

    if (!user || !user.twoFactorSecret || !user.twoFactorEnabled) {
      return res.status(400).json({ success: false, message: "المصادقة الثنائية غير مفعّلة" });
    }

    if (!verifyTotp(user.twoFactorSecret, code)) {
      return res.status(401).json({ success: false, message: "رمز التحقق غير صحيح" });
    }

    await db.update(schema.users).set({ twoFactorEnabled: false, twoFactorSecret: null })
      .where(eq(schema.users.id, userId));
    authLog.info({ userId }, "2FA disabled");

    return res.json({ success: true, message: "تم إلغاء المصادقة الثنائية" });
  } catch (err: any) {
    authLog.error({ err }, "2FA disable error");
    return res.status(500).json({ success: false, message: "خطأ" });
  }
});

export default router;
