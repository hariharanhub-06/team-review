"use client";

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  StatCard,
  StatusBadge,
} from "@/components/ui";
import { cn, formatDate, formatDateTime, formatDurationPrecise } from "@/lib/utils";
import { taskOverdue } from "@/lib/tasks";
import { criticalityLabel } from "@/lib/scoring";

/* ---------------- Types (serialized shapes) ---------------- */
type TaskStatus = "TODO" | "IN_PROGRESS" | "IN_REVIEW" | "DONE" | "REJECTED";
type TaskEventType =
  | "SUBMITTED"
  | "APPROVED"
  | "REJECTED"
  | "WITHDRAWN"
  | "REOPENED";

interface Member {
  id: string;
  name: string;
}

interface TaskProject {
  id: string;
  name: string;
  onHold: boolean;
  holdSince: string | null;
  heldDays: number;
}

interface Task {
  id: string;
  title: string;
  projectId: string;
  project: TaskProject;
  assigneeId: string | null;
  assignee: Member | null;
  status: TaskStatus;
  criticality: number;
  startDate: string | null;
  endDate: string | null;
  completedAt: string | null;
  submittedAt: string | null;
  reviewNote: string | null;
  hoursWorked: number;
  submitCount: number;
  rejectCount: number;
}

interface TaskEvent {
  id: string;
  type: TaskEventType;
  note: string | null;
  actorName: string | null;
  createdAt: string;
}

interface Props {
  members: Member[];
}

/** Tab identity: "all", "unassigned", or a member id. */
const ALL = "all";
const UNASSIGNED = "unassigned";

const EVENT_ICON: Record<TaskEventType, string> = {
  SUBMITTED: "📤",
  APPROVED: "✅",
  REJECTED: "❌",
  WITHDRAWN: "↩️",
  REOPENED: "🔄",
};

const EVENT_LABEL: Record<TaskEventType, string> = {
  SUBMITTED: "Submitted for review",
  APPROVED: "Approved",
  REJECTED: "Sent back",
  WITHDRAWN: "Withdrawn",
  REOPENED: "Reopened",
};

/* ---------------- Modal ---------------- */
function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-lg rounded-lg border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <h2 className="min-w-0 break-words text-lg font-semibold">{title}</h2>
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </Button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

