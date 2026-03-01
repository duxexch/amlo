// ════════════════════════════════════════════════════════════
// ⭐ نظام الترقية — 55 مستوى عبر 11 فئة
// ════════════════════════════════════════════════════════════

export interface TierInfo {
  id: number;          // 0-10
  name: string;        // English tier name
  nameAr: string;      // Arabic tier name
  badge: string;       // Emoji badge
  color: string;       // Primary hex color
  gradient: string;    // CSS gradient for frame
}

export interface LevelPerks {
  discount: number;       // % discount on coin purchases
  dailyCoins: number;     // free coins per day
  giftMultiplier: number; // 1.0 = no bonus, 1.5 = +50%
  maxFriends: number;     // max friends limit
  callBonusMinutes: number; // extra free call minutes
}

export interface LevelFeature {
  key: string;
  nameAr: string;
  nameEn: string;
  icon: string;
}

export interface LevelConfig {
  level: number;
  tier: TierInfo;
  xpRequired: number;
  perks: LevelPerks;
  newFeatures: LevelFeature[]; // features unlocked AT this level
}

// ── 11 Tier Definitions ──
export const TIERS: TierInfo[] = [
  { id: 0,  name: "Bronze",       nameAr: "برونزي",      badge: "🥉", color: "#cd7f32", gradient: "linear-gradient(135deg, #cd7f32, #a0522d)" },
  { id: 1,  name: "Silver",       nameAr: "فضي",         badge: "🥈", color: "#c0c0c0", gradient: "linear-gradient(135deg, #c0c0c0, #808080)" },
  { id: 2,  name: "Gold",         nameAr: "ذهبي",        badge: "🥇", color: "#ffd700", gradient: "linear-gradient(135deg, #ffd700, #daa520)" },
  { id: 3,  name: "Platinum",     nameAr: "بلاتيني",     badge: "💎", color: "#e5e4e2", gradient: "linear-gradient(135deg, #e5e4e2, #b8b8b8)" },
  { id: 4,  name: "Diamond",      nameAr: "ماسي",        badge: "💠", color: "#00bfff", gradient: "linear-gradient(135deg, #00bfff, #1e90ff)" },
  { id: 5,  name: "Crown",        nameAr: "التاج",       badge: "👑", color: "#9b59b6", gradient: "linear-gradient(135deg, #9b59b6, #8e44ad)" },
  { id: 6,  name: "Legend",       nameAr: "أسطوري",      badge: "🔥", color: "#ff4500", gradient: "linear-gradient(135deg, #ff4500, #ff6347)" },
  { id: 7,  name: "Master",       nameAr: "خبير",        badge: "⚡", color: "#6a0dad", gradient: "linear-gradient(135deg, #6a0dad, #4b0082)" },
  { id: 8,  name: "Grand Master", nameAr: "القائد",      badge: "🌟", color: "#ff1493", gradient: "linear-gradient(135deg, #ff1493, #ff69b4, #ffd700)" },
  { id: 9,  name: "Elite",        nameAr: "النخبة",      badge: "🏆", color: "#1a1a2e", gradient: "linear-gradient(135deg, #1a1a2e, #ffd700, #1a1a2e)" },
  { id: 10, name: "Supreme",      nameAr: "الأعلى",      badge: "✨", color: "#ff0080", gradient: "linear-gradient(135deg, #ff0080, #7928ca, #00d4ff, #ffd700)" },
];

// ── XP Requirements per level ──
const XP_TABLE: number[] = [
  // Tier 0 — Bronze (1-5)
  0, 100, 300, 600, 1_000,
  // Tier 1 — Silver (6-10)
  1_500, 2_200, 3_000, 4_000, 5_000,
  // Tier 2 — Gold (11-15)
  6_500, 8_000, 10_000, 12_500, 15_000,
  // Tier 3 — Platinum (16-20)
  18_000, 21_000, 25_000, 30_000, 35_000,
  // Tier 4 — Diamond (21-25)
  40_000, 47_000, 55_000, 65_000, 75_000,
  // Tier 5 — Crown (26-30)
  87_000, 100_000, 115_000, 130_000, 150_000,
  // Tier 6 — Legend (31-35)
  175_000, 200_000, 230_000, 265_000, 300_000,
  // Tier 7 — Master (36-40)
  340_000, 385_000, 435_000, 490_000, 550_000,
  // Tier 8 — Grand Master (41-45)
  620_000, 700_000, 790_000, 890_000, 1_000_000,
  // Tier 9 — Elite (46-50)
  1_120_000, 1_260_000, 1_420_000, 1_600_000, 1_800_000,
  // Tier 10 — Supreme (51-55)
  2_050_000, 2_350_000, 2_700_000, 3_100_000, 3_500_000,
];

