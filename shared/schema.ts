import { sql, relations } from "drizzle-orm";
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
  unique,
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
    referredByAgent: varchar("referred_by_agent").references(() => agents.id, { onDelete: "set null" }),
    interests: text("interests"), // comma-separated interests e.g. "gaming,music,travel"
    canStream: boolean("can_stream").notNull().default(true),
    miles: integer("miles").notNull().default(0),
    totalWorldSessions: integer("total_world_sessions").notNull().default(0),
    // OAuth
    googleId: text("google_id"),
    facebookId: text("facebook_id"),
    appleId: text("apple_id"),
    // 2FA
    twoFactorSecret: text("two_factor_secret"),
    twoFactorEnabled: boolean("two_factor_enabled").notNull().default(false),
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
    senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    giftId: varchar("gift_id").notNull().references(() => gifts.id, { onDelete: "restrict" }),
    streamId: varchar("stream_id").references(() => streams.id, { onDelete: "set null" }),
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
}, (table) => [
  index("coin_packages_active_sort_idx").on(table.isActive, table.sortOrder),
]);

export type CoinPackage = typeof coinPackages.$inferSelect;

// ════════════════════════════════════════════════════════════
// 7. WALLET_TRANSACTIONS - سجل المعاملات المالية
// ════════════════════════════════════════════════════════════
export const walletTransactions = pgTable(
  "wallet_transactions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    title: text("title"),
    type: text("type").notNull().default("live"), // live | audio | video_call
    status: text("status").notNull().default("active"), // active | ended | banned | scheduled
    category: text("category"), // chat | gaming | music | education | sports | cooking | art | other
    viewerCount: integer("viewer_count").notNull().default(0),
    peakViewers: integer("peak_viewers").notNull().default(0),
    totalGifts: integer("total_gifts").notNull().default(0),
    tags: text("tags"),
    pinnedMessage: text("pinned_message"),
    recordingUrl: text("recording_url"),
    scheduledAt: timestamp("scheduled_at"), // null = live now, set = scheduled
    startedAt: timestamp("started_at").notNull().defaultNow(),
    endedAt: timestamp("ended_at"),
  },
  (table) => [
    index("streams_user_idx").on(table.userId),
    index("streams_status_idx").on(table.status),
    index("streams_started_idx").on(table.startedAt),
    index("streams_category_idx").on(table.category),
    index("streams_scheduled_idx").on(table.scheduledAt),
  ],
);

export type Stream = typeof streams.$inferSelect;

// ════════════════════════════════════════════════════════════
// 8b. STREAM_POLLS — استطلاعات البث المباشر
// ════════════════════════════════════════════════════════════
export const streamPolls = pgTable("stream_polls", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: varchar("stream_id").notNull().references(() => streams.id, { onDelete: "cascade" }),
  question: text("question").notNull(),
  options: text("options").notNull(), // JSON array: ["opt1","opt2","opt3"]
  votes: text("votes").notNull().default("{}"), // JSON: { "opt1": 5, "opt2": 3 }
  voterIds: text("voter_ids").notNull().default("[]"), // JSON array of user IDs who voted
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("stream_polls_stream_idx").on(table.streamId),
]);

export type StreamPoll = typeof streamPolls.$inferSelect;

// ════════════════════════════════════════════════════════════
// 8c. STREAM_BANNED_WORDS — الكلمات المحظورة في البث
// ════════════════════════════════════════════════════════════
export const streamBannedWords = pgTable("stream_banned_words", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: varchar("stream_id").notNull().references(() => streams.id, { onDelete: "cascade" }),
  word: text("word").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("stream_banned_words_stream_idx").on(table.streamId),
]);

// 8d. STREAM_MUTED_USERS — المستخدمين المكتومين في البث
export const streamMutedUsers = pgTable("stream_muted_users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: varchar("stream_id").notNull().references(() => streams.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  mutedBy: varchar("muted_by").notNull().references(() => users.id, { onDelete: "cascade" }),
  reason: text("reason"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("stream_muted_users_stream_idx").on(table.streamId),
  index("stream_muted_users_user_idx").on(table.userId),
]);

