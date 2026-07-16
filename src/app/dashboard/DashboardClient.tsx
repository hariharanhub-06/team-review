"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Input,
  Label,
  Select,
  StatCard,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import {
  cn,
  formatDate,
  formatDuration,
  formatDurationPrecise,
  formatTime,
  hoursBetween,
  round,
} from "@/lib/utils";
import { criticalityLabel } from "@/lib/scoring";
import { buildSlots } from "@/lib/hour-slots";

/* ---------------- Types ---------------- */
type DayStatus = "COMPLETED" | "IN_PROGRESS" | "BLOCKED";

interface SerializedProject {
  id: string;
  name: string;
}

interface SerializedTask {
  id: string;
  title: string;
  projectId: string;
  projectName: string;
  status: string;
  criticality: number;
  endDate: string | null;
  completedAt: string | null;
  submittedAt: string | null;
  reviewNote: string | null;
  hoursWorked: number;
  isOverdue: boolean;
  daysOverdue: number;
  onHold: boolean;
}

interface SerializedWorkEntry {
  id: string;
  dailyLogId: string;
  projectId: string;
  taskId?: string | null;
  taskDescription: string;
  hoursWorked: number;
  project?: { id: string; name: string } | null;
}

type BreakType = "LUNCH" | "SHORT" | "OTHER";

interface SerializedBreak {
  id: string;
  dailyLogId: string;
  type: BreakType;
  startAt: string;
  endAt: string | null;
}

interface SerializedHourSlot {
  id: string;
  startAt: string;
  endAt: string;
  content: string;
}

interface SerializedLog {
  id: string;
  userId: string;
  date: string;
  loginAt: string | null;
  logoutAt: string | null;
  plannedWork: string | null;
  workCompleted: string | null;
  status: DayStatus | null;
  remarks: string | null;
  workEntries: SerializedWorkEntry[];
  breaks: SerializedBreak[];
  hourSlots?: SerializedHourSlot[];
}

const BREAK_LABELS: Record<BreakType, string> = {
  LUNCH: "Lunch",
  SHORT: "Short break",
  OTHER: "Other",
};

/** Read-only past work log, as returned by GET /api/my-history. */
interface HistoryDay {
  id: string;
  date: string;
  loginAt: string | null;
  logoutAt: string | null;
  status: DayStatus | null;
  plannedWork: string | null;
  workCompleted: string | null;
  remarks: string | null;
  loginHours: number;
  breakHours: number;
  netHours: number;
  workHours: number;
  entries: { id: string; project: string; taskDescription: string; hours: number }[];
  breaks: SerializedBreak[];
}

/** One labelled free-text block from the login/logout forms. Mirrors the admin view. */
function NoteBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="whitespace-pre-wrap break-words rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground">
        {text}
      </div>
    </div>
  );
}

/**
 * Expanded day-detail: notes, work-hour split, and breaks — the same panel an
 * admin sees on the Work Logs page, with no edit controls.
 */
