/**
 * Agent Panel API Client
 */

const BASE = "/api/agent";

interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
}

class AgentApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
    this.name = "AgentApiError";
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
      throw new AgentApiError(
        json.message || `خطأ ${res.status}`,
        res.status,
      );
    }

    return json;
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new AgentApiError("انتهت مهلة الطلب", 408);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export interface AgentData {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  referralCode: string;
  commissionRate: string;
  totalUsers: number;
  totalRevenue: string;
  balance: string;
  status: string;
}

export const agentAuth = {
  login: (email: string, password: string) =>
    request<AgentData>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () =>
    request("/auth/logout", { method: "POST" }),

  me: () => request<AgentData>("/auth/me"),
};

export const agentStats = {
  get: () => request<any>("/stats"),
};