// ════════════════════════════════════════════════════════════
// 9. USER_REPORTS - بلاغات المستخدمين
// ════════════════════════════════════════════════════════════
export const userReports = pgTable(
  "user_reports",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    reportedId: varchar("reported_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    streamId: varchar("stream_id").references(() => streams.id, { onDelete: "set null" }),
    type: text("type").notNull(), // harassment | spam | inappropriate | scam | other
    reason: text("reason").notNull(),
    status: text("status").notNull().default("pending"), // pending | reviewed | resolved | dismissed
    adminNotes: text("admin_notes"),
    reviewedBy: varchar("reviewed_by").references(() => admins.id, { onDelete: "set null" }),
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
    followerId: varchar("follower_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    followingId: varchar("following_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("follows_follower_idx").on(table.followerId),
    index("follows_following_idx").on(table.followingId),
    unique("uq_user_follows").on(table.followerId, table.followingId),
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
    adminId: varchar("admin_id").notNull().references(() => admins.id, { onDelete: "cascade" }),
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
    senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    status: text("status").notNull().default("pending"), // pending | accepted | rejected | blocked
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("friendships_sender_idx").on(table.senderId),
    index("friendships_receiver_idx").on(table.receiverId),
    index("friendships_status_idx").on(table.status),
    unique("uq_friendships").on(table.senderId, table.receiverId),
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
    participant1Id: varchar("participant1_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    participant2Id: varchar("participant2_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
    index("conv_participants_idx").on(table.participant1Id, table.participant2Id),
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
    conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    content: text("content"),
    type: text("type").notNull().default("text"), // text | image | voice | gift | system
    mediaUrl: text("media_url"),
    giftId: varchar("gift_id").references(() => gifts.id, { onDelete: "set null" }),
    replyToId: varchar("reply_to_id"),
    isRead: boolean("is_read").notNull().default(false),
    readAt: timestamp("read_at"),
    isDeleted: boolean("is_deleted").notNull().default(false),
    hiddenFor: text("hidden_for").array().notNull().default(sql`'{}'::text[]`),
    coinsCost: integer("coins_cost").notNull().default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("msg_conv_idx").on(table.conversationId),
    index("msg_sender_idx").on(table.senderId),
    index("msg_created_idx").on(table.createdAt),
    index("msg_conv_created_idx").on(table.conversationId, table.createdAt),
  ],
);

export type Message = typeof messages.$inferSelect;

// ════════════════════════════════════════════════════════════
// 15b. MESSAGE REACTIONS - تفاعلات الرسائل (إيموجي)
// ════════════════════════════════════════════════════════════
export const messageReactions = pgTable(
  "message_reactions",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(), // e.g. "❤️", "😂", "👍"
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("reaction_msg_idx").on(table.messageId),
    index("reaction_user_idx").on(table.userId),
    unique("reaction_unique_idx").on(table.messageId, table.userId, table.emoji),
  ],
);

export type MessageReaction = typeof messageReactions.$inferSelect;

// ════════════════════════════════════════════════════════════
// 16. CALLS - سجل المكالمات (صوت + فيديو)
// ════════════════════════════════════════════════════════════
export const calls = pgTable(
  "calls",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    callerId: varchar("caller_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    receiverId: varchar("receiver_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
  replyToId: z.string().max(100).optional(),
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
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    matchedUserId: varchar("matched_user_id").references(() => users.id, { onDelete: "set null" }),
    genderFilter: text("gender_filter"), // male | female | both
    ageMin: integer("age_min").notNull().default(18),
    ageMax: integer("age_max").notNull().default(60),
    countryFilter: text("country_filter"),
    chatType: text("chat_type").notNull().default("text"), // text | voice | video
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
    sessionId: varchar("session_id").notNull().references(() => worldSessions.id, { onDelete: "cascade" }),
    senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    content: text("content"),
    type: text("type").notNull().default("text"), // text | image | voice | gift | system
    mediaUrl: text("media_url"),
    giftId: varchar("gift_id").references(() => gifts.id, { onDelete: "set null" }),
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
    blockerId: varchar("blocker_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    blockedId: varchar("blocked_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => [
    index("chat_blocks_blocker_idx").on(table.blockerId),
    index("chat_blocks_blocked_idx").on(table.blockedId),
    unique("uq_chat_blocks").on(table.blockerId, table.blockedId),
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
    reporterId: varchar("reporter_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    messageId: varchar("message_id").notNull().references(() => messages.id, { onDelete: "cascade" }),
    conversationId: varchar("conversation_id").notNull().references(() => conversations.id, { onDelete: "cascade" }),
    reportedUserId: varchar("reported_user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    category: text("category").notNull().default("other"), // harassment | spam | inappropriate | scam | threat | other
    reason: text("reason"),
    status: text("status").notNull().default("pending"), // pending | reviewed | resolved | dismissed
    adminNotes: text("admin_notes"),
    reviewedBy: varchar("reviewed_by").references(() => admins.id, { onDelete: "set null" }),
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
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    currentLevel: integer("current_level").notNull(),
    requestedLevel: integer("requested_level").notNull(),
    status: text("status").notNull().default("pending"), // pending | approved | rejected
    adminNotes: text("admin_notes"),
    reviewedBy: varchar("reviewed_by").references(() => admins.id, { onDelete: "set null" }),
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
  chatType: z.enum(["text", "voice", "video"]).default("text"),
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
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
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
    unique("uq_user_profiles").on(table.userId, table.profileIndex),
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
    userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }), // owner
    friendId: varchar("friend_id").notNull().references(() => users.id, { onDelete: "cascade" }), // friend who sees this profile
    visibleProfileIndex: integer("visible_profile_index").notNull().default(1), // 1 or 2
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("fpv_user_idx").on(table.userId),
    index("fpv_friend_idx").on(table.friendId),
    index("fpv_user_friend_idx").on(table.userId, table.friendId),
    unique("uq_friend_profile_vis").on(table.userId, table.friendId),
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
  streamId: varchar("stream_id").references(() => streams.id, { onDelete: "set null" }),
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
  userId: varchar("user_id").references(() => users.id, { onDelete: "set null" }),
  agentId: varchar("agent_id").references(() => agents.id, { onDelete: "set null" }),
  type: text("type").notNull(), // suspicious_login | unusual_transaction | multiple_accounts | rapid_gifting | bot_behavior
  severity: text("severity").notNull().default("medium"), // low | medium | high | critical
  description: text("description").notNull(),
  details: text("details"), // JSON with additional context
  status: text("status").notNull().default("pending"), // pending | investigating | resolved | dismissed
  adminNotes: text("admin_notes"),
  reviewedBy: varchar("reviewed_by").references(() => admins.id, { onDelete: "set null" }),
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
  userId: varchar("user_id").notNull().unique().references(() => users.id, { onDelete: "cascade" }),
  messages: boolean("messages").notNull().default(true),
  calls: boolean("calls").notNull().default(true),
  friendRequests: boolean("friend_requests").notNull().default(true),
  gifts: boolean("gifts").notNull().default(true),
  streams: boolean("streams").notNull().default(true),
  systemUpdates: boolean("system_updates").notNull().default(true),
  marketing: boolean("marketing").notNull().default(false),
  chatAutoTranslate: boolean("chat_auto_translate").notNull().default(true),
  chatShowOriginalText: boolean("chat_show_original_text").notNull().default(true),
  chatTranslateLang: text("chat_translate_lang").notNull().default("ar"),
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
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  amount: integer("amount").notNull(), // in coins
  amountUsd: numeric("amount_usd", { precision: 12, scale: 2 }),
  paymentMethodId: varchar("payment_method_id").references(() => paymentMethods.id, { onDelete: "set null" }),
  paymentDetails: text("payment_details"), // JSON with user's payment info
  status: text("status").notNull().default("pending"), // pending | processing | completed | rejected
  adminNotes: text("admin_notes"),
  processedBy: varchar("processed_by").references(() => admins.id, { onDelete: "set null" }),
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
  streamId: varchar("stream_id").notNull().references(() => streams.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("viewer"), // viewer | speaker | moderator | host
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  leftAt: timestamp("left_at"),
}, (table) => [
  index("stream_viewers_stream_idx").on(table.streamId),
  index("stream_viewers_user_idx").on(table.userId),
  unique("uq_stream_viewers").on(table.streamId, table.userId),
]);

export type StreamViewer = typeof streamViewers.$inferSelect;

// ════════════════════════════════════════════════════════════
// 36. USER_DAILY_MISSIONS — Daily missions claims + streaks
// ════════════════════════════════════════════════════════════
export const userDailyMissions = pgTable("user_daily_missions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  missionDate: date("mission_date").notNull(),
  streakCount: integer("streak_count").notNull().default(1),
  xpAwarded: integer("xp_awarded").notNull().default(0),
  coinsAwarded: integer("coins_awarded").notNull().default(0),
  metadata: text("metadata"),
  claimedAt: timestamp("claimed_at").notNull().defaultNow(),
}, (table) => [
  unique("uq_user_daily_missions_date").on(table.userId, table.missionDate),
  index("user_daily_missions_user_idx").on(table.userId),
  index("user_daily_missions_date_idx").on(table.missionDate),
]);

export type UserDailyMission = typeof userDailyMissions.$inferSelect;

// ════════════════════════════════════════════════════════════
// 37. STREAM_DIRECTOR_EVENTS — Smart Director interaction telemetry
// ════════════════════════════════════════════════════════════
export const streamDirectorEvents = pgTable("stream_director_events", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: varchar("stream_id").notNull().references(() => streams.id, { onDelete: "cascade" }),
  hostId: varchar("host_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tipId: text("tip_id").notNull(),
  action: text("action").notNull(), // shown | accepted | dismissed
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("stream_director_events_stream_idx").on(table.streamId),
  index("stream_director_events_host_idx").on(table.hostId),
  index("stream_director_events_created_idx").on(table.createdAt),
]);

export type StreamDirectorEvent = typeof streamDirectorEvents.$inferSelect;

// ════════════════════════════════════════════════════════════
// 38. STREAM_AUTO_CLIPS — Auto-generated clip markers from engagement peaks
// ════════════════════════════════════════════════════════════
export const streamAutoClips = pgTable("stream_auto_clips", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  streamId: varchar("stream_id").notNull().references(() => streams.id, { onDelete: "cascade" }),
  hostId: varchar("host_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  cueType: text("cue_type").notNull(), // chat_burst | gift_burst | viewer_spike | retention_recovery
  title: text("title").notNull(),
  reason: text("reason").notNull(),
  startOffsetSec: integer("start_offset_sec").notNull(),
  endOffsetSec: integer("end_offset_sec").notNull(),
  score: integer("score").notNull().default(0),
  metadata: text("metadata"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("stream_auto_clips_stream_idx").on(table.streamId),
  index("stream_auto_clips_host_idx").on(table.hostId),
  index("stream_auto_clips_created_idx").on(table.createdAt),
]);

export type StreamAutoClip = typeof streamAutoClips.$inferSelect;

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

export const updateChatTranslationPrefsSchema = z.object({
  chatAutoTranslate: z.boolean().optional(),
  chatShowOriginalText: z.boolean().optional(),
  chatTranslateLang: z.string().trim().min(2).max(20).optional(),
});

// ════════════════════════════════════════════════════════════
// DRIZZLE RELATIONS — العلاقات بين الجداول
// ════════════════════════════════════════════════════════════

export const usersRelations = relations(users, ({ one, many }) => ({
  agent: one(agents, { fields: [users.referredByAgent], references: [agents.id] }),
  profiles: many(userProfiles),
  notificationPrefs: one(notificationPreferences, { fields: [users.id], references: [notificationPreferences.userId] }),
  giftsSent: many(giftTransactions, { relationName: "giftSender" }),
  giftsReceived: many(giftTransactions, { relationName: "giftReceiver" }),
  walletTransactions: many(walletTransactions),
  streams: many(streams),
  friendshipsSent: many(friendships, { relationName: "friendSender" }),
  friendshipsReceived: many(friendships, { relationName: "friendReceiver" }),
  following: many(userFollows, { relationName: "follower" }),
  followers: many(userFollows, { relationName: "following" }),
  messagesSent: many(messages),
  callsMade: many(calls, { relationName: "caller" }),
  callsReceived: many(calls, { relationName: "receiver" }),
  worldSessions: many(worldSessions),
  blocksCreated: many(chatBlocks, { relationName: "blocker" }),
  upgradeRequests: many(upgradeRequests),
  withdrawalRequests: many(withdrawalRequests),
  reports: many(userReports, { relationName: "reporter" }),
}));

export const agentsRelations = relations(agents, ({ many }) => ({
  referredUsers: many(users),
  fraudAlerts: many(fraudAlerts),
}));

export const adminsRelations = relations(admins, ({ many }) => ({
  logs: many(adminLogs),
}));

export const giftsRelations = relations(gifts, ({ many }) => ({
  transactions: many(giftTransactions),
}));

export const giftTransactionsRelations = relations(giftTransactions, ({ one }) => ({
  sender: one(users, { fields: [giftTransactions.senderId], references: [users.id], relationName: "giftSender" }),
  receiver: one(users, { fields: [giftTransactions.receiverId], references: [users.id], relationName: "giftReceiver" }),
  gift: one(gifts, { fields: [giftTransactions.giftId], references: [gifts.id] }),
  stream: one(streams, { fields: [giftTransactions.streamId], references: [streams.id] }),
}));

export const walletTransactionsRelations = relations(walletTransactions, ({ one }) => ({
  user: one(users, { fields: [walletTransactions.userId], references: [users.id] }),
}));

export const streamsRelations = relations(streams, ({ one, many }) => ({
  user: one(users, { fields: [streams.userId], references: [users.id] }),
  polls: many(streamPolls),
  bannedWords: many(streamBannedWords),
  mutedUsers: many(streamMutedUsers),
  viewers: many(streamViewers),
  giftTransactions: many(giftTransactions),
}));

export const streamPollsRelations = relations(streamPolls, ({ one }) => ({
  stream: one(streams, { fields: [streamPolls.streamId], references: [streams.id] }),
}));

export const streamBannedWordsRelations = relations(streamBannedWords, ({ one }) => ({
  stream: one(streams, { fields: [streamBannedWords.streamId], references: [streams.id] }),
}));

export const streamMutedUsersRelations = relations(streamMutedUsers, ({ one }) => ({
  stream: one(streams, { fields: [streamMutedUsers.streamId], references: [streams.id] }),
  user: one(users, { fields: [streamMutedUsers.userId], references: [users.id] }),
}));

export const userReportsRelations = relations(userReports, ({ one }) => ({
  reporter: one(users, { fields: [userReports.reporterId], references: [users.id], relationName: "reporter" }),
  reported: one(users, { fields: [userReports.reportedId], references: [users.id] }),
  stream: one(streams, { fields: [userReports.streamId], references: [streams.id] }),
  reviewedByAdmin: one(admins, { fields: [userReports.reviewedBy], references: [admins.id] }),
}));

export const userFollowsRelations = relations(userFollows, ({ one }) => ({
  follower: one(users, { fields: [userFollows.followerId], references: [users.id], relationName: "follower" }),
  following: one(users, { fields: [userFollows.followingId], references: [users.id], relationName: "following" }),
}));

export const adminLogsRelations = relations(adminLogs, ({ one }) => ({
  admin: one(admins, { fields: [adminLogs.adminId], references: [admins.id] }),
}));

export const friendshipsRelations = relations(friendships, ({ one }) => ({
  sender: one(users, { fields: [friendships.senderId], references: [users.id], relationName: "friendSender" }),
  receiver: one(users, { fields: [friendships.receiverId], references: [users.id], relationName: "friendReceiver" }),
}));

export const conversationsRelations = relations(conversations, ({ one, many }) => ({
  participant1: one(users, { fields: [conversations.participant1Id], references: [users.id] }),
  participant2: one(users, { fields: [conversations.participant2Id], references: [users.id] }),
  messages: many(messages),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  conversation: one(conversations, { fields: [messages.conversationId], references: [conversations.id] }),
  sender: one(users, { fields: [messages.senderId], references: [users.id] }),
  gift: one(gifts, { fields: [messages.giftId], references: [gifts.id] }),
}));

export const callsRelations = relations(calls, ({ one }) => ({
  caller: one(users, { fields: [calls.callerId], references: [users.id], relationName: "caller" }),
  receiver: one(users, { fields: [calls.receiverId], references: [users.id], relationName: "receiver" }),
}));

export const worldSessionsRelations = relations(worldSessions, ({ one, many }) => ({
  user: one(users, { fields: [worldSessions.userId], references: [users.id] }),
  matchedUser: one(users, { fields: [worldSessions.matchedUserId], references: [users.id] }),
  messages: many(worldMessages),
}));

export const worldMessagesRelations = relations(worldMessages, ({ one }) => ({
  session: one(worldSessions, { fields: [worldMessages.sessionId], references: [worldSessions.id] }),
  sender: one(users, { fields: [worldMessages.senderId], references: [users.id] }),
  gift: one(gifts, { fields: [worldMessages.giftId], references: [gifts.id] }),
}));

export const chatBlocksRelations = relations(chatBlocks, ({ one }) => ({
  blocker: one(users, { fields: [chatBlocks.blockerId], references: [users.id], relationName: "blocker" }),
  blocked: one(users, { fields: [chatBlocks.blockedId], references: [users.id] }),
}));

export const messageReportsRelations = relations(messageReports, ({ one }) => ({
  reporter: one(users, { fields: [messageReports.reporterId], references: [users.id] }),
  message: one(messages, { fields: [messageReports.messageId], references: [messages.id] }),
  conversation: one(conversations, { fields: [messageReports.conversationId], references: [conversations.id] }),
  reportedUser: one(users, { fields: [messageReports.reportedUserId], references: [users.id] }),
  reviewedByAdmin: one(admins, { fields: [messageReports.reviewedBy], references: [admins.id] }),
}));

export const upgradeRequestsRelations = relations(upgradeRequests, ({ one }) => ({
  user: one(users, { fields: [upgradeRequests.userId], references: [users.id] }),
  reviewedByAdmin: one(admins, { fields: [upgradeRequests.reviewedBy], references: [admins.id] }),
}));

export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
  user: one(users, { fields: [userProfiles.userId], references: [users.id] }),
}));

export const friendProfileVisibilityRelations = relations(friendProfileVisibility, ({ one }) => ({
  user: one(users, { fields: [friendProfileVisibility.userId], references: [users.id] }),
  friend: one(users, { fields: [friendProfileVisibility.friendId], references: [users.id] }),
}));

export const fraudAlertsRelations = relations(fraudAlerts, ({ one }) => ({
  user: one(users, { fields: [fraudAlerts.userId], references: [users.id] }),
  agent: one(agents, { fields: [fraudAlerts.agentId], references: [agents.id] }),
  reviewedByAdmin: one(admins, { fields: [fraudAlerts.reviewedBy], references: [admins.id] }),
}));

export const notificationPreferencesRelations = relations(notificationPreferences, ({ one }) => ({
  user: one(users, { fields: [notificationPreferences.userId], references: [users.id] }),
}));

export const withdrawalRequestsRelations = relations(withdrawalRequests, ({ one }) => ({
  user: one(users, { fields: [withdrawalRequests.userId], references: [users.id] }),
  paymentMethod: one(paymentMethods, { fields: [withdrawalRequests.paymentMethodId], references: [paymentMethods.id] }),
  processedByAdmin: one(admins, { fields: [withdrawalRequests.processedBy], references: [admins.id] }),
}));

export const streamViewersRelations = relations(streamViewers, ({ one }) => ({
  stream: one(streams, { fields: [streamViewers.streamId], references: [streams.id] }),
  user: one(users, { fields: [streamViewers.userId], references: [users.id] }),
}));

// ════════════════════════════════════════════════════════════
// 36. STORIES — القصص / اللحظات (24 ساعة)
// ════════════════════════════════════════════════════════════
export const stories = pgTable("stories", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: text("type").notNull().default("image"), // image | video | text
  mediaUrl: text("media_url"),
  textContent: text("text_content"),
  bgColor: text("bg_color"), // for text stories
  caption: text("caption"),
  viewCount: integer("view_count").notNull().default(0),
  isActive: boolean("is_active").notNull().default(true),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("stories_user_idx").on(table.userId),
  index("stories_expires_idx").on(table.expiresAt),
  index("stories_active_idx").on(table.isActive),
]);

