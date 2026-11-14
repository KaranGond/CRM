import type { Role, CallOutcome, CallChannel, CallDirection } from "./schemas";

// ─── Indian Mobile Number Normalization to E.164 ─────────────────────────────
/**
 * Normalizes Indian phone numbers to E.164 (+91XXXXXXXXXX).
 * Strips formatting, handles +91 / 91 / 0 prefixes, and ensures 10-digit format starting with 6-9.
 */
export function normalizePhoneE164(input: string): string {
  if (!input) return "";
  const cleaned = input.replace(/\D/g, "");

  if (cleaned.length === 10 && /^[6-9]\d{9}$/.test(cleaned)) {
    return `+91${cleaned}`;
  }
  if (cleaned.length === 11 && cleaned.startsWith("0") && /^[6-9]\d{9}$/.test(cleaned.slice(1))) {
    return `+91${cleaned.slice(1)}`;
  }
  if (cleaned.length === 12 && cleaned.startsWith("91") && /^[6-9]\d{9}$/.test(cleaned.slice(2))) {
    return `+${cleaned}`;
  }
  if (cleaned.length === 13 && cleaned.startsWith("091") && /^[6-9]\d{9}$/.test(cleaned.slice(3))) {
    return `+${cleaned.slice(1)}`;
  }

  // If already with plus or other format, clean non-digits except initial plus
  const withPlus = input.trim();
  if (withPlus.startsWith("+")) {
    return `+${cleaned}`;
  }
  return cleaned ? `+${cleaned}` : "";
}

/** Check if phone is a valid Indian mobile number */
export function isValidIndianMobile(phone: string): boolean {
  const norm = normalizePhoneE164(phone);
  return /^\+91[6-9]\d{9}$/.test(norm);
}

// ─── Dedupe Key Generation ──────────────────────────────────────────────────
/**
 * Dedupe key algorithm:
 * hash(deviceId + callLogEntryId + startedAt + numberE164)
 * Generates an idempotent deduplication key for SIM calls.
 */
export function generateDedupeKey(
  deviceId: string,
  callLogEntryId: string | number,
  startedAt: string | Date | number,
  numberE164: string,
): string {
  const timestamp = typeof startedAt === "number" ? startedAt : new Date(startedAt).getTime();
  const raw = `${deviceId}_${callLogEntryId}_${timestamp}_${numberE164}`;

  // Deterministic 32-bit FNV-1a hash
  let hash = 0x811c9dc5;
  for (let i = 0; i < raw.length; i++) {
    hash ^= raw.charCodeAt(i);
    hash += (hash << 1) + (hash << 4) + (hash << 7) + (hash << 8) + (hash << 24);
  }
  const hex = (hash >>> 0).toString(16).padStart(8, "0");
  return `call_${hex}_${timestamp}`;
}

// ─── Outcome Determination (SIM Channel) ────────────────────────────────────
/**
 * Route A outcome mapping:
 * Outgoing with durationSec > 0 => CONNECTED
 * Outgoing with durationSec == 0 => NOT_CONNECTED
 */
export function determineCallOutcome(
  direction: CallDirection,
  durationSec: number,
  logType?: number,
): CallOutcome {
  if (direction === "OUTBOUND") {
    return durationSec > 0 ? "CONNECTED" : "NOT_CONNECTED";
  }
  // Incoming: 1 = Incoming, 3 = Missed, 5 = Rejected in Android CallLog.Calls
  if (logType === 3) return "MISSED";
  if (logType === 5) return "REJECTED";
  return durationSec > 0 ? "CONNECTED" : "NOT_CONNECTED";
}

// ─── Formatting Utilities ───────────────────────────────────────────────────

export function formatPhone(phone: string): string {
  const normalized = normalizePhoneE164(phone);
  if (normalized.startsWith("+91") && normalized.length === 13) {
    const digits = normalized.slice(3);
    return `+91 ${digits.slice(0, 5)} ${digits.slice(5)}`;
  }
  return phone;
}

export function formatCallDuration(seconds: number): string {
  if (seconds <= 0) return "0s";
  if (seconds < 60) return `${seconds}s`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins < 60) return secs > 0 ? `${mins}m ${secs}s` : `${mins}m`;
  const hrs = Math.floor(mins / 60);
  const remainMins = mins % 60;
  return remainMins > 0 ? `${hrs}h ${remainMins}m` : `${hrs}h`;
}

export function formatDate(
  isoString: string | Date,
  locale = "en-IN",
  options?: Intl.DateTimeFormatOptions,
): string {
  return new Date(isoString)
    .toLocaleDateString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      ...options,
    })
    .replace(/[\u202f\u00a0]/g, " ");
}

export function formatDateTime(isoString: string | Date, locale = "en-IN"): string {
  return new Date(isoString)
    .toLocaleString(locale, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
    .replace(/[\u202f\u00a0]/g, " ");
}

export function timeAgo(isoString: string | Date): string {
  const diff = Date.now() - new Date(isoString).getTime();
  const seconds = Math.floor(diff / 1000);
  if (seconds < 60) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function truncate(text: string, length = 30): string {
  if (text.length <= length) return text;
  return `${text.slice(0, length)}...`;
}
