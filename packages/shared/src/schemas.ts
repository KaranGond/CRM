import { z } from "zod";
import { normalizePhoneE164 } from "./utils";

// ─── Shared Primitives & Enums ──────────────────────────────────────────────

export const roleSchema = z.enum(["admin", "manager", "telecaller"]);
export type Role = z.infer<typeof roleSchema>;
export type UserRole = Role;
export const userRoleSchema = roleSchema;

export const callChannelSchema = z.enum(["SIM", "CLOUD"]);
export type CallChannel = z.infer<typeof callChannelSchema>;

export const callDirectionSchema = z.enum(["OUTBOUND", "INBOUND"]);
export type CallDirection = z.infer<typeof callDirectionSchema>;

export const callOutcomeSchema = z.enum(["CONNECTED", "NOT_CONNECTED", "MISSED", "REJECTED"]);
export type CallOutcome = z.infer<typeof callOutcomeSchema>;

export const callOriginSchema = z.enum(["ENGINE", "RECONCILE", "WEBHOOK"]);
export type CallOrigin = z.infer<typeof callOriginSchema>;

export const recordingSourceSchema = z.enum(["PHONE_FILE", "PROVIDER"]);
export type RecordingSource = z.infer<typeof recordingSourceSchema>;

export const recordingStatusSchema = z.enum([
  "PENDING",
  "MATCHED",
  "UPLOADED",
  "FAILED",
  "MISSING",
  "NOT_APPLICABLE",
  "UNSUPPORTED_DEVICE",
]);
export type RecordingStatus = z.infer<typeof recordingStatusSchema>;

export const consentTypeSchema = z.enum(["WHATSAPP", "RECORDING", "CALL"]);
export type ConsentType = z.infer<typeof consentTypeSchema>;

export const importJobStatusSchema = z.enum(["PENDING", "PROCESSING", "COMPLETED", "FAILED"]);
export type ImportJobStatus = z.infer<typeof importJobStatusSchema>;

export const phoneSchema = z
  .string()
  .min(10)
  .transform((val) => normalizePhoneE164(val))
  .refine((val) => val.length >= 10, { message: "Invalid mobile number" });

export const emailSchema = z.string().email("Invalid email address");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type PaginationInput = z.infer<typeof paginationSchema>;

// ─── User ───────────────────────────────────────────────────────────────────

export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(2).max(100),
  password: z.string().min(8).max(128),
  phone: phoneSchema,
  role: roleSchema.default("telecaller"),
  active: z.boolean().default(true),
});
export type CreateUserInput = z.infer<typeof createUserSchema>;

export const updateUserSchema = createUserSchema.omit({ password: true }).partial();
export type UpdateUserInput = z.infer<typeof updateUserSchema>;

export interface User {
  id: string;
  email: string;
  name: string;
  phone: string;
  role: Role;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Device ─────────────────────────────────────────────────────────────────

export const deviceDiagnosticsSchema = z.object({
  batteryOptimized: z.boolean().optional(),
  permissionsGranted: z.record(z.boolean()).optional(),
  recorderFolderConfigured: z.boolean().optional(),
  outboxPendingCount: z.number().int().optional(),
  lastCallLogReadAt: z.string().optional(),
  lastSyncAt: z.string().optional(),
  lastError: z.string().nullable().optional(),
  networkType: z.string().optional(),
  simSlots: z.number().int().optional(),
});
export type DeviceDiagnostics = z.infer<typeof deviceDiagnosticsSchema>;

export const registerDeviceSchema = z.object({
  id: z.string().min(1),
  model: z.string(),
  androidVersion: z.string(),
  appVersion: z.string(),
  engineVersion: z.string(),
  fcmToken: z.string().optional(),
  diagnostics: deviceDiagnosticsSchema.optional(),
});
export type RegisterDeviceInput = z.infer<typeof registerDeviceSchema>;

export const heartbeatDeviceSchema = z.object({
  fcmToken: z.string().optional(),
  appVersion: z.string().optional(),
  engineVersion: z.string().optional(),
  clockOffsetMs: z.number().optional(),
  diagnostics: deviceDiagnosticsSchema.optional(),
});
export type HeartbeatDeviceInput = z.infer<typeof heartbeatDeviceSchema>;

export interface Device {
  id: string;
  userId: string;
  model: string;
  androidVersion: string;
  appVersion: string;
  engineVersion: string;
  fcmToken: string | null;
  lastSeenAt: string;
  diagnostics: Record<string, any> | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Auth ───────────────────────────────────────────────────────────────────

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1),
  deviceId: z.string().min(1).optional(),
  deviceInfo: registerDeviceSchema.optional(),
});
export type LoginInput = z.infer<typeof loginSchema>;