export type Story = typeof stories.$inferSelect;

// ════════════════════════════════════════════════════════════
// 37. STORY_VIEWS — مشاهدات القصص
// ════════════════════════════════════════════════════════════
export const storyViews = pgTable("story_views", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  storyId: varchar("story_id").notNull().references(() => stories.id, { onDelete: "cascade" }),
  viewerId: varchar("viewer_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  viewedAt: timestamp("viewed_at").notNull().defaultNow(),
}, (table) => [
  index("story_views_story_idx").on(table.storyId),
  index("story_views_viewer_idx").on(table.viewerId),
  unique("uq_story_views").on(table.storyId, table.viewerId),
]);

export type StoryView = typeof storyViews.$inferSelect;

// ════════════════════════════════════════════════════════════
// 38. GROUP_CONVERSATIONS — المحادثات الجماعية
// ════════════════════════════════════════════════════════════
export const groupConversations = pgTable("group_conversations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  avatar: text("avatar"),
  description: text("description"),
  creatorId: varchar("creator_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  maxMembers: integer("max_members").notNull().default(200),
  isActive: boolean("is_active").notNull().default(true),
  lastMessageAt: timestamp("last_message_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (table) => [
  index("group_conv_creator_idx").on(table.creatorId),
  index("group_conv_last_msg_idx").on(table.lastMessageAt),
]);

export type GroupConversation = typeof groupConversations.$inferSelect;

// ════════════════════════════════════════════════════════════
// 39. GROUP_MEMBERS — أعضاء المجموعة
// ════════════════════════════════════════════════════════════
export const groupMembers = pgTable("group_members", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groupConversations.id, { onDelete: "cascade" }),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: text("role").notNull().default("member"), // admin | moderator | member
  joinedAt: timestamp("joined_at").notNull().defaultNow(),
  mutedUntil: timestamp("muted_until"),
}, (table) => [
  index("group_members_group_idx").on(table.groupId),
  index("group_members_user_idx").on(table.userId),
  unique("uq_group_members").on(table.groupId, table.userId),
]);

