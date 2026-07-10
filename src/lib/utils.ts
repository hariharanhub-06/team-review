import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Local calendar day at UTC midnight — used as the canonical DailyLog.date key. */
export function todayUtc(): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function toDateOnly(input: string | Date): Date {
  const d = new Date(input);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

export function formatDate(input?: string | Date | null): string {
  if (!input) return "—";
  const d = new Date(input);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function formatTime(input?: string | Date | null): string {
  if (!input) return "—";
  const d = new Date(input);
  return d.toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function formatDateTime(input?: string | Date | null): string {
  if (!input) return "—";
  return `${formatDate(input)} ${formatTime(input)}`;
}

/** Hours between two timestamps, 0 if incomplete. */
export function hoursBetween(a?: Date | string | null, b?: Date | string | null): number {
  if (!a || !b) return 0;
  const ms = new Date(b).getTime() - new Date(a).getTime();
  return ms > 0 ? ms / 3_600_000 : 0;
}

export function round(n: number, dp = 1): number {
  const f = 10 ** dp;
  return Math.round(n * f) / f;
}

export type SessionStatus = "COMPLETED" | "ACTIVE" | "UNCALCULATED" | "ABSENT";

/**
 * Derive a day's session status from login/logout timestamps.
 * - COMPLETED    : logged in and logged out.
 * - ACTIVE       : logged in, not yet logged out, still within the grace window
 *                  (until 12:00 / noon the day AFTER the log date).
 * - UNCALCULATED : logged in, never logged out, and the grace window has passed
 *                  (hours cannot be calculated).
 * - ABSENT       : never logged in.
 */
export function sessionStatus(
  date: string | Date,
  loginAt?: string | Date | null,
  logoutAt?: string | Date | null,
  now: Date = new Date()
): SessionStatus {
  if (!loginAt) return "ABSENT";
  if (logoutAt) return "COMPLETED";
  const cutoff = new Date(date);
  cutoff.setUTCHours(0, 0, 0, 0);
  cutoff.setUTCDate(cutoff.getUTCDate() + 1); // next day
  cutoff.setUTCHours(12, 0, 0, 0); // 12:00 (noon) the next day
  return now.getTime() > cutoff.getTime() ? "UNCALCULATED" : "ACTIVE";
}

/** Format a decimal-hours value as "Xh Ym" (e.g. 3.5 -> "3h 30m", 0.75 -> "45m"). */
export function formatDuration(hours?: number | null): string {
  if (!hours || hours <= 0) return "0m";
  const totalMinutes = Math.round(hours * 60);
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

/** Format a decimal-hours value as "Xh Ym Zs" with second precision (e.g. 0.0872 -> "5m 14s"). */
export function formatDurationPrecise(hours?: number | null): string {
  if (!hours || hours <= 0) return "0s";
  const totalSeconds = Math.round(hours * 3600);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  const parts: string[] = [];
  if (h) parts.push(`${h}h`);
  if (m) parts.push(`${m}m`);
  if (s || parts.length === 0) parts.push(`${s}s`);
  return parts.join(" ");
}
