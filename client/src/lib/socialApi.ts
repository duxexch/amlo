/**
 * Social API client — Friends, Chat, Calls, Blocks, Reports
 */

const API_BASE = "/api/social";

const REQUEST_TIMEOUT_MS = 15_000;
const RESUMABLE_UPLOAD_THRESHOLD_BYTES = 8 * 1024 * 1024;

type UploadProgress = {
  percent: number;
  uploadedBytes: number;
  totalBytes: number;
  stage: "uploading" | "finalizing" | "completed";
};

type UploadProgressHandler = (progress: UploadProgress) => void;

function isAbortError(err: unknown): boolean {
  return err instanceof DOMException
    ? err.name === "AbortError"
    : String((err as any)?.name || "").toLowerCase() === "aborterror";
}

async function uploadMediaSimple(
  file: File | Blob,
  filename?: string,
  onProgress?: UploadProgressHandler,
  signal?: AbortSignal,
): Promise<string> {
  const total = Number((file as any)?.size || 0) || 0;
  if (onProgress) {
    onProgress({ percent: total > 0 ? 10 : 0, uploadedBytes: 0, totalBytes: total, stage: "uploading" });
  }
  const formData = new FormData();
  formData.append("file", file, filename || (file instanceof File ? file.name : "recording.webm"));
  const res = await fetch("/api/v1/upload/media", {
    method: "POST",
    credentials: "include",
    body: formData,
    signal,
  });
  const json = await res.json();
  if (!res.ok || !json.success) throw new Error(json.message || "Upload failed");
  if (onProgress) {
    onProgress({ percent: 100, uploadedBytes: total || Number(json?.data?.size || 0), totalBytes: total || Number(json?.data?.size || 0), stage: "completed" });
  }
  return json.data.url as string;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function abortResumableUpload(uploadId: string): Promise<void> {
  try {
    await fetch(`/api/v1/upload/media/chunk/${encodeURIComponent(uploadId)}`, {
      method: "DELETE",
      credentials: "include",
    });
  } catch {
    // Ignore abort failures.
  }
}

async function uploadMediaResumable(file: File, onProgress?: UploadProgressHandler, signal?: AbortSignal): Promise<string> {
  const initRes = await fetch("/api/v1/upload/media/chunk/init", {
    method: "POST",
    credentials: "include",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      filename: file.name || `upload-${Date.now()}.bin`,
      mimetype: file.type || "application/octet-stream",
      totalSize: file.size,
    }),
    signal,
  });

  const initJson = await initRes.json();
  if (!initRes.ok || !initJson.success || !initJson.data?.uploadId || !initJson.data?.chunkSize || !initJson.data?.totalChunks) {
    throw new Error(initJson?.message || "Resumable init failed");
  }

  const uploadId = String(initJson.data.uploadId);
  const chunkSize = Number(initJson.data.chunkSize) || 1024 * 1024;
  const totalChunks = Number(initJson.data.totalChunks) || Math.ceil(file.size / chunkSize);
  const uploaded = new Set<number>((initJson.data.uploadedChunks || []).map((n: any) => Number(n)).filter((n: number) => Number.isInteger(n) && n >= 0));

  try {
    if (onProgress) {
      const uploadedBytes = Math.min(file.size, uploaded.size * chunkSize);
      const percent = Math.max(0, Math.min(95, Math.round((uploadedBytes / Math.max(file.size, 1)) * 100)));
      onProgress({ percent, uploadedBytes, totalBytes: file.size, stage: "uploading" });
    }

    for (let index = 0; index < totalChunks; index++) {
      if (uploaded.has(index)) continue;

      const start = index * chunkSize;
      const end = Math.min(file.size, start + chunkSize);
      const chunk = file.slice(start, end);

      let sent = false;
      let lastErr: any = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          const fd = new FormData();
          fd.append("index", String(index));
          fd.append("chunk", chunk, `chunk-${index}.part`);

          const chunkRes = await fetch(`/api/v1/upload/media/chunk/${encodeURIComponent(uploadId)}`, {
            method: "POST",
            credentials: "include",
            body: fd,
            signal,
          });
          const chunkJson = await chunkRes.json();
          if (!chunkRes.ok || !chunkJson.success) {
            throw new Error(chunkJson?.message || "Chunk upload failed");
          }
          sent = true;

          const uploadedBytes = Math.min(file.size, (index + 1) * chunkSize);
          if (onProgress) {
            const percent = Math.max(0, Math.min(95, Math.round((uploadedBytes / Math.max(file.size, 1)) * 100)));
            onProgress({ percent, uploadedBytes, totalBytes: file.size, stage: "uploading" });
          }
          break;
        } catch (err: any) {
          lastErr = err;
          if (attempt < 3) await sleep(350 * attempt);
        }
      }

      if (!sent) {
        throw lastErr || new Error("Chunk upload failed");
      }
    }

    if (onProgress) {
      onProgress({ percent: 97, uploadedBytes: file.size, totalBytes: file.size, stage: "finalizing" });
    }

    const doneRes = await fetch(`/api/v1/upload/media/chunk/${encodeURIComponent(uploadId)}/complete`, {
      method: "POST",
      credentials: "include",
      signal,
    });
    const doneJson = await doneRes.json();
    if (!doneRes.ok || !doneJson.success) {
      throw new Error(doneJson?.message || "Resumable complete failed");
    }
    if (onProgress) {
      onProgress({ percent: 100, uploadedBytes: file.size, totalBytes: file.size, stage: "completed" });
    }
    return doneJson.data.url as string;
  } catch (err) {
    await abortResumableUpload(uploadId);
    throw err;
  }
}

