/**
 * Shared country data — بيانات الدول المشتركة
 * ═══════════════════════════════════════════
 * Single source of truth for country codes, names (ar/en), and flags.
 * Used by Profile, CountrySelector, and other components.
 */

export interface Country {
  code: string;
  flag: string;
  nameAr: string;
  nameEn: string;
}

export const COUNTRIES: Country[] = [
  // ── الخليج (Gulf) ──
  { code: "SA", flag: "🇸🇦", nameAr: "السعودية", nameEn: "Saudi Arabia" },
  { code: "AE", flag: "🇦🇪", nameAr: "الإمارات", nameEn: "UAE" },
  { code: "KW", flag: "🇰🇼", nameAr: "الكويت", nameEn: "Kuwait" },
  { code: "QA", flag: "🇶🇦", nameAr: "قطر", nameEn: "Qatar" },
  { code: "BH", flag: "🇧🇭", nameAr: "البحرين", nameEn: "Bahrain" },
  { code: "OM", flag: "🇴🇲", nameAr: "عُمان", nameEn: "Oman" },
  // ── الشرق الأوسط (Middle East) ──
  { code: "EG", flag: "🇪🇬", nameAr: "مصر", nameEn: "Egypt" },
  { code: "IQ", flag: "🇮🇶", nameAr: "العراق", nameEn: "Iraq" },
  { code: "JO", flag: "🇯🇴", nameAr: "الأردن", nameEn: "Jordan" },
  { code: "LB", flag: "🇱🇧", nameAr: "لبنان", nameEn: "Lebanon" },
  { code: "SY", flag: "🇸🇾", nameAr: "سوريا", nameEn: "Syria" },
  { code: "PS", flag: "🇵🇸", nameAr: "فلسطين", nameEn: "Palestine" },
  { code: "YE", flag: "🇾🇪", nameAr: "اليمن", nameEn: "Yemen" },
  // ── شمال أفريقيا (North Africa) ──
  { code: "LY", flag: "🇱🇾", nameAr: "ليبيا", nameEn: "Libya" },
  { code: "TN", flag: "🇹🇳", nameAr: "تونس", nameEn: "Tunisia" },
  { code: "DZ", flag: "🇩🇿", nameAr: "الجزائر", nameEn: "Algeria" },
  { code: "MA", flag: "🇲🇦", nameAr: "المغرب", nameEn: "Morocco" },
  { code: "SD", flag: "🇸🇩", nameAr: "السودان", nameEn: "Sudan" },
  // ── أوروبا + أمريكا (Europe & Americas) ──
  { code: "TR", flag: "🇹🇷", nameAr: "تركيا", nameEn: "Turkey" },
  { code: "US", flag: "🇺🇸", nameAr: "أمريكا", nameEn: "United States" },
  { code: "GB", flag: "🇬🇧", nameAr: "بريطانيا", nameEn: "United Kingdom" },
  { code: "DE", flag: "🇩🇪", nameAr: "ألمانيا", nameEn: "Germany" },
  { code: "FR", flag: "🇫🇷", nameAr: "فرنسا", nameEn: "France" },
  { code: "ES", flag: "🇪🇸", nameAr: "إسبانيا", nameEn: "Spain" },
  { code: "IT", flag: "🇮🇹", nameAr: "إيطاليا", nameEn: "Italy" },
  { code: "NL", flag: "🇳🇱", nameAr: "هولندا", nameEn: "Netherlands" },
  { code: "SE", flag: "🇸🇪", nameAr: "السويد", nameEn: "Sweden" },
  { code: "CA", flag: "🇨🇦", nameAr: "كندا", nameEn: "Canada" },
  { code: "AU", flag: "🇦🇺", nameAr: "أستراليا", nameEn: "Australia" },
  { code: "BR", flag: "🇧🇷", nameAr: "البرازيل", nameEn: "Brazil" },
  { code: "MX", flag: "🇲🇽", nameAr: "المكسيك", nameEn: "Mexico" },
  { code: "AR", flag: "🇦🇷", nameAr: "الأرجنتين", nameEn: "Argentina" },
  { code: "CL", flag: "🇨🇱", nameAr: "تشيلي", nameEn: "Chile" },
  { code: "CO", flag: "🇨🇴", nameAr: "كولومبيا", nameEn: "Colombia" },
  // ── آسيا (Asia) ──
  { code: "IN", flag: "🇮🇳", nameAr: "الهند", nameEn: "India" },
  { code: "PK", flag: "🇵🇰", nameAr: "باكستان", nameEn: "Pakistan" },
  { code: "MY", flag: "🇲🇾", nameAr: "ماليزيا", nameEn: "Malaysia" },
  { code: "ID", flag: "🇮🇩", nameAr: "إندونيسيا", nameEn: "Indonesia" },
  { code: "JP", flag: "🇯🇵", nameAr: "اليابان", nameEn: "Japan" },
  { code: "KR", flag: "🇰🇷", nameAr: "كوريا الجنوبية", nameEn: "South Korea" },
  { code: "CN", flag: "🇨🇳", nameAr: "الصين", nameEn: "China" },
  { code: "PH", flag: "🇵🇭", nameAr: "الفلبين", nameEn: "Philippines" },
  { code: "TH", flag: "🇹🇭", nameAr: "تايلاند", nameEn: "Thailand" },
  // ── أفريقيا (Africa) ──
  { code: "RU", flag: "🇷🇺", nameAr: "روسيا", nameEn: "Russia" },
  { code: "ZA", flag: "🇿🇦", nameAr: "جنوب أفريقيا", nameEn: "South Africa" },
  { code: "NG", flag: "🇳🇬", nameAr: "نيجيريا", nameEn: "Nigeria" },
];

/** Get country display name by code */
export function getCountryName(code: string, lang: string = "ar"): string {
  const c = COUNTRIES.find(c => c.code === code);
  if (!c) return code;
  return lang === "ar" ? c.nameAr : c.nameEn;
}

/** Get country flag emoji by code */
export function getCountryFlag(code: string): string {
  return COUNTRIES.find(c => c.code === code)?.flag ?? "🌍";
}