// ── All unlockable features ──
const FEATURES = {
  bronzeFrame:        { key: "bronzeFrame",        nameAr: "إطار برونزي",           nameEn: "Bronze Frame",            icon: "🖼️" },
  basicChatBubble:    { key: "basicChatBubble",    nameAr: "فقاعة دردشة أساسية",    nameEn: "Basic Chat Bubble",       icon: "💬" },
  bronzeBadge:        { key: "bronzeBadge",        nameAr: "شارة برونزية",           nameEn: "Bronze Badge",            icon: "🥉" },
  silverFrame:        { key: "silverFrame",        nameAr: "إطار فضي",              nameEn: "Silver Frame",            icon: "🖼️" },
  prioritySearch:     { key: "prioritySearch",     nameAr: "أولوية في البحث",        nameEn: "Priority Search",         icon: "🔍" },
  silverBadge:        { key: "silverBadge",        nameAr: "شارة فضية",              nameEn: "Silver Badge",            icon: "🥈" },
  usernameColor1:     { key: "usernameColor1",     nameAr: "لون اسم مخصص",           nameEn: "Custom Username Color",   icon: "🎨" },
  goldFrame:          { key: "goldFrame",          nameAr: "إطار ذهبي",              nameEn: "Gold Frame",              icon: "🖼️" },
  adFree:             { key: "adFree",             nameAr: "بدون إعلانات",           nameEn: "Ad-Free Experience",      icon: "🚫" },
  extendedCalls:      { key: "extendedCalls",      nameAr: "مكالمات ممتدة",          nameEn: "Extended Calls",          icon: "📞" },
  goldBadge:          { key: "goldBadge",          nameAr: "شارة ذهبية",             nameEn: "Gold Badge",              icon: "🥇" },
  profileBg1:         { key: "profileBg1",         nameAr: "خلفية ملف شخصي",         nameEn: "Profile Background",      icon: "🌄" },
  platinumFrame:      { key: "platinumFrame",      nameAr: "إطار بلاتيني",           nameEn: "Platinum Frame",          icon: "🖼️" },
  entryEffect:        { key: "entryEffect",        nameAr: "تأثير دخول الغرفة",      nameEn: "Room Entry Effect",       icon: "✨" },
  emojiPack1:         { key: "emojiPack1",         nameAr: "حزمة إيموجي حصرية ١",    nameEn: "Exclusive Emoji Pack 1",  icon: "😎" },
  platinumBadge:      { key: "platinumBadge",      nameAr: "شارة بلاتينية",          nameEn: "Platinum Badge",          icon: "💎" },
  priorityMatching:   { key: "priorityMatching",   nameAr: "أولوية في المطابقة",     nameEn: "Priority Matching",       icon: "🎯" },
  diamondFrame:       { key: "diamondFrame",       nameAr: "إطار ماسي",              nameEn: "Diamond Frame",           icon: "🖼️" },
  vipRooms:           { key: "vipRooms",           nameAr: "غرف VIP",                nameEn: "VIP Room Access",         icon: "🏠" },
  voiceEffects:       { key: "voiceEffects",       nameAr: "تأثيرات صوتية",          nameEn: "Voice Effects",           icon: "🎙️" },
  diamondBadge:       { key: "diamondBadge",       nameAr: "شارة ماسية",             nameEn: "Diamond Badge",           icon: "💠" },
  profileHighlight:   { key: "profileHighlight",   nameAr: "ملف شخصي مميز",          nameEn: "Profile Highlight",       icon: "⭐" },
  crownFrame:         { key: "crownFrame",         nameAr: "إطار التاج",             nameEn: "Crown Frame",             icon: "🖼️" },
  profileMusic:       { key: "profileMusic",       nameAr: "موسيقى الملف الشخصي",    nameEn: "Profile Music",           icon: "🎵" },
  crownBadge:         { key: "crownBadge",         nameAr: "شارة التاج",             nameEn: "Crown Badge",             icon: "👑" },
  emojiPack2:         { key: "emojiPack2",         nameAr: "حزمة إيموجي حصرية ٢",    nameEn: "Exclusive Emoji Pack 2",  icon: "🤩" },
  broadcastPriority:  { key: "broadcastPriority",  nameAr: "أولوية في البث",         nameEn: "Broadcast Priority",      icon: "📡" },
  legendFrame:        { key: "legendFrame",        nameAr: "إطار أسطوري",            nameEn: "Legend Frame",            icon: "🖼️" },
  customChatBubble:   { key: "customChatBubble",   nameAr: "فقاعة دردشة مخصصة",     nameEn: "Custom Chat Bubbles",     icon: "💬" },
  legendBadge:        { key: "legendBadge",        nameAr: "شارة أسطورية",           nameEn: "Legend Badge",            icon: "🔥" },
  extendedCallsPro:   { key: "extendedCallsPro",   nameAr: "مكالمات ممتدة برو",      nameEn: "Extended Calls Pro",      icon: "📞" },
  featuredDiscover:   { key: "featuredDiscover",   nameAr: "ظهور مميز في الاكتشاف",  nameEn: "Featured in Discover",    icon: "🌟" },
  masterFrame:        { key: "masterFrame",        nameAr: "إطار الخبير",            nameEn: "Master Frame",            icon: "🖼️" },
  animatedFrame:      { key: "animatedFrame",      nameAr: "إطار متحرك",             nameEn: "Animated Frame",          icon: "🎬" },
  masterBadge:        { key: "masterBadge",        nameAr: "شارة الخبير",            nameEn: "Master Badge",            icon: "⚡" },
  extraFriends:       { key: "extraFriends",       nameAr: "أصدقاء إضافيين +100",    nameEn: "Extra Friends +100",      icon: "👥" },
  vipBadge:           { key: "vipBadge",           nameAr: "شارة VIP",               nameEn: "VIP Badge",               icon: "💫" },
  grandMasterFrame:   { key: "grandMasterFrame",   nameAr: "إطار القائد",            nameEn: "Grand Master Frame",      icon: "🖼️" },
  customRoomTheme:    { key: "customRoomTheme",    nameAr: "ثيم غرفة مخصص",          nameEn: "Custom Room Theme",       icon: "🎨" },
  grandMasterBadge:   { key: "grandMasterBadge",   nameAr: "شارة القائد",            nameEn: "Grand Master Badge",      icon: "🌟" },
  emojiPack3:         { key: "emojiPack3",         nameAr: "حزمة إيموجي حصرية ٣",    nameEn: "Exclusive Emoji Pack 3",  icon: "🥳" },
  prioritySupport:    { key: "prioritySupport",    nameAr: "دعم أولوية",             nameEn: "Priority Support",        icon: "🛡️" },
  eliteFrame:         { key: "eliteFrame",         nameAr: "إطار النخبة المتحرك",    nameEn: "Elite Animated Frame",    icon: "🖼️" },
  exclusiveEffects:   { key: "exclusiveEffects",   nameAr: "تأثيرات حصرية",          nameEn: "Exclusive Effects",       icon: "❄️" },
  eliteBadge:         { key: "eliteBadge",         nameAr: "شارة النخبة",            nameEn: "Elite Badge",             icon: "🏆" },
  doubleXP:           { key: "doubleXP",           nameAr: "مضاعفة الخبرة",          nameEn: "Double XP Events",        icon: "⚡" },
  eliteVipBadge:      { key: "eliteVipBadge",      nameAr: "شارة VIP النخبة",        nameEn: "Elite VIP Badge",         icon: "💎" },
  supremeFrame:       { key: "supremeFrame",       nameAr: "إطار الأعلى الأسطوري",   nameEn: "Supreme Legendary Frame", icon: "🖼️" },
  customBadge:        { key: "customBadge",        nameAr: "إنشاء شارة مخصصة",       nameEn: "Custom Badge Creation",   icon: "🎖️" },
  supremeBadge:       { key: "supremeBadge",       nameAr: "شارة الأعلى",            nameEn: "Supreme Badge",           icon: "✨" },
  allUnlocked:        { key: "allUnlocked",        nameAr: "جميع الميزات مفتوحة",    nameEn: "All Features Unlocked",   icon: "🔓" },
  supremeVip:         { key: "supremeVip",         nameAr: "عضوية VIP الأعلى",       nameEn: "Supreme VIP Membership",  icon: "👑" },
};

