import type {
  ApiResponse,
  PaginatedResponse,
  ApiError,
  User,
  CreateUserInput,
  UpdateUserInput,
  Device,
  RegisterDeviceInput,
  HeartbeatDeviceInput,
  LoginInput,
  RegisterInput,
  RefreshTokenInput,
  AuthTokens,
  PipelineStage,
  CreatePipelineStageInput,
  DispositionType,
  CreateDispositionTypeInput,
  Lead,
  CreateLeadInput,
  UpdateLeadInput,
  AssignLeadInput,
  BulkAssignLeadInput,
  ImportLeadsInput,
  CallLog,
  PostCallsBatchInput,
  UpdateCallLogDispositionInput,
  FollowUp,
  CreateFollowUpInput,
  UpdateFollowUpInput,
  Recording,
  RequestUploadUrlInput,
  LinkRecordingInput,
  SyncPullQuery,
  SyncPullResponse,
  SyncPushInput,
  SyncPushResult,
  DashboardStats,
} from "@telecalling-crm/shared";

// ─── Client Configuration ──────────────────────────────────────────────────

export interface ApiClientConfig {
  baseUrl: string;
  getToken?: () => Promise<string | null>;
  onUnauthorized?: () => void;
}

class ApiClient {
  private clientConfig: ApiClientConfig;

  constructor(config: ApiClientConfig) {
    this.clientConfig = config;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...((options.headers as Record<string, string>) ?? {}),
    };

    if (this.clientConfig.getToken) {
      const token = await this.clientConfig.getToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    }

    const response = await fetch(`${this.clientConfig.baseUrl}${path}`, {
      ...options,
      headers,
    });

    if (!response.ok) {
      if (response.status === 401 && this.clientConfig.onUnauthorized) {
        this.clientConfig.onUnauthorized();
      }
      const error: ApiError = await response.json().catch(() => ({
        statusCode: response.status,
        message: response.statusText,
      }));
      throw error;
    }

