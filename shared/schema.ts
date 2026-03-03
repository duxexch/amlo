import { sql } from "drizzle-orm";
import {
  pgTable,
  text,
  varchar,
  integer,
  boolean,
  timestamp,
  numeric,
  index,
  date,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ════════════════════════════════════════════════════════════
// 1. ADMINS - لوحة التحكم والإدارة
// ════════════════════════════════════════════════════════════
export const admins = pgTable("admins", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  username: text("username").notNull().unique(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("moderator"), // super_admin | admin | moderator
  avatar: text("avatar"),
  isActive: boolean("is_active").notNull().default(true),
  lastLoginAt: timestamp("last_login_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertAdminSchema = createInsertSchema(admins).pick({
  username: true,
  email: true,
  passwordHash: true,
  displayName: true,
  role: true,
});
export type Admin = typeof admins.$inferSelect;
export type InsertAdmin = z.infer<typeof insertAdminSchema>;

// ════════════════════════════════════════════════════════════
// 2. USERS - المستخدمين (جدول موسع)
// ════════════════════════════════════════════════════════════
export const users = pgTable(
  "users",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    username: text("username").notNull().unique(),
    email: text("email").unique(),
    passwordHash: text("password_hash").notNull(),
    displayName: text("display_name"),
    avatar: text("avatar"),
    bio: text("bio"),
    coins: integer("coins").notNull().default(0),
    diamonds: integer("diamonds").notNull().default(0),
    level: integer("level").notNull().default(1),
    xp: integer("xp").notNull().default(0),
    gender: text("gender"), // male | female | other
    country: text("country"),
    birthDate: date("birth_date"),
    isVerified: boolean("is_verified").notNull().default(false),
    isBanned: boolean("is_banned").notNull().default(false),
    banReason: text("ban_reason"),
    status: text("status").notNull().default("offline"), // online | offline | in_stream | in_call
    referralCode: text("referral_code").unique(),
    referredByAgent: varchar("referred_by_agent"),
    miles: integer("miles").notNull().default(0),
    totalWorldSessions: integer("total_world_sessions").notNull().default(0),
    lastOnlineAt: timestamp("last_online_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("users_status_idx").on(table.status),
    index("users_country_idx").on(table.country),
    index("users_created_at_idx").on(table.createdAt),
    index("users_is_banned_idx").on(table.isBanned),
  ],
);

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  email: true,
  passwordHash: true,
  displayName: true,
});
export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// ════════════════════════════════════════════════════════════
// 3. AGENTS - الوكلاء / شركاء الإحالة
// ════════════════════════════════════════════════════════════
export const agents = pgTable(
  "agents",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    name: text("name").notNull(),
    email: text("email").notNull().unique(),
    phone: text("phone"),
    passwordHash: text("password_hash").notNull(),
    referralCode: text("referral_code").notNull().unique(),
    commissionRate: numeric("commission_rate", { precision: 5, scale: 2 })
      .notNull()
      .default("10.00"),
    totalUsers: integer("total_users").notNull().default(0),
    totalRevenue: numeric("total_revenue", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    balance: numeric("balance", { precision: 12, scale: 2 })
      .notNull()
      .default("0.00"),
    status: text("status").notNull().default("pending"), // active | pending | suspended
    createdBy: varchar("created_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("agents_status_idx").on(table.status),
    index("agents_referral_code_idx").on(table.referralCode),
  ],
);

export const insertAgentSchema = createInsertSchema(agents).pick({
  name: true,
  email: true,
  phone: true,
  passwordHash: true,
  referralCode: true,
  commissionRate: true,
});
export type Agent = typeof agents.$inferSelect;
export type InsertAgent = z.infer<typeof insertAgentSchema>;

// ════════════════════════════════════════════════════════════
// 4. GIFTS - كتالوج الهدايا
// ════════════════════════════════════════════════════════════
export const gifts = pgTable("gifts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameAr: text("name_ar").notNull(),
  icon: text("icon").notNull(),
  price: integer("price").notNull(),
  category: text("category").notNull().default("general"), // general | premium | special | event
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertGiftSchema = createInsertSchema(gifts).pick({
  name: true,
  nameAr: true,
  icon: true,
  price: true,
  category: true,
});
export type Gift = typeof gifts.$inferSelect;
export type InsertGift = z.infer<typeof insertGiftSchema>;

// ════════════════════════════════════════════════════════════
// 5. GIFT_TRANSACTIONS - سجل إرسال الهدايا
// ════════════════════════════════════════════════════════════
export const giftTransactions = pgTable(
  "gift_transactions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    senderId: varchar("sender_id").notNull(),
    receiverId: varchar("receiver_id").notNull(),
    giftId: varchar("gift_id").notNull(),
    streamId: varchar("stream_id"),
    quantity: integer("quantity").notNull().default(1),
    totalPrice: integer("total_price").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("gift_tx_sender_idx").on(table.senderId),
    index("gift_tx_receiver_idx").on(table.receiverId),
    index("gift_tx_created_idx").on(table.createdAt),
  ],
);

export type GiftTransaction = typeof giftTransactions.$inferSelect;

// ════════════════════════════════════════════════════════════
// 6. COIN_PACKAGES - باقات شحن الكوينز
// ════════════════════════════════════════════════════════════
export const coinPackages = pgTable("coin_packages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  coins: integer("coins").notNull(),
  bonusCoins: integer("bonus_coins").notNull().default(0),
  priceUsd: numeric("price_usd", { precision: 10, scale: 2 }).notNull(),
  isPopular: boolean("is_popular").notNull().default(false),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type CoinPackage = typeof coinPackages.$inferSelect;

// ════════════════════════════════════════════════════════════
// 7. WALLET_TRANSACTIONS - سجل المعاملات المالية
// ════════════════════════════════════════════════════════════
export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    type: text("type").notNull(), // purchase | gift_sent | gift_received | withdrawal | refund | bonus
    amount: integer("amount").notNull(),
    balanceAfter: integer("balance_after").notNull(),
    currency: text("currency").notNull().default("coins"), // coins | diamonds | usd
    description: text("description"),
    referenceId: varchar("reference_id"),
    paymentMethod: text("payment_method"),
    status: text("status").notNull().default("completed"), // pending | completed | failed | refunded
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("wallet_tx_user_idx").on(table.userId),
    index("wallet_tx_type_idx").on(table.type),
    index("wallet_tx_created_idx").on(table.createdAt),
  ],
);