// ── Feature unlocks per level ──
const LEVEL_FEATURES: Record<number, LevelFeature[]> = {
  1:  [],
  2:  [FEATURES.bronzeFrame],
  3:  [],
  4:  [],
  5:  [FEATURES.bronzeBadge, FEATURES.basicChatBubble],
  6:  [FEATURES.silverFrame],
  7:  [],
  8:  [FEATURES.prioritySearch],
  9:  [FEATURES.usernameColor1],
  10: [FEATURES.silverBadge],
  11: [FEATURES.goldFrame],
  12: [FEATURES.adFree],
  13: [FEATURES.extendedCalls],
  14: [FEATURES.goldBadge],
  15: [FEATURES.profileBg1],
  16: [FEATURES.platinumFrame],
  17: [FEATURES.entryEffect],
  18: [],
  19: [FEATURES.emojiPack1],
  20: [FEATURES.platinumBadge, FEATURES.priorityMatching],
  21: [FEATURES.diamondFrame],
  22: [FEATURES.vipRooms],
  23: [],
  24: [FEATURES.voiceEffects],
  25: [FEATURES.diamondBadge, FEATURES.profileHighlight],
  26: [FEATURES.crownFrame],
  27: [FEATURES.profileMusic],
  28: [],
  29: [FEATURES.emojiPack2],
  30: [FEATURES.crownBadge, FEATURES.broadcastPriority],
  31: [FEATURES.legendFrame],
  32: [FEATURES.customChatBubble],
  33: [],
  34: [FEATURES.extendedCallsPro],
  35: [FEATURES.legendBadge, FEATURES.featuredDiscover],
  36: [FEATURES.masterFrame],
  37: [FEATURES.animatedFrame],
  38: [],
  39: [FEATURES.extraFriends],
  40: [FEATURES.masterBadge, FEATURES.vipBadge],
  41: [FEATURES.grandMasterFrame],
  42: [FEATURES.customRoomTheme],
  43: [],
  44: [FEATURES.emojiPack3],
  45: [FEATURES.grandMasterBadge, FEATURES.prioritySupport],
  46: [FEATURES.eliteFrame],
  47: [FEATURES.exclusiveEffects],
  48: [],
  49: [FEATURES.doubleXP],
  50: [FEATURES.eliteBadge, FEATURES.eliteVipBadge],
  51: [FEATURES.supremeFrame],
  52: [FEATURES.customBadge],
  53: [],
  54: [FEATURES.allUnlocked],
  55: [FEATURES.supremeBadge, FEATURES.supremeVip],
};