    return response.json() as Promise<T>;
  }

  // ─── Auth ─────────────────────────────────────────────────────────────

  readonly auth = {
    login: (data: LoginInput) =>
      this.request<ApiResponse<AuthTokens & { user: User; device?: Device }>>("/auth/login", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    register: (data: RegisterInput) =>
      this.request<ApiResponse<AuthTokens & { user: User }>>("/auth/register", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    refresh: (data: RefreshTokenInput) =>
      this.request<ApiResponse<AuthTokens>>("/auth/refresh", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    logout: (deviceId?: string) =>
      this.request<ApiResponse<{ success: boolean }>>("/auth/logout", {
        method: "POST",
        body: JSON.stringify({ deviceId }),
      }),

    me: () => this.request<ApiResponse<User>>("/auth/me"),
  };

  // ─── Devices ──────────────────────────────────────────────────────────

  readonly devices = {
    register: (data: RegisterDeviceInput) =>
      this.request<ApiResponse<Device>>("/devices", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    heartbeat: (deviceId: string, data: HeartbeatDeviceInput) =>
      this.request<ApiResponse<{ serverTime: string; acknowledged: boolean }>>(
        `/devices/${deviceId}/heartbeat`,
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),

    list: () => this.request<ApiResponse<Device[]>>("/devices"),
  };

  // ─── Leads & Queue ────────────────────────────────────────────────────

  readonly leads = {
    list: (params?: {
      page?: number;
      limit?: number;
      stageId?: string;
      assigneeId?: string;
      search?: string;
    }) =>
      this.request<PaginatedResponse<Lead>>(
        `/leads?${new URLSearchParams((params as Record<string, any>) ?? {}).toString()}`,
      ),

    getById: (id: string) => this.request<ApiResponse<Lead>>(`/leads/${id}`),

    create: (data: CreateLeadInput) =>
      this.request<ApiResponse<Lead>>("/leads", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateLeadInput) =>
      this.request<ApiResponse<Lead>>(`/leads/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    assign: (id: string, data: AssignLeadInput) =>
      this.request<ApiResponse<Lead>>(`/leads/${id}/assign`, {
        method: "POST",
        body: JSON.stringify(data),
      }),

    bulkAssign: (data: BulkAssignLeadInput) =>
      this.request<ApiResponse<{ count: number }>>("/leads/bulk-assign", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getQueue: (params?: { limit?: number }) =>
      this.request<ApiResponse<Lead[]>>(
        `/me/queue?${new URLSearchParams((params as Record<string, any>) ?? {}).toString()}`,
      ),

    importLeads: (data: ImportLeadsInput) =>
      this.request<
        ApiResponse<{
          jobId: string;
          total: number;
          imported: number;
          duplicates: number;
          errors: string[];
        }>
      >("/leads/import", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  };

  // ─── Calls ────────────────────────────────────────────────────────────

  readonly calls = {
    batchPost: (data: PostCallsBatchInput) =>
      this.request<
        ApiResponse<{
          processed: number;
          results: { dedupeKey: string; status: "created" | "duplicate" | "error" }[];
        }>
      >("/calls", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    reconcile: (data: PostCallsBatchInput) =>
      this.request<
        ApiResponse<{
          reconciled: number;
          results: { dedupeKey: string; status: "created" | "duplicate" | "error" }[];
        }>
      >("/calls/reconcile", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    updateDisposition: (id: string, data: UpdateCallLogDispositionInput) =>
      this.request<ApiResponse<CallLog>>(`/calls/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),

    getLeadCalls: (leadId: string) =>
      this.request<ApiResponse<CallLog[]>>(`/leads/${leadId}/calls`),

    list: (params?: {
      page?: number;
      limit?: number;
      callerId?: string;
      leadId?: string;
      outcome?: string;
    }) =>
      this.request<PaginatedResponse<CallLog>>(
        `/calls?${new URLSearchParams((params as Record<string, any>) ?? {}).toString()}`,
      ),
  };

  // ─── Follow-ups ───────────────────────────────────────────────────────

  readonly followUps = {
    list: (params?: { userId?: string; pendingOnly?: boolean }) =>
      this.request<ApiResponse<FollowUp[]>>(
        `/followups?${new URLSearchParams((params as Record<string, any>) ?? {}).toString()}`,
      ),

    create: (data: CreateFollowUpInput) =>
      this.request<ApiResponse<FollowUp>>("/followups", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    update: (id: string, data: UpdateFollowUpInput) =>
      this.request<ApiResponse<FollowUp>>(`/followups/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  };

  // ─── Recordings ───────────────────────────────────────────────────────

  readonly recordings = {
    getUploadUrl: (data: RequestUploadUrlInput) =>
      this.request<ApiResponse<{ uploadUrl: string; storageKey: string; expiresInSec: number }>>(
        "/recordings/upload-url",
        {
          method: "POST",
          body: JSON.stringify(data),
        },
      ),

    link: (data: LinkRecordingInput) =>
      this.request<ApiResponse<Recording>>("/recordings", {
        method: "POST",
        body: JSON.stringify(data),
      }),

    getPlaybackUrl: (id: string) =>
      this.request<ApiResponse<{ url: string; expiresInSec: number }>>(`/recordings/${id}/url`),
  };

  // ─── Offline Sync ─────────────────────────────────────────────────────

  readonly sync = {
    pull: (query?: SyncPullQuery) =>
      this.request<ApiResponse<SyncPullResponse>>(
        `/sync/pull?${new URLSearchParams((query as Record<string, any>) ?? {}).toString()}`,
      ),

    push: (data: SyncPushInput) =>
      this.request<ApiResponse<{ results: SyncPushResult[] }>>("/sync/push", {
        method: "POST",
        body: JSON.stringify(data),
      }),
  };

  // ─── Pipeline & Dispositions Config ───────────────────────────────────

  readonly config = {
    get: () => this.request<ApiResponse<Record<string, any>>>("/config"),

    stages: {
      list: () => this.request<ApiResponse<PipelineStage[]>>("/config/stages"),
      create: (data: CreatePipelineStageInput) =>
        this.request<ApiResponse<PipelineStage>>("/config/stages", {
          method: "POST",
          body: JSON.stringify(data),
        }),
    },

    dispositions: {
      list: () => this.request<ApiResponse<DispositionType[]>>("/config/dispositions"),
      create: (data: CreateDispositionTypeInput) =>
        this.request<ApiResponse<DispositionType>>("/config/dispositions", {
          method: "POST",
          body: JSON.stringify(data),
        }),
    },
  };

  // ─── Reports & Dashboard ──────────────────────────────────────────────

  readonly reports = {
    getSummary: () => this.request<ApiResponse<DashboardStats>>("/reports/summary"),
    getCallers: () => this.request<ApiResponse<any[]>>("/reports/callers"),
    getBenchmark: () => this.request<ApiResponse<any>>("/reports/benchmark"),
  };

  // ─── Health Probe ─────────────────────────────────────────────────────

  readonly health = {
    check: () =>
      this.request<{ status: string; timestamp: string; database: string }>("/health"),
  };

  // ─── WhatsApp & Messages ─────────────────────────────────────────────

  readonly messages = {
    sendTemplate: (data: {
      leadId: string;
      templateId?: string;
      templateName?: string;
      parameters?: Record<string, string>;
      forceOutsideHours?: boolean;
    }) =>
      this.request<ApiResponse<any>>("/messages/send", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    listTemplates: () => this.request<ApiResponse<any[]>>("/messages/templates"),
    createTemplate: (data: { waName: string; language?: string; body: string }) =>
      this.request<ApiResponse<any>>("/messages/templates", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    getLeadMessages: (leadId: string) =>
      this.request<ApiResponse<any[]>>(`/messages/lead/${leadId}`),
  };

  // ─── Users (Admin/Manager) ────────────────────────────────────────────

  readonly users = {
    list: (params?: { page?: number; limit?: number }) =>
      this.request<PaginatedResponse<User>>(
        `/users?${new URLSearchParams((params as Record<string, any>) ?? {}).toString()}`,
      ),
    getById: (id: string) => this.request<ApiResponse<User>>(`/users/${id}`),
    create: (data: CreateUserInput) =>
      this.request<ApiResponse<User>>("/users", {
        method: "POST",
        body: JSON.stringify(data),
      }),
    update: (id: string, data: UpdateUserInput) =>
      this.request<ApiResponse<User>>(`/users/${id}`, {
        method: "PATCH",
        body: JSON.stringify(data),
      }),
  };
}

export function createApiClient(config: ApiClientConfig): ApiClient {
  return new ApiClient(config);
}

export type { ApiClient };
