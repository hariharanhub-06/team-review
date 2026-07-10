/**
 * Productivity scoring (0–100).
 *
 * Weighted blend of three signals over a period:
 *   - effort:      logged hours vs expected hours          (weight 0.45)
 *   - timeliness:  tasks completed on/before their deadline (weight 0.30)
 *   - consistency: days logged vs working days in period    (weight 0.25)
 *
 * Each sub-score is clamped to [0, 1] then combined and scaled to 100.
 */

export const WEIGHTS = { effort: 0.45, timeliness: 0.3, consistency: 0.25 };

export interface ScoreInputs {
  hoursWorked: number;
  expectedHours: number;
  tasksCompleted: number;
  tasksCompletedOnTime: number;
  daysLogged: number;
  workingDays: number;
}

export interface ScoreBreakdown {
  score: number; // 0–100
  effort: number; // 0–1
  timeliness: number; // 0–1
  consistency: number; // 0–1
}

function clamp01(n: number): number {
  if (Number.isNaN(n) || !Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(1, n));
}

export function computeScore(i: ScoreInputs): ScoreBreakdown {
  const effort = clamp01(i.expectedHours > 0 ? i.hoursWorked / i.expectedHours : 0);
  const timeliness = clamp01(
    i.tasksCompleted > 0 ? i.tasksCompletedOnTime / i.tasksCompleted : i.workingDays > 0 ? 0.6 : 0
  );
  const consistency = clamp01(i.workingDays > 0 ? i.daysLogged / i.workingDays : 0);

  const score =
    (effort * WEIGHTS.effort +
      timeliness * WEIGHTS.timeliness +
      consistency * WEIGHTS.consistency) *
    100;

  return {
    score: Math.round(score),
    effort: Math.round(effort * 100) / 100,
    timeliness: Math.round(timeliness * 100) / 100,
    consistency: Math.round(consistency * 100) / 100,
  };
}

export function scoreLabel(score: number): { label: string; tone: "success" | "warning" | "destructive" } {
  if (score >= 80) return { label: "Excellent", tone: "success" };
  if (score >= 60) return { label: "Good", tone: "success" };
  if (score >= 40) return { label: "Fair", tone: "warning" };
  return { label: "Needs attention", tone: "destructive" };
}

/** Count weekdays (Mon–Fri) between two dates inclusive. */
export function workingDaysBetween(start: Date, end: Date): number {
  let count = 0;
  const d = new Date(start);
  d.setUTCHours(0, 0, 0, 0);
  const last = new Date(end);
  last.setUTCHours(0, 0, 0, 0);
  while (d <= last) {
    const day = d.getUTCDay();
    if (day !== 0 && day !== 6) count++;
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return count;
}
