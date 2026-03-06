/**
 * Shared time formatting utilities — أدوات تنسيق الوقت
 * ════════════════════════════════════════
 * Single source of truth for time display across chat UI.
 */

/** Format a date relative to now: "now" / "5m" / "10:30" / "Mon" / "Jan 15" */
export function formatTime(date: Date, lang?: string): string {
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const effectiveLang = lang || document.documentElement.lang || navigator.language || "ar";
  const isAr = effectiveLang.startsWith("ar");

  if (diff < 60000) return isAr ? "الآن" : "now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}${isAr ? "د" : "m"}`;
  if (diff < 86400000) return date.toLocaleTimeString(effectiveLang, { hour: "2-digit", minute: "2-digit" });
  if (diff < 604800000) return date.toLocaleDateString(effectiveLang, { weekday: "short" });
  return date.toLocaleDateString(effectiveLang, { month: "short", day: "numeric" });
}
