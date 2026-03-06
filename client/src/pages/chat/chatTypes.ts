/**
 * Chat TypeScript Interfaces — أنواع الدردشة
 * ════════════════════════════════════════════
 */

// ── User types ──
export interface ChatUser {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string | null;
  level?: number;
  isVerified?: boolean;
  status?: string;
  isOnline?: boolean;
}

// ── Message types ──
export type MessageType = "text" | "image" | "voice" | "gift" | "system";

export interface ChatMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string | null;
  type: MessageType;
  mediaUrl?: string | null;
  giftId?: string | null;
  isRead: boolean;
  readAt?: string | null;
  isDeleted: boolean;
  coinsCost: number;
  createdAt: string;
  isEncrypted?: boolean;
  /** Reply-to reference */
  replyToId?: string | null;
  replyToContent?: string | null;
  replyToSenderName?: string | null;
  /** Optimistic send marker */
  _pending?: boolean;
  /** Failed send marker (for retry) */
  _failed?: boolean;
  /** Delivery confirmation */
  _delivered?: boolean;
}

// ── Conversation types ──
export interface Conversation {
  id: string;
  otherUser?: ChatUser;
  isOnline?: boolean;
  lastSeen?: string | null;
  unreadCount: number;
  lastMessage?: ChatMessage | null;
  lastMessageAt?: string | null;
}

// ── Block status ──
export interface BlockStatus {
  isBlocked: boolean;
  blockedByMe: boolean;
  blockedByThem: boolean;
}

// ── Chat settings (from API) ──
export interface ChatSettings {
  chat_media_enabled: boolean;
  chat_voice_call_enabled: boolean;
  chat_video_call_enabled: boolean;
  chat_time_limit: number;
  message_cost: number;
  voice_call_rate: number;
  video_call_rate: number;
}

// ── Report ──
export type ReportCategory = "harassment" | "spam" | "inappropriate" | "scam" | "threat" | "other";

export interface ReportData {
  messageId: string;
  conversationId: string;
  reportedUserId: string;
  category: ReportCategory;
  reason?: string;
}

// ── View mode ──
export type ViewMode = "list" | "chat";

// ── Socket event payloads ──
export interface NewMessagePayload {
  message: ChatMessage;
  conversationId: string;
  sender: ChatUser;
}

export interface TypingPayload {
  conversationId: string;
  userId: string;
}

export interface MessagesReadPayload {
  conversationId: string;
  readerId?: string;
}

export interface ChatBlockedPayload {
  blockerId: string;
}

// ════════════════════════════════════════
// Admin Chat Types
// ════════════════════════════════════════

export interface AdminConversation {
  id: string;
  participant1: ChatUser;
  participant2: ChatUser;
  messageCount: number;
  lastMessageAt?: string | null;
  isActive: boolean;
}

export interface AdminMessage {
  id: string;
  conversationId: string;
  senderId: string;
  senderName?: string;
  content: string | null;
  type: MessageType;
  mediaUrl?: string | null;
  coinsCost: number;
  isDeleted: boolean;
  isRead: boolean;
  createdAt: string;
}

export interface AdminCall {
  id: string;
  caller: ChatUser;
  receiver: ChatUser;
  type: "voice" | "video";
  status: "ringing" | "active" | "ended" | "missed" | "rejected" | "busy";
  durationSeconds: number;
  coinsCharged: number;
  coinRate: number;
  startedAt?: string | null;
  endedAt?: string | null;
  createdAt: string;
}

export interface AdminStream {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  title: string;
  viewers: number;
  peakViewers: number;
  duration: number;
  giftsReceived: number;
  coinsEarned: number;
  status: string;
  startedAt?: string | null;
}

export interface ChatOverviewStats {
  totalConversations: number;
  totalMessages: number;
  totalCalls: number;
  totalCallRevenue: number;
  totalMessageRevenue: number;
  messagesToday: number;
  callRevenueToday: number;
  messageRevenueToday: number;
  onlineUsers: number;
  voiceCalls: number;
  videoCalls: number;
  avgCallDuration: number;
  avgMessagesPerConv: number;
  activeChatsNow: number;
  activeCallsNow: number;
  textMessages: number;
  imageMessages: number;
  voiceMessages: number;
  giftMessages: number;
}

