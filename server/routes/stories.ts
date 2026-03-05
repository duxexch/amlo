/**
 * Stories API Routes — القصص / اللحظات
 * ======================================
 * POST   /api/social/stories         — Create a story
 * GET    /api/social/stories          — Get stories feed (friends + own)
 * GET    /api/social/stories/:id      — Get single story
 * DELETE /api/social/stories/:id      — Delete own story
 * POST   /api/social/stories/:id/view — Mark story as viewed
 * GET    /api/social/stories/:id/viewers — Get story viewers
 */
import { Router, type Request, type Response } from "express";
import rateLimit from "express-rate-limit";
import { getPool } from "../db";
import { createStorySchema } from "../../shared/schema";
import { createLogger } from "../logger";

const router = Router();
const storyLog = createLogger("stories");

// ── Rate limiting for story creation (max 10 per hour) ──
const storyCreateLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => (req.session as any)?.userId || req.ip || "unknown",
  message: { success: false, message: "تم تجاوز الحد الأقصى لإنشاء القصص. حاول لاحقاً" },
});

// ── POST / — Create a story (expires in 24h) ──
router.post("/", storyCreateLimiter, async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const parsed = createStorySchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
  }

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    const { type, mediaUrl, textContent, bgColor, caption } = parsed.data;
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

    const result = await pool.query(
      `INSERT INTO stories (user_id, type, media_url, text_content, bg_color, caption, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id, user_id as "userId", type, media_url as "mediaUrl", text_content as "textContent",
                 bg_color as "bgColor", caption, view_count as "viewCount", expires_at as "expiresAt",
                 created_at as "createdAt"`,
      [userId, type, mediaUrl || null, textContent || null, bgColor || null, caption || null, expiresAt],
    );

    storyLog.info(`Story created by user ${userId}: ${result.rows[0].id}`);
    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    storyLog.error(`Create story error: ${err.message}`);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── GET / — Get stories feed (own + friends, last 24h) ──
router.get("/", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    // Get stories from self + accepted friends
    const result = await pool.query(
      `SELECT s.id, s.user_id as "userId", s.type, s.media_url as "mediaUrl",
              s.text_content as "textContent", s.bg_color as "bgColor", s.caption,
              s.view_count as "viewCount", s.expires_at as "expiresAt", s.created_at as "createdAt",
              u.username, u.display_name as "displayName", u.avatar,
              EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = $1) as "viewed"
       FROM stories s
       JOIN users u ON u.id = s.user_id
       WHERE s.is_active = true
         AND s.expires_at > NOW()
         AND (
           s.user_id = $1
           OR s.user_id IN (
             SELECT CASE
               WHEN f.sender_id = $1 THEN f.receiver_id
               ELSE f.sender_id
             END
             FROM friendships f
             WHERE f.status = 'accepted'
               AND (f.sender_id = $1 OR f.receiver_id = $1)
           )
         )
       ORDER BY s.created_at DESC
       LIMIT 200`,
      [userId],
    );

    // Group by user for UI convenience
    const storiesByUser = new Map<string, { user: any; stories: any[] }>();
    for (const row of result.rows) {
      const key = row.userId;
      if (!storiesByUser.has(key)) {
        storiesByUser.set(key, {
          user: { id: row.userId, username: row.username, displayName: row.displayName, avatar: row.avatar },
          stories: [],
        });
      }
      storiesByUser.get(key)!.stories.push({
        id: row.id, type: row.type, mediaUrl: row.mediaUrl, textContent: row.textContent,
        bgColor: row.bgColor, caption: row.caption, viewCount: row.viewCount,
        expiresAt: row.expiresAt, createdAt: row.createdAt, viewed: row.viewed,
      });
    }

    return res.json({ success: true, data: Array.from(storiesByUser.values()) });
  } catch (err: any) {
    storyLog.error(`Get stories feed error: ${err.message}`);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── GET /:id — Get a single story ──
router.get("/:id", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    const result = await pool.query(
      `SELECT s.*, u.username, u.display_name as "displayName", u.avatar
       FROM stories s JOIN users u ON u.id = s.user_id
       WHERE s.id = $1 AND s.is_active = true AND s.expires_at > NOW()`,
      [req.params.id],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "القصة غير موجودة" });
    }

    return res.json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── DELETE /:id — Delete own story ──
router.delete("/:id", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    const result = await pool.query(
      `UPDATE stories SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id`,
      [req.params.id, userId],
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "القصة غير موجودة" });
    }

    return res.json({ success: true, message: "تم حذف القصة" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── POST /:id/view — Mark story as viewed ──
router.post("/:id/view", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    // Insert view (ignore duplicate) — only increment count if new row inserted
    const viewResult = await pool.query(
      `INSERT INTO story_views (story_id, viewer_id)
       VALUES ($1, $2)
       ON CONFLICT (story_id, viewer_id) DO NOTHING`,
      [req.params.id, userId],
    );

    // Only increment view count if a new row was actually inserted
    if (viewResult.rowCount && viewResult.rowCount > 0) {
      await pool.query(
        `UPDATE stories SET view_count = view_count + 1 WHERE id = $1 AND user_id != $2`,
        [req.params.id, userId],
      );
    }

    return res.json({ success: true });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── GET /:id/viewers — Get story viewers (owner only) ──
router.get("/:id/viewers", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    // Verify ownership
    const storyCheck = await pool.query(
      `SELECT id FROM stories WHERE id = $1 AND user_id = $2`,
      [req.params.id, userId],
    );
    if (storyCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: "غير مصرح" });
    }

    const result = await pool.query(
      `SELECT u.id, u.username, u.display_name as "displayName", u.avatar, sv.viewed_at as "viewedAt"
       FROM story_views sv
       JOIN users u ON u.id = sv.viewer_id
       WHERE sv.story_id = $1
       ORDER BY sv.viewed_at DESC`,
      [req.params.id],
    );

    return res.json({ success: true, data: result.rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

export default router;
