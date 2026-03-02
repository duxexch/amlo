/**
 * Auth API client — User Registration, Login, PIN, Profiles, Friend Visibility
 */

const API_BASE = "/api/auth";
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
    return json as T;
  } catch (err: unknown) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw { status: 408, success: false, message: "انتهت مهلة الطلب" };
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

// ── Auth ──
export const authApi = {
  register: (data: { username: string; email: string; password: string; displayName?: string; referralCode?: string }) =>
    request<{ success: boolean; data: any }>("/register", { method: "POST", body: JSON.stringify(data) }),

  login: (data: { login: string; password: string }) =>
    request<{ success: boolean; data: any }>("/login", { method: "POST", body: JSON.stringify(data) }),

  logout: () =>
    request<{ success: boolean }>("/logout", { method: "POST" }),

  me: () =>
    request<{ success: boolean; data: any }>("/me"),

  forgotPassword: (email: string) =>
    request<{ success: boolean; message: string; resetToken?: string }>("/forgot-password", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  resetPassword: (token: string, password: string) =>
    request<{ success: boolean; message: string }>("/reset-password", {
      method: "POST",
      body: JSON.stringify({ token, password }),
    }),
};

// ── PIN & Profiles ──
export const profileApi = {
  setupPin: (data: { pin: string; profileIndex: number; displayName: string; bio?: string; gender?: string; country?: string }) =>
    request<{ success: boolean; data: any }>("/pin/setup", { method: "POST", body: JSON.stringify(data) }),

  verifyPin: (pin: string) =>
    request<{ success: boolean; data: any }>("/pin/verify", { method: "POST", body: JSON.stringify({ pin }) }),

  getProfiles: () =>
    request<{ success: boolean; data: any[] }>("/profiles"),

  updateProfile: (index: number, data: { displayName?: string; avatar?: string; bio?: string; gender?: string; country?: string; birthDate?: string }) =>
    request<{ success: boolean; data: any }>(`/profiles/${index}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ── Friend Visibility ──
export const friendVisibilityApi = {
  set: (friendId: string, visibleProfileIndex: number) =>
    request<{ success: boolean; data: any }>("/friend-visibility", {
      method: "PUT",
      body: JSON.stringify({ friendId, visibleProfileIndex }),
    }),

  getAll: () =>
    request<{ success: boolean; data: any[] }>("/friend-visibility"),
};
