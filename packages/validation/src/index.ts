import { z } from "zod";

// ─── Shared Validators ──────────────────────────────────────────────────────

const phoneRegex = /^\+?[1-9]\d{6,14}$/;

export const phoneSchema = z
  .string()
  .regex(phoneRegex, "Invalid phone number format");

export const emailSchema = z.string().email("Invalid email address");

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ─── User Schemas ───────────────────────────────────────────────────────────

export const userRoleSchema = z.enum(["admin", "manager", "agent"]);

export const createUserSchema = z.object({
  email: emailSchema,
  name: z.string().min(2).max(100),
  role: userRoleSchema,
  phone: phoneSchema,
  avatarUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
});

export const updateUserSchema = createUserSchema.partial();

// ─── Lead Schemas ───────────────────────────────────────────────────────────

export const leadStatusSchema = z.enum([
  "new",
  "contacted",
  "qualified",
  "converted",
  "lost",
]);

export const leadSourceSchema = z.enum(["manual", "import", "web", "referral"]);

export const leadPrioritySchema = z.enum(["low", "medium", "high"]);

export const createLeadSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: emailSchema,
  phone: phoneSchema,
  company: z.string().max(200).optional(),
  designation: z.string().max(100).optional(),
  status: leadStatusSchema.default("new"),
  source: leadSourceSchema,
  priority: leadPrioritySchema.default("medium"),
  assignedTo: z.string().uuid().optional(),
  campaignId: z.string().uuid().optional(),
  notes: z.string().max(2000).optional(),
  tags: z.array(z.string().max(50)).default([]),
});

export const updateLeadSchema = createLeadSchema.partial();

// ─── Call Schemas ───────────────────────────────────────────────────────────

export const callStatusSchema = z.enum([
  "scheduled",
  "ringing",
  "in_progress",
  "completed",
  "missed",
  "failed",
]);

export const callDispositionSchema = z.enum([
  "interested",
  "not_interested",
  "callback",
  "no_answer",
  "wrong_number",
  "voicemail",
  "do_not_call",
]);

export const callDirectionSchema = z.enum(["outbound", "inbound"]);

export const createCallSchema = z.object({
  leadId: z.string().uuid(),
  agentId: z.string().uuid(),
  campaignId: z.string().uuid().optional(),
  direction: callDirectionSchema.default("outbound"),
  status: callStatusSchema.default("scheduled"),
  disposition: callDispositionSchema.optional(),
  scheduledAt: z.string().datetime().optional(),
  startedAt: z.string().datetime().optional(),
  endedAt: z.string().datetime().optional(),
  duration: z.number().int().min(0).default(0),
  notes: z.string().max(2000).optional(),
  recordingUrl: z.string().url().optional(),
});

export const updateCallSchema = z.object({
  status: callStatusSchema.optional(),
  disposition: callDispositionSchema.optional(),
  endedAt: z.string().datetime().optional(),
  duration: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  recordingUrl: z.string().url().optional(),
});

// ─── Campaign Schemas ───────────────────────────────────────────────────────

export const campaignStatusSchema = z.enum([
  "draft",
  "active",
  "paused",
  "completed",
]);

export const createCampaignSchema = z.object({
  name: z.string().min(2).max(200),
  description: z.string().max(2000).optional(),
  status: campaignStatusSchema.default("draft"),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  script: z.string().max(10000).optional(),
  createdBy: z.string().uuid(),
});

export const updateCampaignSchema = createCampaignSchema
  .omit({ createdBy: true })
  .partial();

// ─── Inferred Types ─────────────────────────────────────────────────────────

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
export type CreateCallInput = z.infer<typeof createCallSchema>;
export type UpdateCallInput = z.infer<typeof updateCallSchema>;
export type CreateCampaignInput = z.infer<typeof createCampaignSchema>;
export type UpdateCampaignInput = z.infer<typeof updateCampaignSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