/* ---------------- History (review-cycle timeline) ---------------- */
function HistoryPanel({ task }: { task: Task }) {
  const [events, setEvents] = React.useState<TaskEvent[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    setEvents(null);
    setError(null);

    fetch(`/api/tasks/${task.id}/events`)
      .then(async (res) => {
        if (!res.ok) throw new Error("Failed to load history");
        return (await res.json()) as { events: TaskEvent[] };
      })
      .then((data) => {
        if (!cancelled) setEvents(data.events);
      })
      .catch(() => {
        if (!cancelled) setError("Could not load review history.");
      });

    return () => {
      cancelled = true;
    };
  }, [task.id]);

  return (
    <div className="space-y-4">
      <p className="rounded-md bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
        Submitted <span className="font-semibold text-foreground">{task.submitCount}</span>
        ×, sent back{" "}
        <span
          className={cn(
            "font-semibold",
            task.rejectCount > 0 ? "text-destructive" : "text-foreground"
          )}
        >
          {task.rejectCount}
        </span>
        ×
      </p>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {!error && events === null && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Loading history…
        </p>
      )}

      {!error && events !== null && events.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          No review history yet.
        </p>
      )}

      {!error && events !== null && events.length > 0 && (
        <ol className="space-y-3">
          {events.map((ev) => (
            <li
              key={ev.id}
              className="flex gap-3 rounded-md border border-border p-3"
            >
              <span className="text-lg leading-none" aria-hidden>
                {EVENT_ICON[ev.type] ?? "•"}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                  <span className="text-sm font-medium text-foreground">
                    {EVENT_LABEL[ev.type] ?? ev.type}
                  </span>
                  {ev.actorName && (
                    <span className="text-xs text-muted-foreground">
                      by {ev.actorName}
                    </span>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {formatDateTime(ev.createdAt)}
                </p>
                {ev.note && (
                  <p className="mt-1.5 break-words rounded bg-muted/30 px-2 py-1 text-sm text-foreground">
                    {ev.note}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/* ---------------- Main ---------------- */
export default function TasksClient({ members }: Props) {
  const [tasks, setTasks] = React.useState<Task[] | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [tab, setTab] = React.useState<string>(ALL);
  const [busyId, setBusyId] = React.useState<string | null>(null);
  const [historyId, setHistoryId] = React.useState<string | null>(null);

  const loadTasks = React.useCallback(async () => {
    try {
      const res = await fetch("/api/tasks");
      if (!res.ok) throw new Error("Failed to load tasks");
      const data = (await res.json()) as { tasks: Task[] };
      setTasks(data.tasks);
      setError(null);
    } catch {
      setError("Could not load tasks. Please try again.");
    }
  }, []);

  React.useEffect(() => {
    void loadTasks();
  }, [loadTasks]);

  const all = React.useMemo(() => tasks ?? [], [tasks]);

  /**
   * Tabs: All → every member (active members first, plus any assignee that no
   * longer appears in the active list so their tasks never go missing) → Unassigned.
   */
  const memberTabs = React.useMemo(() => {
    const byId = new Map<string, Member>();
    for (const m of members) byId.set(m.id, m);
    for (const t of all) {
      if (t.assignee && !byId.has(t.assignee.id)) byId.set(t.assignee.id, t.assignee);
    }
    return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
  }, [members, all]);

  const countFor = React.useCallback(
    (key: string) => {
      if (key === ALL) return all.length;
      if (key === UNASSIGNED) return all.filter((t) => t.assigneeId === null).length;
      return all.filter((t) => t.assigneeId === key).length;
    },
    [all]
  );

  const visible = React.useMemo(() => {
    if (tab === ALL) return all;
    if (tab === UNASSIGNED) return all.filter((t) => t.assigneeId === null);
    return all.filter((t) => t.assigneeId === tab);
  }, [all, tab]);

  const stats = React.useMemo(() => {
    let done = 0;
    let inReview = 0;
    let overdue = 0;
    for (const t of visible) {
      if (t.status === "DONE") done += 1;
      if (t.status === "IN_REVIEW") inReview += 1;
      if (taskOverdue(t.endDate, t.status, t.project).overdue) overdue += 1;
    }
    return { total: visible.length, done, inReview, overdue };
  }, [visible]);

  const historyTask = historyId
    ? all.find((t) => t.id === historyId) ?? null
    : null;

  /* --- Mutations --- */
  async function patchTask(task: Task, body: Record<string, unknown>) {
    setBusyId(task.id);
    setError(null);
    try {
      const res = await fetch(`/api/tasks/${task.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setError(data.error ?? "Failed to update task");
        return;
      }
      await loadTasks();
    } catch {
      setError("Failed to update task");
    } finally {
      setBusyId(null);
    }
  }

  function approve(task: Task) {
    void patchTask(task, { status: "DONE" });
  }

  function reject(task: Task) {
    const note = window.prompt(
      `Send "${task.title}" back to the member? Optionally add a reason:`,
      ""
    );
    if (note === null) return; // cancelled
    void patchTask(task, { status: "REJECTED", reviewNote: note });
  }

  /* --- Render --- */
  if (tasks === null && error) {
    return (
      <Card>
        <CardContent className="space-y-3 py-12 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" onClick={() => void loadTasks()}>
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  if (tasks === null) {
    return (
      <Card>
        <CardContent className="py-12 text-center text-sm text-muted-foreground">
          Loading tasks…
        </CardContent>
      </Card>
    );
  }

  const unassignedCount = countFor(UNASSIGNED);

  return (
    <div className="space-y-5">
      {error && (
        <div className="rounded-md bg-destructive/15 px-4 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="overflow-x-auto scroll-thin">
        <div className="flex w-max min-w-full gap-2 border-b border-border pb-2">
          <TabButton
            active={tab === ALL}
            onClick={() => setTab(ALL)}
            label="All"
            count={countFor(ALL)}
          />
          {memberTabs.map((m) => (
            <TabButton
              key={m.id}
              active={tab === m.id}
              onClick={() => setTab(m.id)}
              label={m.name}
              count={countFor(m.id)}
            />
          ))}
          <TabButton
            active={tab === UNASSIGNED}
            onClick={() => setTab(UNASSIGNED)}
            label="Unassigned"
            count={unassignedCount}
            warn={unassignedCount > 0}
          />
        </div>
      </div>

      {/* KPI strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total tasks" value={stats.total} />
        <StatCard label="Completed" value={stats.done} tone="success" />
        <StatCard
          label="In Review"
          value={stats.inReview}
          tone={stats.inReview > 0 ? "warning" : "default"}
        />
        <StatCard
          label="Overdue"
          value={stats.overdue}
          tone={stats.overdue > 0 ? "destructive" : "default"}
        />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          {visible.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              No tasks for this member.
            </p>
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[900px] border-collapse text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase text-muted-foreground">
                    <th className="p-3 font-medium">Title</th>
                    <th className="p-3 font-medium">Project</th>
                    <th className="p-3 font-medium">Assignee</th>
                    <th
                      className="p-3 font-medium"
                      title="How critical the task is, 1–10. Drives the assignee's impact score."
                    >
                      Critical
                    </th>
                    <th className="p-3 font-medium">Deadline</th>
                    <th className="p-3 font-medium">Status</th>
                    <th className="p-3 text-right font-medium">Hours</th>
                    <th className="p-3 text-center font-medium">Bounces</th>
                    <th className="p-3 text-right font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {visible.map((t) => {
                    const od = taskOverdue(t.endDate, t.status, t.project);
                    const busy = busyId === t.id;
                    return (
                      <tr
                        key={t.id}
                        className={cn(
                          "border-b border-border align-top last:border-b-0 hover:bg-muted/30",
                          od.overdue && "border-l-2 border-l-destructive"
                        )}
                      >
                        <td className="p-3">
                          <p
                            className={cn(
                              "font-medium",
                              od.overdue && "text-destructive"
                            )}
                          >
                            {t.title}
                          </p>
                          {t.status === "REJECTED" && t.reviewNote && (
                            <p className="mt-1 max-w-[280px] break-words text-xs text-destructive">
                              ↩ {t.reviewNote}
                            </p>
                          )}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {t.project.name}
                        </td>
                        <td className="p-3 text-muted-foreground">
                          {t.assignee?.name ?? "—"}
                        </td>
                        <td className="p-3">
                          <Badge
                            tone={criticalityLabel(t.criticality).tone}
                            title={`${criticalityLabel(t.criticality).label} — ${
                              t.criticality
                            }/10 impact points`}
                          >
                            {t.criticality}
                          </Badge>
                        </td>
                        <td className="whitespace-nowrap p-3">
                          <span className="text-muted-foreground">
                            {formatDate(t.endDate)}
                          </span>
                          <span className="mt-1 flex flex-wrap gap-1">
                            {od.overdue && (
                              <Badge tone="destructive">
                                {od.daysOverdue}d overdue
                              </Badge>
                            )}
                            {t.project.onHold && (
                              <Badge tone="warning">On Hold</Badge>
                            )}
                          </span>
                        </td>
                        <td className="p-3">
                          <StatusBadge status={t.status} />
                        </td>
                        <td className="whitespace-nowrap p-3 text-right tabular-nums text-muted-foreground">
                          {formatDurationPrecise(t.hoursWorked)}
                        </td>
                        <td className="p-3 text-center">
                          {t.rejectCount > 0 ? (
                            <Badge
                              tone="destructive"
                              title={`Sent back ${t.rejectCount} time(s)`}
                            >
                              ↩ {t.rejectCount}
                            </Badge>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="p-3">
                          <div className="flex flex-wrap items-center justify-end gap-1">
                            {t.status === "IN_REVIEW" && (
                              <>
                                <Button
                                  size="sm"
                                  variant="success"
                                  disabled={busy}
                                  onClick={() => approve(t)}
                                >
                                  Approve
                                </Button>
                                <Button
                                  size="sm"
                                  variant="destructive"
                                  disabled={busy}
                                  onClick={() => reject(t)}
                                >
                                  Reject
                                </Button>
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="icon"
                              title="Review history"
                              aria-label="Review history"
                              disabled={busy}
                              onClick={() => setHistoryId(t.id)}
                            >
                              🕘
                            </Button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* History modal */}
      <Modal
        open={historyTask !== null}
        onClose={() => setHistoryId(null)}
        title={historyTask ? `History — ${historyTask.title}` : "History"}
      >
        {historyTask && <HistoryPanel task={historyTask} />}
      </Modal>
    </div>
  );
}

/* ---------------- Tab button ---------------- */
function TabButton({
  active,
  onClick,
  label,
  count,
  warn,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
  warn?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        active
          ? "bg-primary text-primary-foreground"
          : warn
          ? "bg-[hsl(var(--warning))]/15 text-[hsl(var(--warning))] hover:bg-accent"
          : "text-muted-foreground hover:bg-accent hover:text-foreground"
      )}
    >
      {label}
      <span
        className={cn(
          "inline-flex min-w-[1.25rem] justify-center rounded-full px-1.5 py-0.5 text-xs font-semibold",
          active ? "bg-primary-foreground/20" : "bg-muted text-muted-foreground"
        )}
      >
        {count}
      </span>
    </button>
  );
}
