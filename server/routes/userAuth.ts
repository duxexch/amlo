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
import { randomUUID, randomBytes } from "crypto";

const router = Router();
const authLog = createLogger("userAuth");
const log = (msg: string) => authLog.info(msg);

// ── Helper: Express 5 param extraction ──
function paramStr(val: string | string[] | undefined): string {
  return Array.isArray(val) ? val[0] : val || "";
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

// ── Helper: strip sensitive fields ──
function stripSensitive<T extends Record<string, any>>(obj: T) {
  const { passwordHash, pinHash, ...safe } = obj;
  return safe;
}

// ════════════════════════════════════════════════════════════
// AUTH ROUTES
// ════════════════════════════════════════════════════════════

/**
 * POST /auth/register — Create a new user account
 */
router.post("/register", async (req: Request, res: Response) => {
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

    // Set session
    req.session.userId = user.id;
    req.session.pinVerified = false;

    log(`User registered: ${username} (${email})`);

    return res.status(201).json({
      success: true,
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
        needsPinSetup: true,
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
router.post("/login", async (req: Request, res: Response) => {
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
    res.clearCookie("connect.sid");
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
      req.session.destroy(() => {});
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
router.post("/forgot-password", async (req: Request, res: Response) => {
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
    const stored = await cacheSet(tokenKey, user.id, 1800);
    if (!stored) {
      // Fallback: log the token for manual reset (production should use email service)
      authLog.warn({ userId: user.id, token }, "Could not store reset token in Redis — token logged for manual recovery");
    }

    // TODO: Send email with reset link in production
    // For now, log the token (in production, integrate with email service like SendGrid/SES)
    log(`Password reset requested for: ${email}, token: ${token.substring(0, 8)}...`);

    return res.json({
      success: true,
      message: "إذا كان البريد الإلكتروني مسجلاً، ستصلك رسالة مع رابط إعادة تعيين كلمة المرور",
      // Only include token in development for testing
      ...(process.env.NODE_ENV !== "production" && { resetToken: token }),
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

export default router;
