/**
 * Productivity scoring (0–100).
 *
 * Weighted blend of four signals over a period:
 *   - effort:      logged hours vs expected hours            (weight 0.35)
 *   - timeliness:  tasks completed on/before their deadline  (weight 0.25)
 *   - consistency: days logged vs working days in period     (weight 0.20)
 *   - impact:      criticality points delivered vs assigned  (weight 0.20)
 *
 * Impact is what makes a hard task worth more than an easy one: every task
 * carries a 1–10 criticality, and impact is the share of a member's assigned
 * criticality points that they actually finished. Ten trivial tasks (1 pt each)
 * therefore count the same as one mission-critical task (10 pts).
 *
 * Each sub-score is clamped to [0, 1] then combined and scaled to 100.
 */

export const WEIGHTS = {
  effort: 0.35,
  timeliness: 0.25,
  consistency: 0.2,
  impact: 0.2,
};

/** Criticality is a 1–10 integer; anything outside that is coerced back in. */
export const CRITICALITY_MIN = 1;
export const CRITICALITY_MAX = 10;
export const CRITICALITY_DEFAULT = 5;

export interface ScoreInputs {
  hoursWorked: number;
  expectedHours: number;
  tasksCompleted: number;
  tasksCompletedOnTime: number;
  daysLogged: number;
  workingDays: number;
  /** Sum of criticality over the member's DONE tasks. */
  criticalityCompleted: number;
  /** Sum of criticality over every task assigned to the member. */
  criticalityAssigned: number;
}

export interface ScoreBreakdown {
  score: number; // 0–100
  effort: number; // 0–1
  timeliness: number; // 0–1
  consistency: number; // 0–1
  impact: number; // 0–1
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
  // With nothing assigned there is nothing to deliver, so impact is neutral
  // rather than 0 — otherwise an unassigned member is scored as a failure.
  const impact = clamp01(
    i.criticalityAssigned > 0
      ? i.criticalityCompleted / i.criticalityAssigned
      : i.workingDays > 0
      ? 0.6
      : 0
  );

  const score =
    (effort * WEIGHTS.effort +
      timeliness * WEIGHTS.timeliness +
      consistency * WEIGHTS.consistency +
      impact * WEIGHTS.impact) *
    100;

  return {
    score: Math.round(score),
    effort: Math.round(effort * 100) / 100,
    timeliness: Math.round(timeliness * 100) / 100,
    consistency: Math.round(consistency * 100) / 100,
    impact: Math.round(impact * 100) / 100,
  };
}

/** Label for a 1–10 criticality, for badges and tooltips. */
export function criticalityLabel(c: number): {
  label: string;
  tone: "default" | "success" | "warning" | "destructive";
} {
  if (c >= 9) return { label: "Critical", tone: "destructive" };
  if (c >= 7) return { label: "High", tone: "warning" };
  if (c >= 4) return { label: "Medium", tone: "default" };
  return { label: "Low", tone: "success" };
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