export type GroupMember = typeof groupMembers.$inferSelect;

// ════════════════════════════════════════════════════════════
// 40. GROUP_MESSAGES — رسائل المجموعة
// ════════════════════════════════════════════════════════════
export const groupMessages = pgTable("group_messages", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  groupId: varchar("group_id").notNull().references(() => groupConversations.id, { onDelete: "cascade" }),
  senderId: varchar("sender_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  content: text("content"),
  type: text("type").notNull().default("text"), // text | image | voice | gift | system
  mediaUrl: text("media_url"),
  giftId: varchar("gift_id").references(() => gifts.id, { onDelete: "set null" }),
  isDeleted: boolean("is_deleted").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (table) => [
  index("group_msg_group_idx").on(table.groupId),
  index("group_msg_sender_idx").on(table.senderId),
  index("group_msg_created_idx").on(table.createdAt),
]);

export type GroupMessage = typeof groupMessages.$inferSelect;

// ── Stories + Groups Relations ──
export const storiesRelations = relations(stories, ({ one, many }) => ({
  user: one(users, { fields: [stories.userId], references: [users.id] }),
  views: many(storyViews),
}));

export const storyViewsRelations = relations(storyViews, ({ one }) => ({
  story: one(stories, { fields: [storyViews.storyId], references: [stories.id] }),
  viewer: one(users, { fields: [storyViews.viewerId], references: [users.id] }),
}));

export const groupConversationsRelations = relations(groupConversations, ({ one, many }) => ({
  creator: one(users, { fields: [groupConversations.creatorId], references: [users.id] }),
  members: many(groupMembers),
  messages: many(groupMessages),
}));

export const groupMembersRelations = relations(groupMembers, ({ one }) => ({
  group: one(groupConversations, { fields: [groupMembers.groupId], references: [groupConversations.id] }),
  user: one(users, { fields: [groupMembers.userId], references: [users.id] }),
}));

export const groupMessagesRelations = relations(groupMessages, ({ one }) => ({
  group: one(groupConversations, { fields: [groupMessages.groupId], references: [groupConversations.id] }),
  sender: one(users, { fields: [groupMessages.senderId], references: [users.id] }),
  gift: one(gifts, { fields: [groupMessages.giftId], references: [gifts.id] }),
}));

// ── Stories Schemas ──
export const createStorySchema = z.object({
  type: z.enum(["image", "video", "text"]).default("image"),
  mediaUrl: z.string().url().max(2048).optional(),
  textContent: z.string().max(500).optional(),
  bgColor: z.string().max(20).optional(),
  caption: z.string().max(500).optional(),
});

// ── Group Chat Schemas ──
export const createGroupSchema = z.object({
  name: z.string().min(1).max(100).trim(),
  description: z.string().max(500).optional(),
  avatar: z.string().max(2048).optional(),
  memberIds: z.array(z.string().max(100)).min(1).max(199),
});

export const sendGroupMessageSchema = z.object({
  content: z.string().min(1).max(5000).optional(),
  type: z.enum(["text", "image", "voice", "gift"]).default("text"),
  mediaUrl: z.string().url().max(2048).optional(),
  giftId: z.string().max(100).optional(),
});
