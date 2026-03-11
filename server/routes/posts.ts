/**
 * Posts API Routes — المنشورات (صور + ريلز)
 * ═══════════════════════════════════════════════
 * POST   /                   — Create a post (photo or reel)
 * GET    /feed               — Public feed (algorithm-scored reels)
 * GET    /my                 — Current user's own reels (private tab)
 * GET    /saved              — User's saved reels
 * GET    /user/:id           — User's posts (for public profile)
 * GET    /active-stories     — Users with active story reels (for avatar glow)
 * GET    /:id                — Single post
 * DELETE /:id                — Delete own post (soft)
 * POST   /:id/like           — Toggle like
 * POST   /:id/view           — Record view + watch duration
 * POST   /:id/save           — Toggle save/bookmark
 * GET    /:id/comments       — List comments
 * POST   /:id/comments       — Add comment
 * DELETE /comments/:commentId — Delete own comment
 * POST   /screenshot-violation — Report screenshot attempt
 * GET    /screenshot-status  — Check if user is banned from taking screenshots
 */
import { Router, type Request, type Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { getPool } from "../db";
import { createPostSchema, createCommentSchema } from "../../shared/schema";
import { createLogger } from "../logger";
import { enqueueNotificationJob } from "../services/notificationQueue";

const router = Router();
const postLog = createLogger("posts");

// ── Rate limiters ──
const postCreateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.session as any)?.userId || ipKeyGenerator(req.ip || "127.0.0.1"),
    message: { success: false, message: "تم تجاوز الحد الأقصى للنشر. حاول لاحقاً" },
});
const commentLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => (req.session as any)?.userId || ipKeyGenerator(req.ip || "127.0.0.1"),
    message: { success: false, message: "تم تجاوز حد التعليقات. حاول لاحقاً" },
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
        const { type, mediaUrl, thumbnailUrl, caption, duration, visibility } = parsed.data;
        const limits = await getDailyLimits(pool);

        if (type === "reel" && duration && duration > limits.maxReelDurationSec) {
            return res.status(400).json({
                success: false,
                message: `الحد الأقصى لمدة الريلز ${limits.maxReelDurationSec} ثانية`,
            });
        }

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

        const isReel = type === "reel";
        const storyExpiresAt = isReel ? new Date(Date.now() + 24 * 60 * 60 * 1000) : null;

        const result = await pool.query(
            `INSERT INTO user_posts (user_id, type, media_url, thumbnail_url, caption, duration, visibility, is_story_active, story_expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING id, user_id as "userId", type, media_url as "mediaUrl", thumbnail_url as "thumbnailUrl",
                 caption, duration, visibility, like_count as "likeCount", view_count as "viewCount",
                 comment_count as "commentCount", save_count as "saveCount",
                 is_story_active as "isStoryActive", story_expires_at as "storyExpiresAt",
                 created_at as "createdAt"`,
            [userId, type, mediaUrl, thumbnailUrl || null, caption || null, duration || null, visibility || "public", isReel, storyExpiresAt],
        );

        postLog.info(`Post created by ${userId}: ${result.rows[0].id} (${type}, ${visibility})`);
        return res.status(201).json({ success: true, data: result.rows[0] });
    } catch (err: any) {
        postLog.error(`Create post error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── GET /feed — Public feed (algorithm-scored reels) ──
// Score = (like_count * 3) + (view_count * 1) + (total_watch_sec / 10) + (comment_count * 2) + recency_bonus
// Each page refresh shuffles within score tiers using RANDOM()
router.get("/feed", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 20, 50);
        const offset = Math.max(parseInt(req.query.offset as string) || 0, 0);

        const params: any[] = [limit, offset];
        let idx = 3;
        let likedClause = ", false as \"liked\"";
        let savedClause = ", false as \"saved\"";

        if (userId) {
            likedClause = `, EXISTS(SELECT 1 FROM user_post_likes l WHERE l.post_id = p.id AND l.user_id = $${idx}) as "liked"`;
            params.push(userId);
            idx++;
            savedClause = `, EXISTS(SELECT 1 FROM user_post_saves s WHERE s.post_id = p.id AND s.user_id = $${idx}) as "saved"`;
            params.push(userId);
            idx++;
        }

        // Algorithm: score-based ordering with randomization within tiers
        // - Newer posts get a recency bonus (decays over 48h)
        // - Random factor shuffles posts of similar score on each request
        // Check if total_watch_sec column exists (may not be pushed yet)
        let hasWatchSec = true;
        try {
            const colCheck = await pool.query(
                `SELECT 1 FROM information_schema.columns WHERE table_name='user_posts' AND column_name='total_watch_sec' LIMIT 1`
            );
            hasWatchSec = colCheck.rows.length > 0;
        } catch { hasWatchSec = false; }

        const watchSecExpr = hasWatchSec ? "(COALESCE(p.total_watch_sec, 0)::float / 10)" : "0";

        const result = await pool.query(
            `SELECT p.id, p.user_id as "userId", p.type, p.media_url as "mediaUrl",
              p.thumbnail_url as "thumbnailUrl", p.caption, p.duration, p.visibility,
              p.like_count as "likeCount", p.view_count as "viewCount",
              p.comment_count as "commentCount", p.save_count as "saveCount",
              p.is_story_active as "isStoryActive", p.created_at as "createdAt",
              u.username, u.display_name as "displayName", u.avatar,
              u.country_code as "countryCode"
              ${likedClause}
              ${savedClause}
       FROM user_posts p
       JOIN users u ON u.id = p.user_id
       WHERE p.is_active = true AND p.type = 'reel' AND p.visibility = 'public'
       ORDER BY (
         (p.like_count * 3) +
         (p.view_count) +
         ${watchSecExpr} +
         (p.comment_count * 2) +
         (GREATEST(0, 100 - EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 1728))
         + (RANDOM() * 20)
       ) DESC
       LIMIT $1 OFFSET $2`,
            params,
        );

        return res.json({ success: true, data: result.rows, hasMore: result.rows.length === limit });
    } catch (err: any) {
        postLog.error(`Feed error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── GET /my — Current user's own reels (private tab) ──
router.get("/my", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
        const cursor = req.query.cursor as string | undefined;

        const params: any[] = [userId, limit];
        let idx = 3;
        let cursorClause = "";
        if (cursor) {
            const cursorDate = new Date(cursor);
            if (!isNaN(cursorDate.getTime())) {
                cursorClause = `AND p.created_at < $${idx}`;
                params.push(cursorDate.toISOString());
            }
        }

        const result = await pool.query(
            `SELECT p.id, p.type, p.media_url as "mediaUrl", p.thumbnail_url as "thumbnailUrl",
              p.caption, p.duration, p.visibility,
              p.like_count as "likeCount", p.view_count as "viewCount",
              p.comment_count as "commentCount", p.save_count as "saveCount",
              p.is_story_active as "isStoryActive", p.created_at as "createdAt"
       FROM user_posts p
       WHERE p.user_id = $1 AND p.is_active = true AND p.type = 'reel'
         ${cursorClause}
       ORDER BY p.created_at DESC
       LIMIT $2`,
            params,
        );

        const rows = result.rows;
        const nextCursor = rows.length === limit ? rows[rows.length - 1].createdAt : null;
        return res.json({ success: true, data: rows, nextCursor });
    } catch (err: any) {
        postLog.error(`My posts error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── GET /saved — User's saved reels ──
router.get("/saved", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
        const cursor = req.query.cursor as string | undefined;

        const params: any[] = [userId, limit];
        let cursorClause = "";
        if (cursor) {
            const cursorDate = new Date(cursor);
            if (!isNaN(cursorDate.getTime())) {
                cursorClause = `AND s.created_at < $3`;
                params.push(cursorDate.toISOString());
            }
        }

        const result = await pool.query(
            `SELECT p.id, p.user_id as "userId", p.type, p.media_url as "mediaUrl",
              p.thumbnail_url as "thumbnailUrl", p.caption, p.duration,
              p.like_count as "likeCount", p.view_count as "viewCount",
              p.comment_count as "commentCount",
              p.created_at as "createdAt",
              u.username, u.display_name as "displayName", u.avatar,
              s.created_at as "savedAt",
              true as "saved"
       FROM user_post_saves s
       JOIN user_posts p ON p.id = s.post_id AND p.is_active = true
       JOIN users u ON u.id = p.user_id
       WHERE s.user_id = $1
         ${cursorClause}
       ORDER BY s.created_at DESC
       LIMIT $2`,
            params,
        );

        const rows = result.rows;
        const nextCursor = rows.length === limit ? rows[rows.length - 1].savedAt : null;
        return res.json({ success: true, data: rows, nextCursor });
    } catch (err: any) {
        postLog.error(`Saved posts error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── GET /screenshot-status — Check if user is banned ──
router.get("/screenshot-status", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.json({ success: true, banned: false, count: 0 });

    const pool = getPool();
    if (!pool) return res.json({ success: true, banned: false, count: 0 });

    try {
        const result = await pool.query(
            `SELECT count, banned_until as "bannedUntil" FROM screenshot_violations WHERE user_id = $1`,
            [userId],
        );
        if (result.rows.length === 0) return res.json({ success: true, banned: false, count: 0 });

        const { count, bannedUntil } = result.rows[0];
        const banned = bannedUntil ? new Date(bannedUntil) > new Date() : false;
        return res.json({ success: true, banned, count, bannedUntil: banned ? bannedUntil : null });
    } catch {
        return res.json({ success: true, banned: false, count: 0 });
    }
});

// ── POST /screenshot-violation — Report screenshot attempt ──
router.post("/screenshot-violation", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        // Upsert: increment count
        const result = await pool.query(
            `INSERT INTO screenshot_violations (user_id, count, last_attempt_at)
       VALUES ($1, 1, NOW())
       ON CONFLICT (user_id) DO UPDATE SET
         count = screenshot_violations.count + 1,
         last_attempt_at = NOW()
       RETURNING count`,
            [userId],
        );

        const count = result.rows[0].count;

        // After 5 attempts, ban for 5 hours
        if (count >= 5) {
            await pool.query(
                `UPDATE screenshot_violations SET banned_until = NOW() + INTERVAL '5 hours' WHERE user_id = $1`,
                [userId],
            );
            postLog.warn(`User ${userId} banned from Watch for 5h (${count} screenshot attempts)`);
            return res.json({ success: true, banned: true, count, bannedUntil: new Date(Date.now() + 5 * 3600 * 1000) });
        }

        return res.json({ success: true, banned: false, count, warning: true });
    } catch (err: any) {
        postLog.error(`Screenshot violation error: ${err.message}`);
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
        const type = req.query.type as string | undefined;
        const limit = Math.min(parseInt(req.query.limit as string) || 30, 100);
        const cursor = req.query.cursor as string | undefined;

        const params: any[] = [targetUserId, limit];
        let idx = 3;
        let typeClause = "";
        let cursorClause = "";
        let likedClause = ", false as \"liked\"";
        let savedClause = ", false as \"saved\"";

        // Only show public posts (unless viewing own profile)
        let visibilityClause = "AND p.visibility = 'public'";
        if (viewerId === targetUserId) {
            visibilityClause = ""; // owner sees all
        }

        if (viewerId) {
            likedClause = `, EXISTS(SELECT 1 FROM user_post_likes l WHERE l.post_id = p.id AND l.user_id = $${idx}) as "liked"`;
            params.push(viewerId);
            idx++;
            savedClause = `, EXISTS(SELECT 1 FROM user_post_saves s WHERE s.post_id = p.id AND s.user_id = $${idx}) as "saved"`;
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
              p.caption, p.duration, p.visibility,
              p.like_count as "likeCount", p.view_count as "viewCount",
              p.comment_count as "commentCount", p.save_count as "saveCount",
              p.is_story_active as "isStoryActive", p.created_at as "createdAt"
              ${likedClause}
              ${savedClause}
       FROM user_posts p
       WHERE p.user_id = $1 AND p.is_active = true
         ${visibilityClause}
         ${typeClause}
         ${cursorClause}
       ORDER BY p.created_at DESC
       LIMIT $2`,
            params,
        );

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
            data: { user: userResult.rows[0], posts: rows, nextCursor },
        });
    } catch (err: any) {
        postLog.error(`User posts error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── GET /active-stories ──
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
        let idx = 2;
        let likedClause = ", false as \"liked\"";
        let savedClause = ", false as \"saved\"";
        if (viewerId) {
            likedClause = `, EXISTS(SELECT 1 FROM user_post_likes l WHERE l.post_id = p.id AND l.user_id = $${idx}) as "liked"`;
            params.push(viewerId);
            idx++;
            savedClause = `, EXISTS(SELECT 1 FROM user_post_saves s WHERE s.post_id = p.id AND s.user_id = $${idx}) as "saved"`;
            params.push(viewerId);
            idx++;
        }
        const result = await pool.query(
            `SELECT p.*, u.username, u.display_name as "displayName", u.avatar,
              u.country_code as "countryCode"
              ${likedClause}
              ${savedClause}
       FROM user_posts p JOIN users u ON u.id = p.user_id
       WHERE p.id = $1 AND p.is_active = true`,
            params,
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "المنشور غير موجود" });
        }

        // Private posts only visible to owner
        const post = result.rows[0];
        if (post.visibility === "private" && post.user_id !== viewerId) {
            return res.status(404).json({ success: false, message: "المنشور غير موجود" });
        }

        return res.json({ success: true, data: post });
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
        const existingLike = await pool.query(
            `SELECT id FROM user_post_likes WHERE post_id = $1 AND user_id = $2`,
            [postId, userId],
        );

        if (existingLike.rows.length > 0) {
            await pool.query(`DELETE FROM user_post_likes WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
            await pool.query(`UPDATE user_posts SET like_count = GREATEST(like_count - 1, 0) WHERE id = $1`, [postId]);
            return res.json({ success: true, liked: false });
        } else {
            await pool.query(
                `INSERT INTO user_post_likes (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [postId, userId],
            );
            await pool.query(`UPDATE user_posts SET like_count = like_count + 1 WHERE id = $1`, [postId]);

            // Notify post owner
            const postOwner = await pool.query(`SELECT user_id, caption FROM user_posts WHERE id = $1`, [postId]);
            if (postOwner.rows.length > 0 && postOwner.rows[0].user_id !== userId) {
                const actor = await pool.query(`SELECT display_name, username FROM users WHERE id = $1`, [userId]);
                const actorName = actor.rows[0]?.display_name || actor.rows[0]?.username || "";
                enqueueNotificationJob({
                    userId: postOwner.rows[0].user_id,
                    preferenceKey: "systemUpdates",
                    kind: "friend" as any,
                    actorName,
                    bodyPreview: "❤️",
                    url: `/cex`,
                });
            }

            return res.json({ success: true, liked: true });
        }
    } catch (err: any) {
        postLog.error(`Like error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── POST /:id/view — Record view + watch duration ──
router.post("/:id/view", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const postId = req.params.id;
        const watchSec = Math.min(Math.max(parseInt(req.body?.watchSec) || 0, 0), 300); // cap at 5min

        const viewResult = await pool.query(
            `INSERT INTO user_post_views (post_id, user_id)
       VALUES ($1, $2) ON CONFLICT (post_id, user_id) DO NOTHING`,
            [postId, userId],
        );

        if (viewResult.rowCount && viewResult.rowCount > 0) {
            await pool.query(
                `UPDATE user_posts SET view_count = view_count + 1, total_watch_sec = total_watch_sec + $2 WHERE id = $1`,
                [postId, watchSec],
            );
        } else if (watchSec > 0) {
            // Already counted the view, but still accumulate watch time
            await pool.query(
                `UPDATE user_posts SET total_watch_sec = total_watch_sec + $2 WHERE id = $1`,
                [postId, watchSec],
            );
        }

        return res.json({ success: true });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── POST /:id/save — Toggle save/bookmark ──
router.post("/:id/save", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const postId = req.params.id;
        const existing = await pool.query(
            `SELECT id FROM user_post_saves WHERE post_id = $1 AND user_id = $2`,
            [postId, userId],
        );

        if (existing.rows.length > 0) {
            await pool.query(`DELETE FROM user_post_saves WHERE post_id = $1 AND user_id = $2`, [postId, userId]);
            await pool.query(`UPDATE user_posts SET save_count = GREATEST(save_count - 1, 0) WHERE id = $1`, [postId]);
            return res.json({ success: true, saved: false });
        } else {
            await pool.query(
                `INSERT INTO user_post_saves (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
                [postId, userId],
            );
            await pool.query(`UPDATE user_posts SET save_count = save_count + 1 WHERE id = $1`, [postId]);
            return res.json({ success: true, saved: true });
        }
    } catch (err: any) {
        postLog.error(`Save error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── GET /:id/comments — List comments ──
router.get("/:id/comments", async (req: Request, res: Response) => {
    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const postId = req.params.id;
        const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);
        const cursor = req.query.cursor as string | undefined;

        const params: any[] = [postId, limit];
        let cursorClause = "";
        if (cursor) {
            const cursorDate = new Date(cursor);
            if (!isNaN(cursorDate.getTime())) {
                cursorClause = `AND c.created_at < $3`;
                params.push(cursorDate.toISOString());
            }
        }

        const result = await pool.query(
            `SELECT c.id, c.text, c.created_at as "createdAt",
              u.id as "userId", u.username, u.display_name as "displayName", u.avatar
       FROM user_post_comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = $1 AND c.is_active = true
         ${cursorClause}
       ORDER BY c.created_at DESC
       LIMIT $2`,
            params,
        );

        const rows = result.rows;
        const nextCursor = rows.length === limit ? rows[rows.length - 1].createdAt : null;
        return res.json({ success: true, data: rows, nextCursor });
    } catch (err: any) {
        postLog.error(`Comments list error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── POST /:id/comments — Add comment ──
router.post("/:id/comments", commentLimiter, async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

    const parsed = createCommentSchema.safeParse(req.body);
    if (!parsed.success) {
        return res.status(400).json({ success: false, message: "تعليق غير صالح" });
    }

    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const postId = req.params.id;
        const { text } = parsed.data;

        // Check post exists
        const postCheck = await pool.query(
            `SELECT user_id FROM user_posts WHERE id = $1 AND is_active = true`, [postId],
        );
        if (postCheck.rows.length === 0) {
            return res.status(404).json({ success: false, message: "المنشور غير موجود" });
        }

        const result = await pool.query(
            `INSERT INTO user_post_comments (post_id, user_id, text)
       VALUES ($1, $2, $3)
       RETURNING id, text, created_at as "createdAt"`,
            [postId, userId, text],
        );

        // Increment comment count
        await pool.query(`UPDATE user_posts SET comment_count = comment_count + 1 WHERE id = $1`, [postId]);

        // Fetch commenter info for response
        const commenter = await pool.query(
            `SELECT id as "userId", username, display_name as "displayName", avatar FROM users WHERE id = $1`,
            [userId],
        );

        const comment = { ...result.rows[0], ...commenter.rows[0] };

        // Notify post owner
        const postOwnerId = postCheck.rows[0].user_id;
        if (postOwnerId !== userId) {
            const actorName = commenter.rows[0]?.displayName || commenter.rows[0]?.username || "";
            enqueueNotificationJob({
                userId: postOwnerId,
                preferenceKey: "systemUpdates",
                kind: "friend" as any,
                actorName,
                bodyPreview: text.slice(0, 80),
                url: `/cex`,
            });
        }

        return res.status(201).json({ success: true, data: comment });
    } catch (err: any) {
        postLog.error(`Add comment error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── DELETE /comments/:commentId — Delete own comment ──
router.delete("/comments/:commentId", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const result = await pool.query(
            `UPDATE user_post_comments SET is_active = false
       WHERE id = $1 AND user_id = $2 RETURNING post_id`,
            [req.params.commentId, userId],
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "التعليق غير موجود" });
        }

        // Decrement comment count
        await pool.query(
            `UPDATE user_posts SET comment_count = GREATEST(comment_count - 1, 0) WHERE id = $1`,
            [result.rows[0].post_id],
        );

        return res.json({ success: true });
    } catch (err: any) {
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

// ── PATCH /:id/visibility — Toggle visibility (own posts only) ──
router.patch("/:id/visibility", async (req: Request, res: Response) => {
    const userId = (req.session as any)?.userId;
    if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

    const pool = getPool();
    if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

    try {
        const visibility = req.body?.visibility;
        if (visibility !== "public" && visibility !== "private") {
            return res.status(400).json({ success: false, message: "القيمة غير صالحة" });
        }

        const result = await pool.query(
            `UPDATE user_posts SET visibility = $1 WHERE id = $2 AND user_id = $3 AND is_active = true
       RETURNING id, visibility`,
            [visibility, req.params.id, userId],
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ success: false, message: "المنشور غير موجود" });
        }

        postLog.info(`Post ${req.params.id} visibility changed to ${visibility} by ${userId}`);
        return res.json({ success: true, data: result.rows[0] });
    } catch (err: any) {
        postLog.error(`Visibility toggle error: ${err.message}`);
        return res.status(500).json({ success: false, message: "خطأ في الخادم" });
    }
});

export default router;