function HistoryRowDetail({ day }: { day: HistoryDay }) {
  const notes = [
    { title: "Planned Work (at login)", text: day.plannedWork?.trim() ?? "" },
    { title: "Work Completed (at logout)", text: day.workCompleted?.trim() ?? "" },
    { title: "Remarks", text: day.remarks?.trim() ?? "" },
  ].filter((n) => n.text.length > 0);

  const total = day.workHours > 0 ? day.workHours : 0;

  return (
    <div className="space-y-5 px-2 py-4">
      {/* Session summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          Login:{" "}
          <span className="font-medium text-foreground">{formatTime(day.loginAt)}</span>
        </span>
        <span className="text-muted-foreground">
          Logout:{" "}
          <span className="font-medium text-foreground">{formatTime(day.logoutAt)}</span>
        </span>
        <span className="text-muted-foreground">
          Break total:{" "}
          <span className="font-medium text-[hsl(var(--warning))]">
            {formatDurationPrecise(day.breakHours)}
          </span>
        </span>
        <span className="text-muted-foreground">
          Net active:{" "}
          <span className="font-medium text-foreground">
            {formatDurationPrecise(day.netHours)}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Notes */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Notes
          </h4>
          {notes.length === 0 ? (
            <p className="text-sm text-muted-foreground">No notes recorded.</p>
          ) : (
            <div className="space-y-3">
              {notes.map((n) => (
                <NoteBlock key={n.title} title={n.title} text={n.text} />
              ))}
            </div>
          )}
        </div>

        {/* Work-hours split */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Work hours split
          </h4>
          {day.entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">No work entries logged.</p>
          ) : (
            <div className="overflow-x-auto scroll-thin rounded-md border border-border">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30 text-left uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2 font-medium">Project</th>
                    <th className="px-3 py-2 font-medium">Task</th>
                    <th className="px-3 py-2 text-right font-medium">Hours</th>
                    <th className="w-32 px-3 py-2 font-medium">Share</th>
                  </tr>
                </thead>
                <tbody>
                  {day.entries.map((entry) => {
                    const pct = total > 0 ? (entry.hours / total) * 100 : 0;
                    return (
                      <tr key={entry.id} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {entry.project}
                        </td>
                        <td className="break-words px-3 py-2 text-muted-foreground">
                          {entry.taskDescription}
                        </td>
                        <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums text-foreground">
                          {formatDurationPrecise(entry.hours)}
                        </td>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-primary"
                                style={{ width: `${pct}%` }}
                              />
                            </div>
                            <span className="w-10 shrink-0 text-right tabular-nums text-muted-foreground">
                              {Math.round(pct)}%
                            </span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                <tfoot>
                  <tr className="border-t border-border bg-muted/30 font-semibold text-foreground">
                    <td className="px-3 py-2" colSpan={2}>
                      Total
                    </td>
                    <td className="whitespace-nowrap px-3 py-2 text-right tabular-nums">
                      {formatDurationPrecise(day.workHours)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      100%
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Breaks */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Breaks
        </h4>
        {day.breaks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No breaks taken.</p>
        ) : (
          <ul className="space-y-1">
            {day.breaks.map((b) => (
              <li
                key={b.id}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
              >
                <Badge tone="warning">{BREAK_LABELS[b.type]}</Badge>
                <span className="tabular-nums text-muted-foreground">
                  {formatTime(b.startAt)} → {b.endAt ? formatTime(b.endAt) : "ongoing"}
                </span>
                {b.endAt && (
                  <span className="ml-auto font-medium tabular-nums text-[hsl(var(--warning))]">
                    {formatDurationPrecise(hoursBetween(b.startAt, b.endAt))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

interface EntryRow {
  key: string;
  projectId: string;
  taskId: string; // "" when custom / no task
  taskDescription: string;
  hoursWorked: string;
  custom: boolean; // true = free-text task (no matching assigned task)
}

function rowKey() {
  return Math.random().toString(36).slice(2);
}

function entriesToRows(
  entries: SerializedWorkEntry[],
  tasks: SerializedTask[]
): EntryRow[] {
  if (!entries.length) return [blankRow()];
  return entries.map((e) => {
    const matchedById = e.taskId
      ? tasks.find((t) => t.id === e.taskId)
      : undefined;
    const isCustom = !matchedById && e.taskDescription.length > 0;
    return {
      key: rowKey(),
      projectId: e.projectId,
      taskId: matchedById?.id ?? "",
      taskDescription: e.taskDescription,
      hoursWorked: String(e.hoursWorked),
      custom: isCustom,
    };
  });
}

function blankRow(): EntryRow {
  return {
    key: rowKey(),
    projectId: "",
    taskId: "",
    taskDescription: "",
    hoursWorked: "",
    custom: false,
  };
}

const CUSTOM_TASK = "__custom__";

/* ---------------- Hours Report (hour module) ---------------- */
/**
 * The day split into fixed windows from the login time. Only the window holding
 * "now" is writable; it autosaves as they type and freezes the moment it passes.
 * A window that closed with nothing in it reads "No entries" — for good: only an
 * admin can fill it in afterwards, from Work Logs.
 */
function HoursReport({
  log,
  intervalHours,
  now,
}: {
  log: SerializedLog | null;
  intervalHours: number;
  now: number;
}) {
  const [slots, setSlots] = useState<SerializedHourSlot[]>(log?.hourSlots ?? []);
  const [draft, setDraft] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error">(
    "idle"
  );
  const [saveError, setSaveError] = useState<string | null>(null);

  const windows = useMemo(
    () => buildSlots(log?.loginAt, log?.logoutAt, intervalHours, new Date(now)),
    [log?.loginAt, log?.logoutAt, intervalHours, now]
  );

  const current = windows.find((w) => w.active) ?? null;
  const currentKey = current?.key ?? null;

  const contentFor = (key: string) =>
    slots.find((s) => new Date(s.startAt).toISOString() === key)?.content ?? "";

  // When the active window rolls over, load that window's saved text into the
  // box. The previous window's text stays put in `slots`, now locked.
  const loadedKey = useRef<string | null>(null);
  useEffect(() => {
    if (currentKey === loadedKey.current) return;
    loadedKey.current = currentKey;
    setDraft(currentKey ? contentFor(currentKey) : "");
    setSaveState("idle");
    setSaveError(null);
    // contentFor reads `slots`, but we deliberately only resync on window change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentKey]);

  // Debounced autosave of the open window.
  const dirty = useRef(false);
  useEffect(() => {
    if (!currentKey || !dirty.current) return;
    const id = setTimeout(async () => {
      setSaveState("saving");
      setSaveError(null);
      try {
        const res = await fetch("/api/daily-log/hour-slot", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ startAt: currentKey, content: draft }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Couldn't save");

        setSlots((prev) => {
          const rest = prev.filter(
            (s) => new Date(s.startAt).toISOString() !== currentKey
          );
          return data.slot ? [...rest, data.slot as SerializedHourSlot] : rest;
        });
        dirty.current = false;
        setSaveState("saved");
      } catch (e) {
        setSaveState("error");
        setSaveError(e instanceof Error ? e.message : "Couldn't save");
      }
    }, 800);
    return () => clearTimeout(id);
  }, [draft, currentKey]);

  if (!log?.loginAt) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Hours Report</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Mark login to start your {intervalHours}-hour reporting windows.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Hours Report</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="mb-4 text-sm text-muted-foreground">
          Your day in {intervalHours}-hour windows from {formatTime(log.loginAt)}. Only
          the open window can be edited — once it passes it locks, and only an admin can
          change it.
        </p>

        <ul className="space-y-3">
          {windows.map((w) => {
            const isCurrent = w.key === currentKey;
            const saved = contentFor(w.key);
            return (
              <li
                key={w.key}
                className={cn(
                  "rounded-lg border p-3",
                  isCurrent
                    ? "border-primary/50 bg-primary/5"
                    : "border-border bg-muted/20"
                )}
              >
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold tabular-nums">
                    {formatTime(w.startAt)} – {formatTime(w.endAt)}
                  </span>
                  {isCurrent ? (
                    <Badge tone="info">Open now</Badge>
                  ) : (
                    <Badge tone="default">🔒 Locked</Badge>
                  )}
                </div>

                {isCurrent ? (
                  <>
                    <Textarea
                      placeholder="What are you working on in this window?"
                      value={draft}
                      onChange={(e) => {
                        dirty.current = true;
                        setDraft(e.target.value);
                        setSaveState("idle");
                      }}
                      aria-label={`Report for ${formatTime(w.startAt)} to ${formatTime(
                        w.endAt
                      )}`}
                    />
                    <p className="mt-1 h-4 text-xs">
                      {saveState === "saving" && (
                        <span className="text-muted-foreground">Saving…</span>
                      )}
                      {saveState === "saved" && (
                        <span className="text-[hsl(var(--success))]">✓ Saved</span>
                      )}
                      {saveState === "error" && (
                        <span className="text-destructive">{saveError}</span>
                      )}
                    </p>
                  </>
                ) : saved ? (
                  <p className="whitespace-pre-wrap text-sm">{saved}</p>
                ) : (
                  <p className="text-sm italic text-muted-foreground">No entries</p>
                )}
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}

/* ---------------- Component ---------------- */
export function DashboardClient({
  initialLog,
  projects,
  tasks: initialTasks,
  userName,
  hourModuleHours,
}: {
  initialLog: SerializedLog | null;
  projects: SerializedProject[];
  tasks: SerializedTask[];
  userName: string;
  /** Window size in hours, or null when the hour module is off for this member. */
  hourModuleHours: number | null;
}) {
  const [log, setLog] = useState<SerializedLog | null>(initialLog);
  const [tasks, setTasks] = useState<SerializedTask[]>(initialTasks);

  // Active section is driven by the sidebar link (?tab=work|tasks).
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const tab: "today" | "work" | "tasks" =
    tabParam === "work" ? "work" : tabParam === "tasks" ? "tasks" : "today";

  // Work Logs (history) — loaded lazily the first time the tab is opened.
  const [history, setHistory] = useState<HistoryDay[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);
  const historyRequested = useRef(false);
  // Days whose detail row is dropped down. Several can be open at once.
  const [expandedDays, setExpandedDays] = useState<Set<string>>(new Set());

  function toggleDay(id: string) {
    setExpandedDays((prev) => {
      const next = new Set(prev);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  }

  useEffect(() => {
    if (tab !== "work" || historyRequested.current) return;
    historyRequested.current = true;
    setHistoryLoading(true);
    setHistoryError(null);
    fetch("/api/my-history")
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "Failed to load your work logs");
        setHistory(data.history as HistoryDay[]);
      })
      .catch((e) => {
        historyRequested.current = false; // allow a retry on the next visit
        setHistoryError(e instanceof Error ? e.message : "Something went wrong");
      })
      .finally(() => setHistoryLoading(false));
  }, [tab]);

  // My Tasks
  const [taskPending, setTaskPending] = useState<string | null>(null);
  const [taskError, setTaskError] = useState<string | null>(null);

  async function submitTaskForReview(taskId: string) {
    setTaskPending(taskId);
    setTaskError(null);
    try {
      const res = await fetch(`/api/my-tasks/${taskId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "submit" }),
      });
      const d = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(d.error ?? "Failed to submit task");
      }
      // Update just this task in place — no page refresh needed.
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                status: d.task?.status ?? "IN_REVIEW",
                reviewNote: d.task?.reviewNote ?? null,
                submittedAt: d.task?.submittedAt ?? null,
                isOverdue: false,
              }
            : t
        )
      );
    } catch (e) {
      setTaskError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setTaskPending(null);
    }
  }

  // Login form
  const [plannedWork, setPlannedWork] = useState(initialLog?.plannedWork ?? "");
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  // Entries
  const [rows, setRows] = useState<EntryRow[]>(
    entriesToRows(initialLog?.workEntries ?? [], tasks)
  );
  const [entriesPending, setEntriesPending] = useState(false);
  const [entriesError, setEntriesError] = useState<string | null>(null);
  const [entriesSaved, setEntriesSaved] = useState(false);

  // Logout form
  const [workCompleted, setWorkCompleted] = useState(
    initialLog?.workCompleted ?? ""
  );
  const [remarks, setRemarks] = useState(initialLog?.remarks ?? "");
  const [logoutPending, setLogoutPending] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  // Breaks
  const [breakType, setBreakType] = useState<BreakType>("LUNCH");
  const [breakPending, setBreakPending] = useState(false);
  const [breakError, setBreakError] = useState<string | null>(null);

  // Reminder banner
  const [reminderDismissed, setReminderDismissed] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const isLoggedIn = !!log?.loginAt;
  const isLoggedOut = !!log?.logoutAt;

  const savedEntriesCount = log?.workEntries.length ?? 0;

  const totalHours = useMemo(
    () =>
      round(
        rows.reduce((sum, r) => {
          const h = parseFloat(r.hoursWorked);
          return sum + (Number.isFinite(h) && h > 0 ? h : 0);
        }, 0)
      ),
    [rows]
  );

  const savedTotalHours = useMemo(
    () =>
      round(
        (log?.workEntries ?? []).reduce((s, e) => s + (e.hoursWorked || 0), 0)
      ),
    [log]
  );

  // Hours logged per project for the day (shown at logout time).
  const hoursByProject = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of log?.workEntries ?? []) {
      const name = e.project?.name ?? "Unknown project";
      map.set(name, (map.get(name) ?? 0) + (e.hoursWorked || 0));
    }
    return [...map.entries()]
      .map(([name, hours]) => ({ name, hours }))
      .sort((a, b) => b.hours - a.hours);
  }, [log]);

  // Assigned tasks available for logging under a given project (exclude completed).
  const tasksForProject = (projectId: string) =>
    tasks.filter((t) => t.projectId === projectId && t.status !== "DONE");

  const hoursSinceLogin = useMemo(() => {
    if (!log?.loginAt || log.logoutAt) return 0;
    return hoursBetween(log.loginAt, new Date(now));
  }, [log, now]);

  const breaks = log?.breaks ?? [];
  const openBreak = useMemo(() => breaks.find((b) => b.endAt === null) ?? null, [breaks]);
  const onBreak = !!openBreak;

  // Tick every second while a break is running so the live counter actually moves.
  // With the hour module on, tick often enough that a window rollover is picked up
  // promptly — a stale window would have the member typing into a box whose saves
  // the server has already started rejecting. Otherwise once a minute is plenty.
  useEffect(() => {
    const period = onBreak ? 1_000 : hourModuleHours !== null ? 5_000 : 60_000;
    const id = setInterval(() => setNow(Date.now()), period);
    return () => clearInterval(id);
  }, [onBreak, hourModuleHours]);

  // NOTE: keep full precision here — rounding to 1 decimal of an HOUR would snap the
  // value to 6-minute steps, making a live break look frozen (e.g. stuck on "6m").
  const totalBreakHours = useMemo(() => {
    return breaks.reduce((sum, b) => {
      // An open break ends at logout (if logged out) or "now" (still active).
      const end = b.endAt
        ? new Date(b.endAt)
        : log?.logoutAt
        ? new Date(log.logoutAt)
        : new Date(now);
      return sum + hoursBetween(b.startAt, end);
    }, 0);
  }, [breaks, now, log]);

  // Net active presence = login duration minus break time. Full precision (see above).
  const netActiveHours = useMemo(() => {
    if (!log?.loginAt) return 0;
    const end = log.logoutAt ? new Date(log.logoutAt) : new Date(now);
    return Math.max(0, hoursBetween(log.loginAt, end) - totalBreakHours);
  }, [log, now, totalBreakHours]);

  const showReminder =
    isLoggedIn && !isLoggedOut && hoursSinceLogin > 8 && !reminderDismissed;

  async function toggleBreak() {
    setBreakPending(true);
    setBreakError(null);
    try {
      const res = await fetch("/api/daily-log/break", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ type: breakType }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to update break");
      setLog(data.log);
    } catch (err) {
      setBreakError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBreakPending(false);
    }
  }

  const today = new Date().toLocaleDateString(undefined, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  /* ---------------- Mutations ---------------- */
  async function markLogin() {
    setLoginPending(true);
    setLoginError(null);
    try {
      const res = await fetch("/api/daily-log/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ plannedWork }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to mark login");
      setLog(data.log);
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoginPending(false);
    }
  }

  async function saveEntries() {
    setEntriesPending(true);
    setEntriesError(null);
    setEntriesSaved(false);
    try {
      const entries = rows
        .filter((r) => r.projectId && parseFloat(r.hoursWorked) > 0)
        .map((r) => ({
          projectId: r.projectId,
          taskId: r.taskId || null,
          taskDescription: r.taskDescription,
          hoursWorked: parseFloat(r.hoursWorked),
        }));
      const res = await fetch("/api/daily-log/entries", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save entries");
      setLog(data.log);
      setRows(entriesToRows(data.log?.workEntries ?? [], tasks));
      setEntriesSaved(true);
      setTimeout(() => setEntriesSaved(false), 3000);
    } catch (err) {
      setEntriesError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setEntriesPending(false);
    }
  }

  async function markLogout() {
    setLogoutPending(true);
    setLogoutError(null);
    try {
      const res = await fetch("/api/daily-log/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ workCompleted, remarks }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to mark logout");
      setLog(data.log);
    } catch (err) {
      setLogoutError(
        err instanceof Error ? err.message : "Something went wrong"
      );
    } finally {
      setLogoutPending(false);
    }
  }

  /* ---------------- Row helpers ---------------- */
  function updateRow(key: string, patch: Partial<EntryRow>) {
    setRows((prev) =>
      prev.map((r) => (r.key === key ? { ...r, ...patch } : r))
    );
  }
  function addRow() {
    setRows((prev) => [...prev, blankRow()]);
  }
  function removeRow(key: string) {
    setRows((prev) => {
      const next = prev.filter((r) => r.key !== key);
      return next.length ? next : [blankRow()];
    });
  }

  /* ---------------- Render ---------------- */
  const hoursByProjectBlock =
    savedEntriesCount > 0 ? (
      <div>
        <Label>Hours by Project (today)</Label>
        <ul className="mt-1 space-y-1">
          {hoursByProject.map((p) => (
            <li
              key={p.name}
              className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-3 py-1.5 text-sm"
            >
              <span>{p.name}</span>
              <span className="font-semibold text-foreground">
                {formatDuration(p.hours)}
              </span>
            </li>
          ))}
          <li className="flex items-center justify-between px-3 py-1 text-sm font-semibold">
            <span>Total</span>
            <span>{formatDuration(savedTotalHours)}</span>
          </li>
        </ul>
      </div>
    ) : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Good day, {userName}</h1>
        <p className="text-sm text-muted-foreground">{today}</p>
      </div>

      {/* Reminder banner */}
      {showReminder && (
        <div className="flex items-start justify-between gap-4 rounded-lg border border-[hsl(var(--warning))]/40 bg-[hsl(var(--warning))]/10 px-4 py-3 text-sm">
          <p className="text-[hsl(var(--warning))]">
            ⏰ You&apos;ve been logged in for {round(hoursSinceLogin)} hours —
            don&apos;t forget to Mark Logout.
          </p>
          <button
            onClick={() => setReminderDismissed(true)}
            className="shrink-0 text-[hsl(var(--warning))] hover:opacity-70"
            aria-label="Dismiss reminder"
          >
            ✕
          </button>
        </div>
      )}

      {/* Status strip */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard
          label="Login Time"
          value={formatTime(log?.loginAt)}
          tone={isLoggedIn ? "success" : "default"}
        />
        <StatCard
          label="Logout Time"
          value={formatTime(log?.logoutAt)}
          tone={isLoggedOut ? "success" : "default"}
        />
        <StatCard
          label="Logged Time"
          value={formatDuration(savedTotalHours)}
          hint={`${savedEntriesCount} ${
            savedEntriesCount === 1 ? "entry" : "entries"
          }`}
        />
        <StatCard
          label="Break Time"
          value={formatDurationPrecise(totalBreakHours)}
          hint={`${breaks.length} ${breaks.length === 1 ? "break" : "breaks"}`}
          tone={onBreak ? "warning" : "default"}
        />
        <StatCard
          label="Net Active"
          value={formatDurationPrecise(netActiveHours)}
          hint={onBreak ? "on break…" : "presence − breaks"}
          tone={onBreak ? "warning" : "default"}
        />
      </div>

      {/* Section heading (chosen from the sidebar menu) */}
      <p className="text-sm font-medium text-muted-foreground">
        {tab === "today"
          ? "🗓️ Today — attendance & breaks"
          : tab === "work"
          ? "📋 Work Logs — your past days"
          : "✅ My Tasks"}
      </p>

      {/* My Tasks tab */}
      {tab === "tasks" && tasks.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>My Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {taskError && (
              <p className="mb-2 text-sm text-destructive">{taskError}</p>
            )}
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[680px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-2 py-2">Task</th>
                    <th className="px-2 py-2">Project</th>
                    <th className="px-2 py-2">Deadline</th>
                    <th className="px-2 py-2 text-right">Hours</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {tasks.map((t) => {
                    const isOverdue = t.isOverdue;
                    const canSubmit =
                      t.status === "TODO" ||
                      t.status === "IN_PROGRESS" ||
                      t.status === "REJECTED";
                    return (
                      <tr
                        key={t.id}
                        className={
                          "border-b border-border align-top " +
                          (isOverdue ? "bg-destructive/5" : "")
                        }
                      >
                        <td className="px-2 py-2 font-medium text-foreground">
                          {t.title}
                          <Badge
                            tone={criticalityLabel(t.criticality).tone}
                            className="ml-2 align-middle"
                            title={`Criticality ${t.criticality}/10 — ${
                              criticalityLabel(t.criticality).label
                            }. Higher-criticality tasks count for more in your score.`}
                          >
                            {t.criticality}
                          </Badge>
                          {t.status === "REJECTED" && t.reviewNote && (
                            <p className="mt-0.5 text-xs font-normal text-destructive">
                              ✗ {t.reviewNote}
                            </p>
                          )}
                        </td>
                        <td className="px-2 py-2 text-muted-foreground">
                          {t.projectName}
                        </td>
                        <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                          {formatDate(t.endDate)}
                          {t.onHold && (
                            <Badge tone="warning" className="ml-2">
                              On Hold
                            </Badge>
                          )}
                          {isOverdue && (
                            <Badge tone="destructive" className="ml-2">
                              {t.daysOverdue}d overdue
                            </Badge>
                          )}
                        </td>
                        <td className="px-2 py-2 text-right tabular-nums text-foreground">
                          {formatDuration(t.hoursWorked)}
                        </td>
                        <td className="px-2 py-2">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="px-2 py-2">
                          {t.status === "DONE" ? (
                            <span className="text-xs font-medium text-[hsl(var(--success))]">
                              ✓ Approved
                            </span>
                          ) : t.status === "IN_REVIEW" ? (
                            <span className="text-xs font-medium text-[hsl(var(--warning))]">
                              ⏳ Awaiting approval
                            </span>
                          ) : canSubmit ? (
                            <Button
                              size="sm"
                              variant={t.status === "REJECTED" ? "outline" : "success"}
                              onClick={() => submitTaskForReview(t.id)}
                              disabled={taskPending === t.id}
                            >
                              {taskPending === t.id
                                ? "…"
                                : t.status === "REJECTED"
                                ? "Resubmit"
                                : "Mark Complete"}
                            </Button>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Marking a task complete sends it to an admin for approval. If rejected,
              you can resubmit it.
            </p>
          </CardContent>
        </Card>
      )}

      {/* My Tasks tab — empty state */}
      {tab === "tasks" && tasks.length === 0 && (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No tasks have been assigned to you yet.
          </CardContent>
        </Card>
      )}

      {/* Today tab — Mark Login */}
      {tab === "today" && (
      <Card>
        <CardHeader>
          <CardTitle>Mark Login</CardTitle>
        </CardHeader>
        <CardContent>
          {!isLoggedIn ? (
            <div className="space-y-3">
              <div>
                <Label htmlFor="plannedWork">Planned Work for Today</Label>
                <Textarea
                  id="plannedWork"
                  placeholder="What do you plan to work on today?"
                  value={plannedWork}
                  onChange={(e) => setPlannedWork(e.target.value)}
                  required
                />
              </div>
              {loginError && (
                <p className="text-sm text-destructive">{loginError}</p>
              )}
              <Button
                onClick={markLogin}
                disabled={loginPending || plannedWork.trim().length === 0}
              >
                {loginPending ? "Marking…" : "Mark Login"}
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              <p className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--success))]/10 px-3 py-1.5 text-sm font-medium text-[hsl(var(--success))]">
                ✓ Logged in at {formatTime(log?.loginAt)}
              </p>
              <div>
                <Label>Planned Work for Today</Label>
                <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 px-3 py-2 text-sm">
                  {log?.plannedWork || "—"}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      )}

      {/* Today tab — Break / Lunch tracking */}
      {tab === "today" && isLoggedIn && !isLoggedOut && (
        <Card className={onBreak ? "border-[hsl(var(--warning))]/50" : undefined}>
          <CardHeader>
            <CardTitle>Breaks &amp; Lunch</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap items-center gap-3">
              {!onBreak ? (
                <>
                  <Select
                    value={breakType}
                    onChange={(e) => setBreakType(e.target.value as BreakType)}
                    className="w-auto"
                  >
                    <option value="LUNCH">Lunch</option>
                    <option value="SHORT">Short break</option>
                    <option value="OTHER">Other</option>
                  </Select>
                  <Button variant="secondary" onClick={toggleBreak} disabled={breakPending}>
                    {breakPending ? "…" : "🍽 Out for Break"}
                  </Button>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--warning))]/10 px-3 py-1.5 text-sm font-medium text-[hsl(var(--warning))]">
                    ⏸ On {BREAK_LABELS[openBreak.type].toLowerCase()} since{" "}
                    {formatTime(openBreak.startAt)}
                  </span>
                  <Button variant="success" onClick={toggleBreak} disabled={breakPending}>
                    {breakPending ? "…" : "▶ Back to Work"}
                  </Button>
                </div>
              )}
              <span className="text-sm text-muted-foreground">
                Total break time today:{" "}
                <span className="font-semibold tabular-nums text-foreground">
                  {formatDurationPrecise(totalBreakHours)}
                </span>
              </span>
            </div>

            {breakError && <p className="mt-2 text-sm text-destructive">{breakError}</p>}

            {breaks.length > 0 && (
              <ul className="mt-4 space-y-2">
                {breaks.map((b) => (
                  <li
                    key={b.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border bg-muted/30 px-3 py-2 text-sm"
                  >
                    <span className="font-medium">{BREAK_LABELS[b.type]}</span>
                    <span className="text-muted-foreground">
                      {formatTime(b.startAt)} →{" "}
                      {b.endAt ? (
                        formatTime(b.endAt)
                      ) : (
                        <span className="text-[hsl(var(--warning))]">ongoing</span>
                      )}
                      <span
                        className={cn(
                          "ml-2 tabular-nums",
                          b.endAt ? "text-foreground" : "font-semibold text-[hsl(var(--warning))]"
                        )}
                      >
                        (
                        {formatDurationPrecise(
                          hoursBetween(b.startAt, b.endAt ? new Date(b.endAt) : new Date(now))
                        )}
                        )
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      )}

      {/* Work Logs tab — read-only history of past days. No editing: only an admin can amend a log. */}
      {tab === "work" && (
        <Card>
          <CardHeader>
            <CardTitle>Work Log History</CardTitle>
          </CardHeader>
          <CardContent>
            {historyLoading && (
              <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>
            )}
            {historyError && (
              <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {historyError}
              </p>
            )}
            {history && !historyLoading && history.length === 0 && (
              <p className="py-8 text-center text-sm text-muted-foreground">
                No work logs yet. Mark login on the Today tab to start your first one.
              </p>
            )}
            {history && !historyLoading && history.length > 0 && (
              <>
                <p className="mb-3 text-sm text-muted-foreground">
                  Your last {history.length} {history.length === 1 ? "day" : "days"} — view
                  only.
                </p>
                <div className="overflow-x-auto scroll-thin">
                  <table className="w-full min-w-[720px] text-sm">
                    <thead>
                      <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th className="w-8 px-2 py-2" />
                        <th className="px-2 py-2">Date</th>
                        <th className="px-2 py-2">Login</th>
                        <th className="px-2 py-2">Logout</th>
                        <th className="px-2 py-2 text-right">Hours</th>
                        <th className="px-2 py-2 text-right">Break</th>
                        <th className="px-2 py-2 text-right">Net Active</th>
                        <th className="px-2 py-2 text-right">Work Hours</th>
                        <th className="px-2 py-2">Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {history.map((h) => {
                        const isOpen = expandedDays.has(h.id);
                        return (
                          <Fragment key={h.id}>
                            <tr
                              className="cursor-pointer border-b border-border align-top hover:bg-accent/50"
                              onClick={() => toggleDay(h.id)}
                            >
                              <td className="px-2 py-2">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    toggleDay(h.id);
                                  }}
                                  aria-expanded={isOpen}
                                  aria-label={
                                    isOpen ? "Collapse details" : "Expand details"
                                  }
                                  className="flex h-6 w-6 items-center justify-center rounded text-muted-foreground transition-colors hover:bg-muted"
                                >
                                  <span
                                    className={
                                      isOpen
                                        ? "rotate-90 transition-transform"
                                        : "transition-transform"
                                    }
                                  >
                                    ▶
                                  </span>
                                </button>
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-foreground">
                                {formatDate(h.date)}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                                {formatTime(h.loginAt)}
                              </td>
                              <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                                {formatTime(h.logoutAt)}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                                {formatDurationPrecise(h.loginHours)}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-[hsl(var(--warning))]">
                                {h.breakHours ? formatDurationPrecise(h.breakHours) : "—"}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                                {formatDurationPrecise(h.netHours)}
                              </td>
                              <td className="px-2 py-2 text-right tabular-nums text-foreground">
                                {formatDurationPrecise(h.workHours)}
                              </td>
                              <td className="px-2 py-2">
                                <StatusBadge status={h.status} />
                              </td>
                            </tr>
                            {isOpen && (
                              <tr className="border-b border-border bg-muted/20">
                                {/* 9 columns in the header above */}
                                <td colSpan={9} className="p-0">
                                  <HistoryRowDetail day={h} />
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      )}

      {/* Today tab — Hours Report, when the admin enabled the hour module. */}
      {tab === "today" && hourModuleHours !== null && (
        <HoursReport log={log} intervalHours={hourModuleHours} now={now} />
      )}

      {/* Project & Task Logging — today's split. Sits directly above Mark Logout,
          since the split is what the logout gate checks. */}
      {tab === "today" && (
      <Card className={!isLoggedIn ? "opacity-60" : undefined}>
        <CardHeader>
          <CardTitle>Project &amp; Task Logging</CardTitle>
        </CardHeader>
        <CardContent>
          {!isLoggedIn ? (
            <p className="text-sm text-muted-foreground">
              Mark login to start logging your work.
            </p>
          ) : (
            <div className="space-y-4">
              {/* Header row (desktop) */}
              <div className="hidden gap-3 px-1 text-xs font-medium text-muted-foreground md:grid md:grid-cols-[1fr_1.5fr_110px_40px]">
                <span>Project</span>
                <span>Task Description</span>
                <span>Hours</span>
                <span />
              </div>

              {rows.map((row) => (
                <div
                  key={row.key}
                  className="grid grid-cols-1 gap-3 rounded-lg border border-border p-3 md:grid-cols-[1fr_1.5fr_110px_40px] md:items-center md:rounded-none md:border-0 md:p-0"
                >
                  <div>
                    <Label className="md:hidden">Project</Label>
                    <Select
                      value={row.projectId}
                      onChange={(e) =>
                        updateRow(row.key, {
                          projectId: e.target.value,
                          taskId: "",
                          taskDescription: "",
                          custom: false,
                        })
                      }
                      disabled={isLoggedOut}
                    >
                      <option value="">Select project…</option>
                      {projects.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div>
                    <Label className="md:hidden">Task (assigned to you)</Label>
                    {!row.projectId ? (
                      <Select disabled value="">
                        <option value="">Select a project first…</option>
                      </Select>
                    ) : row.custom || tasksForProject(row.projectId).length === 0 ? (
                      <div className="space-y-1">
                        <Input
                          placeholder={
                            tasksForProject(row.projectId).length === 0
                              ? "No assigned task — describe your work"
                              : "Describe the task"
                          }
                          value={row.taskDescription}
                          onChange={(e) =>
                            updateRow(row.key, { taskDescription: e.target.value })
                          }
                          disabled={isLoggedOut}
                        />
                        {tasksForProject(row.projectId).length > 0 && (
                          <button
                            type="button"
                            className="text-xs text-primary hover:underline"
                            onClick={() =>
                              updateRow(row.key, { custom: false, taskDescription: "" })
                            }
                            disabled={isLoggedOut}
                          >
                            ← Choose an assigned task
                          </button>
                        )}
                      </div>
                    ) : (
                      <Select
                        value={row.taskId || ""}
                        onChange={(e) => {
                          const v = e.target.value;
                          if (v === CUSTOM_TASK) {
                            updateRow(row.key, {
                              custom: true,
                              taskId: "",
                              taskDescription: "",
                            });
                          } else {
                            const t = tasksForProject(row.projectId).find(
                              (x) => x.id === v
                            );
                            updateRow(row.key, {
                              taskId: v,
                              taskDescription: t?.title ?? "",
                            });
                          }
                        }}
                        disabled={isLoggedOut}
                      >
                        <option value="">Select a task…</option>
                        {tasksForProject(row.projectId).map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.title}
                          </option>
                        ))}
                        <option value={CUSTOM_TASK}>✏️ Other (specify)…</option>
                      </Select>
                    )}
                  </div>
                  <div>
                    <Label className="md:hidden">Hours</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="0"
                      value={row.hoursWorked}
                      onChange={(e) =>
                        updateRow(row.key, { hoursWorked: e.target.value })
                      }
                      disabled={isLoggedOut}
                    />
                  </div>
                  <div className="flex justify-end md:justify-center">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => removeRow(row.key)}
                      disabled={isLoggedOut}
                      aria-label="Remove row"
                      title="Remove row"
                    >
                      🗑
                    </Button>
                  </div>
                </div>
              ))}

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={addRow}
                  disabled={isLoggedOut}
                >
                  ➕ Add Row
                </Button>
                <p className="text-sm text-muted-foreground">
                  Running total:{" "}
                  <span className="font-semibold text-foreground">
                    {formatDuration(totalHours)}
                  </span>
                </p>
              </div>

              {entriesError && (
                <p className="text-sm text-destructive">{entriesError}</p>
              )}

              <div className="flex items-center gap-3">
                <Button
                  onClick={saveEntries}
                  disabled={entriesPending || isLoggedOut}
                >
                  {entriesPending ? "Saving…" : "Save Entries"}
                </Button>
                {entriesSaved && (
                  <span className="text-sm font-medium text-[hsl(var(--success))]">
                    ✓ Entries saved
                  </span>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      )}

      {/* Today tab — Mark Logout */}
      {tab === "today" && (
      <Card className={!isLoggedIn ? "opacity-60" : undefined}>
        <CardHeader>
          <CardTitle>Mark Logout</CardTitle>
        </CardHeader>
        <CardContent>
          {!isLoggedIn ? (
            <p className="text-sm text-muted-foreground">
              Mark login before you can end your day.
            </p>
          ) : isLoggedOut ? (
            <div className="space-y-3 text-sm">
              <p className="inline-flex items-center gap-2 rounded-md bg-[hsl(var(--success))]/10 px-3 py-1.5 font-medium text-[hsl(var(--success))]">
                ✓ Logged out at {formatTime(log?.logoutAt)}
              </p>
              {hoursByProjectBlock}
              <div>
                <Label>Work Completed Today</Label>
                <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 px-3 py-2">
                  {log?.workCompleted || "—"}
                </p>
              </div>
              {log?.remarks ? (
                <div>
                  <Label>Remarks</Label>
                  <p className="whitespace-pre-wrap rounded-md border border-border bg-muted/40 px-3 py-2">
                    {log.remarks}
                  </p>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="space-y-3">
              {onBreak && (
                <p className="rounded-md bg-[hsl(var(--warning))]/10 px-3 py-2 text-sm text-[hsl(var(--warning))]">
                  ⏸ You&apos;re on a break. Click <strong>Back to Work</strong> above before
                  logging out.
                </p>
              )}
              {savedEntriesCount === 0 && (
                <p className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  Split your day across projects before logging out — add at least one
                  work entry above and hit <strong>Save Entries</strong>. Without it your
                  work hours for today are recorded as zero.
                </p>
              )}
              {hoursByProjectBlock}
              <div>
                <Label htmlFor="workCompleted">Work Completed Today</Label>
                <Textarea
                  id="workCompleted"
                  placeholder="Summarize what you accomplished."
                  value={workCompleted}
                  onChange={(e) => setWorkCompleted(e.target.value)}
                />
              </div>
              <div>
                <Label htmlFor="remarks">Remarks</Label>
                <Textarea
                  id="remarks"
                  placeholder="Anything else to note (optional)."
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                />
              </div>
              {logoutError && (
                <p className="text-sm text-destructive">{logoutError}</p>
              )}
              <Button
                variant="success"
                onClick={markLogout}
                disabled={
                  logoutPending ||
                  workCompleted.trim().length === 0 ||
                  onBreak ||
                  savedEntriesCount === 0
                }
              >
                {logoutPending ? "Marking…" : "Mark Logout"}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
      )}
    </div>
  );
}