export type WalletTransaction = typeof walletTransactions.$inferSelect;

// ════════════════════════════════════════════════════════════
// 8. STREAMS - البثوث المباشرة
// ════════════════════════════════════════════════════════════
export const streams = pgTable(
  "streams",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    title: text("title"),
    type: text("type").notNull().default("live"), // live | audio | video_call
    status: text("status").notNull().default("active"), // active | ended | banned
    viewerCount: integer("viewer_count").notNull().default(0),
    peakViewers: integer("peak_viewers").notNull().default(0),
    totalGifts: integer("total_gifts").notNull().default(0),
    tags: text("tags"),
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    index("streams_user_idx").on(table.userId),
    index("streams_status_idx").on(table.status),
    index("streams_started_idx").on(table.startedAt),
  ],
);

export type Stream = typeof streams.$inferSelect;

// ════════════════════════════════════════════════════════════
// 9. USER_REPORTS - بلاغات المستخدمين
// ════════════════════════════════════════════════════════════
export const userReports = pgTable(
  "user_reports",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    reporterId: varchar("reporter_id").notNull(),
    reportedId: varchar("reported_id").notNull(),
    streamId: varchar("stream_id"),
    type: text("type").notNull(), // harassment | spam | inappropriate | scam | other
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"), // pending | reviewed | resolved | dismissed
    adminNotes: text("admin_notes"),
    reviewedBy: varchar("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("reports_status_idx").on(table.status),
    index("reports_created_idx").on(table.createdAt),
  ],
);

export type UserReport = typeof userReports.$inferSelect;

// ════════════════════════════════════════════════════════════
// 10. USER_FOLLOWS - علاقات المتابعة
// ════════════════════════════════════════════════════════════
export const userFollows = pgTable(
  "user_follows",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    followerId: varchar("follower_id").notNull(),
    followingId: varchar("following_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("follows_follower_idx").on(table.followerId),
    index("follows_following_idx").on(table.followingId),
  ],
);

export type UserFollow = typeof userFollows.$inferSelect;

