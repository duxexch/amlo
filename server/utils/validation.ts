/**
 * Shared Validation Utilities — أدوات التحقق المشتركة
 * ═══════════════════════════════════════════════════════
 * UUID validation, LIKE escaping, and other shared helpers.
 */

/** UUID v4 regex pattern */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Validate a string is a valid UUID v4 */
export function isValidUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_RE.test(s);
}

/**
 * Escape special LIKE/ILIKE metacharacters (%, _, \) in user input.
 * Prevents wildcard injection in SQL LIKE queries.
 * 
 * Usage: `WHERE col ILIKE '%' || ${escapeLike(userInput)} || '%'`
 */
export function escapeLike(input: string): string {
  return input.replace(/[%_\\]/g, ch => "\\" + ch);
}

/**
 * Validate and return a UUID param, or send a 400 response.
 * Returns the UUID string if valid, null if invalid (response already sent).
 */
export function validateUuidParam(paramValue: string | string[] | undefined, res: any, paramName = "id"): string | null {
  const val = Array.isArray(paramValue) ? paramValue[0] : paramValue || "";
  if (!isValidUuid(val)) {
    res.status(400).json({ success: false, message: `${paramName} غير صالح` });
    return null;
  }
  return val;
}
