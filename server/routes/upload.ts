/**
 * File Upload Service — خدمة رفع الملفات
 * ================================================
 * Handles avatar, image, video, and voice message uploads.
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
import { randomUUID, createHash } from "crypto";
import { createLogger } from "../logger";
import { getPool } from "../db";
import { storage } from "../storage";

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
  "image/jpg": [Buffer.from([0xFF, 0xD8, 0xFF])],
  "image/png": [Buffer.from([0x89, 0x50, 0x4E, 0x47])],
  "image/gif": [Buffer.from("GIF87a"), Buffer.from("GIF89a")],
  "image/webp": [Buffer.from("RIFF")],  // RIFF....WEBP
  "audio/ogg": [Buffer.from("OggS")],
  "audio/mpeg": [Buffer.from([0xFF, 0xFB]), Buffer.from([0xFF, 0xF3]), Buffer.from([0xFF, 0xF2]), Buffer.from("ID3")],
  "audio/wav": [Buffer.from("RIFF")],
  "video/mp4": [Buffer.from([0x00, 0x00, 0x00])],
  "video/webm": [Buffer.from([0x1A, 0x45, 0xDF, 0xA3])],
};

function validateMagicBytes(filePath: string, mimetype: string): boolean {
  if (mimetype === "image/heic" || mimetype === "image/heif") {
    try {
      const fd = fs.openSync(filePath, "r");
      const buf = Buffer.alloc(16);
      fs.readSync(fd, buf, 0, 16, 0);
      fs.closeSync(fd);
      return buf.subarray(4, 8).toString("ascii") === "ftyp";
    } catch {
      return false;
    }
  }

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

function sha256File(filePath: string): string {
  const data = fs.readFileSync(filePath);
  return createHash("sha256").update(data).digest("hex");
}

let sharpLoader: Promise<any> | null = null;
async function getSharp() {
  if (!sharpLoader) {
    sharpLoader = import("sharp").then((m: any) => m.default || m).catch(() => null);
  }
  return sharpLoader;
}

function hammingDistance(a: string, b: string): number {
  if (a.length !== b.length) return Number.MAX_SAFE_INTEGER;
  let d = 0;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) d++;
  }
  return d;
}

async function computeDHash(filePath: string): Promise<string | null> {
  const sharp = await getSharp();
  if (!sharp) return null;
  try {
    const raw = await sharp(filePath)
      .grayscale()
      .resize(9, 8, { fit: "fill" })
      .raw()
      .toBuffer();

    if (!raw || raw.length < 72) return null;
    let bits = "";
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const left = raw[y * 9 + x];
        const right = raw[y * 9 + x + 1];
        bits += left > right ? "1" : "0";
      }
    }
    return bits;
  } catch {
    return null;
  }
}

async function emitDuplicateAvatarSecurityAlert(params: {
  userId: string;
  duplicateOwnerUserId: string;
  mode: "exact" | "perceptual";
  distance?: number;
  source: "users" | "user_profiles";
}) {
  try {
    await storage.createFraudAlert({
      userId: params.userId,
      type: "multiple_accounts",
      severity: params.mode === "exact" ? "high" : "medium",
      description: params.mode === "exact"
        ? "Duplicate avatar upload attempt detected (exact match)"
        : "Duplicate avatar upload attempt detected (near match)",
      details: JSON.stringify({
        duplicateOwnerUserId: params.duplicateOwnerUserId,
        duplicateMode: params.mode,
        perceptualDistance: params.distance ?? null,
        source: params.source,
      }),
      status: "pending",
    } as any);
  } catch (err: any) {
    uploadLog.warn(`Could not create fraud alert for duplicate avatar: ${err?.message || "unknown"}`);
  }
}

async function findDuplicateAvatarOwner(userId: string, uploadedFilePath: string): Promise<{
  ownerUserId: string;
  source: "users" | "user_profiles";
  mode: "exact" | "perceptual";
  distance?: number;
} | null> {
  const pool = getPool();
  if (!pool) {
    throw new Error("DB_UNAVAILABLE");
  }

  const uploadedStat = fs.statSync(uploadedFilePath);
  const uploadedHash = sha256File(uploadedFilePath);
  const uploadedDHash = await computeDHash(uploadedFilePath);
  const DHASH_MAX_DISTANCE = 5;

  const { rows } = await pool.query(
    `
      SELECT id::text AS owner_user_id, avatar::text AS avatar_path, 'users'::text AS source
      FROM users
      WHERE id <> $1 AND avatar LIKE '/uploads/avatars/%'
      UNION ALL
      SELECT user_id::text AS owner_user_id, avatar::text AS avatar_path, 'user_profiles'::text AS source
      FROM user_profiles
      WHERE user_id <> $1 AND avatar LIKE '/uploads/avatars/%'
    `,
    [userId],
  );

  const hashByPath = new Map<string, string>();
  const dHashByPath = new Map<string, string | null>();
  for (const row of rows) {
    const avatarPath = row.avatar_path as string;
    if (!avatarPath) continue;
    const absPath = path.join(AVATAR_DIR, path.basename(avatarPath));
    if (!fs.existsSync(absPath)) continue;

    try {
      const st = fs.statSync(absPath);
      if (st.size !== uploadedStat.size) continue;

      let candidateHash = hashByPath.get(absPath);
      if (!candidateHash) {
        candidateHash = sha256File(absPath);
        hashByPath.set(absPath, candidateHash);
      }

      if (candidateHash === uploadedHash) {
        return {
          ownerUserId: row.owner_user_id as string,
          source: (row.source as "users" | "user_profiles") || "users",
          mode: "exact",
        };
      }

      if (!uploadedDHash) continue;

      let candidateDHash = dHashByPath.get(absPath);
      if (candidateDHash === undefined) {
        candidateDHash = await computeDHash(absPath);
        dHashByPath.set(absPath, candidateDHash);
      }
      if (!candidateDHash) continue;

      const distance = hammingDistance(uploadedDHash, candidateDHash);
      if (distance <= DHASH_MAX_DISTANCE) {
        return {
          ownerUserId: row.owner_user_id as string,
          source: (row.source as "users" | "user_profiles") || "users",
          mode: "perceptual",
          distance,
        };
      }
    } catch {
      // Ignore unreadable candidate files.
    }
  }

  return null;
}

// ── Upload directory ──
const UPLOAD_DIR = path.resolve(process.cwd(), "uploads");
const AVATAR_DIR = path.join(UPLOAD_DIR, "avatars");
const MEDIA_DIR = path.join(UPLOAD_DIR, "media");
const MEDIA_CHUNK_DIR = path.join(UPLOAD_DIR, "media-chunks");

// Ensure directories exist
[UPLOAD_DIR, AVATAR_DIR, MEDIA_DIR, MEDIA_CHUNK_DIR].forEach((dir) => {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

const RESUMABLE_CHUNK_SIZE = 1024 * 1024; // 1MB
const RESUMABLE_MAX_CHUNKS = 200; // 200MB max with default chunk size

type ResumableMeta = {
  uploadId: string;
  userId: string;
  filename: string;
  mimetype: string;
  totalSize: number;
  chunkSize: number;
  totalChunks: number;
  createdAt: number;
};

function getUploadTempDir(userId: string, uploadId: string) {
  return path.join(MEDIA_CHUNK_DIR, `${userId}-${uploadId}`);
}

function getMetaPath(userId: string, uploadId: string) {
  return path.join(getUploadTempDir(userId, uploadId), "meta.json");
}

function loadResumableMeta(userId: string, uploadId: string): ResumableMeta | null {
  try {
    const p = getMetaPath(userId, uploadId);
    if (!fs.existsSync(p)) return null;
    const raw = fs.readFileSync(p, "utf8");
    const parsed = JSON.parse(raw) as ResumableMeta;
    if (!parsed || parsed.userId !== userId || parsed.uploadId !== uploadId) return null;
    return parsed;
  } catch {
    return null;
  }
}

function saveResumableMeta(meta: ResumableMeta) {
  const dir = getUploadTempDir(meta.userId, meta.uploadId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(getMetaPath(meta.userId, meta.uploadId), JSON.stringify(meta));
}

function listUploadedChunkIndexes(userId: string, uploadId: string): number[] {
  const dir = getUploadTempDir(userId, uploadId);
  if (!fs.existsSync(dir)) return [];
  const out: number[] = [];
  for (const name of fs.readdirSync(dir)) {
    const m = name.match(/^chunk-(\d+)\.part$/);
    if (m) out.push(Number(m[1]));
  }
  return out.sort((a, b) => a - b);
}

function cleanupUploadTempDir(userId: string, uploadId: string) {
  try {
    const dir = getUploadTempDir(userId, uploadId);
    if (fs.existsSync(dir)) fs.rmSync(dir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors.
  }
}

// ── Allowed MIME types ──
const IMAGE_MIMES = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/gif", "image/heic", "image/heif"];
const VOICE_MIMES = ["audio/webm", "audio/ogg", "audio/mp4", "audio/mpeg", "audio/wav"];
const VIDEO_MIMES = ["video/mp4", "video/webm", "video/quicktime"];
const ALL_MIMES = [...IMAGE_MIMES, ...VOICE_MIMES, ...VIDEO_MIMES];

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

const uploadChunk = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
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

  // Reject duplicates if same image is already used by another user.
  try {
    if (userId) {
      const duplicate = await findDuplicateAvatarOwner(userId, filePath);
      if (duplicate) {
        fs.unlinkSync(filePath);
        uploadLog.warn(`Avatar upload rejected: ${duplicate.mode} duplicate image used by user ${duplicate.ownerUserId} (source: ${duplicate.source}), uploader: ${userId}, distance: ${duplicate.distance ?? "n/a"}`);
        await emitDuplicateAvatarSecurityAlert({
          userId,
          duplicateOwnerUserId: duplicate.ownerUserId,
          mode: duplicate.mode,
          distance: duplicate.distance,
          source: duplicate.source,
        });
        return res.status(409).json({
          success: false,
          message: duplicate.mode === "exact"
            ? "هذه الصورة مستخدمة بالفعل بواسطة مستخدم آخر. الرجاء اختيار صورة مختلفة."
            : "هذه الصورة متشابهة جداً مع صورة مستخدم آخر. الرجاء اختيار صورة مختلفة.",
          code: "DUPLICATE_AVATAR",
        });
      }
    }
  } catch (dupErr: any) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    uploadLog.error({ err: dupErr, userId }, "Avatar duplicate-check error");
    return res.status(503).json({ success: false, message: "تعذر التحقق من تكرار الصورة حالياً" });
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

// ── Upload media (image/video/voice for chat) ──
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
  const isVideo = VIDEO_MIMES.includes(req.file.mimetype);
  const url = `/uploads/media/${req.file.filename}`;
  const mediaType = isVoice ? "voice" : (isVideo ? "video" : "image");
  uploadLog.info(`Media uploaded: ${req.file.filename} (${mediaType}, ${(req.file.size / 1024).toFixed(1)}KB) by user ${userId}`);

  return res.json({
    success: true,
    data: {
      url,
      filename: req.file.filename,
      size: req.file.size,
      type: mediaType,
      mimetype: req.file.mimetype,
    },
  });
});

// ── Init resumable upload session ──
router.post("/media/chunk/init", (req, res) => {
  const userId = String((req.session as any)?.userId || "");
  const filename = String(req.body?.filename || "").trim();
  const mimetype = String(req.body?.mimetype || "").trim();
  const totalSize = Number(req.body?.totalSize || 0);

  if (!filename || !mimetype || !Number.isFinite(totalSize) || totalSize <= 0) {
    return res.status(400).json({ success: false, message: "بيانات رفع غير صالحة" });
  }
  if (!ALL_MIMES.includes(mimetype)) {
    return res.status(400).json({ success: false, message: "نوع الملف غير مدعوم" });
  }
  const totalChunks = Math.ceil(totalSize / RESUMABLE_CHUNK_SIZE);
  if (totalChunks <= 0 || totalChunks > RESUMABLE_MAX_CHUNKS) {
    return res.status(400).json({ success: false, message: "حجم الملف غير مدعوم للرفع المتقطع" });
  }

  const uploadId = randomUUID();
  const meta: ResumableMeta = {
    uploadId,
    userId,
    filename,
    mimetype,
    totalSize,
    chunkSize: RESUMABLE_CHUNK_SIZE,
    totalChunks,
    createdAt: Date.now(),
  };

  saveResumableMeta(meta);
  uploadLog.info(`Resumable media init: ${uploadId} (${filename}, ${totalSize} bytes) by user ${userId}`);
  return res.json({
    success: true,
    data: {
      uploadId,
      chunkSize: RESUMABLE_CHUNK_SIZE,
      totalChunks,
      uploadedChunks: [] as number[],
    },
  });
});

// ── Upload one chunk ──
router.post("/media/chunk/:uploadId", uploadChunk.single("chunk"), (req, res) => {
  const userId = String((req.session as any)?.userId || "");
  const uploadId = String(req.params.uploadId || "").trim();
  const index = Number(req.body?.index);

  if (!uploadId || !Number.isInteger(index) || index < 0) {
    return res.status(400).json({ success: false, message: "بيانات الشريحة غير صالحة" });
  }
  if (!req.file || !req.file.buffer || req.file.buffer.length === 0) {
    return res.status(400).json({ success: false, message: "لم يتم إرسال بيانات الشريحة" });
  }

  const meta = loadResumableMeta(userId, uploadId);
  if (!meta) {
    return res.status(404).json({ success: false, message: "جلسة الرفع غير موجودة أو منتهية" });
  }
  if (index >= meta.totalChunks) {
    return res.status(400).json({ success: false, message: "رقم الشريحة خارج النطاق" });
  }

  const expectedSize = index === meta.totalChunks - 1
    ? (meta.totalSize - (index * meta.chunkSize))
    : meta.chunkSize;

  if (req.file.buffer.length > meta.chunkSize || req.file.buffer.length <= 0) {
    return res.status(400).json({ success: false, message: "حجم الشريحة غير صالح" });
  }
  if (index !== meta.totalChunks - 1 && req.file.buffer.length !== expectedSize) {
    return res.status(400).json({ success: false, message: "حجم الشريحة لا يطابق المتوقع" });
  }

  const dir = getUploadTempDir(userId, uploadId);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const chunkPath = path.join(dir, `chunk-${index}.part`);
  fs.writeFileSync(chunkPath, req.file.buffer);

  const uploadedChunks = listUploadedChunkIndexes(userId, uploadId);
  return res.json({ success: true, data: { uploadId, uploadedChunks } });
});

// ── Complete resumable upload and merge chunks ──
router.post("/media/chunk/:uploadId/complete", (req, res) => {
  const userId = String((req.session as any)?.userId || "");
  const uploadId = String(req.params.uploadId || "").trim();
  if (!uploadId) {
    return res.status(400).json({ success: false, message: "معرف جلسة الرفع غير صالح" });
  }

  const meta = loadResumableMeta(userId, uploadId);
  if (!meta) {
    return res.status(404).json({ success: false, message: "جلسة الرفع غير موجودة أو منتهية" });
  }

  const uploadedChunks = listUploadedChunkIndexes(userId, uploadId);
  if (uploadedChunks.length !== meta.totalChunks) {
    return res.status(409).json({
      success: false,
      message: "لم يتم رفع جميع الشرائح بعد",
      data: { uploadedChunks, totalChunks: meta.totalChunks },
    });
  }

  const ext = path.extname(meta.filename) || ".bin";
  const finalName = `${randomUUID()}${ext}`;
  const finalPath = path.join(MEDIA_DIR, finalName);

  try {
    const outFd = fs.openSync(finalPath, "w");
    for (let i = 0; i < meta.totalChunks; i++) {
      const chunkPath = path.join(getUploadTempDir(userId, uploadId), `chunk-${i}.part`);
      const buf = fs.readFileSync(chunkPath);
      fs.writeSync(outFd, buf);
    }
    fs.closeSync(outFd);

    const stat = fs.statSync(finalPath);
    if (stat.size !== meta.totalSize) {
      fs.unlinkSync(finalPath);
      return res.status(400).json({ success: false, message: "فشل تجميع الملف بشكل صحيح" });
    }

    if (!validateMagicBytes(finalPath, meta.mimetype)) {
      fs.unlinkSync(finalPath);
      return res.status(400).json({ success: false, message: "محتوى الملف لا يطابق نوعه — رفض أمني" });
    }

    const isVoice = VOICE_MIMES.includes(meta.mimetype);
    const isVideo = VIDEO_MIMES.includes(meta.mimetype);
    const mediaType = isVoice ? "voice" : (isVideo ? "video" : "image");
    const url = `/uploads/media/${finalName}`;

    cleanupUploadTempDir(userId, uploadId);
    uploadLog.info(`Resumable media completed: ${finalName} (${mediaType}, ${(stat.size / 1024).toFixed(1)}KB) by user ${userId}`);

    return res.json({
      success: true,
      data: {
        url,
        filename: finalName,
        size: stat.size,
        type: mediaType,
        mimetype: meta.mimetype,
      },
    });
  } catch (err: any) {
    if (fs.existsSync(finalPath)) {
      try { fs.unlinkSync(finalPath); } catch { }
    }
    uploadLog.error({ err, userId, uploadId }, "Resumable media merge failed");
    return res.status(500).json({ success: false, message: "فشل إنهاء رفع الملف" });
  }
});

// ── Abort resumable upload and cleanup temp chunks ──
router.delete("/media/chunk/:uploadId", (req, res) => {
  const userId = String((req.session as any)?.userId || "");
  const uploadId = String(req.params.uploadId || "").trim();
  if (!uploadId) {
    return res.status(400).json({ success: false, message: "معرف جلسة الرفع غير صالح" });
  }

  cleanupUploadTempDir(userId, uploadId);
  uploadLog.info(`Resumable media aborted: ${uploadId} by user ${userId}`);
  return res.json({ success: true });
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