// ════════════════════════════════════════════════════════════
// 11. SYSTEM_SETTINGS - إعدادات النظام
// ════════════════════════════════════════════════════════════
export const systemSettings = pgTable("system_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  category: text("category").notNull().default("general"), // general | payments | moderation | notifications
  description: text("description"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type SystemSetting = typeof systemSettings.$inferSelect;

// ════════════════════════════════════════════════════════════
// 12. ADMIN_LOGS - سجل عمليات الإدارة (التدقيق)
// ════════════════════════════════════════════════════════════
export const adminLogs = pgTable(
  "admin_logs",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    adminId: varchar("admin_id").notNull(),
    action: text("action").notNull(),
    targetType: text("target_type"), // user | agent | gift | stream | setting | report
    targetId: varchar("target_id"),
    details: text("details"),
    ipAddress: text("ip_address"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("admin_logs_admin_idx").on(table.adminId),
    index("admin_logs_created_idx").on(table.createdAt),
  ],
);

export type AdminLog = typeof adminLogs.$inferSelect;

// ════════════════════════════════════════════════════════════
// 13. FRIENDSHIPS - نظام الأصدقاء
// ════════════════════════════════════════════════════════════
export const friendships = pgTable(
  "friendships",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    senderId: varchar("sender_id").notNull(),
    receiverId: varchar("receiver_id").notNull(),
    status: text("status").notNull().default("pending"), // pending | accepted | rejected | blocked
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("friendships_sender_idx").on(table.senderId),
    index("friendships_receiver_idx").on(table.receiverId),
    index("friendships_status_idx").on(table.status),
  ],
);

export type Friendship = typeof friendships.$inferSelect;

// ════════════════════════════════════════════════════════════
// 14. CONVERSATIONS - المحادثات الخاصة
// ════════════════════════════════════════════════════════════
export const conversations = pgTable(
  "conversations",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    participant1Id: varchar("participant1_id").notNull(),
    participant2Id: varchar("participant2_id").notNull(),
    lastMessageId: varchar("last_message_id"),
    lastMessageAt: timestamp("last_message_at"),
    participant1Unread: integer("participant1_unread").notNull().default(0),
    participant2Unread: integer("participant2_unread").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("conv_p1_idx").on(table.participant1Id),
    index("conv_p2_idx").on(table.participant2Id),
    index("conv_last_msg_idx").on(table.lastMessageAt),
  ],
);

export type Conversation = typeof conversations.$inferSelect;

// ════════════════════════════════════════════════════════════
// 15. MESSAGES - الرسائل الخاصة
// ════════════════════════════════════════════════════════════
export const messages = pgTable(
  "messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    conversationId: varchar("conversation_id").notNull(),
    senderId: varchar("sender_id").notNull(),
    content: text("content"),
    type: text("type").notNull().default("text"), // text | image | voice | gift | system
    mediaUrl: text("media_url"),
    giftId: varchar("gift_id"),
    isRead: boolean("is_read").notNull().default(false),
    isDeleted: boolean("is_deleted").notNull().default(false),
    coinsCost: integer("coins_cost").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("msg_conv_idx").on(table.conversationId),
    index("msg_sender_idx").on(table.senderId),
    index("msg_created_idx").on(table.createdAt),
  ],
);

export type Message = typeof messages.$inferSelect;

// ════════════════════════════════════════════════════════════
// 16. CALLS - سجل المكالمات (صوت + فيديو)
// ════════════════════════════════════════════════════════════
export const calls = pgTable(
  "calls",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    callerId: varchar("caller_id").notNull(),
    receiverId: varchar("receiver_id").notNull(),
    type: text("type").notNull(), // voice | video
    status: text("status").notNull().default("ringing"), // ringing | active | ended | missed | rejected | busy
    startedAt: timestamp("started_at"),
    endedAt: timestamp("ended_at"),
    durationSeconds: integer("duration_seconds").notNull().default(0),
    coinsCharged: integer("coins_charged").notNull().default(0),
    coinRate: integer("coin_rate").notNull().default(0), // coins per minute
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("calls_caller_idx").on(table.callerId),
    index("calls_receiver_idx").on(table.receiverId),
    index("calls_status_idx").on(table.status),
    index("calls_created_idx").on(table.createdAt),
  ],
);

export type Call = typeof calls.$inferSelect;

// ════════════════════════════════════════════════════════════
// ZOD VALIDATION SCHEMAS
// ════════════════════════════════════════════════════════════
export const adminLoginSchema = z.object({
  username: z.string().min(3).max(50),
  password: z.string().min(6).max(100),
});

export const createAgentSchema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email(),
  phone: z.string().optional(),
  password: z.string().min(6).max(100),
  commissionType: z.enum(["fixed", "percentage"]).optional(),
  commissionRate: z.string().optional(),
  fixedAmount: z.string().optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  email: z.string().email().optional(),
  phone: z.string().optional(),
  commissionType: z.enum(["fixed", "percentage"]).optional(),
  commissionRate: z.string().optional(),
  fixedAmount: z.string().optional(),
  status: z.enum(["active", "pending", "suspended"]).optional(),
});

export const createGiftSchema = z.object({
  name: z.string().min(1).max(100),
  nameAr: z.string().min(1).max(100),
  icon: z.string().min(1),
  price: z.number().int().positive(),
  category: z.enum(["general", "premium", "special", "event"]).optional(),
});

