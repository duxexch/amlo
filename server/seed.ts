/**
 * Database Seed Script — يُنشئ البيانات الأساسية في قاعدة البيانات
 * Run: npx tsx server/seed.ts
 */
import "dotenv/config";
import pg from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "../shared/schema";
import bcryptjs from "bcryptjs";

const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://aplo_admin:ApL0_S3cur3_2026!@localhost:5432/aplo";

async function seed() {
  console.log("🌱 Starting database seed...\n");

  const pool = new Pool({ connectionString: DATABASE_URL });
  const db = drizzle(pool, { schema });

  // ── 1. Seed Admin ──
  console.log("👤 Creating admin user...");
  const adminHash = bcryptjs.hashSync(process.env.ADMIN_PASSWORD || "admin123", 12);
  await db.insert(schema.admins).values({
    username: "admin",
    email: "admin@aplo.app",
    passwordHash: adminHash,
    displayName: "مدير النظام",
    role: "super_admin",
    isActive: true,
  }).onConflictDoNothing({ target: schema.admins.username });

  // ── 2. Seed Gifts (48 هدية) ──
  console.log("🎁 Creating gifts catalog...");
  const giftCategories = [
    // General (12)
    { name: "Rose", nameAr: "وردة", icon: "🌹", price: 10, category: "general", sortOrder: 1 },
    { name: "Heart", nameAr: "قلب", icon: "❤️", price: 20, category: "general", sortOrder: 2 },
    { name: "Star", nameAr: "نجمة", icon: "⭐", price: 30, category: "general", sortOrder: 3 },
    { name: "Fire", nameAr: "نار", icon: "🔥", price: 50, category: "general", sortOrder: 4 },
    { name: "Thumbs Up", nameAr: "إعجاب", icon: "👍", price: 5, category: "general", sortOrder: 5 },
    { name: "Clap", nameAr: "تصفيق", icon: "👏", price: 15, category: "general", sortOrder: 6 },
    { name: "Rainbow", nameAr: "قوس قزح", icon: "🌈", price: 40, category: "general", sortOrder: 7 },
    { name: "Kiss", nameAr: "قبلة", icon: "💋", price: 25, category: "general", sortOrder: 8 },
    { name: "Balloon", nameAr: "بالون", icon: "🎈", price: 35, category: "general", sortOrder: 9 },
    { name: "Confetti", nameAr: "قصاصات", icon: "🎊", price: 45, category: "general", sortOrder: 10 },
    { name: "Music", nameAr: "موسيقى", icon: "🎵", price: 20, category: "general", sortOrder: 11 },
    { name: "Coffee", nameAr: "قهوة", icon: "☕", price: 10, category: "general", sortOrder: 12 },
    // Premium (12)
    { name: "Diamond", nameAr: "ماسة", icon: "💎", price: 500, category: "premium", sortOrder: 13 },
    { name: "Crown", nameAr: "تاج", icon: "👑", price: 1000, category: "premium", sortOrder: 14 },
    { name: "Rocket", nameAr: "صاروخ", icon: "🚀", price: 800, category: "premium", sortOrder: 15 },
    { name: "Luxury Car", nameAr: "سيارة فاخرة", icon: "🏎️", price: 5000, category: "premium", sortOrder: 16 },
    { name: "Yacht", nameAr: "يخت", icon: "🛥️", price: 10000, category: "premium", sortOrder: 17 },
    { name: "Jet", nameAr: "طائرة", icon: "✈️", price: 20000, category: "premium", sortOrder: 18 },
    { name: "Castle", nameAr: "قلعة", icon: "🏰", price: 50000, category: "premium", sortOrder: 19 },
    { name: "Galaxy", nameAr: "مجرة", icon: "🌌", price: 100000, category: "premium", sortOrder: 20 },
    { name: "Planet", nameAr: "كوكب", icon: "🪐", price: 30000, category: "premium", sortOrder: 21 },
    { name: "Treasure", nameAr: "كنز", icon: "💰", price: 15000, category: "premium", sortOrder: 22 },
    { name: "Gem", nameAr: "جوهرة", icon: "💠", price: 2000, category: "premium", sortOrder: 23 },
    { name: "Gold", nameAr: "ذهب", icon: "🥇", price: 3000, category: "premium", sortOrder: 24 },
    // Special (12)
    { name: "Phoenix", nameAr: "طائر النار", icon: "🦅", price: 7500, category: "special", sortOrder: 25 },
    { name: "Dragon", nameAr: "تنين", icon: "🐉", price: 25000, category: "special", sortOrder: 26 },
    { name: "Unicorn", nameAr: "يونيكورن", icon: "🦄", price: 15000, category: "special", sortOrder: 27 },
    { name: "Fireworks", nameAr: "ألعاب نارية", icon: "🎆", price: 5000, category: "special", sortOrder: 28 },
    { name: "Lion", nameAr: "أسد", icon: "🦁", price: 8000, category: "special", sortOrder: 29 },
    { name: "Teddy Bear", nameAr: "دبدوب", icon: "🧸", price: 3000, category: "special", sortOrder: 30 },
    { name: "Crystal Ball", nameAr: "كرة بلورية", icon: "🔮", price: 6000, category: "special", sortOrder: 31 },
    { name: "Angel", nameAr: "ملاك", icon: "👼", price: 12000, category: "special", sortOrder: 32 },
    { name: "Sun", nameAr: "شمس", icon: "☀️", price: 9000, category: "special", sortOrder: 33 },
    { name: "Moon", nameAr: "قمر", icon: "🌙", price: 4000, category: "special", sortOrder: 34 },
    { name: "Lightning", nameAr: "برق", icon: "⚡", price: 7000, category: "special", sortOrder: 35 },
    { name: "Snowflake", nameAr: "ندفة ثلج", icon: "❄️", price: 2500, category: "special", sortOrder: 36 },
    // Event (12)
    { name: "Eid Gift", nameAr: "هدية العيد", icon: "🎁", price: 5000, category: "event", sortOrder: 37 },
    { name: "Ramadan Moon", nameAr: "هلال رمضان", icon: "🌙", price: 3000, category: "event", sortOrder: 38 },
    { name: "National Day", nameAr: "اليوم الوطني", icon: "🇸🇦", price: 4000, category: "event", sortOrder: 39 },
    { name: "New Year", nameAr: "رأس السنة", icon: "🎆", price: 6000, category: "event", sortOrder: 40 },
    { name: "Valentine", nameAr: "عيد الحب", icon: "💝", price: 8000, category: "event", sortOrder: 41 },
    { name: "Birthday Cake", nameAr: "كيكة عيد ميلاد", icon: "🎂", price: 2000, category: "event", sortOrder: 42 },
    { name: "Party", nameAr: "حفلة", icon: "🥳", price: 1500, category: "event", sortOrder: 43 },
    { name: "Trophy", nameAr: "كأس", icon: "🏆", price: 10000, category: "event", sortOrder: 44 },
    { name: "Medal", nameAr: "ميدالية", icon: "🏅", price: 4000, category: "event", sortOrder: 45 },
    { name: "Pumpkin", nameAr: "يقطينة", icon: "🎃", price: 1000, category: "event", sortOrder: 46 },
    { name: "Snowman", nameAr: "رجل ثلج", icon: "⛄", price: 2000, category: "event", sortOrder: 47 },
    { name: "Sparkles", nameAr: "بريق", icon: "✨", price: 500, category: "event", sortOrder: 48 },
  ];

  for (const gift of giftCategories) {
    await db.insert(schema.gifts).values(gift).onConflictDoNothing();
  }

  // ── 3. Seed Coin Packages ──
  console.log("💰 Creating coin packages...");
  const packages = [
    { coins: 100, bonusCoins: 0, priceUsd: "0.99", isPopular: false, sortOrder: 1 },
    { coins: 500, bonusCoins: 50, priceUsd: "4.99", isPopular: false, sortOrder: 2 },
    { coins: 1000, bonusCoins: 150, priceUsd: "9.99", isPopular: true, sortOrder: 3 },
    { coins: 2500, bonusCoins: 500, priceUsd: "19.99", isPopular: false, sortOrder: 4 },
    { coins: 5000, bonusCoins: 1500, priceUsd: "39.99", isPopular: true, sortOrder: 5 },
    { coins: 10000, bonusCoins: 4000, priceUsd: "69.99", isPopular: false, sortOrder: 6 },
    { coins: 25000, bonusCoins: 12000, priceUsd: "149.99", isPopular: false, sortOrder: 7 },
    { coins: 50000, bonusCoins: 30000, priceUsd: "249.99", isPopular: false, sortOrder: 8 },
  ];

  for (const pkg of packages) {
    await db.insert(schema.coinPackages).values(pkg).onConflictDoNothing();
  }

  // ── 4. Seed System Settings ──
  console.log("⚙️ Creating system settings...");
  const settings = [
    { key: "app_name", value: "Aplo", category: "general", description: "اسم التطبيق" },
    { key: "app_name_ar", value: "أبلو", category: "general", description: "اسم التطبيق بالعربي" },
    { key: "min_withdrawal", value: "50", category: "payments", description: "الحد الأدنى للسحب (بالدولار)" },
    { key: "platform_fee", value: "15", category: "payments", description: "عمولة المنصة %" },
    { key: "agent_default_commission", value: "10", category: "payments", description: "عمولة الوكيل الافتراضية %" },
    { key: "max_stream_duration", value: "480", category: "moderation", description: "أقصى مدة بث (دقائق)" },
    { key: "announcement_popup_enabled", value: "true", category: "notifications", description: "تفعيل الإشعار المنبثق" },
    { key: "announcement_popup_delay", value: "8", category: "notifications", description: "تأخير الإشعار (ثواني)" },
    { key: "featured_streams_enabled", value: "true", category: "general", description: "تفعيل البثوث المميزة" },
  ];

  for (const s of settings) {
    await db.insert(schema.systemSettings).values(s).onConflictDoNothing();
  }

  // ── 5. Seed Demo Users (for testing) ──
  console.log("👥 Creating demo users...");
  const userHash = bcryptjs.hashSync("user123", 12);
  const demoUsers = [
    { username: "sara_ahmed", email: "sara@demo.com", passwordHash: userHash, displayName: "سارة أحمد", coins: 5000, diamonds: 200, level: 15, xp: 4500, gender: "female", country: "SA", isVerified: true, referralCode: "SARA001" },
    { username: "ahmed_ali", email: "ahmed@demo.com", passwordHash: userHash, displayName: "أحمد علي", coins: 12000, diamonds: 500, level: 32, xp: 18000, gender: "male", country: "EG", isVerified: true, referralCode: "AHMED001" },
    { username: "layla_star", email: "layla@demo.com", passwordHash: userHash, displayName: "ليلى النجم", coins: 3200, diamonds: 100, level: 8, xp: 2100, gender: "female", country: "AE", isVerified: false, referralCode: "LAYLA001" },
    { username: "tariq_pro", email: "tariq@demo.com", passwordHash: userHash, displayName: "طارق المحترف", coins: 25000, diamonds: 1200, level: 45, xp: 35000, gender: "male", country: "SA", isVerified: true, referralCode: "TARIQ001" },
    { username: "nader_live", email: "nader@demo.com", passwordHash: userHash, displayName: "نادر لايف", coins: 800, diamonds: 30, level: 5, xp: 980, gender: "male", country: "JO", isVerified: false, referralCode: "NADER001" },
    { username: "yasmine_vip", email: "yasmine@demo.com", passwordHash: userHash, displayName: "ياسمين VIP", coins: 50000, diamonds: 3000, level: 60, xp: 75000, gender: "female", country: "KW", isVerified: true, referralCode: "YASM001" },
    { username: "mohali_gamer", email: "mohali@demo.com", passwordHash: userHash, displayName: "محمد علي جيمر", coins: 1500, diamonds: 50, level: 3, xp: 450, gender: "male", country: "IQ", isVerified: false, referralCode: "MOHA001" },
    { username: "reem_singer", email: "reem@demo.com", passwordHash: userHash, displayName: "ريم المغنية", coins: 18000, diamonds: 800, level: 28, xp: 14000, gender: "female", country: "LB", isVerified: true, referralCode: "REEM001" },
  ];

  for (const user of demoUsers) {
    await db.insert(schema.users).values(user).onConflictDoNothing({ target: schema.users.username });
  }

  // ── 6. Seed Demo Agent ──
  console.log("🤝 Creating demo agent...");
  const agentHash = bcryptjs.hashSync("agent123", 12);
  await db.insert(schema.agents).values({
    name: "شركة الأفق للتسويق",
    email: "agent@aplo.app",
    phone: "+966501234567",
    passwordHash: agentHash,
    referralCode: "AGENT-AFQ-001",
    commissionRate: "12.50",
    totalUsers: 45,
    totalRevenue: "15000.00",
    balance: "4500.00",
    status: "active",
  }).onConflictDoNothing({ target: schema.agents.email });

  // ── 5. Seed World Pricing ──
  console.log("🌍 Creating world pricing defaults...");
  const worldPricingDefaults = [
    { filterType: "spin_cost", priceCoins: 10, label: "Base Search Cost", labelAr: "تكلفة البحث الأساسية" },
    { filterType: "gender_both", priceCoins: 0, label: "Both Genders", labelAr: "الجنسين" },
    { filterType: "gender_male", priceCoins: 5, label: "Male Only", labelAr: "ذكر فقط" },
    { filterType: "gender_female", priceCoins: 5, label: "Female Only", labelAr: "أنثى فقط" },
    { filterType: "age_range", priceCoins: 10, label: "Age Range Filter", labelAr: "فلتر الفئة العمرية" },
    { filterType: "country_specific", priceCoins: 15, label: "Specific Country", labelAr: "دولة محددة" },
    { filterType: "country_all", priceCoins: 0, label: "All Countries", labelAr: "جميع الدول" },
  ];
  for (const wp of worldPricingDefaults) {
    await db.insert(schema.worldPricing).values(wp).onConflictDoNothing();
  }

  // ── 7. Seed Chat Settings ──
  console.log("💬 Creating default chat settings...");
  const chatDefaults = [
    { key: "chat_media_enabled", value: "true" },
    { key: "chat_voice_call_enabled", value: "true" },
    { key: "chat_video_call_enabled", value: "true" },
    { key: "chat_message_cost", value: "0" },
    { key: "chat_call_cost", value: "0" },
    { key: "chat_time_limit", value: "0" },
  ];
  for (const s of chatDefaults) {
    await db.insert(schema.systemSettings).values(s).onConflictDoNothing({ target: schema.systemSettings.key });
  }

  console.log("\n✅ Seed completed successfully!");
  console.log("   Admin: admin / admin123");
  console.log("   Agent: agent@aplo.app / agent123");
  console.log("   Users: sara_ahmed, ahmed_ali, etc. / user123");

  await pool.end();
  process.exit(0);
}

seed().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