// ── Perks per level (computed) ──
function computePerks(level: number): LevelPerks {
  const tierIndex = Math.floor((level - 1) / 5);
  const posInTier = (level - 1) % 5; // 0-4

  // Discount: 0% at L1, grows to 30% at L55
  const discountSteps = [0, 0, 1, 2, 3, 5, 6, 7, 8, 10, 12,
    13, 14, 15, 16, 18, 19, 20, 21, 22, 24,
    25, 26, 27, 28, 30];
  const discountIndex = Math.min(Math.floor(level / 2), discountSteps.length - 1);
  const discount = discountSteps[discountIndex];

  // Daily coins: 0 at L1, grows to 500 at L55
  const dailyCoins = level <= 1 ? 0 : Math.round(
    level <= 5 ? level * 2 :
    level <= 10 ? 10 + (level - 5) * 6 :
    level <= 15 ? 40 + (level - 10) * 8 :
    level <= 20 ? 80 + (level - 15) * 10 :
    level <= 25 ? 130 + (level - 20) * 14 :
    level <= 30 ? 200 + (level - 25) * 16 :
    level <= 35 ? 280 + (level - 30) * 18 :
    level <= 40 ? 370 + (level - 35) * 14 :
    level <= 45 ? 440 + (level - 40) * 12 :
    level <= 50 ? 500 + (level - 45) * 10 :
    550 + (level - 50) * 10
  );

  // Gift multiplier: 1.0 at L1, grows to 3.0 at L55
  const giftMultiplier = Math.round((1.0 + (level - 1) * (2.0 / 54)) * 100) / 100;

  // Max friends: 50 at L1, up to 500 at L55
  const maxFriends = 50 + Math.floor((level - 1) * (450 / 54));

  // Call bonus minutes: 0 at L1, up to 60 at L55
  const callBonusMinutes =
    level < 13 ? 0 :
    level < 25 ? 5 :
    level < 34 ? 10 :
    level < 40 ? 15 :
    level < 45 ? 20 :
    level < 50 ? 30 :
    level < 55 ? 45 : 60;

  return { discount, dailyCoins, giftMultiplier, maxFriends, callBonusMinutes };
}