export const updateUserAdminSchema = z.object({
  displayName: z.string().min(1).max(100).optional(),
  email: z.string().email().optional(),
  coins: z.number().int().min(0).optional(),
  diamonds: z.number().int().min(0).optional(),
  level: z.number().int().min(1).optional(),
  isVerified: z.boolean().optional(),
  isBanned: z.boolean().optional(),
  banReason: z.string().optional(),
  country: z.string().optional(),
});

export const updateSettingSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_]+$/, "Invalid setting key"),
  value: z.string().max(10000),
});

export const updateReportSchema = z.object({
  status: z.enum(["pending", "reviewed", "resolved", "dismissed"]),
  adminNotes: z.string().optional(),
});

// ── Social System Schemas ──
export const sendMessageSchema = z.object({
  receiverId: z.string().min(1).max(100),
  content: z.string().min(1).max(5000).optional(),
  type: z.enum(["text", "image", "voice", "gift"]).default("text"),
  mediaUrl: z.string().url().max(2048).optional(),
  giftId: z.string().max(100).optional(),
});

export const initiateCallSchema = z.object({
  receiverId: z.string().min(1).max(100),
  type: z.enum(["voice", "video"]),
});

// ════════════════════════════════════════════════════════════
// 17. WORLD_SESSIONS — جلسات حول العالم
// ════════════════════════════════════════════════════════════
export const worldSessions = pgTable(
  "world_sessions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    matchedUserId: varchar("matched_user_id"),
    genderFilter: text("gender_filter"), // male | female | both
    ageMin: integer("age_min").notNull().default(18),
    ageMax: integer("age_max").notNull().default(60),
    countryFilter: text("country_filter"),
    coinsSpent: integer("coins_spent").notNull().default(0),
    milesEarned: integer("miles_earned").notNull().default(0),
    status: text("status").notNull().default("searching"), // searching | matched | chatting | ended | cancelled
    startedAt: timestamp("started_at").notNull().defaultNow(),
    matchedAt: timestamp("matched_at"),
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    index("world_sessions_user_idx").on(table.userId),
    index("world_sessions_status_idx").on(table.status),
    index("world_sessions_started_idx").on(table.startedAt),
  ],
);

export type WorldSession = typeof worldSessions.$inferSelect;

// ════════════════════════════════════════════════════════════
// 18. WORLD_MESSAGES — رسائل دردشة حول العالم
// ════════════════════════════════════════════════════════════
export const worldMessages = pgTable(
  "world_messages",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    sessionId: varchar("session_id").notNull(),
    senderId: varchar("sender_id").notNull(),
    content: text("content"),
    type: text("type").notNull().default("text"), // text | image | voice | gift | system
    mediaUrl: text("media_url"),
    giftId: varchar("gift_id"),
    coinsCost: integer("coins_cost").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("world_msg_session_idx").on(table.sessionId),
    index("world_msg_sender_idx").on(table.senderId),
    index("world_msg_created_idx").on(table.createdAt),
  ],
);

export type WorldMessage = typeof worldMessages.$inferSelect;

// ════════════════════════════════════════════════════════════
// 19. WORLD_PRICING — أسعار فلاتر حول العالم
// ════════════════════════════════════════════════════════════
export const worldPricing = pgTable(
  "world_pricing",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    filterType: text("filter_type").notNull().unique(),
    // spin_cost | gender_male | gender_female | gender_both | age_range | country_specific | country_all | miles_per_minute
    priceCoins: integer("price_coins").notNull().default(0),
    isActive: boolean("is_active").notNull().default(true),
    description: text("description"),
    descriptionAr: text("description_ar"),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("world_pricing_filter_idx").on(table.filterType),
  ],
);

export type WorldPricing = typeof worldPricing.$inferSelect;

// ════════════════════════════════════════════════════════════
// 20. CHAT_BLOCKS — حظر الدردشة (مع بقاء المتابعة)
// ════════════════════════════════════════════════════════════
export const chatBlocks = pgTable(
  "chat_blocks",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    blockerId: varchar("blocker_id").notNull(),
    blockedId: varchar("blocked_id").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("chat_blocks_blocker_idx").on(table.blockerId),
    index("chat_blocks_blocked_idx").on(table.blockedId),
  ],
);

export type ChatBlock = typeof chatBlocks.$inferSelect;

