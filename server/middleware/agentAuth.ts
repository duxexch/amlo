import type { Request, Response, NextFunction } from "express";

// Augment express-session to hold agent data
declare module "express-session" {
  interface SessionData {
    agentId?: string;
    agentName?: string;
    agentEmail?: string;
  }
}

/**
 * Middleware: Require agent authentication.
 */
export function requireAgent(req: Request, res: Response, next: NextFunction) {
  if (!req.session?.agentId) {
    return res.status(401).json({
      success: false,
      message: "غير مصرح - يرجى تسجيل الدخول",
    });
  }
  next();
}
