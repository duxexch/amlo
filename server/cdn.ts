/**
 * CDN Configuration — إعدادات شبكة توصيل المحتوى
 * ═══════════════════════════════════════════════════
 * Adds proper cache headers for Cloudflare/CDN optimization.
 * Provides CDN URL utility for asset prefixing.
 *
 * Features:
 * - Security headers (X-Content-Type-Options, X-Frame-Options, etc.)
 * - Cache-Control policies for different asset types
 * - CDN_URL env var for asset URL rewriting
 * - Compression hints for CDN edge
 */
import type { Request, Response, NextFunction, Express } from "express";

// ── CDN Base URL (empty = same origin) ──
const CDN_URL = process.env.CDN_URL || "";

/**
 * Get CDN-prefixed URL for an asset path
 * @example cdnUrl("/uploads/avatar.jpg") => "https://cdn.mrco.live/uploads/avatar.jpg"
 */
export function cdnUrl(path: string): string {
  if (!CDN_URL) return path;
  return `${CDN_URL.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

/**
 * CDN & Security headers middleware
 * Add to Express app BEFORE static file serving
 */
export function cdnMiddleware() {
  return (req: Request, res: Response, next: NextFunction) => {
    // ── Security Headers ──
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("X-XSS-Protection", "1; mode=block");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    res.setHeader(
      "Permissions-Policy",
      "camera=(self), microphone=(self), geolocation=(), payment=(self)"
    );

    // ── CORS for CDN assets ──
    if (CDN_URL && (req.path.startsWith("/assets/") || req.path.startsWith("/uploads/"))) {
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
      res.setHeader("Access-Control-Max-Age", "86400");
      // Timing headers for CDN performance metrics
      res.setHeader("Timing-Allow-Origin", "*");
    }

    // ── Cache-Control by content type ──
    const path = req.path.toLowerCase();

    // API responses — no caching by default (individual routes override)
    if (path.startsWith("/api/")) {
      res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
      res.setHeader("Pragma", "no-cache");
      return next();
    }

    // Hashed assets (Vite build output) — immutable, 1 year
    if (/\/assets\/.*\.[a-f0-9]{8}\./i.test(path)) {
      res.setHeader("Cache-Control", "public, max-age=31536000, immutable");
      return next();
    }

    // Images — 7 days, stale-while-revalidate
    if (/\.(jpg|jpeg|png|gif|webp|avif|svg|ico)$/i.test(path)) {
      res.setHeader("Cache-Control", "public, max-age=604800, stale-while-revalidate=86400");
      return next();
    }

    // Videos / audio — 24 hours
    if (/\.(mp4|webm|ogg|mp3|wav|m4a)$/i.test(path)) {
      res.setHeader("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");
      return next();
    }

    // Fonts — 30 days, immutable
    if (/\.(woff2?|ttf|otf|eot)$/i.test(path)) {
      res.setHeader("Cache-Control", "public, max-age=2592000, immutable");
      return next();
    }

    // CSS/JS (non-hashed) — 1 hour
    if (/\.(css|js|mjs)$/i.test(path)) {
      res.setHeader("Cache-Control", "public, max-age=3600, stale-while-revalidate=600");
      return next();
    }

    // Service worker — never cache
    if (path.endsWith("/sw.js") || path.endsWith("/service-worker.js")) {
      res.setHeader("Cache-Control", "no-cache, no-store, must-revalidate");
      return next();
    }

    // Manifest — 1 day
    if (path.endsWith("/manifest.json") || path.endsWith("/manifest.webmanifest")) {
      res.setHeader("Cache-Control", "public, max-age=86400");
      return next();
    }

    // HTML pages — 10 minutes with revalidation
    if (path === "/" || path.endsWith(".html") || !path.includes(".")) {
      res.setHeader("Cache-Control", "public, max-age=600, stale-while-revalidate=300");
      return next();
    }

    next();
  };
}

/**
 * Apply CDN configuration to Express app
 * Call this BEFORE serveStatic()
 */
export function applyCdnConfig(app: Express): void {
  app.use(cdnMiddleware());

  // Expose CDN URL as an API endpoint for frontend
  app.get("/api/cdn-config", (_req, res) => {
    res.json({
      success: true,
      data: {
        cdnUrl: CDN_URL || null,
        enabled: !!CDN_URL,
      },
    });
  });
}