// ════════════════════════════════════════════════════════════
// 21. MESSAGE_REPORTS — بلاغات الرسائل
// ════════════════════════════════════════════════════════════
export const messageReports = pgTable(
  "message_reports",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    reporterId: varchar("reporter_id").notNull(),
    messageId: varchar("message_id").notNull(),
    conversationId: varchar("conversation_id").notNull(),
    reportedUserId: varchar("reported_user_id").notNull(),
    category: text("category").notNull().default("other"), // harassment | spam | inappropriate | scam | threat | other
    reason: text("reason"),
    status: text("status").notNull().default("pending"), // pending | reviewed | resolved | dismissed
    adminNotes: text("admin_notes"),
    reviewedBy: varchar("reviewed_by"),
    reviewedAt: timestamp("reviewed_at"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("msg_reports_reporter_idx").on(table.reporterId),
    index("msg_reports_message_idx").on(table.messageId),
    index("msg_reports_status_idx").on(table.status),
    index("msg_reports_created_idx").on(table.createdAt),
  ],
);

export type MessageReport = typeof messageReports.$inferSelect;

// ── Report & Block Schemas ──
export const reportMessageSchema = z.object({
  messageId: z.string().min(1).max(100),
  conversationId: z.string().min(1).max(100),
  reportedUserId: z.string().min(1).max(100),
  category: z.enum(["harassment", "spam", "inappropriate", "scam", "threat", "other"]).default("other"),
  reason: z.string().max(500).optional(),
});

export const updateMessageReportSchema = z.object({
  status: z.enum(["pending", "reviewed", "resolved", "dismissed"]),
  adminNotes: z.string().optional(),
});

// ════════════════════════════════════════════════════════════
// 22. UPGRADE_REQUESTS — طلبات ترقية المستخدمين
// ════════════════════════════════════════════════════════════
export const upgradeRequests = pgTable(
  "upgrade_requests",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    currentLevel: integer("current_level").notNull(),
    requestedLevel: integer("requested_level").notNull(),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    adminNotes: text("admin_notes"),
    reviewedBy: varchar("reviewed_by"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    reviewedAt: timestamp("reviewed_at"),
  },
  (table) => [
    index("upgrade_req_user_idx").on(table.userId),
    index("upgrade_req_status_idx").on(table.status),
    index("upgrade_req_created_idx").on(table.createdAt),
  ],
);

export type UpgradeRequest = typeof upgradeRequests.$inferSelect;

export const createUpgradeRequestSchema = z.object({
  requestedLevel: z.number().int().min(2).max(55),
});

export const reviewUpgradeRequestSchema = z.object({
  status: z.enum(["approved", "rejected"]),
  adminNotes: z.string().max(500).optional(),
});

// ── Admin Validation Schemas (Input Sanitization) ──

export const banUserSchema = z.object({
  reason: z.string().max(500).optional(),
});

export const agentApplicationUpdateSchema = z.object({
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  adminNotes: z.string().max(2000).optional(),
});

export const transactionUpdateSchema = z.object({
  status: z.enum(["completed", "pending", "failed", "refunded"]).optional(),
  adminNotes: z.string().max(2000).optional(),
  rejectionReason: z.string().max(500).optional(),
  amount: z.number().positive().max(1000000).optional(),
  description: z.string().max(1000).optional(),
});

export const fraudAlertUpdateSchema = z.object({
  status: z.enum(["pending", "investigating", "resolved", "dismissed"]).optional(),
  adminNotes: z.string().max(2000).optional(),
});

export const announcementPopupSchema = z.object({
  enabled: z.boolean().optional(),
  imageUrl: z.string().max(2048).optional(),
  title: z.string().max(200).optional(),
  subtitle: z.string().max(500).optional(),
  buttons: z.array(z.object({
    label: z.string().max(100),
    url: z.string().max(500),
    style: z.enum(["primary", "secondary"]),
  })).max(5).optional(),
  showOnce: z.boolean().optional(),
  delaySeconds: z.number().int().min(0).max(120).optional(),
});

export const agentAccountCreateSchema = z.object({
  agentId: z.string().max(100).optional(),
  agentName: z.string().max(200).optional(),
  displayName: z.string().min(1).max(200),
  email: z.string().email().max(300),
  type: z.string().max(50).optional(),
  features: z.array(z.string().max(100)).max(20).optional(),
  commissionRate: z.string().max(10).optional(),
  discount: z.string().max(10).optional(),
});

export const releaseBalanceSchema = z.object({
  amount: z.number().positive().max(10000000),
});

