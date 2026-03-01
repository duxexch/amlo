/**
 * Social API client — Friends, Chat, Calls, Blocks, Reports
 */

const API_BASE = "/api/social";

const REQUEST_TIMEOUT_MS = 15_000;

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
  list: () => request<any[]>("/friends"),
  requests: () => request<any[]>("/friends/requests"),
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
  sendMessage: (conversationId: string, data: {
    content?: string;
    type?: string;
    mediaUrl?: string;
    giftId?: string;
  }) =>
    request(`/conversations/${conversationId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    }),
  deleteMessage: (id: string) =>
    request(`/messages/${id}`, { method: "DELETE" }),
  unreadCount: () => request<{ unread: number; friendRequests: number }>("/unread-count"),
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
  pricing: () => request<{ voice_call_rate: number; video_call_rate: number; message_cost: number }>("/pricing"),
};
