/**
 * Task overdue calculation that accounts for project hold periods.
 *
 * A project can be put "on hold" by an admin. Days spent on hold do NOT count
 * toward a task being overdue:
 *   - While the project is currently on hold, tasks are never overdue (paused).
 *   - Otherwise, overdue days = calendar days past the deadline MINUS total hold days.
 */

export interface HoldInfo {
  onHold: boolean;
  heldDays: number;
  holdSince: string | Date | null;
}

const DAY = 86_400_000;

/** Total days a project has spent on hold (accumulated + current open hold). */
export function totalHoldDays(h: HoldInfo, now: number = Date.now()): number {
  const base = h.heldDays || 0;
  if (h.onHold && h.holdSince) {
    const open = Math.floor((now - new Date(h.holdSince).getTime()) / DAY);
    return base + Math.max(0, open);
  }
  return base;
}

function endOfDay(d: Date): number {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x.getTime();
}

export interface OverdueResult {
  overdue: boolean;
  daysOverdue: number;
  onHold: boolean;
}

export function taskOverdue(
  endDate: string | Date | null | undefined,
  status: string,
  hold: HoldInfo,
  now: number = Date.now()
): OverdueResult {
  const onHold = !!hold.onHold;
  if (!endDate || status === "DONE" || status === "IN_REVIEW") {
    return { overdue: false, daysOverdue: 0, onHold };
  }
  if (onHold) {
    // Deadline is paused while on hold.
    return { overdue: false, daysOverdue: 0, onHold };
  }
  const rawDays = Math.floor((now - endOfDay(new Date(endDate))) / DAY);
  const net = rawDays - totalHoldDays(hold, now);
  return net > 0
    ? { overdue: true, daysOverdue: net, onHold }
    : { overdue: false, daysOverdue: 0, onHold };
}
