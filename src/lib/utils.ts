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
