/**
 * Posts API Routes — المنشورات (صور + ريلز)
 * ═══════════════════════════════════════════════
 * POST   /                   — Create a post (photo or reel)
 * GET    /feed               — CEX feed (all reels, cursor-paginated)
 * GET    /user/:id           — User's posts (for public profile)
 * GET    /active-stories     — Users with active story reels (for avatar glow)
 * GET    /:id                — Single post
 * DELETE /:id                — Delete own post (soft)
 * POST   /:id/like           — Toggle like
 * POST   /:id/view           — Record view
 */
import { Router, type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { getPool } from "../db";
import { createPostSchema } from "../../shared/schema";
import { createLogger } from "../logger";

const router = Router();
const postLog = createLogger("posts");

// ── Rate limiting for post creation ──
const postCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.session as any)?.userId || ipKeyGenerator(req.ip || "127.0.0.1"),
    message: { success: false, message: "تم تجاوز الحد الأقصى للنشر. حاول لاحقاً" },
});

// ── Helper: get daily limits from system_config ──
async function getDailyLimits(pool: any): Promise<{ maxDailyReels: number; maxDailyPhotos: number; maxReelDurationSec: number }> {
    try {
        const result = await pool.query(
            `SELECT value FROM system_config WHERE category = 'contentLimits' LIMIT 1`,
        );
        if (result.rows.length > 0) {
            const cfg = typeof result.rows[0].value === "string" ? JSON.parse(result.rows[0].value) : result.rows[0].value;
            return {
                maxDailyReels: parseInt(cfg.maxDailyReels) || 10,
                maxDailyPhotos: parseInt(cfg.maxDailyPhotos) || 20,
                maxReelDurationSec: parseInt(cfg.maxReelDurationSec) || 60,
            };
        }
    } catch { /* use defaults */ }
    return { maxDailyReels: 10, maxDailyPhotos: 20, maxReelDurationSec: 60 };
}