export const agentApplicationSubmitSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email().max(300),
  phone: z.string().min(5).max(30),
  bio: z.string().max(2000).optional(),
  photoUrl: z.string().max(2048).optional(),
  whatsapp: z.string().max(30).optional(),
  telegram: z.string().max(100).optional(),
  instagram: z.string().max(100).optional(),
  twitter: z.string().max(100).optional(),
  accountType: z.enum(["marketer", "agent", "both"]),
  referralCode: z.string().max(50).optional(),
});

export const accountApplicationSubmitSchema = z.object({
  fullName: z.string().min(1).max(200),
  email: z.string().email().max(300),
  phone: z.string().min(5).max(30),
  bio: z.string().max(2000).optional(),
  accountReferralCode: z.string().max(50).optional(),
});

export const milesPricingSchema = z.object({
  costPerMile: z.number().positive().max(1000000).optional(),
  packages: z.array(z.object({
    id: z.string().max(50),
    miles: z.number().int().positive(),
    price: z.number().positive(),
    bonus: z.number().int().min(0).optional(),
    isPopular: z.boolean().optional(),
  })).max(50).optional(),
});

// ── World System Schemas ──
export const worldSearchSchema = z.object({
  genderFilter: z.enum(["male", "female", "both"]).default("both"),
  ageMin: z.number().int().min(18).max(100).default(18),
  ageMax: z.number().int().min(18).max(100).default(60),
  countryFilter: z.string().max(100).optional(),
});

export const worldMessageSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  type: z.enum(["text", "image", "voice", "gift"]).default("text"),
  mediaUrl: z.string().url().max(2048).optional(),
  giftId: z.string().max(100).optional(),
});

// ════════════════════════════════════════════════════════════
// 23. USER_PROFILES — الملفات الشخصية المزدوجة (2 بروفايل لكل مستخدم)
// ════════════════════════════════════════════════════════════
export const userProfiles = pgTable(
  "user_profiles",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(),
    profileIndex: integer("profile_index").notNull(), // 1 or 2
    pinHash: text("pin_hash").notNull(), // bcrypt hash of 4-digit PIN
    displayName: text("display_name"),
    avatar: text("avatar"),
    bio: text("bio"),
    gender: text("gender"), // male | female | other
    country: text("country"),
    birthDate: date("birth_date"),
    isDefault: boolean("is_default").notNull().default(false), // first profile is default
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("user_profiles_user_idx").on(table.userId),
    index("user_profiles_user_index_idx").on(table.userId, table.profileIndex),
  ],
);

export type UserProfile = typeof userProfiles.$inferSelect;

// ════════════════════════════════════════════════════════════
// 24. FRIEND_PROFILE_VISIBILITY — إعداد ظهور البروفايل لكل صديق
// ════════════════════════════════════════════════════════════
export const friendProfileVisibility = pgTable(
  "friend_profile_visibility",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull(), // owner
    friendId: varchar("friend_id").notNull(), // friend who sees this profile
    visibleProfileIndex: integer("visible_profile_index").notNull().default(1), // 1 or 2
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("fpv_user_idx").on(table.userId),
    index("fpv_friend_idx").on(table.friendId),
    index("fpv_user_friend_idx").on(table.userId, table.friendId),
  ],
);

export type FriendProfileVisibility = typeof friendProfileVisibility.$inferSelect;

// ── PIN & Profile Schemas ──
export const setupPinSchema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
  profileIndex: z.number().int().min(1).max(2),
  displayName: z.string().min(1).max(100).trim(),
  bio: z.string().max(500).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  country: z.string().max(100).optional(),
});

export const verifyPinSchema = z.object({
  pin: z.string().length(4).regex(/^\d{4}$/, "PIN must be exactly 4 digits"),
});

export const updateProfileSchema = z.object({
  displayName: z.string().min(1).max(100).trim().optional(),
  avatar: z.string().max(2048).optional(),
  bio: z.string().max(500).optional(),
  gender: z.enum(["male", "female", "other"]).optional(),
  country: z.string().max(100).optional(),
  birthDate: z.string().max(20).optional(),
});

export const setFriendVisibilitySchema = z.object({
  friendId: z.string().min(1).max(100),
  visibleProfileIndex: z.number().int().min(1).max(2),
});

// ── User Auth Schemas ──
export const userRegisterSchema = z.object({
  username: z.string().min(3).max(50).trim().regex(/^[a-zA-Z0-9_]+$/, "Username: letters, numbers, underscore only"),
  email: z.string().email().max(200),
  password: z.string().min(6).max(200),
  displayName: z.string().min(1).max(100).trim().optional(),
  referralCode: z.string().max(50).optional(),
});

export const userLoginSchema = z.object({
  login: z.string().min(2).max(200).trim(), // username or email
  password: z.string().min(1).max(200),
});

