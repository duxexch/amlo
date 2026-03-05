/**
 * Group Chat API Routes — المحادثات الجماعية
 * =============================================
 * POST   /api/social/groups              — Create a group
 * GET    /api/social/groups              — List user's groups
 * GET    /api/social/groups/:id          — Get group details
 * PUT    /api/social/groups/:id          — Update group (admin only)
 * DELETE /api/social/groups/:id          — Delete group (creator only)
 * POST   /api/social/groups/:id/members  — Add members
 * DELETE /api/social/groups/:id/members/:userId — Remove member
 * POST   /api/social/groups/:id/leave    — Leave group
 * GET    /api/social/groups/:id/messages — Get group messages
 * POST   /api/social/groups/:id/messages — Send group message
 */
import { Router, type Request, type Response } from "express";
import { getPool } from "../db";
import { createGroupSchema, sendGroupMessageSchema } from "../../shared/schema";
import { createLogger } from "../logger";

const router = Router();
const groupLog = createLogger("groups");

// ── POST / — Create a group ──
router.post("/", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const parsed = createGroupSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "بيانات غير صالحة", errors: parsed.error.issues });
  }

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    const { name, description, avatar, memberIds } = parsed.data;

    // Create group
    const groupResult = await client.query(
      `INSERT INTO group_conversations (name, avatar, description, creator_id, last_message_at)
       VALUES ($1, $2, $3, $4, NOW())
       RETURNING id, name, avatar, description, creator_id as "creatorId", max_members as "maxMembers",
                 created_at as "createdAt"`,
      [name, avatar || null, description || null, userId],
    );
    const group = groupResult.rows[0];

    // Add creator as admin
    await client.query(
      `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'admin')`,
      [group.id, userId],
    );

    // Add other members
    const uniqueMembers = [...new Set(memberIds.filter((id: string) => id !== userId))];
    for (const memberId of uniqueMembers) {
      await client.query(
        `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member')
         ON CONFLICT (group_id, user_id) DO NOTHING`,
        [group.id, memberId],
      );
    }

    // System message
    await client.query(
      `INSERT INTO group_messages (group_id, sender_id, content, type)
       VALUES ($1, $2, $3, 'system')`,
      [group.id, userId, "تم إنشاء المجموعة"],
    );

    await client.query("COMMIT");

    groupLog.info(`Group "${name}" created by ${userId} with ${uniqueMembers.length + 1} members`);
    return res.status(201).json({ success: true, data: { ...group, memberCount: uniqueMembers.length + 1 } });
  } catch (err: any) {
    await client.query("ROLLBACK");
    groupLog.error(`Create group error: ${err.message}`);
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  } finally {
    client.release();
  }
});

// ── GET / — List user's groups ──
router.get("/", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    const result = await pool.query(
      `SELECT gc.id, gc.name, gc.avatar, gc.description, gc.creator_id as "creatorId",
              gc.last_message_at as "lastMessageAt", gc.created_at as "createdAt",
              gm.role,
              (SELECT COUNT(*)::int FROM group_members WHERE group_id = gc.id) as "memberCount",
              (SELECT gm2.content FROM group_messages gm2 WHERE gm2.group_id = gc.id ORDER BY gm2.created_at DESC LIMIT 1) as "lastMessage"
       FROM group_conversations gc
       JOIN group_members gm ON gm.group_id = gc.id AND gm.user_id = $1
       WHERE gc.is_active = true
       ORDER BY gc.last_message_at DESC NULLS LAST`,
      [userId],
    );

    return res.json({ success: true, data: result.rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── GET /:id — Get group details with members ──
router.get("/:id", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    // Verify membership
    const memberCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [req.params.id, userId],
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: "أنت لست عضواً في هذه المجموعة" });
    }

    const groupResult = await pool.query(
      `SELECT id, name, avatar, description, creator_id as "creatorId",
              max_members as "maxMembers", created_at as "createdAt"
       FROM group_conversations WHERE id = $1 AND is_active = true`,
      [req.params.id],
    );
    if (groupResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "المجموعة غير موجودة" });
    }

    const membersResult = await pool.query(
      `SELECT gm.user_id as "userId", gm.role, gm.joined_at as "joinedAt",
              u.username, u.display_name as "displayName", u.avatar
       FROM group_members gm
       JOIN users u ON u.id = gm.user_id
       WHERE gm.group_id = $1
       ORDER BY gm.role = 'admin' DESC, gm.joined_at ASC`,
      [req.params.id],
    );

    return res.json({
      success: true,
      data: { ...groupResult.rows[0], members: membersResult.rows, myRole: memberCheck.rows[0].role },
    });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── POST /:id/members — Add members (admin/moderator only) ──
