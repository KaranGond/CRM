import type {
  ApiResponse,
  PaginatedResponse,
  User,
  CreateUserDto,
  UpdateUserDto,
  Lead,
  CreateLeadDto,
  UpdateLeadDto,
  Call,
  CreateCallDto,
  UpdateCallDto,
  Campaign,
  CreateCampaignDto,
  UpdateCampaignDto,
  DashboardStats,
  ApiError,
} from "@telecalling-crm/types";

// ─── Client Configuration ──────────────────────────────────────────────────

export interface ApiClientConfig {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
  onUnauthorized?: () => void;
}

class ApiClient {
  private config: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.config = config;
  }

  // ─── Core Request Method ───────────────────────────────────────────────

  private async request<T>(
    path: string,
    options: RequestInit = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    };

    if (this.config.getToken) {
      const token = await this.config.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${this.config.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401 && this.config.onUnauthorized) {
        this.config.onUnauthorized();
      }
      const error: ApiError = await response.json().catch(() => ({
        statusCode: response.status,
        message: response.statusText,
      }));
      throw error;
    }

    return response.json() as Promise<T>;
  }

  // ─── Users ────────────────────────────────────────────────────────────

  readonly users = {
    list: (params?: { page?: number; limit?: number }) =>
      this.request<PaginatedResponse<User>>(
        `/users?${new URLSearchParams(params as Record<string, string>).toString()}`,
      ),

    getById: (id: string) =>
      this.request<ApiResponse<User>>(`/users/${id}`),

    create: (data: CreateUserDto) =>
      this.request<ApiResponse<User>>("/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateUserDto) =>
      this.request<ApiResponse<User>>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      this.request<ApiResponse<void>>(`/users/${id}`, { method: "DELETE" }),
  };

  // ─── Leads ────────────────────────────────────────────────────────────

  readonly leads = {
    list: (params?: { page?: number; limit?: number; status?: string; assignedTo?: string }) =>
      this.request<PaginatedResponse<Lead>>(
        `/leads?${new URLSearchParams(params as Record<string, string>).toString()}`,
      ),

    getById: (id: string) =>
      this.request<ApiResponse<Lead>>(`/leads/${id}`),

    create: (data: CreateLeadDto) =>
      this.request<ApiResponse<Lead>>("/leads", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateLeadDto) =>
      this.request<ApiResponse<Lead>>(`/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      this.request<ApiResponse<void>>(`/leads/${id}`, { method: "DELETE" }),
  };

  // ─── Calls ────────────────────────────────────────────────────────────

  readonly calls = {
    list: (params?: { page?: number; limit?: number; agentId?: string; leadId?: string }) =>
      this.request<PaginatedResponse<Call>>(
        `/calls?${new URLSearchParams(params as Record<string, string>).toString()}`,
      ),

    getById: (id: string) =>
      this.request<ApiResponse<Call>>(`/calls/${id}`),

    create: (data: CreateCallDto) =>
      this.request<ApiResponse<Call>>("/calls", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateCallDto) =>
      this.request<ApiResponse<Call>>(`/calls/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  };

  // ─── Campaigns ────────────────────────────────────────────────────────

  readonly campaigns = {
    list: (params?: { page?: number; limit?: number; status?: string }) =>
      this.request<PaginatedResponse<Campaign>>(
        `/campaigns?${new URLSearchParams(params as Record<string, string>).toString()}`,
      ),

    getById: (id: string) =>
      this.request<ApiResponse<Campaign>>(`/campaigns/${id}`),

    create: (data: CreateCampaignDto) =>
      this.request<ApiResponse<Campaign>>("/campaigns", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateCampaignDto) =>
      this.request<ApiResponse<Campaign>>(`/campaigns/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    delete: (id: string) =>
      this.request<ApiResponse<void>>(`/campaigns/${id}`, { method: "DELETE" }),
  };

  // ─── Dashboard ────────────────────────────────────────────────────────

  readonly dashboard = {
    getStats: () =>
      this.request<ApiResponse<DashboardStats>>("/dashboard/stats"),
  };
}

// ─── Factory ────────────────────────────────────────────────────────────────

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

export type { ApiClient };