export const forgotPasswordSchema = z.object({
  email: z.string().email().max(200),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10).max(200),
  password: z.string().min(6).max(200),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1).max(200),
  newPassword: z.string().min(6).max(200),
});

// ════════════════════════════════════════════════════════════
// 25. SYSTEM_CONFIG — إعدادات النظام المتقدمة (SEO, ASO, Branding, etc.)
// ════════════════════════════════════════════════════════════
export const systemConfig = pgTable("system_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  category: text("category").notNull(), // seo | aso | branding | social_login | otp | policies | app_download | advanced
  configData: text("config_data").notNull().default("{}"), // JSON string
  updatedBy: varchar("updated_by"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("system_config_category_idx").on(table.category),
]);

export type SystemConfig = typeof systemConfig.$inferSelect;

// ════════════════════════════════════════════════════════════
// 26. FEATURED_STREAMS_CONFIG — البثوث المميزة على الصفحة الرئيسية
// ════════════════════════════════════════════════════════════
export const featuredStreamsConfig = pgTable("featured_streams_config", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  streamerName: text("streamer_name").notNull(),
  image: text("image").notNull(),
  streamId: varchar("stream_id"),
  viewerCount: integer("viewer_count").notNull().default(0),
  isLive: boolean("is_live").notNull().default(false),
  sortOrder: integer("sort_order").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type FeaturedStreamConfig = typeof featuredStreamsConfig.$inferSelect;

// ════════════════════════════════════════════════════════════
// 27. ANNOUNCEMENT_POPUPS — إعلانات البوب أب
// ════════════════════════════════════════════════════════════
export const announcementPopups = pgTable("announcement_popups", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  enabled: boolean("enabled").notNull().default(false),
  imageUrl: text("image_url"),
  title: text("title"),
  subtitle: text("subtitle"),
  buttons: text("buttons").default("[]"), // JSON array
  showOnce: boolean("show_once").notNull().default(true),
  delaySeconds: integer("delay_seconds").notNull().default(3),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type AnnouncementPopup = typeof announcementPopups.$inferSelect;

// ════════════════════════════════════════════════════════════
// 28. PAYMENT_METHODS — طرق الدفع
// ════════════════════════════════════════════════════════════
export const paymentMethods = pgTable("payment_methods", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  nameAr: text("name_ar"),
  type: text("type").notNull().default("manual"), // manual | auto | crypto
  icon: text("icon"),
  instructions: text("instructions"),
  instructionsAr: text("instructions_ar"),
  accountDetails: text("account_details"), // JSON
  minAmount: numeric("min_amount", { precision: 12, scale: 2 }).default("1.00"),
  maxAmount: numeric("max_amount", { precision: 12, scale: 2 }).default("10000.00"),
  currency: text("currency").notNull().default("USD"),
  isActive: boolean("is_active").notNull().default(true),
  sortOrder: integer("sort_order").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PaymentMethod = typeof paymentMethods.$inferSelect;

// ════════════════════════════════════════════════════════════
// 29. FRAUD_ALERTS — تنبيهات الاحتيال
// ════════════════════════════════════════════════════════════
export const fraudAlerts = pgTable("fraud_alerts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id"),
  agentId: varchar("agent_id"),
  type: text("type").notNull(), // suspicious_login | unusual_transaction | multiple_accounts | rapid_gifting | bot_behavior
  severity: text("severity").notNull().default("medium"), // low | medium | high | critical
  description: text("description").notNull(),
  details: text("details"), // JSON with additional context
  status: text("status").notNull().default("pending"), // pending | investigating | resolved | dismissed
  adminNotes: text("admin_notes"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("fraud_alerts_user_idx").on(table.userId),
  index("fraud_alerts_status_idx").on(table.status),
  index("fraud_alerts_severity_idx").on(table.severity),
  index("fraud_alerts_created_idx").on(table.createdAt),
]);

export type FraudAlert = typeof fraudAlerts.$inferSelect;

// ════════════════════════════════════════════════════════════
// 30. MODERATION_CONFIG + BANNED_WORDS — إعدادات الإشراف
// ════════════════════════════════════════════════════════════
export const bannedWords = pgTable("banned_words", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  word: text("word").notNull(),
  language: text("language").notNull().default("all"), // all | ar | en | etc
  severity: text("severity").notNull().default("block"), // warn | block | ban
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("banned_words_word_idx").on(table.word),
]);

export type BannedWord = typeof bannedWords.$inferSelect;

// ════════════════════════════════════════════════════════════
// 31. AGENT_APPLICATIONS — طلبات تسجيل الوكلاء
// ════════════════════════════════════════════════════════════
export const agentApplications = pgTable("agent_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  bio: text("bio"),
  photoUrl: text("photo_url"),
  whatsapp: text("whatsapp"),
  telegram: text("telegram"),
  instagram: text("instagram"),
  twitter: text("twitter"),
  accountType: text("account_type").notNull().default("agent"), // marketer | agent | both
  referralCode: text("referral_code"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  adminNotes: text("admin_notes"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("agent_apps_status_idx").on(table.status),
  index("agent_apps_email_idx").on(table.email),
  index("agent_apps_created_idx").on(table.createdAt),
]);

export type AgentApplication = typeof agentApplications.$inferSelect;

// ════════════════════════════════════════════════════════════
// 32. ACCOUNT_APPLICATIONS — طلبات فتح حسابات
// ════════════════════════════════════════════════════════════
export const accountApplications = pgTable("account_applications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  fullName: text("full_name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  bio: text("bio"),
  accountReferralCode: text("account_referral_code"),
  status: text("status").notNull().default("pending"), // pending | approved | rejected
  adminNotes: text("admin_notes"),
  reviewedBy: varchar("reviewed_by"),
  reviewedAt: timestamp("reviewed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("account_apps_status_idx").on(table.status),
  index("account_apps_created_idx").on(table.createdAt),
]);

export type AccountApplication = typeof accountApplications.$inferSelect;

// ════════════════════════════════════════════════════════════
// 33. NOTIFICATION_PREFERENCES — تفضيلات الإشعارات
// ════════════════════════════════════════════════════════════
export const notificationPreferences = pgTable("notification_preferences", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().unique(),
  messages: boolean("messages").notNull().default(true),
  calls: boolean("calls").notNull().default(true),
  friendRequests: boolean("friend_requests").notNull().default(true),
  gifts: boolean("gifts").notNull().default(true),
  streams: boolean("streams").notNull().default(true),
  systemUpdates: boolean("system_updates").notNull().default(true),
  marketing: boolean("marketing").notNull().default(false),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("notif_prefs_user_idx").on(table.userId),
]);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;

// ════════════════════════════════════════════════════════════
// 34. WITHDRAWAL_REQUESTS — طلبات سحب الأموال
// ════════════════════════════════════════════════════════════
export const withdrawalRequests = pgTable("withdrawal_requests", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull(),
  amount: integer("amount").notNull(), // in coins
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }),
  paymentMethodId: varchar("payment_method_id"),
  paymentDetails: text("payment_details"), // JSON with user's payment info
  status: text("status").notNull().default("pending"), // pending | processing | completed | rejected
  adminNotes: text("admin_notes"),
  processedBy: varchar("processed_by"),
  processedAt: timestamp("processed_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("withdrawal_user_idx").on(table.userId),
  index("withdrawal_status_idx").on(table.status),
  index("withdrawal_created_idx").on(table.createdAt),
]);

