/**
 * User Data Sanitization — تنقية بيانات المستخدم
 * ═══════════════════════════════════════════════════
 * Centralized utility to strip sensitive fields from user objects
 * before sending them in API responses.
 *
 * Use this everywhere user data is returned to clients.
 */

/** Fields that must NEVER be sent to the client */
const SENSITIVE_FIELDS = new Set([
  "passwordHash",
  "pinHash",
  "resetToken",
  "resetTokenExpiry",
  "verificationToken",
  "twoFactorSecret",
  "encryptionKey",
]);

/**
 * Strip all sensitive fields from a user/agent object.
 * Returns a new object — does not mutate the original.
 */
export function sanitizeUser<T extends Record<string, any>>(obj: T): Omit<T, "passwordHash" | "pinHash" | "resetToken" | "resetTokenExpiry" | "verificationToken" | "twoFactorSecret" | "encryptionKey"> {
  const result: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (!SENSITIVE_FIELDS.has(key)) {
      result[key] = value;
    }
  }
  return result as any;
}

/**
 * Strip sensitive fields from an array of user objects.
 */
export function sanitizeUsers<T extends Record<string, any>>(users: T[]): Array<Omit<T, "passwordHash" | "pinHash" | "resetToken" | "resetTokenExpiry" | "verificationToken" | "twoFactorSecret" | "encryptionKey">> {
  return users.map(sanitizeUser);
}
