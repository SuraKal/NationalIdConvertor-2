import type {
  AuthUser,
  DashboardResponse,
  PackageItem,
  PaymentMethod,
  PaymentRequest,
} from "./api-types";

const API_BASE = import.meta.env.VITE_API_URL || "/api";
const TOKEN_KEY = "nconvert_auth_token";

type ApiOptions = {
  method?: string;
  body?: unknown;
  token?: string | null;
};

export function getStoredToken() {
  return localStorage.getItem(TOKEN_KEY);
}

export function storeToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed.";
}

async function request<T>(path: string, options: ApiOptions = {}): Promise<T> {
  const token = options.token ?? getStoredToken();
  const response = await fetch(`${API_BASE}${path}`, {
    method: options.method || "GET",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.error || "Request failed.");
  }

  return data as T;
}

export const api = {
  async register(payload: { name: string; email: string; password: string }) {
    return request<{ success: true }>("/auth/register", {
      method: "POST",
      body: payload,
      token: null,
    });
  },

  async login(payload: { email: string; password: string }) {
    return request<{ token: string; user: AuthUser }>("/auth/login", {
      method: "POST",
      body: payload,
      token: null,
    });
  },

  async me() {
    return request<{ user: AuthUser }>("/auth/me");
  },

  async sendPasswordResetOtp(email: string) {
    return request<{ success: true; otp?: string; message?: string }>(
      "/auth/forgot-password/send",
      {
        method: "POST",
        body: { email },
        token: null,
      },
    );
  },

  async resetPassword(payload: {
    email: string;
    otp: string;
    newPassword: string;
  }) {
    return request<{ success: true }>("/auth/forgot-password/reset", {
      method: "POST",
      body: payload,
      token: null,
    });
  },

  async getDashboard() {
    return request<DashboardResponse>("/dashboard");
  },

  async getUsers() {
    return request<{ users: AuthUser[] }>("/admin/users");
  },

  async createUser(payload: {
    name: string;
    email: string;
    password: string;
    role: "admin" | "user";
  }) {
    return request<{ success: true }>("/admin/users", {
      method: "POST",
      body: payload,
    });
  },

  async updateUser(
    id: string,
    payload: Partial<Pick<AuthUser, "name" | "email" | "role" | "wallet_balance">>,
  ) {
    return request<{ success: true }>(`/admin/users/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },

  async deleteUser(id: string) {
    return request<{ success: true }>(`/admin/users/${id}`, {
      method: "DELETE",
    });
  },

  async getPaymentMethods() {
    return request<{ paymentMethods: PaymentMethod[] }>("/payment-methods");
  },

  async createPaymentMethod(payload: Omit<PaymentMethod, "id" | "created_at">) {
    return request<{ success: true }>("/payment-methods", {
      method: "POST",
      body: payload,
    });
  },

  async updatePaymentMethod(
    id: string,
    payload: Omit<PaymentMethod, "id" | "created_at">,
  ) {
    return request<{ success: true }>(`/payment-methods/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },

  async deletePaymentMethod(id: string) {
    return request<{ success: true }>(`/payment-methods/${id}`, {
      method: "DELETE",
    });
  },

  async getPackages() {
    const data = await request<{ packages: Array<PackageItem & { is_active: boolean | number }> }>("/packages");
    return {
      packages: data.packages.map((pkg) => ({
        ...pkg,
        is_active: Boolean(pkg.is_active),
      })),
    };
  },

  async createPackage(payload: Omit<PackageItem, "id" | "created_at">) {
    return request<{ success: true }>("/packages", {
      method: "POST",
      body: payload,
    });
  },

  async updatePackage(
    id: string,
    payload: Omit<PackageItem, "id" | "created_at">,
  ) {
    return request<{ success: true }>(`/packages/${id}`, {
      method: "PATCH",
      body: payload,
    });
  },

  async deletePackage(id: string) {
    return request<{ success: true }>(`/packages/${id}`, {
      method: "DELETE",
    });
  },

  async getPaymentRequests() {
    return request<{ paymentRequests: PaymentRequest[] }>("/payment-requests");
  },

  async createPaymentRequest(payload: {
    payment_method_id: string;
    package_id: string | null;
    transaction_number: string;
    amount: number;
  }) {
    return request<{ success: true }>("/payment-requests", {
      method: "POST",
      body: payload,
    });
  },

  async actOnPaymentRequest(id: string, action: "approve" | "reject" | "reverse") {
    return request<{ success: true }>(`/payment-requests/${id}/action`, {
      method: "POST",
      body: { action },
    });
  },

  async consumeDownload(fileName: string) {
    return request<{
      success: true;
      wallet_balance: number;
      total_downloads: number;
      role: "admin" | "user";
    }>("/downloads/consume", {
      method: "POST",
      body: { fileName },
    });
  },
};
