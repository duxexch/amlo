/**
 * World API client — حول العالم (Around the World)
 */

const API_BASE = "/api/social/world";

async function request<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const json = await res.json();
  if (!res.ok) throw { status: res.status, ...json };
  return json.data !== undefined ? json.data : json;
}

export interface WorldSearchFilters {
  genderFilter: "male" | "female" | "both";
  ageMin: number;
  ageMax: number;
  countryFilter?: string;
  chatType: "text" | "voice" | "video";
}

export const worldApi = {
  // Pricing
  getPricing: () => request<any[]>("/pricing"),

  // Search
  search: (filters: WorldSearchFilters) =>
    request("/search", { method: "POST", body: JSON.stringify(filters) }),

  // Session
  getSession: (id: string) => request<any>(`/sessions/${id}`),
  cancelSession: (id: string) =>
    request(`/sessions/${id}/cancel`, { method: "POST" }),
  endSession: (id: string) =>
    request(`/sessions/${id}/end`, { method: "POST" }),

  // Messages
  messages: (sessionId: string, page = 1) =>
    request<any[]>(`/sessions/${sessionId}/messages?page=${page}`),
  sendMessage: (sessionId: string, data: { content?: string; type?: string; mediaUrl?: string; giftId?: string }) =>
    request(`/sessions/${sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify(data),
    }),

  // Interactions
  follow: (sessionId: string) =>
    request(`/sessions/${sessionId}/follow`, { method: "POST" }),
  friendRequest: (sessionId: string) =>
    request(`/sessions/${sessionId}/friend-request`, { method: "POST" }),

  // Report
  report: (sessionId: string, data: { type: string; reason?: string }) =>
    request(`/sessions/${sessionId}/report`, { method: "POST", body: JSON.stringify(data) }),

  // Stats
  stats: () => request<any>("/stats"),
};

// Admin API
const ADMIN_BASE = "/api/admin";

async function adminRequest<T = any>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${ADMIN_BASE}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...init?.headers },
    ...init,
  });
  const json = await res.json();
  if (!res.ok) throw { status: res.status, ...json };
  return json;
}

export const worldAdminApi = {
  getPricing: () => adminRequest<any>("/world/pricing"),
  updatePricing: (id: string, data: any) =>
    adminRequest(`/world/pricing/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  bulkUpdatePricing: (prices: { filterType: string; priceCoins: number }[]) =>
    adminRequest("/world/pricing", { method: "PUT", body: JSON.stringify({ prices }) }),
  getStats: () => adminRequest<any>("/world/stats"),
};
