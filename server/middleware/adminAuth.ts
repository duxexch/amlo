import type { Request, Response, NextFunction } from "express";
import { createLogger } from "../logger";
import { getRedis } from "../redis";
const log = (msg: string, _src?: string) => authLog.info(msg);
const authLog = createLogger("adminAuth");

// Augment express-session to hold admin data
declare module "express-session" {
  interface SessionData {
    adminId?: string;
    adminUsername?: string;
    adminRole?: string;
    adminDisplayName?: string;
    userId?: string; // For regular user sessions (social/world)
    activeProfileIndex?: number; // 1 or 2 — which dual profile is active
    pinVerified?: boolean; // Whether PIN was verified after login
  }
}

/**
 * Middleware: Require admin authentication.
 * Checks if the request has a valid admin session.
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.adminId) {
    return res.status(401).json({
      success: false,
      message: "غير مصرح - يرجى تسجيل الدخول",
    });
  }
  next();
}

/**
 * Middleware: Require super_admin or admin role.
 */
export function requireAdminRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.session?.adminId) {
      return res.status(401).json({
        success: false,
        message: "غير مصرح - يرجى تسجيل الدخول",
      });
    }
    if (!roles.includes(req.session.adminRole || "")) {
      return res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية للقيام بهذا الإجراء",
      });
    }
    next();
  };
}

/**
 * Middleware: Rate limiter for admin login.
 * Redis-backed rate limiter — survives restarts and works across cluster nodes.
 */
const MAX_ATTEMPTS = 5;
const WINDOW_SECONDS = 15 * 60; // 15 minutes
const RATE_LIMIT_PREFIX = "ablox:admin_rate:";

export async function rateLimitLogin(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const redis = getRedis();

  // FAIL-CLOSED: deny login attempts when Redis is unavailable (prevents brute-force bypass)
  if (!redis) {
    authLog.warn(`Rate limiter: Redis unavailable — blocking login attempt from ${ip}`);
    return res.status(503).json({
      success: false,
      message: "الخدمة غير متاحة مؤقتاً. حاول لاحقاً.",
    });
  }

  try {
    const key = `${RATE_LIMIT_PREFIX}${ip}`;
    const current = await redis.incr(key);

    // Set expiry on first attempt
    if (current === 1) {
      await redis.expire(key, WINDOW_SECONDS);
    }

    if (current > MAX_ATTEMPTS) {
      const ttl = await redis.ttl(key);
      const minutesLeft = Math.ceil(ttl / 60);
      log(`Rate limit exceeded for IP: ${ip} (${current} attempts)`, "admin-auth");
      return res.status(429).json({
        success: false,
        message: `تم تجاوز عدد المحاولات المسموحة. حاول بعد ${minutesLeft} دقيقة.`,
      });
    }
  } catch (err) {
    // FAIL-CLOSED: if Redis errors, block the request (prevents brute-force bypass)
    authLog.warn(`Rate limiter Redis error — blocking request from ${ip}: ${err}`);
    return res.status(503).json({
      success: false,
      message: "الخدمة غير متاحة مؤقتاً. حاول لاحقاً.",
    });
  }

  next();
}
