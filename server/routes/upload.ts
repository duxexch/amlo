/**
 * File Upload Service — خدمة رفع الملفات
 * ================================================
 * Handles avatar, image, and voice message uploads.
 * Stores files locally in /uploads/ directory.
 * In production, swap with S3/R2 presigned URLs.
 *
 * Security:
 *  - Requires user authentication (session userId)
 *  - Validates file magic bytes (not just MIME header)
 *  - Logs all upload attempts (success + failure)
 */
import { Router, type Request, type Response, type NextFunction } from "express";
import multer from "multer";
import path from "path";
import fs from "fs";
import { randomUUID } from "crypto";
import { createLogger } from "../logger";
import { getPool } from "../db";

const uploadLog = createLogger("upload");
const router = Router();

// ── Authentication middleware — all upload routes require login ──
function requireAuth(req: Request, res: Response, next: NextFunction) {
  const userId = (req.session as any)?.userId;
  if (!userId) {
    uploadLog.warn(`Unauthenticated upload attempt from IP: ${req.ip}`);
    return res.status(401).json({ success: false, message: "يجب تسجيل الدخول لرفع الملفات" });
  }
  next();
}
router.use(requireAuth);

// ── Magic bytes validation (prevents MIME spoofing) ──
const MAGIC_BYTES: Record<string, Buffer[]> = {
  "image/jpeg": [Buffer.from([0xFF, 0xD8, 0xFF])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  "image/gif": [Buffer.from("GIF87a"), Buffer.from("GIF89a")],
  "image/webp": [Buffer.from("RIFF")],  // RIFF....WEBP
  "audio/ogg": [Buffer.from("OggS")],
  "audio/mpeg": [Buffer.from([0xFF, 0xFB]), Buffer.from([0xFF, 0xF3]), Buffer.from([0xFF, 0xF2]), Buffer.from("ID3")],
  "audio/wav": [Buffer.from("RIFF")],
};

function validateMagicBytes(filePath: string, mimetype: string): boolean {
  const signatures = MAGIC_BYTES[mimetype];
  if (!signatures) return true; // No signature check for unknown types (webm, mp4 have complex headers)
  try {
    const fd = fs.openSync(filePath, "r");
    const buf = Buffer.alloc(12);
    fs.readSync(fd, buf, 0, 12, 0);
    fs.closeSync(fd);
    return signatures.some((sig) => buf.subarray(0, sig.length).equals(sig));
  } catch {
    return false;
  }
}

// ── Upload directory ──
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const AVATAR_DIR = path.join(UPLOAD_DIR, "avatars");
const MEDIA_DIR = path.join(UPLOAD_DIR, "media");

// Ensure directories exist
[UPLOAD_DIR, AVATAR_DIR, MEDIA_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// ── Allowed MIME types ──
const IMAGE_MIMES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const VOICE_MIMES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];
const ALL_MIMES = [...IMAGE_MIMES, ...VOICE_MIMES];

// ── Multer config ──
const avatarStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, AVATAR_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const mediaStorage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, MEDIA_DIR),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".bin";
    cb(null, `${randomUUID()}${ext}`);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (_req, file, cb) => {
    if (IMAGE_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("نوع الملف غير مدعوم. الأنواع المسموحة: JPEG, PNG, WebP, GIF"));
  },
});

const uploadMedia = multer({
  storage: mediaStorage,
  limits: { fileSize: 25 * 1024 * 1024 }, // 25MB
  fileFilter: (_req, file, cb) => {
    if (ALL_MIMES.includes(file.mimetype)) cb(null, true);
    else cb(new Error("نوع الملف غير مدعوم"));
  },
});

// ── Upload avatar ──
router.post("/avatar", uploadAvatar.single("file"), async (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!req.file) {
    uploadLog.warn(`Avatar upload failed: no file provided (user: ${userId})`);
    return res.status(400).json({ success: false, message: "لم يتم تحديد ملف" });
  }

  // Validate magic bytes
  const filePath = path.join(AVATAR_DIR, req.file.filename);
  if (!validateMagicBytes(filePath, req.file.mimetype)) {
    fs.unlinkSync(filePath); // Delete spoofed file
    uploadLog.warn(`Avatar upload rejected: magic bytes mismatch for ${req.file.mimetype} (user: ${userId})`);
    return res.status(400).json({ success: false, message: "محتوى الملف لا يطابق نوعه — رفض أمني" });
  }

  const url = `/uploads/avatars/${req.file.filename}`;
  uploadLog.info(`Avatar uploaded: ${req.file.filename} (${(req.file.size / 1024).toFixed(1)}KB) by user ${userId}`);

  // ── Delete old avatar file if it's a local upload ──
  if (userId) {
    try {
      const pool = getPool();
      if (pool) {
        const { rows } = await pool.query(`SELECT avatar FROM users WHERE id = $1`, [userId]);
        const oldAvatar = rows[0]?.avatar;
        if (oldAvatar && oldAvatar.startsWith("/uploads/avatars/")) {
          const oldPath = path.join(AVATAR_DIR, path.basename(oldAvatar));
          if (fs.existsSync(oldPath) && oldPath !== filePath) {
            fs.unlinkSync(oldPath);
            uploadLog.info(`Old avatar deleted: ${path.basename(oldAvatar)} (user ${userId})`);
          }
        }
      }
    } catch (cleanupErr: any) {
      uploadLog.warn(`Old avatar cleanup failed: ${cleanupErr.message}`);
    }
  }

  return res.json({
    success: true,
    data: { url, filename: req.file.filename, size: req.file.size },
  });
});

// ── Upload media (image/voice for chat) ──
router.post("/media", uploadMedia.single("file"), (req, res) => {
  const userId = (req.session as any)?.userId;
  if (!req.file) {
    uploadLog.warn(`Media upload failed: no file provided (user: ${userId})`);
    return res.status(400).json({ success: false, message: "لم يتم تحديد ملف" });
  }

  // Validate magic bytes
  const filePath = path.join(MEDIA_DIR, req.file.filename);
  if (!validateMagicBytes(filePath, req.file.mimetype)) {
    fs.unlinkSync(filePath); // Delete spoofed file
    uploadLog.warn(`Media upload rejected: magic bytes mismatch for ${req.file.mimetype} (user: ${userId})`);
    return res.status(400).json({ success: false, message: "محتوى الملف لا يطابق نوعه — رفض أمني" });
  }

  const isVoice = VOICE_MIMES.includes(req.file.mimetype);
  const url = `/uploads/media/${req.file.filename}`;
  uploadLog.info(`Media uploaded: ${req.file.filename} (${isVoice ? "voice" : "image"}, ${(req.file.size / 1024).toFixed(1)}KB) by user ${userId}`);

  return res.json({
    success: true,
    data: {
      url,
      filename: req.file.filename,
      size: req.file.size,
      type: isVoice ? "voice" : "image",
      mimetype: req.file.mimetype,
    },
  });
});

// ── Multer error handler ──
router.use((err: any, req: any, res: any, _next: any) => {
  const userId = req.session?.userId || "anonymous";
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      uploadLog.warn(`Upload rejected: file too large (user: ${userId}, code: ${err.code})`);
      return res.status(413).json({ success: false, message: "حجم الملف كبير جداً" });
    }
    uploadLog.warn(`Upload error: ${err.message} (user: ${userId}, code: ${err.code})`);
    return res.status(400).json({ success: false, message: err.message });
  }
  if (err) {
    uploadLog.error({ err, userId }, "Upload unexpected error");
    return res.status(400).json({ success: false, message: err.message });
  }
});

export default router;
