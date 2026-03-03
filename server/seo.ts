/**
 * Ablox — SEO Middleware & Routes
 * 
 * Enterprise-grade SEO infrastructure:
 * - Dynamic XML sitemap generation
 * - Image sitemap for rich snippets
 * - X-Robots-Tag headers for API routes
 * - Canonical Link headers
 * - Crawler prerender hints
 * - Security.txt (RFC 9116)
 * - Apple App Site Association (Universal Links)
 * - Widget API endpoint for PWA widgets
 */

import { type Express, type Request, type Response, type NextFunction } from "express";

const DOMAIN = "https://mrco.live";
const LAST_MOD = new Date().toISOString().split("T")[0]; // YYYY-MM-DD

// ═══════════════════════════════════════════════
// Supported languages for hreflang
// ═══════════════════════════════════════════════
const LANGUAGES = [
  "ar", "en", "fr", "es", "de", "tr", "pt", "ru",
  "hi", "ur", "fa", "zh", "ja", "ko", "id",
];

// Language → country mapping for hreflang variants
const LANG_REGIONS: Record<string, string> = {
  ar: "ar-SA", en: "en-US", fr: "fr-FR", es: "es-ES",
  de: "de-DE", tr: "tr-TR", pt: "pt-BR", ru: "ru-RU",
  hi: "hi-IN", ur: "ur-PK", fa: "fa-IR", zh: "zh-CN",
  ja: "ja-JP", ko: "ko-KR", id: "id-ID",
};

// ═══════════════════════════════════════════════
// Public pages for sitemap
// ═══════════════════════════════════════════════
interface SitemapPage {
  loc: string;
  changefreq: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority: string;
  lastmod?: string;
  images?: { loc: string; title: string; caption?: string }[];
}

const PAGES: SitemapPage[] = [
  {
    loc: "/",
    changefreq: "daily",
    priority: "1.0",
    images: [
      { loc: "/og-image.png", title: "Ablox — دردشة فيديو وصوت عشوائية وبث مباشر" },
    ],
  },
  { loc: "/home", changefreq: "hourly", priority: "0.9" },
  { loc: "/policy", changefreq: "monthly", priority: "0.3" },
  { loc: "/agent-apply", changefreq: "weekly", priority: "0.6" },
  { loc: "/account-apply", changefreq: "weekly", priority: "0.6" },
  { loc: "/wallet", changefreq: "daily", priority: "0.7" },
  { loc: "/friends", changefreq: "daily", priority: "0.7" },
  { loc: "/profile", changefreq: "weekly", priority: "0.5" },
];

// ═══════════════════════════════════════════════
// Known search engine crawlers
// ═══════════════════════════════════════════════
const CRAWLER_REGEX = /googlebot|bingbot|yandexbot|duckduckbot|slurp|baiduspider|sogou|facebookexternalhit|twitterbot|linkedinbot|whatsapp|telegrambot|applebot|discordbot|pinterestbot|redditbot|ia_archiver/i;

