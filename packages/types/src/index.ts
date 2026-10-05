// ─── User ────────────────────────────────────────────────────────────────────

export type UserRole = "admin" | "manager" | "agent";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  phone: string;
  avatarUrl?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type CreateUserDto = Omit<User, "id" | "createdAt" | "updatedAt">;
export type UpdateUserDto = Partial<CreateUserDto>;

// ─── Lead ────────────────────────────────────────────────────────────────────

export type LeadStatus =
  | "new"
  | "contacted"
  | "qualified"
  | "converted"
  | "lost";

export type LeadSource = "manual" | "import" | "web" | "referral";

export type LeadPriority = "low" | "medium" | "high";

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  company?: string;
  designation?: string;
  status: LeadStatus;
  source: LeadSource;
  priority: LeadPriority;
  assignedTo?: string;
  campaignId?: string;
  notes?: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

export type CreateLeadDto = Omit<Lead, "id" | "createdAt" | "updatedAt">;
export type UpdateLeadDto = Partial<CreateLeadDto>;

// ─── Call ────────────────────────────────────────────────────────────────────

export type CallStatus =
  | "scheduled"
  | "ringing"
  | "in_progress"
  | "completed"
  | "missed"
  | "failed";

export type CallDisposition =
  | "interested"
  | "not_interested"
  | "callback"
  | "no_answer"
  | "wrong_number"
  | "voicemail"
  | "do_not_call";

export type CallDirection = "outbound" | "inbound";

export interface Call {
  id: string;
  leadId: string;
  agentId: string;
  campaignId?: string;
  direction: CallDirection;
  status: CallStatus;
  disposition?: CallDisposition;
  scheduledAt?: string;
  startedAt?: string;
  endedAt?: string;
  duration: number; // seconds
  notes?: string;
  recordingUrl?: string;
  createdAt: string;
}

export type CreateCallDto = Omit<Call, "id" | "createdAt">;
export type UpdateCallDto = Partial<
  Pick<Call, "status" | "disposition" | "endedAt" | "duration" | "notes" | "recordingUrl">
>;

// ─── Campaign ────────────────────────────────────────────────────────────────

export type CampaignStatus = "draft" | "active" | "paused" | "completed";

export interface Campaign {
  id: string;
  name: string;
  description?: string;
  status: CampaignStatus;
  startDate?: string;
  endDate?: string;
  script?: string; // call script for agents
  totalLeads: number;
  contactedLeads: number;
  convertedLeads: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type CreateCampaignDto = Omit<
  Campaign,
  "id" | "totalLeads" | "contactedLeads" | "convertedLeads" | "createdAt" | "updatedAt"
>;
export type UpdateCampaignDto = Partial<CreateCampaignDto>;

// ─── API Responses ───────────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  message: string;
  error?: string;
}

// ─── Dashboard Stats ─────────────────────────────────────────────────────────

export interface DashboardStats {
  totalLeads: number;
  totalCalls: number;
  totalAgents: number;
  activeCampaigns: number;
  callsToday: number;
  conversionRate: number;
  avgCallDuration: number;
}