export type WithdrawalRequest = typeof withdrawalRequests.$inferSelect;

// ════════════════════════════════════════════════════════════
// 35. STREAM_VIEWERS — مشاهدي البث المباشر
// ════════════════════════════════════════════════════════════
export const streamViewers = pgTable("stream_viewers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: varchar("stream_id").notNull(),
  userId: varchar("user_id").notNull(),
  role: text("role").notNull().default("viewer"), // viewer | speaker | moderator | host
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  leftAt: timestamp("left_at"),
}, (table) => [
  index("stream_viewers_stream_idx").on(table.streamId),
  index("stream_viewers_user_idx").on(table.userId),
]);

export type StreamViewer = typeof streamViewers.$inferSelect;

// ═══ Additional Validation Schemas ═══

export const sendGiftSchema = z.object({
  giftId: z.string().min(1).max(100),
  receiverId: z.string().min(1).max(100),
  streamId: z.string().max(100).optional(),
  quantity: z.number().int().positive().max(100).default(1),
});

export const createStreamSchema = z.object({
  title: z.string().min(1).max(200),
  type: z.enum(["live", "audio"]).default("live"),
  tags: z.string().max(500).optional(),
});

export const withdrawalRequestSchema = z.object({
  amount: z.number().int().positive(),
  paymentMethodId: z.string().max(100).optional(),
  paymentDetails: z.string().max(2000).optional(),
});

export const updateNotificationPrefsSchema = z.object({
  messages: z.boolean().optional(),
  calls: z.boolean().optional(),
  friendRequests: z.boolean().optional(),
  gifts: z.boolean().optional(),
  streams: z.boolean().optional(),
  systemUpdates: z.boolean().optional(),
  marketing: z.boolean().optional(),
});