export interface TrendDay {
  date: string;
  messages: number;
  calls: number;
  revenue: number;
}

export interface TopChatter {
  userId: string;
  username: string;
  displayName: string;
  avatar?: string | null;
  messageCount: number;
  callCount: number;
  totalSpent: number;
}

export interface ModerationSettings {
  bannedWords: string[];
  autoDelete: boolean;
  maxMessageLength: number;
  maxMessagesPerMinute: number;
  allowImages: boolean;
  allowVoice: boolean;
  allowGifts: boolean;
  maxCallDuration: number;
  minLevelToChat: number;
  minLevelToCall: number;
  minLevelToStream: number;
  maxConcurrentStreams: number;
  streamMaxViewers: number;
  chatCooldown: number;
  enableProfanityFilter: boolean;
  enableSpamDetection: boolean;
  autoMuteSpammers: boolean;
  spamThreshold: number;
}

export interface AdminChatSettings {
  voice_call_rate: number;
  video_call_rate: number;
  message_cost: number;
  max_message_length: number;
  chat_cooldown: number;
  max_call_duration: number;
  min_level_chat: number;
  min_level_call: number;
  min_level_stream: number;
  max_concurrent_streams: number;
  stream_max_viewers: number;
  allow_images: boolean;
  allow_voice: boolean;
  allow_gifts: boolean;
  enable_profanity_filter: boolean;
  enable_spam_detection: boolean;
  video_streaming_enabled: boolean;
  audio_streaming_enabled: boolean;
  [key: string]: string | number | boolean;
}

export interface StreamStats {
  activeNow: number;
  totalViewers: number;
  totalToday: number;
  avgDuration: number;
  avgViewers: number;
  totalGiftsToday: number;
  totalRevenueToday: number;
  peakConcurrent: number;
  topCategories: { name: string; count: number; viewers: number }[];
}

export interface StreamTelemetry {
  joins: number;
  leaves: number;
  chatMessages: number;
  chatMutedBlocked: number;
  chatBannedWordBlocked: number;
  giftsRateLimited: number;
  giftsSocketRejected: number;
  speakerInvites: number;
  speakerAccepts: number;
  speakerRejects: number;
  timestamp: string;
}

export interface StreamAlertConfig {
  giftsRateLimited: number;
  chatBannedWordBlocked: number;
  chatMutedBlocked: number;
  giftsSocketRejected: number;
  joinImbalanceOffset: number;
  cooldownMinutes: number;
}

export interface StreamAlertItem {
  id: string;
  level: "high" | "medium" | "low";
  title: string;
  detail: string;
  value: number;
  threshold: number;
}

export interface StreamAlertHistoryEntry {
  id: string;
  level: "high" | "medium" | "low";
  title: string;
  lastDetail: string;
  hits: number;
  firstSeenAt: string;
  lastSeenAt: string;
  isActive: boolean;
}

export interface StreamAlertStatus {
  activeAlerts: StreamAlertItem[];
  history: StreamAlertHistoryEntry[];
  summary?: {
    total: number;
    active: number;
    resolved: number;
    high: number;
    medium: number;
    low: number;
  };
  generatedAt: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface MessageReport {
  id: string;
  reporterId: string;
  messageId: string;
  conversationId: string;
  reportedUserId: string;
  category: string;
  reason?: string;
  status: "pending" | "reviewed" | "resolved" | "dismissed";
  adminNotes?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  createdAt: string;
  reporter?: ChatUser;
  reportedUser?: ChatUser;
  message?: AdminMessage | null;
  messageContent?: string;
}

export interface ReportStats {
  pending: number;
  reviewed: number;
  resolved: number;
  dismissed: number;
  total: number;
}

export interface ChatBlock {
  id: string;
  blockerId: string;
  blockedId: string;
  blocker?: ChatUser;
  blocked?: ChatUser;
  createdAt: string;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface WhitelistUser {
  id: string;
  username: string;
  displayName?: string;
  avatar?: string | null;
  level?: number;
  canStream?: boolean;
}
