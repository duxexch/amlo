/**
 * Admin Panel API Client
 * Centralized API calls with typed responses and error handling.
 */

const BASE = "/api/admin";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

class AdminApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AdminApiError";
  }
}

const REQUEST_TIMEOUT_MS = 15_000;

async function request<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<ApiResponse<T>> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${BASE}${endpoint}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...options.headers,
      },
      credentials: "include",
      signal: controller.signal,
    });

    const json = await res.json();

    if (!res.ok) {
      throw new AdminApiError(
        json.message || `خطأ ${res.status}`,
        res.status,
      );
    }

    return json;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AdminApiError("انتهت مهلة الطلب", 408);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Auth ──────────────────────────────────────────────────

export const adminAuth = {
  login: (username: string, password: string) =>
    request("/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),

  logout: () =>
    request("/auth/logout", { method: "POST" }),

  me: () =>
    request<{
      id: string;
      username: string;
      displayName: string;
      role: string;
      avatar: string | null;
    }>("/auth/me"),
};

// ── Dashboard ────────────────────────────────────────────

export const adminStats = {
  get: () => request<any>("/stats"),
};

// ── Users ────────────────────────────────────────────────

export interface UserFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  country?: string;
  banned?: string;
  verified?: string;
  sortBy?: string;
  sortDir?: string;
}

export const adminUsers = {
  list: (filters: UserFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return request<any[]>(`/users?${params}`);
  },

  get: (id: string) => request<any>(`/users/${id}`),

  update: (id: string, data: Record<string, any>) =>
    request(`/users/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  ban: (id: string, reason?: string) =>
    request(`/users/${id}/ban`, {
      method: "POST",
      body: JSON.stringify({ reason }),
    }),

  unban: (id: string) =>
    request(`/users/${id}/unban`, { method: "POST" }),

  getUpgradeRequests: (id: string) =>
    request<any[]>(`/users/${id}/upgrade-requests`),

  setLevel: (id: string, level: number) =>
    request(`/users/${id}/set-level`, {
      method: "POST",
      body: JSON.stringify({ level }),
    }),
};

// ── Upgrade Requests ────────────────────────────────────

export interface UpgradeRequestFilters {
  page?: number;
  limit?: number;
  status?: string;
  userId?: string;
}

export const adminUpgradeRequests = {
  list: (filters: UpgradeRequestFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return request<any[]>(`/upgrade-requests?${params}`);
  },

  pendingCount: () =>
    request<{ count: number }>("/upgrade-requests/pending-count"),

  review: (id: string, status: "approved" | "rejected", adminNotes?: string) =>
    request(`/upgrade-requests/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ status, adminNotes }),
    }),
};

// ── Agents ───────────────────────────────────────────────

export interface AgentFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export const adminAgents = {
  list: (filters: AgentFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return request<any[]>(`/agents?${params}`);
  },

  get: (id: string) => request<any>(`/agents/${id}`),