/** Upload a media file (image/video/voice) for chat */
export async function uploadMedia(
  file: File | Blob,
  filename?: string,
  onProgress?: UploadProgressHandler,
  signal?: AbortSignal,
): Promise<string> {
  const effectiveFile = file instanceof File
    ? file
    : (typeof File !== "undefined" ? new File([file], filename || "recording.webm", { type: file.type || "application/octet-stream" }) : null);

  // Use resumable flow for large files; fallback keeps legacy behavior intact.
  if (effectiveFile && effectiveFile.size >= RESUMABLE_UPLOAD_THRESHOLD_BYTES) {
    try {
      return await uploadMediaResumable(effectiveFile, onProgress, signal);
    } catch (err) {
      if (isAbortError(err)) throw err;
      return uploadMediaSimple(file, filename, onProgress, signal);
    }
  }

  return uploadMediaSimple(file, filename, onProgress, signal);
}

async function request<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${API_BASE}${path}`, {
      credentials: "include",
      headers: { "Content-Type": "application/json", ...init?.headers },
      signal: controller.signal,
      ...init,
    });
    const json = await res.json();
    if (!res.ok) throw { status: res.status, ...json };
    return json.data;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw { status: 408, success: false, message: "انتهت مهلة الطلب" };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Friends ──
export const friendsApi = {
  list: (page = 1, limit = 50) => request<any[]>(`/friends?page=${page}&limit=${limit}`),
  requests: (page = 1, limit = 30) => request<any[]>(`/friends/requests?page=${page}&limit=${limit}`),
  sent: () => request<any[]>("/friends/sent"),
  sendRequest: (receiverId: string) =>
    request("/friends/request", { method: "POST", body: JSON.stringify({ receiverId }) }),
  accept: (id: string) =>
    request(`/friends/${id}/accept`, { method: "POST" }),
  reject: (id: string) =>
    request(`/friends/${id}/reject`, { method: "POST" }),
  remove: (id: string) =>
    request(`/friends/${id}`, { method: "DELETE" }),
  block: (userId: string) =>
    request(`/friends/${userId}/block`, { method: "POST" }),
  searchUsers: (q: string) =>
    request<any[]>(`/users/search?q=${encodeURIComponent(q)}`),
};

// ── Chat ──
export const chatApi = {
  conversations: () => request<any[]>("/conversations"),
  createConversation: (receiverId: string) =>
    request("/conversations", { method: "POST", body: JSON.stringify({ receiverId }) }),
  messages: (conversationId: string, page = 1) =>
    request<any[]>(`/conversations/${conversationId}/messages?page=${page}`),
  messagesCursor: (conversationId: string, cursor?: string, limit = 50) => {
    const params = new URLSearchParams({ limit: String(limit) });
    if (cursor) params.set("cursor", cursor);
    return request<{ messages: any[]; nextCursor: string | null; hasMore: boolean }>(
      `/conversations/${conversationId}/messages?${params.toString()}`,
    );
  },
  sendMessage: (conversationId: string, data: {
    content?: string;
    type?: string;
    clientMessageId?: string;
    mediaUrl?: string;
    giftId?: string;
  }) =>
    request(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteMessage: (id: string, mode: "forMe" | "forEveryone" = "forEveryone") =>
    request(`/messages/${id}?mode=${mode}`, { method: "DELETE" }),
  bulkDelete: (messageIds: string[]) =>
    request<{ deletedCount: number }>("/messages/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ messageIds }),
    }),
  toggleReaction: (messageId: string, emoji: string) =>
    request(`/messages/${messageId}/reactions`, { method: "POST", body: JSON.stringify({ emoji }) }),
  getReactions: (messageId: string) =>
    request<any[]>(`/messages/${messageId}/reactions`),
  getBatchReactions: (messageIds: string[]) =>
    request<Record<string, Array<{ emoji: string; userId: string; username?: string; isMine?: boolean }>>>(
      "/messages/reactions/batch",
      { method: "POST", body: JSON.stringify({ messageIds }) },
    ),
  unreadCount: () => request<{ unread: number; friendRequests: number }>("/unread-count"),
  metrics: () => request<{
    sentTotal: number;
    sendErrors: number;
    avgSendLatencyMs: number;
    fetchTotal: number;
    fetchErrors: number;
    avgFetchLatencyMs: number;
    timestamp: string;
  }>("/chat/metrics"),
  settings: () => request<{
    chat_media_enabled: boolean;
    chat_voice_call_enabled: boolean;
    chat_video_call_enabled: boolean;
    chat_time_limit: number;
    message_cost: number;
    voice_call_rate: number;
    video_call_rate: number;
  }>("/chat/settings"),
};

// ── Chat Blocks ──
export const chatBlocksApi = {
  block: (userId: string) =>
    request(`/chat/block/${userId}`, { method: "POST" }),
  unblock: (userId: string) =>
    request(`/chat/block/${userId}`, { method: "DELETE" }),
  list: () => request<any[]>("/chat/blocked"),
  status: (userId: string) =>
    request<{ isBlocked: boolean; blockedByMe: boolean; blockedByThem: boolean }>(`/chat/block-status/${userId}`),
};

// ── Message Reports ──
export const messageReportsApi = {
  report: (data: {
    messageId: string;
    conversationId: string;
    reportedUserId: string;
    category?: string;
    reason?: string;
  }) =>
    request("/messages/report", { method: "POST", body: JSON.stringify(data) }),
};

// ── Calls ──
export const callsApi = {
  initiate: (receiverId: string, type: "voice" | "video") =>
    request("/calls", { method: "POST", body: JSON.stringify({ receiverId, type }) }),
  answer: (callId: string) =>
    request(`/calls/${callId}/answer`, { method: "POST" }),
  reject: (callId: string) =>
    request(`/calls/${callId}/reject`, { method: "POST" }),
  end: (callId: string) =>
    request(`/calls/${callId}/end`, { method: "POST" }),
  history: (page = 1) => request<any[]>(`/calls/history?page=${page}`),
  pricing: () => request<any>("/pricing/all"),
};

// ── Wallet ──
export const walletApi = {
  balance: () => request<{ coins: number; diamonds: number; miles: number }>("/wallet/balance"),
  transactions: (page = 1, type?: string) => {
    const params = new URLSearchParams({ page: String(page) });
    if (type) params.set("type", type);
    return request<any[]>(`/wallet/transactions?${params}`);
  },
  income: () => request<{ totalReceived: number; todayReceived: number; weekReceived: number; monthReceived: number }>("/wallet/income"),
  recharge: (data: { packageId?: string; amount: number; paymentMethod?: string }) =>
    request("/wallet/recharge", { method: "POST", body: JSON.stringify(data) }),
  paymentProviders: async (packageId?: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const query = packageId ? `?packageId=${encodeURIComponent(packageId)}` : "";
      const res = await fetch(`/api/v1/payments/providers${query}`, {
        credentials: "include",
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw { status: res.status, ...json };
      return json.data as {
        country: string | null;
        providers: Array<{
          key: string;
          displayName: string;
          mode: string;
          priority: number;
          countries: string[];
          hasCredentials: boolean;
          requiredCredentials: string[];
          isReady: boolean;
          available?: boolean;
        }>;
        unavailableProviders?: Array<{
          key: string;
          displayName: string;
          mode: string;
          priority: number;
          reasonCode?: string;
          reasonText?: string;
          minAmount?: number;
          maxAmount?: number;
        }>;
        recommendedProvider?: string | null;
        paymentMethods: Array<any>;
      };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw { status: 408, success: false, message: "انتهت مهلة الطلب" };
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },
  createCheckoutSession: async (packageId: string, provider = "stripe", idempotencyKey?: string) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch("/api/v1/payments/checkout", {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "x-idempotency-key": idempotencyKey } : {}),
        },
        body: JSON.stringify({ packageId, provider, ...(idempotencyKey ? { idempotencyKey } : {}) }),
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok || !json.success) throw { status: res.status, ...json };
      return json.data as {
        sessionId?: string;
        url: string;
        orderId?: string;
        manual?: boolean;
        status?: string;
        referenceId?: string;
        message?: string;
        provider?: string;
        reused?: boolean;
        paid?: boolean;
      };
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw { status: 408, success: false, message: "انتهت مهلة الطلب" };
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },
  withdraw: (data: { amount: number; paymentMethodId?: string; paymentDetails?: string }) =>
    request("/wallet/withdraw", { method: "POST", body: JSON.stringify(data) }),
  withdrawAccess: () => request<{ enabled: boolean }>("/wallet/withdraw-access"),
  paymentMethods: (usage: "deposit" | "withdrawal" = "withdrawal") =>
    request<any[]>(`/wallet/payment-methods?usage=${usage}`),
  withdrawalRequests: (page = 1) => request<any>(`/wallet/withdrawal-requests?page=${page}`),
  incomeChart: (days = 30) => request<any>(`/wallet/income-chart?days=${days}`),
  cancelWithdrawal: (withdrawalId: string) =>
    request("/wallet/cancel-withdrawal", { method: "POST", body: JSON.stringify({ withdrawalId }) }),
  conversionRate: () => request<{ coinsPerUsd: number }>("/wallet/conversion-rate"),
  /** Miles pricing packages */
  milesPricing: () => request<{ packages: any[] }>("/miles-pricing"),
  /** Recharge packages from payment system */
  rechargePackages: async () => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    try {
      const res = await fetch("/api/payments/packages", {
        credentials: "include",
        signal: controller.signal,
      });
      const json = await res.json();
      if (!res.ok) throw { status: res.status, ...json };
      return json;
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === "AbortError") {
        throw { status: 408, success: false, message: "انتهت مهلة الطلب" };
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  },
  /** #14: Merged spending summary (totalSpent + breakdown in one call) */
  spendingSummary: () => request<{ totalSpent: number; breakdown: { type: string; total: number; count: number }[] }>("/wallet/spending-summary"),
  /** #15: Get remaining withdrawal limits */
  withdrawLimits: () => request<{
    dailyLimit: number; weeklyLimit: number;
    dailyUsed: number; weeklyUsed: number;
    dailyRemaining: number; weeklyRemaining: number;
    hasActiveRequest: boolean;
  }>("/wallet/withdraw-limits"),
  exportTransactionsCsv: () => `${API_BASE}/wallet/transactions/export`,
};

// ── Miles ──
export const milesApi = {
  /** #7: Purchase miles package through API client */
  purchase: (packageId: string) =>
    request<{ success: boolean; newBalance: number }>("/miles/purchase", { method: "POST", body: JSON.stringify({ packageId }) }),
};

// ── Gifts ──
export const giftsApi = {
  list: () => request<any[]>("/gifts"),
  send: (data: { giftId: string; receiverId: string; streamId?: string; quantity?: number }) =>
    request<{ success: boolean; newBalance: number }>("/gifts/send", { method: "POST", body: JSON.stringify(data) }),
  history: (role: "sent" | "received" = "sent", page = 1) =>
    request<any[]>(`/gifts/history?role=${role}&page=${page}`),
};

// ── Follows ──
export const followApi = {
  follow: (userId: string) => request("/follow/" + userId, { method: "POST" }),
  unfollow: (userId: string) => request("/follow/" + userId, { method: "DELETE" }),
  followers: (page = 1) => request<any[]>(`/followers?page=${page}`),
  following: (page = 1) => request<any[]>(`/following?page=${page}`),
  counts: (userId: string) => request<{ followers: number; following: number }>(`/follow/count/${userId}`),
  status: (userId: string) => request<{ following: boolean }>(`/follow/status/${userId}`),
};

// ── Streams ──
export const streamsApi = {
  featureFlags: () => request<{
    liveRecommendationEnabled: boolean;
    postStreamReportEnabled: boolean;
    liveGamificationEnabled: boolean;
    creatorAnalyticsCsvEnabled: boolean;
    smartDirectorTelemetryEnabled: boolean;
    autoClipsEnabled: boolean;
  }>("/feature-flags"),
  active: (category?: string) => request<any[]>(`/streams/active${category ? `?category=${category}` : ""}`),
  recommended: (category?: string) => request<any[]>(`/streams/recommended${category ? `?category=${category}` : ""}`),
  scheduled: () => request<any[]>("/streams/scheduled"),
  search: (q: string) => request<any[]>(`/streams/search?q=${encodeURIComponent(q)}`),
  detail: (id: string) => request<any>(`/streams/${id}`),
  my: () => request<any>("/streams/my"),
  stats: (id: string) => request<any>(`/streams/${id}/stats`),
  report: (id: string) => request<any>(`/streams/${id}/report`),
  analytics: (id: string) => request<any>(`/streams/${id}/analytics`),
  analyticsExportUrl: (id: string) => `${API_BASE}/streams/${id}/analytics/export`,
  directorEvent: (id: string, data: { tipId: string; action: "shown" | "accepted" | "dismissed"; metadata?: Record<string, unknown> }) =>
    request<any>(`/streams/${id}/director-events`, { method: "POST", body: JSON.stringify(data) }),
  captureAutoClip: (id: string, data: {
    cueType: "chat_burst" | "gift_burst" | "viewer_spike" | "retention_recovery";
    title: string;
    reason: string;
    score?: number;
    lookbackSec?: number;
    forwardSec?: number;
    metadata?: Record<string, unknown>;
  }) => request<any>(`/streams/${id}/clips/auto`, { method: "POST", body: JSON.stringify(data) }),
  autoClips: (id: string) => request<any[]>(`/streams/${id}/clips`),
  create: (data: { title: string; type: "live" | "audio"; tags?: string[]; category?: string; scheduledAt?: string }) =>
    request<any>("/streams/create", { method: "POST", body: JSON.stringify(data) }),
  end: (id: string) => request<any>(`/streams/${id}/end`, { method: "POST" }),
  join: (id: string) => request("/streams/" + id + "/join", { method: "POST" }),
  leave: (id: string) => request("/streams/" + id + "/leave", { method: "POST" }),
  viewers: (id: string) => request<any[]>(`/streams/${id}/viewers`),
  /** Get LiveKit token to join the media room */
  token: (id: string, role?: "host" | "speaker" | "viewer") =>
    request<{ token: string; wsUrl: string; roomName: string; role: string }>(
      `/streams/${id}/token`,
      { method: "POST", body: JSON.stringify({ role }) }
    ),
  /** Promote viewer to speaker (host only) */
  promote: (streamId: string, targetUserId: string) =>
    request(`/streams/${streamId}/promote`, { method: "POST", body: JSON.stringify({ targetUserId }) }),
  /** Demote speaker to viewer (host only) */
  demote: (streamId: string, targetUserId: string) =>
    request(`/streams/${streamId}/demote`, { method: "POST", body: JSON.stringify({ targetUserId }) }),
  /** Kick participant from stream (host only) */
  kick: (streamId: string, targetUserId: string) =>
    request(`/streams/${streamId}/kick`, { method: "POST", body: JSON.stringify({ targetUserId }) }),
  /** Pin a message in stream chat (host only) */
  pin: (streamId: string, message: string) =>
    request(`/streams/${streamId}/pin`, { method: "POST", body: JSON.stringify({ message }) }),
  unpin: (streamId: string) =>
    request(`/streams/${streamId}/pin`, { method: "DELETE" }),
  /** Polls */
  createPoll: (streamId: string, question: string, options: string[]) =>
    request(`/streams/${streamId}/poll`, { method: "POST", body: JSON.stringify({ question, options }) }),
  votePoll: (streamId: string, pollId: string, option: string) =>
    request(`/streams/${streamId}/poll/${pollId}/vote`, { method: "POST", body: JSON.stringify({ option }) }),
  endPoll: (streamId: string, pollId: string) =>
    request(`/streams/${streamId}/poll/${pollId}/end`, { method: "POST" }),
  getActivePoll: (streamId: string) =>
    request<any>(`/streams/${streamId}/poll`),
  /** Chat moderation */
  muteUser: (streamId: string, targetUserId: string, reason?: string) =>
    request(`/streams/${streamId}/mute`, { method: "POST", body: JSON.stringify({ targetUserId, reason }) }),
  unmuteUser: (streamId: string, targetUserId: string) =>
    request(`/streams/${streamId}/mute/${targetUserId}`, { method: "DELETE" }),
  addBannedWord: (streamId: string, word: string) =>
    request(`/streams/${streamId}/banned-words`, { method: "POST", body: JSON.stringify({ word }) }),
  removeBannedWord: (streamId: string, wordId: string) =>
    request(`/streams/${streamId}/banned-words/${wordId}`, { method: "DELETE" }),
  getBannedWords: (streamId: string) =>
    request<any[]>(`/streams/${streamId}/banned-words`),
  /** Recording */
  startRecording: (streamId: string) =>
    request(`/streams/${streamId}/record/start`, { method: "POST" }),
  stopRecording: (streamId: string) =>
    request(`/streams/${streamId}/record/stop`, { method: "POST" }),
};

// ── Gamification ──
export const gamificationApi = {
  daily: () => request<any>("/gamification/daily"),
  claim: () => request<any>("/gamification/claim", { method: "POST" }),
  xpMe: () => request<{
    level: number;
    xp: number;
    xpForCurrentLevel: number;
    xpForNextLevel: number;
    progress: number;
    maxLevel: number;
  }>("/xp/me"),
};

export const profileStatsApi = {
  me: () => request<{
    followers: number;
    following: number;
    friends: number;
    giftsSent: number;
    giftsReceived: number;
    streamHours: number;
  }>("/profile/me/stats"),
};

// ── Auto-Translation — الترجمة التلقائية ──
export const translateApi = {
  translate: (text: string, targetLang: string, sourceLang?: string) =>
    request<{ translatedText: string; detectedLang: string }>("/translate", {
      method: "POST",
      body: JSON.stringify({ text, targetLang, sourceLang }),
    }),
};