// ── Generate all 55 levels ──
function generateLevels(): LevelConfig[] {
  const levels: LevelConfig[] = [];
  for (let lvl = 1; lvl <= 55; lvl++) {
    const tierIndex = Math.floor((lvl - 1) / 5);
    levels.push({
      level: lvl,
      tier: TIERS[tierIndex],
      xpRequired: XP_TABLE[lvl - 1],
      perks: computePerks(lvl),
      newFeatures: LEVEL_FEATURES[lvl] || [],
    });
  }
  return levels;
}

export const LEVELS: LevelConfig[] = generateLevels();

// ── Helper functions ──

/** Get config for a specific level (1-55) */
export function getLevelConfig(level: number): LevelConfig {
  const clampedLevel = Math.max(1, Math.min(55, level));
  return LEVELS[clampedLevel - 1];
}

/** Get the tier for a level */
export function getTierForLevel(level: number): TierInfo {
  const tierIndex = Math.floor((Math.max(1, Math.min(55, level)) - 1) / 5);
  return TIERS[tierIndex];
}

/** Get all features unlocked up to and including a level */
export function getAllUnlockedFeatures(level: number): LevelFeature[] {
  const features: LevelFeature[] = [];
  for (let lvl = 1; lvl <= Math.min(55, level); lvl++) {
    const lvlFeatures = LEVEL_FEATURES[lvl];
    if (lvlFeatures) features.push(...lvlFeatures);
  }
  return features;
}

/** Get XP needed for next level, or 0 if max */
export function getXpForNextLevel(currentLevel: number): number {
  if (currentLevel >= 55) return 0;
  return XP_TABLE[currentLevel]; // XP_TABLE[currentLevel] is XP for level (currentLevel + 1)
}

/** Calculate progress percentage to next level */
export function getLevelProgress(currentLevel: number, currentXp: number): number {
  if (currentLevel >= 55) return 100;
  const currentLevelXp = XP_TABLE[currentLevel - 1];
  const nextLevelXp = XP_TABLE[currentLevel];
  const totalNeeded = nextLevelXp - currentLevelXp;
  if (totalNeeded <= 0) return 100;
  const progress = ((currentXp - currentLevelXp) / totalNeeded) * 100;
  return Math.max(0, Math.min(100, Math.round(progress)));
}

/** Format XP number with commas */
export function formatXp(xp: number): string {
  return xp.toLocaleString("en-US");
}

/** Max level constant */
export const MAX_LEVEL = 55;

/** Total tiers */
export const TOTAL_TIERS = 11;