export const registerSchema = createUserSchema;
export type RegisterInput = CreateUserInput;

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
  deviceId: z.string().min(1),
});
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

// ─── Pipeline Stage & Disposition Type ──────────────────────────────────────

export const createPipelineStageSchema = z.object({
  label: z.string().min(1).max(100),
  order: z.number().int().default(0),
  active: z.boolean().default(true),
});
export type CreatePipelineStageInput = z.infer<typeof createPipelineStageSchema>;

export interface PipelineStage {
  id: string;
  label: string;
  order: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
}

export const createDispositionTypeSchema = z.object({
  label: z.string().min(1).max(100),
  order: z.number().int().default(0),
  active: z.boolean().default(true),
  setsStageId: z.string().uuid().nullable().optional(),
  requiresFollowUp: z.boolean().default(false),
  templateId: z.string().uuid().nullable().optional(),
});
export type CreateDispositionTypeInput = z.infer<typeof createDispositionTypeSchema>;

export interface DispositionType {
  id: string;
  label: string;
  order: number;
  active: boolean;
  setsStageId: string | null;
  requiresFollowUp: boolean;
  templateId: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Lead ───────────────────────────────────────────────────────────────────

export const createLeadSchema = z.object({
  name: z.string().min(1).max(100),
  phoneE164: phoneSchema,
  altPhones: z.array(z.string()).default([]),
  source: z.string().default("manual"),
  stageId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  nextFollowUpAt: z.string().datetime().optional(),
  customFields: z.record(z.any()).default({}),
  dnd: z.boolean().default(false),
});
export type CreateLeadInput = z.infer<typeof createLeadSchema>;

export const updateLeadSchema = createLeadSchema.partial();
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;

export const assignLeadSchema = z.object({
  toUserId: z.string().uuid(),
  reason: z.string().default("Manual assignment"),
});
export type AssignLeadInput = z.infer<typeof assignLeadSchema>;

export const bulkAssignLeadSchema = z.object({
  leadIds: z.array(z.string().uuid()).min(1),
  toUserId: z.string().uuid(),
  reason: z.string().default("Bulk assignment"),
});
export type BulkAssignLeadInput = z.infer<typeof bulkAssignLeadSchema>;

export const importLeadItemSchema = z.object({
  name: z.string().min(1).max(100),
  phone: z.string().min(1),
  altPhones: z.array(z.string()).optional(),
  source: z.string().optional(),
  stageId: z.string().uuid().optional(),
  assigneeId: z.string().uuid().optional(),
  customFields: z.record(z.any()).optional(),
  notes: z.string().optional(),
});
export type ImportLeadItem = z.infer<typeof importLeadItemSchema>;

export const importLeadsSchema = z.object({
  leads: z.array(importLeadItemSchema).min(1),
  autoRoundRobin: z.boolean().optional(),
  defaultStageId: z.string().uuid().optional(),
  defaultAssigneeId: z.string().uuid().optional(),
});
export type ImportLeadsInput = z.infer<typeof importLeadsSchema>;

export interface Lead {
  id: string;
  name: string;
  phoneE164: string;
  altPhones: string[];
  source: string;
  stageId: string | null;
  assigneeId: string | null;
  nextFollowUpAt: string | null;
  customFields: Record<string, any> | null;
  dnd: boolean;
  createdAt: string;
  updatedAt: string;
}

// ─── Call Log ───────────────────────────────────────────────────────────────

export const createCallLogEntrySchema = z.object({
  id: z.string().uuid().optional(),
  leadId: z.string().uuid().nullable().optional(),
  deviceId: z.string().min(1),
  channel: callChannelSchema.default("SIM"),
  provider: z.string().nullable().optional(),
  providerCallId: z.string().nullable().optional(),
  dedupeKey: z.string().min(1),
  direction: callDirectionSchema.default("OUTBOUND"),
  numberE164: phoneSchema,
  startedAt: z.string().datetime(),
  endedAt: z.string().datetime(),
  durationSec: z.number().int().min(0),
  outcome: callOutcomeSchema,
  sim: z.string().nullable().optional(),
  dispositionId: z.string().uuid().nullable().optional(),
  remark: z.string().max(2000).nullable().optional(),
  followUpAt: z.string().datetime().nullable().optional(),
  recordingId: z.string().uuid().nullable().optional(),
  recordingStatus: recordingStatusSchema.default("PENDING"),
  origin: callOriginSchema.default("ENGINE"),
});
export type CreateCallLogEntryInput = z.infer<typeof createCallLogEntrySchema>;

export const postCallsBatchSchema = z.object({
  calls: z.array(createCallLogEntrySchema).min(1),
});
export type PostCallsBatchInput = z.infer<typeof postCallsBatchSchema>;

export const updateCallLogDispositionSchema = z.object({
  dispositionId: z.string().uuid(),
  remark: z.string().max(2000).optional(),
  followUpAt: z.string().datetime().optional(),
});
export type UpdateCallLogDispositionInput = z.infer<typeof updateCallLogDispositionSchema>;

export interface CallLog {
  id: string;
  leadId: string | null;
  callerId: string;
  deviceId: string;
  channel: CallChannel;
  provider: string | null;
  providerCallId: string | null;
  dedupeKey: string;
  direction: CallDirection;
  numberE164: string;
  startedAt: string;
  endedAt: string;
  durationSec: number;
  outcome: CallOutcome;
  sim: string | null;
  dispositionId: string | null;
  remark: string | null;
  followUpAt: string | null;
  recordingId: string | null;
  recordingStatus: RecordingStatus;
  origin: CallOrigin;
  createdAt: string;
  updatedAt: string;
}
export type Call = CallLog;

// ─── Follow-Up ──────────────────────────────────────────────────────────────

export const createFollowUpSchema = z.object({
  leadId: z.string().uuid(),
  dueAt: z.string().datetime(),
  note: z.string().max(2000).optional(),
});
export type CreateFollowUpInput = z.infer<typeof createFollowUpSchema>;

export const updateFollowUpSchema = z.object({
  dueAt: z.string().datetime().optional(),
  note: z.string().max(2000).optional(),
  done: z.boolean().optional(),
});
export type UpdateFollowUpInput = z.infer<typeof updateFollowUpSchema>;

export interface FollowUp {
  id: string;
  leadId: string;
  userId: string;
  dueAt: string;
  note: string | null;
  doneAt: string | null;
  createdAt: string;
  updatedAt: string;
}

// ─── Recording ──────────────────────────────────────────────────────────────

export const requestUploadUrlSchema = z.object({
  callLogId: z.string().uuid().optional(),
  fileName: z.string().min(1),
  durationSec: z.number().int().min(0).default(0),
  sizeBytes: z.number().int().min(0).default(0),
  source: recordingSourceSchema.default("PHONE_FILE"),
});
export type RequestUploadUrlInput = z.infer<typeof requestUploadUrlSchema>;

export const linkRecordingSchema = z.object({
  callLogId: z.string().uuid(),
  storageKey: z.string().min(1),
  source: recordingSourceSchema.default("PHONE_FILE"),
  durationSec: z.number().int().min(0).default(0),
  sizeBytes: z.number().int().min(0).default(0),
});
export type LinkRecordingInput = z.infer<typeof linkRecordingSchema>;

export interface Recording {
  id: string;
  callLogId: string | null;
  storageKey: string;
  source: RecordingSource;
  durationSec: number;
  sizeBytes: number;
  status: RecordingStatus;
  createdAt: string;
  updatedAt: string;
}

// ─── Offline Sync Layer (Section 9) ─────────────────────────────────────────

export const syncPullQuerySchema = z.object({
  cursor: z.coerce.number().int().min(0).default(0),
  limit: z.coerce.number().int().min(1).max(500).default(100),
});
export type SyncPullQuery = z.infer<typeof syncPullQuerySchema>;

export const syncMutationSchema = z.object({
  mutationId: z.string().min(1),
  type: z.enum([
    "CALL_CAPTURED",
    "DISPOSITION_SAVED",
    "FOLLOWUP_DONE",
    "FOLLOWUP_CREATED",
    "LEAD_UPDATED",
    "LEAD_CREATED",
  ]),
  payload: z.record(z.any()),
  clientTimestamp: z.string().datetime(),
});
export type SyncMutation = z.infer<typeof syncMutationSchema>;

export const syncPushSchema = z.object({
  deviceId: z.string().min(1),
  mutations: z.array(syncMutationSchema).min(1),
});
export type SyncPushInput = z.infer<typeof syncPushSchema>;

export interface SyncPushResult {
  mutationId: string;
  status: "applied" | "duplicate" | "conflict" | "rejected";
  error?: string;
  serverRecord?: any;
}

export interface SyncPullResponse {
  nextCursor: number;
  hasMore: boolean;
  serverTimestamp: string;
  changes: {
    seq: number;
    entityType: string;
    entityId: string;
    operation: string;
    data: any;
  }[];
}

// ─── API Envelope Responses & Errors ────────────────────────────────────────

export interface ApiResponse<T> {
  success: boolean;
  data: T;
  message?: string;
}

export interface PaginatedResponse<T> {
  success: boolean;
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ApiError {
  statusCode: number;
  message: string | string[];
  error?: string;
}

export interface DashboardStats {
  totalLeads: number;
  callsToday: number;
  connectedCallsToday: number;
  avgDurationSec: number;
  pendingFollowUps: number;
  activeCallers: number;
}

export interface CallerAuditReportItem {
  callerId: string;
  name: string;
  email: string;
  phone: string;
  lastSeenAt: string | null;
  deviceModel: string;
  appVersion: string | null;
  dialsToday: number;
  connectsToday: number;
  connectRate: number;
  totalTalkTimeSec: number;
  recordedCalls: number;
  unsupportedCalls: number;
  recordingCoverage: number;
  deviceSupported: boolean;
}

export interface OEMRecorderProfile {
  brand: string;
  folderPaths: string[];
  fileExtensions: string[];
  filenamePattern: string;
  setupInstructions: string;
}

export const OEM_RECORDER_PROFILES: Record<string, OEMRecorderProfile> = {
  samsung: {
    brand: "Samsung",
    folderPaths: ["Recordings/Call", "Sounds/Call", "Call"],
    fileExtensions: [".m4a", ".amr", ".mp3"],
    filenamePattern: "^Call with (.*?)_(\\+?\\d+)_(\\d{6})_(\\d{6})\\.(m4a|amr|mp3)$",
    setupInstructions:
      "Set Samsung Phone as default dialer. Enable 'Auto record calls' in Phone Settings > Record calls.",
  },
  xiaomi: {
    brand: "Xiaomi / Redmi / Poco",
    folderPaths: ["MIUI/sound_recorder/call_rec", "sound_recorder/call_rec"],
    fileExtensions: [".mp3", ".aac", ".wav", ".m4a"],
    filenamePattern: "^(.*?)(\\(\\+?\\d+\\))?_(\\d{8})(\\d{6})\\.(mp3|aac|wav)$",
    setupInstructions:
      "Use Mi Dialer / Sound Recorder app. Enable 'Record calls automatically' in Call Settings.",
  },
  vivo: {
    brand: "Vivo / iQOO",
    folderPaths: ["Record/Call", "Recordings/Call"],
    fileExtensions: [".amr", ".mp3", ".aac", ".m4a"],
    filenamePattern: "^(\\+?\\d+)_(\\d{8})(\\d{6})\\.(amr|mp3|aac)$",
    setupInstructions:
      "Use Vivo Phone app. Enable 'Record all calls automatically' in Phone Settings.",
  },
  oppo: {
    brand: "Oppo / Realme / OnePlus",
    folderPaths: ["Recordings/Call Recordings", "Record/Call", "Music/Recordings/Call Recordings"],
    fileExtensions: [".aac", ".mp3", ".m4a"],
    filenamePattern: "^(\\+?\\d+)_(\\d{8})(\\d{6})\\.(aac|mp3|m4a)$",
    setupInstructions:
      "Install ODialer app from official app market for native auto-call recording without announcement.",
  },
  generic: {
    brand: "Universal Android",
    folderPaths: ["Recordings/Call", "Record/Call", "Voice/Call"],
    fileExtensions: [".m4a", ".mp3", ".aac", ".amr", ".wav"],
    filenamePattern: ".*",
    setupInstructions:
      "Pick your recorder folder via SAF picker. Ensure your phone dialer is set to auto-record.",
  },
};