// ── POST / — Create a post ──
router.post("/", postCreateLimiter, async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

    const parsed = createPostSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
    }

    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const { type, mediaUrl, thumbnailUrl, caption, duration } = parsed.data;
        const limits = await getDailyLimits(pool);

        // Validate reel duration
        if (type === "reel" && duration && duration > limits.maxReelDurationSec) {
            return res.status(400).json({
                success: false,
                message: `الحد الأقصى لمدة الريلز ${limits.maxReelDurationSec} ثانية`,
            });
        }

        // Check daily limit
        const countResult = await pool.query(
            `SELECT COUNT(*) as cnt FROM user_posts
       WHERE user_id = $1 AND type = $2 AND is_active = true
       AND created_at > NOW() - INTERVAL '24 hours'`,
            [userId, type],
        );
        const todayCount = parseInt(countResult.rows[0].cnt);
        const maxDaily = type === "reel" ? limits.maxDailyReels : limits.maxDailyPhotos;

        if (todayCount >= maxDaily) {
            return res.status(429).json({
                success: false,
                message: type === "reel"
                    ? `الحد الأقصى اليومي ${maxDaily} ريلز`
                    : `الحد الأقصى اليومي ${maxDaily} صور`,
            });
        }

        // For reels: set story active for 24h
        const isReel = type === "reel";
        const storyExpiresAt = isReel ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

        const result = await pool.query(
            `INSERT INTO user_posts (user_id, type, media_url, thumbnail_url, caption, duration, is_story_active, story_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING id, user_id as "userId", type, media_url as "mediaUrl", thumbnail_url as "thumbnailUrl",
                 caption, duration, like_count as "likeCount", view_count as "viewCount",
                 is_story_active as "isStoryActive", story_expires_at as "storyExpiresAt",
                 created_at as "createdAt"`,
            [userId, type, mediaUrl, thumbnailUrl || null, caption || null, duration || null, isReel, storyExpiresAt],
        );

        postLog.info(`Post created by ${userId}: ${result.rows[0].id} (${type})`);
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
        postLog.error(`Create post error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── GET /feed — CEX feed (all active reels, cursor-paginated) ──
router.get("/feed", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
        const cursor = req.query.cursor as string | undefined;

        const params: any[] = [limit];
        let idx = 2;
        let cursorClause = "";
        let likedClause = ", false as \"liked\"";

        if (userId) {
            likedClause = `, EXISTS(SELECT 1 FROM user_post_likes l WHERE l.post_id = p.id AND l.user_id = $${idx}) as "liked"`;
            params.push(userId);
            idx++;
        }
        if (cursor) {
            const cursorDate = new Date(cursor);
            if (!isNaN(cursorDate.getTime())) {
                cursorClause = `AND p.created_at < $${idx}`;
                params.push(cursorDate.toISOString());
                idx++;
            }
        }

        // Feed: all active reels + recent photos, ordered by recency
        const result = await pool.query(
            `SELECT p.id, p.user_id as "userId", p.type, p.media_url as "mediaUrl",
              p.thumbnail_url as "thumbnailUrl", p.caption, p.duration,
              p.like_count as "likeCount", p.view_count as "viewCount",
              p.is_story_active as "isStoryActive", p.created_at as "createdAt",
              u.username, u.display_name as "displayName", u.avatar,
              u.country_code as "countryCode"
              ${likedClause}
       FROM user_posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.is_active = true AND p.type = 'reel'
         ${cursorClause}
       ORDER BY p.created_at DESC
       LIMIT $1`,
            params,
        );

        const rows = result.rows;
        const nextCursor = rows.length === limit ? rows[rows.length - 1].createdAt : null;

        return res.json({ success: true, data: rows, nextCursor });
    } catch (err: any) {
        postLog.error(`Feed error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── GET /user/:id — User's posts (public profile) ──
router.get("/user/:id", async (req: Request, res: Response) => {
    const viewerId = (req.session as any)?.userId;
    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const targetUserId = req.params.id;
        const type = req.query.type as string | undefined; // filter by "photo" or "reel"
        const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
        const cursor = req.query.cursor as string | undefined;

        const params: any[] = [targetUserId, limit];
        let idx = 3;
        let typeClause = "";
        let cursorClause = "";
        let likedClause = ", false as \"liked\"";

        if (viewerId) {
            likedClause = `, EXISTS(SELECT 1 FROM user_post_likes l WHERE l.post_id = p.id AND l.user_id = $${idx}) as "liked"`;
            params.push(viewerId);
            idx++;
        }
        if (type && (type === "photo" || type === "reel")) {
            typeClause = `AND p.type = $${idx}`;
            params.push(type);
            idx++;
        }
        if (cursor) {
            const cursorDate = new Date(cursor);
            if (!isNaN(cursorDate.getTime())) {
                cursorClause = `AND p.created_at < $${idx}`;
                params.push(cursorDate.toISOString());
                idx++;
            }
        }

        const result = await pool.query(
            `SELECT p.id, p.type, p.media_url as "mediaUrl", p.thumbnail_url as "thumbnailUrl",
              p.caption, p.duration, p.like_count as "likeCount", p.view_count as "viewCount",
              p.is_story_active as "isStoryActive", p.created_at as "createdAt"
              ${likedClause}
       FROM user_posts p
       WHERE p.user_id = $1 AND p.is_active = true
         ${typeClause}
         ${cursorClause}
       ORDER BY p.created_at DESC
       LIMIT $2`,
            params,
        );

        // Also get user profile info
        const userResult = await pool.query(
            `SELECT u.id, u.username, u.display_name as "displayName", u.avatar, u.bio,
              u.country_code as "countryCode", u.gender, u.created_at as "joinedAt",
              EXISTS(SELECT 1 FROM user_posts up WHERE up.user_id = u.id AND up.type = 'reel'
                AND up.is_story_active = true AND up.story_expires_at > NOW() AND up.is_active = true
              ) as "hasActiveStory"
       FROM users u WHERE u.id = $1 AND u.is_active = true`,
            [targetUserId],
        );

        if (userResult.rows.length === 0) {
            return res.status(404).json({ success: false, message: "المستخدم غير موجود" });
        }

        const rows = result.rows;
        const nextCursor = rows.length === limit ? rows[rows.length - 1].createdAt : null;

        return res.json({
            success: true,
            data: {
                user: userResult.rows[0],
                posts: rows,
                nextCursor,
            },
        });
    } catch (err: any) {
        postLog.error(`User posts error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── GET /active-stories — Users with active story reels (for avatar glow) ──
router.get("/active-stories", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const result = await pool.query(
            `SELECT DISTINCT u.id, u.username, u.display_name as "displayName", u.avatar
       FROM user_posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.is_story_active = true AND p.story_expires_at > NOW() AND p.is_active = true
       ORDER BY u.username
       LIMIT 200`,
        );

        return res.json({ success: true, data: result.rows });
    } catch (err: any) {
        postLog.error(`Active stories error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── GET /:id — Single post ──
router.get("/:id", async (req: Request, res: Response) => {
    const viewerId = (req.session as any)?.userId;
    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const params: any[] = [req.params.id];
        let likedClause = ", false as \"liked\"";
        if (viewerId) {
            likedClause = `, EXISTS(SELECT 1 FROM user_post_likes l WHERE l.post_id = p.id AND l.user_id = $2) as "liked"`;
            params.push(viewerId);
        }
        const result = await pool.query(
            `SELECT p.*, u.username, u.display_name as "displayName", u.avatar,
              u.country_code as "countryCode"
              ${likedClause}
       FROM user_posts p JOIN users u ON u.id = p.user_id
       WHERE p.id = $1 AND p.is_active = true`,
            params,
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "المنشور غير موجود" });
        }

        return res.json({ success: true, data: result.rows[0] });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── DELETE /:id — Delete own post ──
router.delete("/:id", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const result = await pool.query(
            `UPDATE user_posts SET is_active = false WHERE id = $1 AND user_id = $2 RETURNING id`,
            [req.params.id, userId],
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "المنشور غير موجود" });
        }

        return res.json({ success: true, message: "تم حذف المنشور" });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── POST /:id/like — Toggle like ──
router.post("/:id/like", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const postId = req.params.id;

        // Check if already liked
        const existingLike = await pool.query(
            `SELECT id FROM user_post_likes WHERE post_id = $1 AND user_id = $2`,
            [postId, userId],
        );

        if (existingLike.rows.length > 0) {
            // Unlike
            await pool.query(`DELETE FROM user_post_likes WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
            await pool.query(`UPDATE user_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1`, [postId]);
            return res.json({ success: true, liked: false });
        } else {
            // Like
            await pool.query(
                `INSERT INTO user_post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [postId, userId],
            );
            await pool.query(`UPDATE user_posts SET like_count = like_count + 1 WHERE id = $1`, [postId]);
            return res.json({ success: true, liked: true });
        }
    } catch (err: any) {
        postLog.error(`Like error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── POST /:id/view — Record view (unique per user) ──
router.post("/:id/view", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const postId = req.params.id;

        const viewResult = await pool.query(
            `INSERT INTO user_post_views (post_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT (post_id, user_id) DO NOTHING`,
            [postId, userId],
        );

        if (viewResult.rowCount && viewResult.rowCount > 0) {
            await pool.query(
                `UPDATE user_posts SET view_count = view_count + 1 WHERE id = $1`,
                [postId],
            );
        }

        return res.json({ success: true });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

export default router;