  create: (data: Record<string, any>) =>
    request("/agents", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Record<string, any>) =>
    request(`/agents/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request(`/agents/${id}`, { method: "DELETE" }),

  releaseBalance: (id: string, amount: number) =>
    request(`/agents/${id}/release-balance`, {
      method: "POST",
      body: JSON.stringify({ amount }),
    }),

  upgradeToAccount: (id: string, data: Record<string, any>) =>
    request(`/agents/${id}/upgrade-account`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── Agent Accounts (حسابات الوكلاء) ─────────────────────

export interface AgentAccountFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  type?: string;
}

export const adminAgentAccounts = {
  list: (filters: AgentAccountFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return request<any[]>(`/agent-accounts?${params}`);
  },

  create: (data: Record<string, any>) =>
    request("/agent-accounts", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, any>) =>
    request(`/agent-accounts/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  delete: (id: string) =>
    request(`/agent-accounts/${id}`, { method: "DELETE" }),

  approve: (id: string) =>
    request(`/agent-accounts/${id}/approve`, { method: "POST" }),

  upgradeToVip: (id: string, data: Record<string, any>) =>
    request(`/agent-accounts/${id}/upgrade-vip`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
};

// ── VIP Agents (الوكلاء المميزين) ────────────────────────

export interface VipAgentFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export const adminVipAgents = {
  list: (filters: VipAgentFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return request<any[]>(`/vip-agents?${params}`);
  },

  create: (data: Record<string, any>) =>
    request("/vip-agents", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, any>) =>
    request(`/vip-agents/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  delete: (id: string) =>
    request(`/vip-agents/${id}`, { method: "DELETE" }),

  releaseBalance: (id: string, amount: number) =>
    request(`/vip-agents/${id}/release-balance`, { method: "POST", body: JSON.stringify({ amount }) }),
};

// ── Agent Applications (طلبات الانضمام كوكيل) ───────────

export interface AgentApplicationFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}

export const adminAgentApplications = {
  list: (filters: AgentApplicationFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return request<any[]>(`/agent-applications?${params}`);
  },

  update: (id: string, data: Record<string, any>) =>
    request(`/agent-applications/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  delete: (id: string) =>
    request(`/agent-applications/${id}`, { method: "DELETE" }),
};

// ── Gifts ────────────────────────────────────────────────

export const adminGifts = {
  list: () => request<any[]>("/gifts"),

  create: (data: Record<string, any>) =>
    request("/gifts", {
      method: "POST",
      body: JSON.stringify(data),
    }),

  update: (id: string, data: Record<string, any>) =>
    request(`/gifts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  delete: (id: string) =>
    request(`/gifts/${id}`, { method: "DELETE" }),

  send: (giftId: string, userId: string, message?: string) =>
    request(`/gifts/${giftId}/send`, {
      method: "POST",
      body: JSON.stringify({ userId, message }),
    }),
};

// ── Transactions ─────────────────────────────────────────

export interface TransactionFilters {
  page?: number;
  limit?: number;
  type?: string;
  status?: string;
  search?: string;
}

export const adminTransactions = {
  list: (filters: TransactionFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return request<any[]>(`/transactions?${params}`);
  },

  get: (id: string) => request<any>(`/transactions/${id}`),

  update: (id: string, data: {
    status?: string;
    adminNotes?: string;
    rejectionReason?: string;
    amount?: number;
    description?: string;
  }) => request(`/transactions/${id}`, {
    method: "PATCH",
    body: JSON.stringify(data),
  }),
};

// ── Reports ──────────────────────────────────────────────

export interface ReportFilters {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
}

export const adminReports = {
  list: (filters: ReportFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return request<any[]>(`/reports?${params}`);
  },

  update: (id: string, data: { status: string; adminNotes?: string }) =>
    request(`/reports/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),
};

// ── Settings ─────────────────────────────────────────────

export const adminSettings = {
  list: () => request<any[]>("/settings"),

  update: (key: string, value: string) =>
    request("/settings", {
      method: "PATCH",
      body: JSON.stringify({ key, value }),
    }),

  // Advanced settings
  getAdvanced: () => request<any>("/settings/advanced"),

  updateSeo: (data: Record<string, any>) =>
    request("/settings/seo", { method: "PUT", body: JSON.stringify(data) }),

  updateAso: (data: Record<string, any>) =>
    request("/settings/aso", { method: "PUT", body: JSON.stringify(data) }),

  updateSocialLogin: (provider: string, data: Record<string, any>) =>
    request("/settings/social-login", { method: "PUT", body: JSON.stringify({ provider, ...data }) }),

  updateOtp: (data: Record<string, any>) =>
    request("/settings/otp", { method: "PUT", body: JSON.stringify(data) }),

  updateBranding: (data: Record<string, any>) =>
    request("/settings/branding", { method: "PUT", body: JSON.stringify(data) }),

  updateSeoTexts: (data: Record<string, any>) =>
    request("/settings/seo-texts", { method: "PUT", body: JSON.stringify(data) }),

  updatePolicies: (documentKey: string, data: Record<string, any>) =>
    request("/settings/policies", { method: "PUT", body: JSON.stringify({ documentKey, ...data }) }),
};

// ── Payment Methods ──────────────────────────────────────

export const adminPaymentMethods = {
  list: () => request<any[]>("/payment-methods"),

  create: (data: {
    name: string;
    nameAr: string;
    icon?: string;
    type: string;
    provider?: string;
    countries?: string[];
    minAmount?: number;
    maxAmount?: number;
    fee?: string;
    instructions?: string;
  }) => request("/payment-methods", { method: "POST", body: JSON.stringify(data) }),

  update: (id: string, data: Record<string, any>) =>
    request(`/payment-methods/${id}`, { method: "PATCH", body: JSON.stringify(data) }),

  delete: (id: string) =>
    request(`/payment-methods/${id}`, { method: "DELETE" }),
};

// ── Wallets ──────────────────────────────────────────────

export interface WalletFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  sortBy?: string;
  minBalance?: number;
}

export const adminWallets = {
  list: (filters: WalletFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return request<any[]>(`/wallets?${params}`);
  },

  get: (userId: string, filters: { page?: number; limit?: number; type?: string } = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return request<any>(`/wallets/${userId}?${params}`);
  },
};

// ── Logs ─────────────────────────────────────────────────

export const adminLogs = {
  list: (page = 1, limit = 20) =>
    request<any[]>(`/logs?page=${page}&limit=${limit}`),
};

// ── Fraud Detection (كشف الاحتيال) ──────────────────────

export interface FraudFilters {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
  severity?: string;
  category?: string;
}

export const adminFraud = {
  stats: () => request<any>("/fraud/stats"),

  list: (filters: FraudFilters = {}) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== undefined && v !== "") params.set(k, String(v));
    });
    return request<any[]>(`/fraud/alerts?${params}`);
  },

  get: (id: string) => request<any>(`/fraud/alerts/${id}`),

  update: (id: string, data: { status?: string; adminNotes?: string }) =>
    request(`/fraud/alerts/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  banUser: (id: string) =>
    request(`/fraud/alerts/${id}/ban-user`, { method: "POST" }),

  suspendAgent: (id: string) =>
    request(`/fraud/alerts/${id}/suspend-agent`, { method: "POST" }),
};

// ── Featured Streams (البثوث المميزة) ────────────────────

export const adminFeatured = {
  list: () => request<any[]>("/featured-streams"),

  add: (accountId: string, tags: string[] = []) =>
    request("/featured-streams", {
      method: "POST",
      body: JSON.stringify({ accountId, tags }),
    }),

  update: (id: string, data: Record<string, any>) =>
    request(`/featured-streams/${id}`, {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  remove: (id: string) =>
    request(`/featured-streams/${id}`, { method: "DELETE" }),

  reorder: (order: { id: string; sortOrder: number }[]) =>
    request("/featured-streams/reorder", {
      method: "PUT",
      body: JSON.stringify({ order }),
    }),
};

// ── Announcement Popup (الإشعار المنبثق) ─────────────────

export const adminAnnouncementPopup = {
  get: () => request<any>("/announcement-popup"),

  update: (data: {
    enabled?: boolean;
    imageUrl?: string;
    title?: string;
    subtitle?: string;
    buttons?: { label: string; url: string; style: "primary" | "secondary" }[];
    showOnce?: boolean;
    delaySeconds?: number;
  }) =>
    request("/announcement-popup", {
      method: "PUT",
      body: JSON.stringify(data),
    }),
};

// ══════════════════════════════════════════════════════════
// Chat & Broadcast Management (إدارة الشات والبث)
// ══════════════════════════════════════════════════════════

const chatReq = <T = any>(path: string, options?: RequestInit) =>
  request<T>(`/chat${path}`, options);

export const adminChatManagement = {
  // Overview
  getStats: () => chatReq<any>("/overview/stats"),
  getTrends: () => chatReq<any>("/overview/trends"),
  getTopChatters: () => chatReq<any>("/overview/top-chatters"),

  // Conversations
  getConversations: (page = 1, limit = 20, search = "") =>
    chatReq<any>(`/conversations?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}`),
  getConversationMessages: (id: string, page = 1) =>
    chatReq<any>(`/conversations/${id}/messages?page=${page}`),
  deleteConversation: (id: string) =>
    chatReq(`/conversations/${id}`, { method: "DELETE" }),

  // Messages
  getMessages: (page = 1, limit = 30, search = "", type = "") =>
    chatReq<any>(`/messages?page=${page}&limit=${limit}&search=${encodeURIComponent(search)}&type=${type}`),
  deleteMessage: (id: string) =>
    chatReq(`/messages/${id}`, { method: "DELETE" }),
  bulkDeleteMessages: (ids: string[]) =>
    chatReq("/messages/bulk-delete", { method: "POST", body: JSON.stringify({ ids }) }),

  // Calls
  getCalls: (page = 1, limit = 20, type = "", status = "") =>
    chatReq<any>(`/calls?page=${page}&limit=${limit}&type=${type}&status=${status}`),
  forceEndCall: (id: string) =>
    chatReq(`/calls/${id}/force-end`, { method: "POST" }),

  // Moderation
  getModerationSettings: () => chatReq<any>("/moderation/settings"),
  updateModerationSettings: (data: Record<string, any>) =>
    chatReq("/moderation/settings", { method: "PUT", body: JSON.stringify(data) }),
  getBannedWords: () => chatReq<string[]>("/moderation/banned-words"),
  addBannedWord: (word: string) =>
    chatReq("/moderation/banned-words", { method: "POST", body: JSON.stringify({ word }) }),
  removeBannedWord: (word: string) =>
    chatReq(`/moderation/banned-words/${encodeURIComponent(word)}`, { method: "DELETE" }),

  // Chat & Broadcast Settings
  getSettings: () => chatReq<any>("/settings"),
  updateSettings: (settings: { key: string; value: any }[]) =>
    chatReq("/settings", { method: "PUT", body: JSON.stringify({ settings }) }),

  // Live Streams
  getActiveStreams: () => chatReq<any>("/streams/active"),
  getStreamStats: () => chatReq<any>("/streams/stats"),
  forceEndStream: (id: string) =>
    chatReq(`/streams/${id}/end`, { method: "POST" }),

  // ── Chat Settings (Feature Toggles) ──
  getChatSettings: () => chatReq<Record<string, string>>("/settings/chat"),
  updateChatSetting: (key: string, value: string) =>
    chatReq("/settings/chat", { method: "PUT", body: JSON.stringify({ key, value }) }),

  // ── Message Reports ──
  getMessageReports: (page = 1, status = "all") =>
    chatReq<any>(`/message-reports?page=${page}&status=${status}`),
  getMessageReportStats: () => chatReq<any>("/message-reports/stats"),
  updateMessageReport: (id: string, status: string, adminNotes?: string) =>
    chatReq(`/message-reports/${id}`, { method: "PUT", body: JSON.stringify({ status, adminNotes }) }),

  // ── Chat Blocks ──
  getChatBlocks: (page = 1) => chatReq<any>(`/chat-blocks?page=${page}`),
  removeChatBlock: (id: string) =>
    chatReq(`/chat-blocks/${id}`, { method: "DELETE" }),
};