router.post("/:id/members", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    // Verify admin/moderator role
    const roleCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND role IN ('admin', 'moderator')`,
      [req.params.id, userId],
    );
    if (roleCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية" });
    }

    const { memberIds } = req.body;
    if (!Array.isArray(memberIds) || memberIds.length === 0) {
      return res.status(400).json({ success: false, message: "يرجى تحديد الأعضاء" });
    }

    let added = 0;
    for (const memberId of memberIds.slice(0, 50)) {
      if (typeof memberId !== "string") continue;
      const r = await pool.query(
        `INSERT INTO group_members (group_id, user_id, role) VALUES ($1, $2, 'member')
         ON CONFLICT (group_id, user_id) DO NOTHING`,
        [req.params.id, memberId],
      );
      added += r.rowCount || 0;
    }

    return res.json({ success: true, message: `تم إضافة ${added} عضو` });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── DELETE /:id/members/:userId — Remove member (admin only) ──
router.delete("/:id/members/:userId", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    const roleCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2 AND role = 'admin'`,
      [req.params.id, userId],
    );
    if (roleCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: "ليس لديك صلاحية" });
    }

    // Can't remove yourself (use leave instead)
    if (req.params.userId === userId) {
      return res.status(400).json({ success: false, message: "استخدم خيار المغادرة" });
    }

    await pool.query(
      `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [req.params.id, req.params.userId],
    );

    return res.json({ success: true, message: "تم إزالة العضو" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── POST /:id/leave — Leave group ──
router.post("/:id/leave", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    await pool.query(
      `DELETE FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [req.params.id, userId],
    );

    // If no members left, deactivate group
    const count = await pool.query(
      `SELECT COUNT(*)::int as c FROM group_members WHERE group_id = $1`,
      [req.params.id],
    );
    if (count.rows[0].c === 0) {
      await pool.query(
        `UPDATE group_conversations SET is_active = false WHERE id = $1`,
        [req.params.id],
      );
    }

    return res.json({ success: true, message: "تم المغادرة" });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── GET /:id/messages — Get group messages (paginated) ──
router.get("/:id/messages", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    // Verify membership
    const memberCheck = await pool.query(
      `SELECT role FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [req.params.id, userId],
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: "أنت لست عضواً" });
    }

    const before = req.query.before as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 100);

    let query = `
      SELECT gm.id, gm.group_id as "groupId", gm.sender_id as "senderId",
             gm.content, gm.type, gm.media_url as "mediaUrl", gm.gift_id as "giftId",
             gm.is_deleted as "isDeleted", gm.created_at as "createdAt",
             u.username as "senderUsername", u.display_name as "senderName", u.avatar as "senderAvatar"
      FROM group_messages gm
      JOIN users u ON u.id = gm.sender_id
      WHERE gm.group_id = $1`;

    const params: any[] = [req.params.id];
    if (before) {
      query += ` AND gm.created_at < $2`;
      params.push(before);
    }
    query += ` ORDER BY gm.created_at DESC LIMIT $${params.length + 1}`;
    params.push(limit);

    const result = await pool.query(query, params);

    return res.json({ success: true, data: result.rows });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

// ── POST /:id/messages — Send group message ──
router.post("/:id/messages", async (req: Request, res: Response) => {
  const userId = (req.session as any)?.userId;
  if (!userId) return res.status(401).json({ success: false, message: "يرجى تسجيل الدخول" });

  const parsed = sendGroupMessageSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ success: false, message: "بيانات غير صالحة" });
  }

  const pool = getPool();
  if (!pool) return res.status(500).json({ success: false, message: "خطأ في الخادم" });

  try {
    // Verify membership + not muted
    const memberCheck = await pool.query(
      `SELECT role, muted_until FROM group_members WHERE group_id = $1 AND user_id = $2`,
      [req.params.id, userId],
    );
    if (memberCheck.rows.length === 0) {
      return res.status(403).json({ success: false, message: "أنت لست عضواً" });
    }
    if (memberCheck.rows[0].muted_until && new Date(memberCheck.rows[0].muted_until) > new Date()) {
      return res.status(403).json({ success: false, message: "أنت مكتوم في هذه المجموعة" });
    }

    const { content, type, mediaUrl, giftId } = parsed.data;
    const result = await pool.query(
      `INSERT INTO group_messages (group_id, sender_id, content, type, media_url, gift_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, group_id as "groupId", sender_id as "senderId", content, type, created_at as "createdAt"`,
      [req.params.id, userId, content || null, type, mediaUrl || null, giftId || null],
    );

    // Update last message timestamp
    await pool.query(
      `UPDATE group_conversations SET last_message_at = NOW() WHERE id = $1`,
      [req.params.id],
    );

    return res.status(201).json({ success: true, data: result.rows[0] });
  } catch (err: any) {
    return res.status(500).json({ success: false, message: "خطأ في الخادم" });
  }
});

export default router;
