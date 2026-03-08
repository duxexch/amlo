/**
 * Auth API client — User Registration, Login, PIN, Profiles, Friend Visibility
 */

const API_BASE = "/api/auth";
const REQUEST_TIMEOUT_MS = 15_000;

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function uploadAvatar(file: File | Blob, filename?: string): Promise<string> {
  const formData = new FormData();
  formData.append("file", file, filename || (file instanceof File ? file.name : "avatar.jpg"));
  let lastErr: any = null;

  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const res = await fetch("/api/v1/upload/avatar", {
        method: "POST",
        credentials: "include",
        body: formData,
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || "Avatar upload failed");
      }
      return json.data.url as string;
    } catch (err: any) {
      lastErr = err;
      if (attempt < 3) {
        await sleep(350 * attempt);
      }
    }
  }

  throw lastErr || new Error("Avatar upload failed");
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

  changePassword: (currentPassword: string, newPassword: string) =>
    request<{ success: boolean; message: string }>("/change-password", {
      method: "PUT",
      body: JSON.stringify({ currentPassword, newPassword }),
    }),

  deleteAccount: (password: string) =>
    request<{ success: boolean; message: string }>("/account", {
      method: "DELETE",
      body: JSON.stringify({ password }),
    }),

  getNotificationPreferences: () =>
    request<{ success: boolean; data: any }>("/notification-preferences"),

  updateNotificationPreferences: (prefs: {
    messages?: boolean;
    calls?: boolean;
    friendRequests?: boolean;
    gifts?: boolean;
    streams?: boolean;
    systemUpdates?: boolean;
    marketing?: boolean;
  }) =>
    request<{ success: boolean; data: any }>("/notification-preferences", {
      method: "PUT",
      body: JSON.stringify(prefs),
    }),

  getChatTranslationPreferences: () =>
    request<{
      success: boolean; data: {
        chatAutoTranslate: boolean;
        chatShowOriginalText: boolean;
        chatTranslateLang: string;
      }
    }>("/chat-translation-preferences"),

  updateChatTranslationPreferences: (prefs: {
    chatAutoTranslate?: boolean;
    chatShowOriginalText?: boolean;
    chatTranslateLang?: string;
  }) =>
    request<{
      success: boolean; data: {
        chatAutoTranslate: boolean;
        chatShowOriginalText: boolean;
        chatTranslateLang: string;
      }
    }>("/chat-translation-preferences", {
      method: "PUT",
      body: JSON.stringify(prefs),
    }),

  // OTP
  sendOtp: (email: string) =>
    request<{ success: boolean; message: string; cooldownSeconds?: number; devCode?: string }>("/otp/send", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  sendRegisterOtp: (email: string) =>
    request<{ success: boolean; message: string; cooldownSeconds?: number; devCode?: string }>("/otp/send-register", {
      method: "POST",
      body: JSON.stringify({ email }),
    }),

  verifyOtp: (email: string, code: string) =>
    request<{ success: boolean; message: string; verified?: boolean }>("/otp/verify", {
      method: "POST",
      body: JSON.stringify({ email, code }),
    }),

  // OAuth
  oauthGoogle: (idToken: string) =>
    request<{ success: boolean; data: any }>("/oauth/google", {
      method: "POST",
      body: JSON.stringify({ idToken }),
    }),

  oauthFacebook: (accessToken: string) =>
    request<{ success: boolean; data: any }>("/oauth/facebook", {
      method: "POST",
      body: JSON.stringify({ accessToken }),
    }),

  oauthApple: (identityToken: string, fullName?: { givenName?: string; familyName?: string }) =>
    request<{ success: boolean; data: any }>("/oauth/apple", {
      method: "POST",
      body: JSON.stringify({ identityToken, fullName }),
    }),

  // 2FA
  setup2FA: () =>
    request<{ success: boolean; data: { secret: string; otpauthUri: string } }>("/2fa/setup", { method: "POST" }),

  verifySetup2FA: (code: string) =>
    request<{ success: boolean; message: string }>("/2fa/verify-setup", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  verify2FA: (userId: string, code: string) =>
    request<{ success: boolean; data: any }>("/2fa/verify", {
      method: "POST",
      body: JSON.stringify({ userId, code }),
    }),

  disable2FA: (code: string) =>
    request<{ success: boolean; message: string }>("/2fa/disable", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),

  getSecurityTimeline: () =>
    request<{ success: boolean; data: Array<{ id: string; type: string; createdAt: string; ip: string; userAgent: string; details?: Record<string, any> }> }>("/security/timeline"),

  getTrustedDevices: () =>
    request<{ success: boolean; data: { lockEnabled: boolean; currentDeviceId: string; currentDeviceTrusted: boolean; devices: Array<{ id: string; label: string; userAgent: string; ip: string; addedAt: string; lastSeenAt: string }> } }>("/security/devices"),

  trustCurrentDevice: () =>
    request<{ success: boolean; data: any }>("/security/devices/trust-current", { method: "POST" }),

  setTrustedDeviceLock: (enabled: boolean) =>
    request<{ success: boolean; data: { lockEnabled: boolean } }>("/security/device-lock", {
      method: "PUT",
      body: JSON.stringify({ enabled }),
    }),

  removeTrustedDevice: (deviceId: string) =>
    request<{ success: boolean; message: string }>(`/security/devices/${encodeURIComponent(deviceId)}`, { method: "DELETE" }),
};

// ── PIN & Profiles ──
export const profileApi = {
  setupPin: (data: { pin: string; profileIndex: number; displayName: string; bio?: string; gender?: string; country?: string }) =>
    request<{ success: boolean; data: any }>("/pin/setup", { method: "POST", body: JSON.stringify(data) }),

  verifyPin: (pin: string) =>
    request<{ success: boolean; data: any }>("/pin/verify", { method: "POST", body: JSON.stringify({ pin }) }),

  changePin: (profileIndex: number, currentPin: string, newPin: string) =>
    request<{ success: boolean; message: string }>("/pin/change", {
      method: "PUT",
      body: JSON.stringify({ profileIndex, currentPin, newPin }),
    }),

  deleteProfile: (index: number) =>
    request<{ success: boolean; message: string }>(`/pin/profile/${index}`, { method: "DELETE" }),

  getProfiles: () =>
    request<{ success: boolean; data: any[] }>("/profiles"),

  updateProfile: (index: number, data: { displayName?: string; avatar?: string; bio?: string; gender?: string; country?: string; birthDate?: string }) =>
    request<{ success: boolean; data: any }>(`/profiles/${index}`, { method: "PUT", body: JSON.stringify(data) }),
};

// ── Login OTP (alternative to PIN) ──
export const loginOtpApi = {
  sendOtp: () =>
    request<{ success: boolean; message: string; email?: string; devCode?: string }>("/login/otp", { method: "POST" }),

  verifyOtp: (code: string) =>
    request<{ success: boolean; data?: any }>("/login/otp-verify", {
      method: "POST",
      body: JSON.stringify({ code }),
    }),
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
