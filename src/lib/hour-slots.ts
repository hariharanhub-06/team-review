/**
 * The "hour module": a member's day is split into fixed-size windows starting at
 * their login time, and they report what they did in each one.
 *
 * Example — login 09:36, interval 1h: 09:36–10:36, 10:36–11:36, …
 * The last window is cut short at logout, so a 09:36 login with a 11:00 logout
 * gives 09:36–10:36 and 10:36–11:00.
 *
 * Only the window containing "now" is writable. Once it passes it is frozen, and
 * only an admin can amend it. This module is the single source of truth for that
 * rule: the member UI, the member API (which enforces it) and the admin view all
 * derive their windows from `buildSlots`, so they cannot disagree.
 */

export const MIN_HOUR_INTERVAL = 1;
export const MAX_HOUR_INTERVAL = 24;

const MS_PER_HOUR = 3_600_000;

export interface HourWindow {
  /** Stable identity of the window — its ISO start. */
  key: string;
  startAt: Date;
  endAt: Date;
  /** True when this window contains `now` and the day is still open. */
  active: boolean;
}

export function isValidInterval(hours: unknown): hours is number {
  return (
    typeof hours === "number" &&
    Number.isInteger(hours) &&
    hours >= MIN_HOUR_INTERVAL &&
    hours <= MAX_HOUR_INTERVAL
  );
}

/**
 * Every reporting window for a day, oldest first.
 *
 * Returns [] when the module can't apply — no login, no valid interval. Windows
 * run from login until logout (or until `now` while the day is still open), and
 * the final one is truncated at logout so it never claims time they weren't there.
 */
export function buildSlots(
  loginAt: Date | string | null | undefined,
  logoutAt: Date | string | null | undefined,
  intervalHours: number | null | undefined,
  now: Date = new Date()
): HourWindow[] {
  if (!loginAt || !isValidInterval(intervalHours)) return [];

  const login = new Date(loginAt);
  if (Number.isNaN(login.getTime())) return [];

  const logout = logoutAt ? new Date(logoutAt) : null;
  if (logout && Number.isNaN(logout.getTime())) return [];

  // The day stops at logout; while still open it stops at the current moment.
  const horizon = logout ?? now;
  if (horizon.getTime() <= login.getTime()) return [];

  const step = intervalHours * MS_PER_HOUR;
  const windows: HourWindow[] = [];

  // Guard against a pathological span (e.g. a login left open for weeks) so we
  // never build an unbounded array.
  const maxWindows = Math.ceil((24 * MS_PER_HOUR) / step) + 1;

  for (let i = 0; i < maxWindows; i++) {
    const start = new Date(login.getTime() + i * step);
    if (start.getTime() >= horizon.getTime()) break;

    const naturalEnd = start.getTime() + step;
    // Cut the final window at logout, but never past it.
    const end = new Date(logout ? Math.min(naturalEnd, logout.getTime()) : naturalEnd);

    windows.push({
      key: start.toISOString(),
      startAt: start,
      endAt: end,
      // A closed day has no active window — everything is frozen.
      active:
        !logout && now.getTime() >= start.getTime() && now.getTime() < naturalEnd,
    });
  }

  return windows;
}

/** The window a member may currently write to, or null when the day is closed. */
export function activeSlot(
  loginAt: Date | string | null | undefined,
  logoutAt: Date | string | null | undefined,
  intervalHours: number | null | undefined,
  now: Date = new Date()
): HourWindow | null {
  return (
    buildSlots(loginAt, logoutAt, intervalHours, now).find((w) => w.active) ?? null
  );
}
