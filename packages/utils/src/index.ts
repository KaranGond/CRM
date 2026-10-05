import type {
  CallStatus,
  CallDisposition,
  LeadStatus,
  LeadPriority,
  CampaignStatus,
  Lead,
} from "@telecalling-crm/types";

// ─── Phone Formatting ──────────────────────────────────────────────────────

/**
 * Formats a phone number for display (basic international format).
 * E.g., "+919876543210" → "+91 98765 43210"
 */
export function formatPhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length === 10) {
    return `${cleaned.slice(0, 5)} ${cleaned.slice(5)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("91")) {
    return `+${cleaned.slice(0, 2)} ${cleaned.slice(2, 7)} ${cleaned.slice(7)}`;
  }
  return phone; // return as-is if format is unrecognized
}

// ─── Call Duration ──────────────────────────────────────────────────────────

/**
 * Formats call duration in seconds to "Xm Ys" or "Xh Ym" for display.
 */
export function formatCallDuration(seconds: number): string {
  if (seconds < 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

// ─── Date Formatting ────────────────────────────────────────────────────────

/**
 * Formats an ISO date string to a localized readable date.
 */
export function formatDate(
  isoString: string,
  locale = "en-IN",
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(isoString).toLocaleDateString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    ...options,
  });
}

/**
 * Formats an ISO date string to a localized readable date + time.
 */
export function formatDateTime(isoString: string, locale = "en-IN"): string {
  return new Date(isoString).toLocaleString(locale, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Returns a relative time string like "2 hours ago", "just now", etc.
 */
export function timeAgo(isoString: string): string {
  const now = Date.now();
  const past = new Date(isoString).getTime();
  const diffSec = Math.floor((now - past) / 1000);

  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
  if (diffSec < 604800) return `${Math.floor(diffSec / 86400)}d ago`;
  return formatDate(isoString);
}

// ─── Name Formatting ────────────────────────────────────────────────────────

/**
 * Returns the full name of a lead.
 */
export function getFullName(lead: Pick<Lead, "firstName" | "lastName">): string {
  return `${lead.firstName} ${lead.lastName}`.trim();
}

/**
 * Returns initials from a name string (e.g., "John Doe" → "JD").
 */
export function getInitials(name: string, maxLength = 2): string {
  return name
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, maxLength)
    .join("");
}

// ─── Status Labels & Colors ────────────────────────────────────────────────

const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "New",
  contacted: "Contacted",
  qualified: "Qualified",
  converted: "Converted",
  lost: "Lost",
};

const CALL_STATUS_LABELS: Record<CallStatus, string> = {
  scheduled: "Scheduled",
  ringing: "Ringing",
  in_progress: "In Progress",
  completed: "Completed",
  missed: "Missed",
  failed: "Failed",
};

const CALL_DISPOSITION_LABELS: Record<CallDisposition, string> = {
  interested: "Interested",
  not_interested: "Not Interested",
  callback: "Callback Requested",
  no_answer: "No Answer",
  wrong_number: "Wrong Number",
  voicemail: "Voicemail",
  do_not_call: "Do Not Call",
};

const CAMPAIGN_STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: "Draft",
  active: "Active",
  paused: "Paused",
  completed: "Completed",
};

const LEAD_PRIORITY_LABELS: Record<LeadPriority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

export function getLeadStatusLabel(status: LeadStatus): string {
  return LEAD_STATUS_LABELS[status];
}

export function getCallStatusLabel(status: CallStatus): string {
  return CALL_STATUS_LABELS[status];
}

export function getCallDispositionLabel(disposition: CallDisposition): string {
  return CALL_DISPOSITION_LABELS[disposition];
}

export function getCampaignStatusLabel(status: CampaignStatus): string {
  return CAMPAIGN_STATUS_LABELS[status];
}

export function getLeadPriorityLabel(priority: LeadPriority): string {
  return LEAD_PRIORITY_LABELS[priority];
}

// ─── Misc Helpers ───────────────────────────────────────────────────────────

/**
 * Calculates conversion rate as a percentage.
 */
export function calcConversionRate(
  converted: number,
  total: number,
): number {
  if (total === 0) return 0;
  return Math.round((converted / total) * 10000) / 100; // 2 decimal places
}

/**
 * Truncates text to a max length and appends "…" if needed.
 */
export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength)}…`;
}
