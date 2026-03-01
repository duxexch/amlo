/**
 * Message Encryption Utility — تشفير الرسائل
 * ════════════════════════════════════════════
 * AES-256-GCM server-side encryption at rest.
 * Each conversation gets a derived key from the master secret + conversationId.
 * Protects message content stored in the database.
 *
 * Production requirements:
 *  - ENCRYPTION_SECRET env var MUST be set (64+ hex chars recommended)
 *  - Derived keys are cached in-memory (LRU) to avoid blocking scryptSync per call
 */
import { createCipheriv, createDecipheriv, randomBytes, scryptSync, createHash } from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;

// ── Master secret — MUST be set in production ──
function getMasterSecret(): string {
  const secret = process.env.ENCRYPTION_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      throw new Error("ENCRYPTION_SECRET env var is required in production");
    }
    // Dev-only fallback with a loud warning
    console.warn("⚠️  WARNING: Using dev-only ENCRYPTION_SECRET — set ENCRYPTION_SECRET in .env for production");
    return "dev-only-encryption-key-NOT-FOR-PRODUCTION-USE";
  }
  return secret;
}

// ── LRU key cache — avoids blocking scryptSync on every encrypt/decrypt ──
const KEY_CACHE_MAX = 500;
const keyCache = new Map<string, Buffer>();

function deriveKey(conversationId: string): Buffer {
  const cached = keyCache.get(conversationId);
  if (cached) return cached;

  const masterSecret = getMasterSecret();
  const salt = createHash("sha256").update(conversationId).digest();
  const key = scryptSync(masterSecret, salt, 32);

  // LRU eviction: remove oldest entry when cache is full
  if (keyCache.size >= KEY_CACHE_MAX) {
    const oldest = keyCache.keys().next().value;
    if (oldest !== undefined) keyCache.delete(oldest);
  }
  keyCache.set(conversationId, key);
  return key;
}

/**
 * Clear the derived-key cache (useful when rotating secrets).
 */
export function clearKeyCache(): void {
  keyCache.clear();
}

/**
 * Encrypt a plaintext message for storage.
 * Returns base64-encoded string: iv:authTag:ciphertext
 */
export function encryptMessage(plaintext: string, conversationId: string): string {
  if (!plaintext) return plaintext;

  const key = deriveKey(conversationId);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  let encrypted = cipher.update(plaintext, "utf8", "base64");
  encrypted += cipher.final("base64");
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted}`;
}

/**
 * Decrypt a stored ciphertext message.
 * Expects format: iv:authTag:ciphertext (all base64)
 */
export function decryptMessage(ciphertext: string, conversationId: string): string {
  if (!ciphertext) return ciphertext;

  // Non-encrypted content (backward compatibility)
  if (!ciphertext.includes(":")) return ciphertext;

  try {
    const parts = ciphertext.split(":");
    if (parts.length !== 3) return ciphertext;

    const [ivB64, authTagB64, encryptedB64] = parts;
    const key = deriveKey(conversationId);
    const iv = Buffer.from(ivB64, "base64");
    const authTag = Buffer.from(authTagB64, "base64");

    const decipher = createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encryptedB64, "base64", "utf8");
    decrypted += decipher.final("utf8");

    return decrypted;
  } catch {
    // Return safe placeholder — never leak ciphertext to client
    return "[رسالة مشفرة]";
  }
}

/**
 * Decrypt an array of messages (returns new array, does not mutate originals).
 */
export function decryptMessages(messages: Array<{ content?: string | null; [key: string]: unknown }>, conversationId: string): Array<{ content?: string | null; isEncrypted: boolean; [key: string]: unknown }> {
  return messages.map(msg => ({
    ...msg,
    content: msg.content ? decryptMessage(msg.content, conversationId) : msg.content,
    isEncrypted: true,
  }));
}