export function registerSeoRoutes(app: Express) {
  // ══════════════════════════════════════════════
  // 1. X-Robots-Tag — prevent API routes from being indexed
  // ══════════════════════════════════════════════
  app.use((req: Request, res: Response, next: NextFunction) => {
    const path = req.path;

    // API routes: noindex, nofollow, noarchive
    if (path.startsWith("/api/")) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow, noarchive");
    }
    // Admin/agent/internal pages
    else if (path.startsWith("/admin") || path.startsWith("/agent/") || path.startsWith("/call/") || path.startsWith("/chat/")) {
      res.setHeader("X-Robots-Tag", "noindex, nofollow");
    }
    // Public pages: index, follow, max-snippet, max-image-preview
    else if (!path.startsWith("/assets/") && !path.startsWith("/icons/")) {
      res.setHeader("X-Robots-Tag", "index, follow, max-snippet:-1, max-image-preview:large, max-video-preview:-1");
    }

    // Canonical Link header for public pages
    if (!path.startsWith("/api/") && !path.startsWith("/assets/") && !path.startsWith("/admin")) {
      const canonical = path === "/" ? DOMAIN + "/" : DOMAIN + path;
      res.setHeader("Link", `<${canonical}>; rel="canonical"`);
    }

    next();
  });

  // ══════════════════════════════════════════════
  // 2. Dynamic XML Sitemap
  // ══════════════════════════════════════════════
  app.get("/sitemap.xml", (_req: Request, res: Response) => {
    const urls = PAGES.map((page) => {
      const hreflangs = LANGUAGES.map((lang) => {
        const hreflang = LANG_REGIONS[lang] || lang;
        const href = `${DOMAIN}${page.loc}?lang=${lang}`;
        return `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${href}" />`;
      }).join("\n");

      // x-default (Arabic — primary language)
      const xDefault = `    <xhtml:link rel="alternate" hreflang="x-default" href="${DOMAIN}${page.loc}" />`;

      // Image sitemap tags
      const imageTags = (page.images || []).map((img) =>
        `    <image:image>\n      <image:loc>${DOMAIN}${img.loc}</image:loc>\n      <image:title>${escapeXml(img.title)}</image:title>${img.caption ? `\n      <image:caption>${escapeXml(img.caption)}</image:caption>` : ""}\n    </image:image>`
      ).join("\n");

      return `  <url>
    <loc>${DOMAIN}${page.loc}</loc>
    <lastmod>${page.lastmod || LAST_MOD}</lastmod>
    <changefreq>${page.changefreq}</changefreq>
    <priority>${page.priority}</priority>
${xDefault}
${hreflangs}${imageTags ? "\n" + imageTags : ""}
  </url>`;
    }).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:xhtml="http://www.w3.org/1999/xhtml"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=3600, s-maxage=86400");
    res.send(xml);
  });

  // ══════════════════════════════════════════════
  // 3. Image Sitemap (separate, for Google Images)
  // ══════════════════════════════════════════════
  app.get("/sitemap-images.xml", (_req: Request, res: Response) => {
    const images = [
      { page: "/", loc: "/og-image.png", title: "Ablox — دردشة فيديو وصوت عشوائية وبث مباشر", caption: "الصفحة الرئيسية لتطبيق Ablox" },
      { page: "/", loc: "/screenshots/narrow-home.png", title: "شاشة الهاتف — الصفحة الرئيسية", caption: "واجهة الهاتف المحمول" },
      { page: "/", loc: "/screenshots/narrow-chat.png", title: "شاشة الدردشة والبث المباشر", caption: "غرف الدردشة" },
      { page: "/", loc: "/screenshots/wide-home.png", title: "واجهة الويب الكاملة", caption: "تجربة سطح المكتب" },
      { page: "/", loc: "/screenshots/wide-chat.png", title: "الدردشة والبث على سطح المكتب", caption: "البث المباشر" },
    ];

    const urls = images.map((img) => `  <url>
    <loc>${DOMAIN}${img.page}</loc>
    <image:image>
      <image:loc>${DOMAIN}${img.loc}</image:loc>
      <image:title>${escapeXml(img.title)}</image:title>
      <image:caption>${escapeXml(img.caption)}</image:caption>
    </image:image>
  </url>`).join("\n");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
        xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">
${urls}
</urlset>`;

    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(xml);
  });

  // ══════════════════════════════════════════════
  // 4. Security.txt (RFC 9116)
  // ══════════════════════════════════════════════
  app.get("/.well-known/security.txt", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(`# Ablox Security Policy
# https://mrco.live/.well-known/security.txt

Contact: mailto:security@mrco.live
Contact: mailto:info@mrco.live
Expires: 2027-03-03T00:00:00.000Z
Preferred-Languages: ar, en
Canonical: https://mrco.live/.well-known/security.txt
Policy: https://mrco.live/policy
`);
  });

  // ══════════════════════════════════════════════
  // 5. Apple App Site Association (Universal Links)
  // ══════════════════════════════════════════════
  app.get("/.well-known/apple-app-site-association", (_req: Request, res: Response) => {
    const teamId = process.env.APPLE_TEAM_ID || "XXXXXXXXXX";
    const bundleId = process.env.APPLE_BUNDLE_ID || "app.ablox.ios";

    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.json({
      applinks: {
        details: [
          {
            appIDs: [`${teamId}.${bundleId}`],
            components: [
              { "/": "/home", comment: "Random chat" },
              { "/": "/profile/*", comment: "User profiles" },
              { "/": "/room/*", comment: "Live rooms" },
              { "/": "/wallet", comment: "Wallet" },
              { "/": "/friends", comment: "Friends" },
              { "/": "/chat/*", comment: "Chat" },
            ],
          },
        ],
      },
      webcredentials: {
        apps: [`${teamId}.${bundleId}`],
      },
      appclips: {
        apps: [],
      },
    });
  });

  // ══════════════════════════════════════════════
  // 6. Widget API endpoint (for PWA Widgets)
  // ══════════════════════════════════════════════
  app.get("/api/widgets/status", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=60");
    res.json({
      appName: "Ablox",
      status: "online",
      activeUsers: 0, // Will be populated dynamically
      lastUpdated: new Date().toISOString(),
    });
  });

  // Widget Adaptive Card template
  app.get("/widgets/status", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "public, max-age=300");
    res.json({
      type: "AdaptiveCard",
      version: "1.5",
      body: [
        {
          type: "TextBlock",
          text: "Ablox — حالة الدردشة",
          weight: "Bolder",
          size: "Medium",
        },
        {
          type: "TextBlock",
          text: "${status === 'online' ? '🟢 متصل' : '🔴 غير متصل'}",
          spacing: "Small",
        },
        {
          type: "TextBlock",
          text: "المستخدمون النشطون: ${activeUsers}",
          spacing: "Small",
        },
      ],
      actions: [
        {
          type: "Action.OpenUrl",
          title: "فتح Ablox",
          url: "https://mrco.live/home",
        },
      ],
      "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
    });
  });

  // ══════════════════════════════════════════════
  // 7. Ads.txt (for future monetization)
  // ══════════════════════════════════════════════
  app.get("/ads.txt", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send("# Ablox Ads.txt\n# Contact: info@mrco.live\n# No ad networks configured yet\n");
  });

  // ══════════════════════════════════════════════
  // 8. humans.txt
  // ══════════════════════════════════════════════
  app.get("/humans.txt", (_req: Request, res: Response) => {
    res.setHeader("Content-Type", "text/plain; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=86400");
    res.send(`/* TEAM */
Name: Ablox Team
Site: https://mrco.live
Contact: info@mrco.live
Location: Global

/* SITE */
Standards: HTML5, CSS4, ECMAScript 2025
Components: React 19, Express 5, PostgreSQL 16, Redis 7, Socket.io
Software: Vite 7, TypeScript, Tailwind CSS 4, Drizzle ORM
`);
  });
}

// ═══════════════════════════════════════════════
// XML escape helper
// ═══════════════════════════════════════════════
function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
