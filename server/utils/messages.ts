/**
 * Server Error Messages — رسائل الأخطاء الموحدة
 * ═══════════════════════════════════════════════
 * Centralized error/success messages to avoid hardcoded strings
 * and ensure consistency across all routes.
 */

export const ERR = {
  // ── Auth ──
  UNAUTHORIZED: "يرجى تسجيل الدخول",
  FORBIDDEN: "غير مصرح",
  INVALID_CREDENTIALS: "بيانات تسجيل الدخول غير صحيحة",

  // ── Validation ──
  INVALID_DATA: "بيانات غير صالحة",
  INVALID_ID: (name = "id") => `${name} غير صالح`,
  MISSING_FIELD: (field: string) => `الحقل ${field} مطلوب`,

  // ── Resources ──
  NOT_FOUND: (resource: string) => `${resource} غير موجود`,
  ALREADY_EXISTS: (resource: string) => `${resource} موجود بالفعل`,

  // ── Financial ──
  INSUFFICIENT_COINS: "رصيدك غير كافٍ",
  RATE_LIMITED: "طلبات كثيرة جداً، حاول لاحقاً",
  FEATURE_DISABLED: (feature: string) => `${feature} معطلة حالياً`,

  // ── Social ──
  CANNOT_SELF_ACTION: (action: string) => `لا يمكنك ${action} نفسك`,
  USER_BLOCKED: "لا يمكنك التواصل مع هذا المستخدم",
  EMPTY_MESSAGE: "الرسالة فارغة",

  // ── Generic ──
  SERVER_ERROR: "خطأ في الخادم",
  DB_UNAVAILABLE: "DB unavailable",
} as const;

export const MSG = {
  SUCCESS: "تمت العملية بنجاح",
  DELETED: (resource: string) => `تم حذف ${resource}`,
  UPDATED: (resource: string) => `تم تحديث ${resource}`,
  CREATED: (resource: string) => `تم إنشاء ${resource}`,
} as const;
