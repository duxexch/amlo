import type { Request, Response, NextFunction } from "express";
import { createLogger } from "../logger";
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
 * Simple in-memory rate limiter — replace with Redis in production.
 */
const loginAttempts = new Map<string, { count: number; lastAttempt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

export function rateLimitLogin(req: Request, res: Response, next: NextFunction) {
  const ip = req.ip || req.socket.remoteAddress || "unknown";
  const now = Date.now();
  const record = loginAttempts.get(ip);

  if (record) {
    if (now - record.lastAttempt > WINDOW_MS) {
      // Reset window
      loginAttempts.set(ip, { count: 1, lastAttempt: now });
    } else if (record.count >= MAX_ATTEMPTS) {
      log(`Rate limit exceeded for IP: ${ip}`, "admin-auth");
      return res.status(429).json({
        success: false,
        message: "تم تجاوز عدد المحاولات المسموحة. حاول بعد 15 دقيقة.",
      });
    } else {
      record.count++;
      record.lastAttempt = now;
    }
  } else {
    loginAttempts.set(ip, { count: 1, lastAttempt: now });
  }

  // Cleanup old entries periodically
  if (loginAttempts.size > 10000) {
    Array.from(loginAttempts.entries()).forEach(([key, val]) => {
      if (now - val.lastAttempt > WINDOW_MS) loginAttempts.delete(key);
    });
  }

  next();
}
