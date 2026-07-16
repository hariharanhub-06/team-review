"use client";

import { Fragment, useCallback, useEffect, useState } from "react";
import {
  Badge,
  Button,
  Input,
  Select,
  Label,
  Card,
  CardContent,
  StatCard,
  StatusBadge,
  Textarea,
} from "@/components/ui";
import { buildSlots } from "@/lib/hour-slots";
import { Markdown } from "@/components/markdown";
import {
  formatDate,
  formatTime,
  formatDurationPrecise,
  hoursBetween,
} from "@/lib/utils";

interface Option {
  id: string;
  name: string;
}

interface Filters {
  userId: string;
  projectId: string;
  status: string;
  from: string;
  to: string;
}

interface Entry {
  projectId: string;
  taskId: string | null;
  project: string;
  taskDescription: string;
  hours: number;
}

interface TaskOption {
  id: string;
  title: string;
  projectId: string;
  assigneeId: string | null;
}

/** Sentinel for "this wasn't an assigned task, let me type it". */
const CUSTOM_TASK = "__custom__";

/** One editable row in the admin's work-split editor. */
interface DraftEntry {
  projectId: string;
  taskId: string;
  taskDescription: string;
  hours: string;
  /** true = free-text description instead of an assigned task. */
  custom: boolean;
}

function draftFrom(entries: Entry[], tasks: TaskOption[]): DraftEntry[] {
  if (entries.length === 0) return [blankDraft()];
  return entries.map((e) => {
    const matched = e.taskId ? tasks.find((t) => t.id === e.taskId) : undefined;
    return {
      projectId: e.projectId,
      taskId: matched?.id ?? "",
      taskDescription: e.taskDescription,
      hours: String(e.hours),
      // An entry with a description but no surviving task link was typed by hand.
      custom: !matched && e.taskDescription.length > 0,
    };
  });
}

function blankDraft(): DraftEntry {
  return { projectId: "", taskId: "", taskDescription: "", hours: "", custom: false };
}

interface BreakItem {
  type: string;
  startAt: string;
  endAt: string | null;
}

interface HourSlotItem {
  startAt: string;
  endAt: string;
  content: string;
}

interface Row {
  id: string;
  date: string;
  userId: string;
  userName: string;
  userEmail: string;
  loginAt: string | null;
  logoutAt: string | null;
  loginHours: number;
  breakHours: number;
  netActiveHours: number;
  sessionStatus: string;
  status: string | null;
  plannedWork: string | null;
  workCompleted: string | null;
  remarks: string | null;
  totalWorkHours: number;
  entries: Entry[];
  breaks: BreakItem[];
  /** Window size in hours, or null when the hour module is off for this member. */
  hourModuleHours: number | null;
  hourSlots: HourSlotItem[];
}

interface Summary {
  totalLogs: number;
  totalHours: number;
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "COMPLETED", label: "Completed" },
  { value: "ACTIVE", label: "Active" },
  { value: "UNCALCULATED", label: "Uncalculated" },
  { value: "ABSENT", label: "Absent" },
];

/** yyyy-mm-dd for `n` days ago (UTC). */
function isoDaysAgo(n: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function defaultFilters(): Filters {
  return {
    userId: "",
    projectId: "",
    status: "",
    from: isoDaysAgo(30),
    to: isoDaysAgo(0),
  };
}

function buildQuery(f: Filters): string {
  const params = new URLSearchParams();
  if (f.userId) params.set("userId", f.userId);
  if (f.projectId) params.set("projectId", f.projectId);
  if (f.status) params.set("status", f.status);
  if (f.from) params.set("from", f.from);
  if (f.to) params.set("to", f.to);
  return params.toString();
}

const BREAK_LABELS: Record<string, string> = {
  LUNCH: "Lunch",
  SHORT: "Short break",
  OTHER: "Other",
};

function breakLabel(type: string): string {
  return BREAK_LABELS[type] ?? "Other";
}

/** Elapsed hours of a break; 0 while it is still ongoing. */
function breakElapsedHours(b: BreakItem): number {
  if (!b.endAt) return 0;
  const ms = new Date(b.endAt).getTime() - new Date(b.startAt).getTime();
  if (!Number.isFinite(ms) || ms <= 0) return 0;
  return ms / 3_600_000;
}

/** A timestamp as the local-wall-clock value expected by <input type="datetime-local">. */
function toLocalInput(value: string | Date): string {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 16);
}

/** One labelled free-text block from the member's login/logout forms. */
function NoteBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2">
        <Markdown>{text}</Markdown>
      </div>
    </div>
  );
}

/**
 * The member's hour-module windows for a day, each amendable by an admin.
 *
 * Members can only write to the window that is currently open, so this is the
 * only route by which a closed window (including one left empty) can be corrected.
 */
function HourSlotsPanel({
  row,
  onSaved,
}: {
  row: Row;
  onSaved: (slots: HourSlotItem[]) => void;
}) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const windows = buildSlots(row.loginAt, row.logoutAt, row.hourModuleHours);
  if (windows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No reporting windows — the member hadn&apos;t logged in.
      </p>
    );
  }

  const contentFor = (key: string) =>
    row.hourSlots.find((s) => new Date(s.startAt).toISOString() === key)?.content ?? "";

  async function save(key: string) {
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/logs/${row.id}/hour-slots`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ startAt: key, content: draft }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to save");

      const rest = row.hourSlots.filter(
        (s) => new Date(s.startAt).toISOString() !== key
      );
      onSaved(
        data.slot
          ? [...rest, data.slot as HourSlotItem].sort(
              (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime()
            )
          : rest
      );
      setEditingKey(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <ul className="space-y-2">
        {windows.map((w) => {
          const saved = contentFor(w.key);
          const isEditing = editingKey === w.key;
          return (
            <li
              key={w.key}
              className="rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium tabular-nums text-foreground">
                  {formatTime(w.startAt)} – {formatTime(w.endAt)}
                </span>
                {!saved && !isEditing && (
                  <span className="italic text-muted-foreground">No entries</span>
                )}
                {!isEditing && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="ml-auto h-6 w-6"
                    title={saved ? "Edit this window" : "Add a report for this window"}
                    aria-label="Edit hour report"
                    onClick={() => {
                      setEditingKey(w.key);
                      setDraft(saved);
                      setError(null);
                    }}
                  >
                    ✏️
                  </Button>
                )}
              </div>

              {isEditing ? (
                <div className="mt-2 space-y-2">
                  <Textarea
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    placeholder="What they did in this window (leave blank for no entries)"
                    aria-label="Hour report content"
                  />
                  <div className="flex justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setEditingKey(null)}
                      disabled={pending}
                    >
                      Cancel
                    </Button>
                    <Button size="sm" onClick={() => save(w.key)} disabled={pending}>
                      {pending ? "Saving…" : "Save"}
                    </Button>
                  </div>
                </div>
              ) : (
                saved && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-foreground">
                    {saved}
                  </p>
                )
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Expanded day-detail: notes, work-hour split, and breaks. */
function RowDetail({
  row,
  onSlotsSaved,
}: {
  row: Row;
  onSlotsSaved: (slots: HourSlotItem[]) => void;
}) {
  const notes: { title: string; text: string }[] = [
    { title: "Planned Work (at login)", text: row.plannedWork?.trim() ?? "" },
    { title: "Work Completed (at logout)", text: row.workCompleted?.trim() ?? "" },
    { title: "Remarks", text: row.remarks?.trim() ?? "" },
  ].filter((n) => n.text.length > 0);

  const entries = row.entries ?? [];
  const breaks = row.breaks ?? [];
  const total = row.totalWorkHours > 0 ? row.totalWorkHours : 0;

  return (
    <div className="space-y-5 px-2 py-4">
      {/* Session summary */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-xs">
        <span className="text-muted-foreground">
          Login:{" "}
          <span className="font-medium text-foreground">
            {row.loginAt ? formatTime(row.loginAt) : "—"}
          </span>
        </span>
        <span className="text-muted-foreground">
          Logout:{" "}
          <span className="font-medium text-foreground">
            {row.logoutAt ? formatTime(row.logoutAt) : "—"}
          </span>
        </span>
        <span className="text-muted-foreground">
          Break total:{" "}
          <span className="font-medium text-[hsl(var(--warning))]">
            {formatDurationPrecise(row.breakHours)}
          </span>
        </span>
        <span className="text-muted-foreground">
          Net active:{" "}
          <span className="font-medium text-foreground">
            {row.sessionStatus === "UNCALCULATED"
              ? "—"
              : formatDurationPrecise(row.netActiveHours)}
          </span>
        </span>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* (A) Notes */}
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

        {/* (B) Work-hours split */}
        <div className="space-y-3">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Work hours split
          </h4>
          {entries.length === 0 ? (
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
                  {entries.map((entry, i) => {
                    const pct = total > 0 ? (entry.hours / total) * 100 : 0;
                    return (
                      <tr key={i} className="border-b border-border last:border-0">
                        <td className="px-3 py-2 font-medium text-foreground">
                          {entry.project}
                        </td>
                        <td className="px-3 py-2 text-muted-foreground break-words">
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
                      {formatDurationPrecise(row.totalWorkHours)}
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

      {/* (C) Breaks */}
      <div className="space-y-2">
        <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
          Breaks
        </h4>
        {breaks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No breaks taken.</p>
        ) : (
          <ul className="space-y-1">
            {breaks.map((b, i) => (
              <li
                key={i}
                className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-md border border-border bg-muted/30 px-3 py-2 text-xs"
              >
                <Badge tone="warning">{breakLabel(b.type)}</Badge>
                <span className="tabular-nums text-muted-foreground">
                  {formatTime(b.startAt)} → {b.endAt ? formatTime(b.endAt) : "ongoing"}
                </span>
                {b.endAt && (
                  <span className="ml-auto tabular-nums font-medium text-[hsl(var(--warning))]">
                    {formatDurationPrecise(breakElapsedHours(b))}
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* (D) Hours report — only for members with the hour module enabled. */}
      {row.hourModuleHours !== null && (
        <div className="space-y-2">
          <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground">
            Hours report ({row.hourModuleHours}h windows)
          </h4>
          <HourSlotsPanel row={row} onSaved={onSlotsSaved} />
        </div>
      )}
    </div>
  );
}

/** Back-fill a logout time for a day the member forgot to close. */
function SetLogoutModal({
  row,
  onClose,
  onSaved,
}: {
  row: Row;
  onClose: () => void;
  onSaved: (row: Row) => void;
}) {
  // Default to the login moment on the correct day — the admin just nudges the time forward.
  const [value, setValue] = useState<string>(() =>
    row.loginAt ? toLocalInput(row.loginAt) : ""
  );
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  // Live preview of the resulting session length, so a typo'd time is obvious.
  const previewHours =
    row.loginAt && value ? hoursBetween(row.loginAt, new Date(value)) : 0;
  const valid = !!value && row.loginAt !== null && new Date(value) > new Date(row.loginAt);

  async function save() {
    if (!valid) return;
    setPending(true);
    setError(null);
    try {
      const res = await fetch(`/api/logs/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          action: "setLogout",
          logoutAt: new Date(value).toISOString(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Failed to set logout time");

      // Recompute the derived fields exactly as the logs API does, so the row
      // updates in place without a full reload (keeps the expanded panel open).
      const logoutIso = new Date(value).toISOString();
      const loginHours = hoursBetween(row.loginAt, logoutIso);
      const breakHours = row.breaks.reduce(
        (sum, b) => sum + hoursBetween(b.startAt, b.endAt ?? logoutIso),
        0
      );
      onSaved({
        ...row,
        logoutAt: logoutIso,
        sessionStatus: "COMPLETED",
        loginHours,
        breakHours,
        netActiveHours: Math.max(0, loginHours - breakHours),
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to set logout time");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-md rounded-lg border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Set logout time"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <h2 className="min-w-0 break-words text-lg font-semibold">
            Set logout — {row.userName}, {formatDate(row.date)}
          </h2>
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

        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            Logged in at{" "}
            <span className="font-medium text-foreground">
              {row.loginAt ? formatTime(row.loginAt) : "—"}
            </span>
            . Set when they actually left; their work entries are untouched.
          </p>

          <div>
            <Label htmlFor="logout-at">Logout time</Label>
            <Input
              id="logout-at"
              type="datetime-local"
              value={value}
              min={row.loginAt ? toLocalInput(row.loginAt) : undefined}
              max={toLocalInput(new Date())}
              onChange={(e) => setValue(e.target.value)}
            />
          </div>

          {value && (
            <p className="text-sm text-muted-foreground">
              Session length:{" "}
              <span
                className={
                  valid
                    ? "font-medium text-foreground"
                    : "font-medium text-destructive"
                }
              >
                {valid
                  ? formatDurationPrecise(previewHours)
                  : "logout must be after login"}
              </span>
            </p>
          )}

          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex justify-end gap-2 border-t border-border p-4">
          <Button variant="outline" onClick={onClose} disabled={pending}>
            Cancel
          </Button>
          <Button onClick={save} disabled={pending || !valid}>
            {pending ? "Saving…" : "Set logout"}
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Admin editor for a day's work split — used when a member forgot to log one. */
function EditEntriesModal({
  row,
  projects,
  tasks,
  onClose,
  onSaved,
}: {
  row: Row;
  projects: Option[];
  tasks: TaskOption[];
  onClose: () => void;
  onSaved: (entries: Entry[], totalWorkHours: number) => void;
}) {
  const [draft, setDraft] = useState<DraftEntry[]>(() => draftFrom(row.entries, tasks));
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  function update(i: number, patch: Partial<DraftEntry>) {
    setDraft((prev) => prev.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  }

  /** Tasks assigned to THIS member on THIS project — same list they'd see themselves. */
  const tasksFor = useCallback(
    (projectId: string) =>
      tasks.filter((t) => t.projectId === projectId && t.assigneeId === row.userId),
    [tasks, row.userId]
  );

  const total = draft.reduce((s, d) => s + (parseFloat(d.hours) || 0), 0);

  async function save() {
    setPending(true);
    setError(null);
    try {
      const entries = draft
        .filter((d) => d.projectId && parseFloat(d.hours) > 0)
        .map((d) => ({
          projectId: d.projectId,
          taskId: d.taskId || null,
          taskDescription: d.taskDescription.trim() || "—",
          hoursWorked: parseFloat(d.hours),
        }));
      const res = await fetch(`/api/logs/${row.id}/entries`, {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ entries }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to save work split");
      onSaved(data.entries as Entry[], data.totalWorkHours as number);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save work split");
    } finally {
      setPending(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/50 p-4 sm:items-center"
      onClick={onClose}
      role="presentation"
    >
      <div
        className="w-full max-w-2xl rounded-lg border border-border bg-card shadow-lg"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Edit work split"
      >
        <div className="flex items-center justify-between gap-2 border-b border-border p-4">
          <h2 className="min-w-0 break-words text-lg font-semibold">
            Work split — {row.userName}, {formatDate(row.date)}
          </h2>
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

        <div className="space-y-3 p-4">
          <p className="text-sm text-muted-foreground">
            They were active for{" "}
            <span className="font-medium text-foreground">
              {formatDurationPrecise(row.netActiveHours)}
            </span>
            . Split that time across the projects they worked on.
          </p>

          {draft.map((d, i) => {
            const assigned = tasksFor(d.projectId);
            const freeText = d.custom || assigned.length === 0;
            return (
              <div
                key={i}
                className="grid grid-cols-1 gap-2 rounded-md border border-border p-3 sm:grid-cols-[1fr_1.5fr_90px_auto]"
              >
                <div>
                  <Label htmlFor={`p-${i}`}>Project</Label>
                  <Select
                    id={`p-${i}`}
                    value={d.projectId}
                    onChange={(e) =>
                      update(i, {
                        projectId: e.target.value,
                        taskId: "",
                        taskDescription: "",
                        custom: false,
                      })
                    }
                  >
                    <option value="">Select…</option>
                    {projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                      </option>
                    ))}
                  </Select>
                </div>

                <div>
                  <Label htmlFor={`t-${i}`}>Task</Label>
                  {!d.projectId ? (
                    <Select id={`t-${i}`} disabled value="">
                      <option value="">Select a project first…</option>
                    </Select>
                  ) : freeText ? (
                    <div className="space-y-1">
                      <Input
                        id={`t-${i}`}
                        value={d.taskDescription}
                        placeholder={
                          assigned.length === 0
                            ? "No task assigned to them here — describe the work"
                            : "Describe the task"
                        }
                        onChange={(e) => update(i, { taskDescription: e.target.value })}
                      />
                      {assigned.length > 0 && (
                        <button
                          type="button"
                          className="text-xs text-primary hover:underline"
                          onClick={() =>
                            update(i, { custom: false, taskId: "", taskDescription: "" })
                          }
                        >
                          ← Choose an assigned task
                        </button>
                      )}
                    </div>
                  ) : (
                    <Select
                      id={`t-${i}`}
                      value={d.taskId || ""}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === CUSTOM_TASK) {
                          update(i, { custom: true, taskId: "", taskDescription: "" });
                          return;
                        }
                        const t = assigned.find((x) => x.id === v);
                        update(i, { taskId: v, taskDescription: t?.title ?? "" });
                      }}
                    >
                      <option value="">Select task…</option>
                      {assigned.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.title}
                        </option>
                      ))}
                      <option value={CUSTOM_TASK}>✎ Something else…</option>
                    </Select>
                  )}
                </div>

                <div>
                  <Label htmlFor={`h-${i}`}>Hours</Label>
                  <Input
                    id={`h-${i}`}
                    type="number"
                    min="0"
                    max="24"
                    step="0.25"
                    value={d.hours}
                    onChange={(e) => update(i, { hours: e.target.value })}
                  />
                </div>

                <div className="flex items-end">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove row"
                    title="Remove row"
                    onClick={() =>
                      setDraft((prev) =>
                        prev.length === 1 ? [blankDraft()] : prev.filter((_, j) => j !== i)
                      )
                    }
                  >
                    🗑
                  </Button>
                </div>
              </div>
            );
          })}

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDraft((prev) => [...prev, blankDraft()])}
            >
              + Add project
            </Button>
            <span className="text-sm text-muted-foreground">
              Total:{" "}
              <span className="font-medium tabular-nums text-foreground">
                {formatDurationPrecise(total)}
              </span>
            </span>
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <div className="flex gap-2 border-t border-border pt-3">
            <Button onClick={save} disabled={pending}>
              {pending ? "Saving…" : "Save work split"}
            </Button>
            <Button variant="outline" onClick={onClose} disabled={pending}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function OverviewClient({
  members,
  projects,
  tasks,
}: {
  members: Option[];
  projects: Option[];
  tasks: TaskOption[];
}) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalLogs: 0, totalHours: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Row | null>(null);
  const [settingLogout, setSettingLogout] = useState<Row | null>(null);

  /** Fold a back-filled logout (and its recomputed hours) into the table. */
  function applyLogout(updated: Row) {
    setRows((prev) => prev.map((r) => (r.id === updated.id ? updated : r)));
    setSettingLogout(null);
  }

  /** Fold an admin-edited work split back into the table without a full reload. */
  function applyEntries(rowId: string, entries: Entry[], totalWorkHours: number) {
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, entries, totalWorkHours } : r))
    );
    setSummary((prev) => {
      const before = rows.find((r) => r.id === rowId)?.totalWorkHours ?? 0;
      return {
        ...prev,
        totalHours: Math.max(0, prev.totalHours - before + totalWorkHours),
      };
    });
    setEditing(null);
  }

  /** Delete a member's whole day entry so they can re-do it. */
  async function deleteEntry(row: Row) {
    if (
      !window.confirm(
        `Delete ${row.userName}'s entry for ${formatDate(row.date)}?\n\n` +
          `This removes their login, logout, notes, work entries and breaks for that day. ` +
          `They will need to mark login again.`
      )
    )
      return;
    setBusyId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/logs/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to delete entry");
      }
      setRows((prev) => prev.filter((r) => r.id !== row.id));
      setSummary((prev) => ({
        totalLogs: Math.max(0, prev.totalLogs - 1),
        totalHours: Math.max(0, prev.totalHours - row.totalWorkHours),
      }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to delete entry");
    } finally {
      setBusyId(null);
    }
  }

  /** Undo a mistaken logout so the member can carry on and log out properly. */
  async function undoLogout(row: Row) {
    if (
      !window.confirm(
        `Undo ${row.userName}'s logout for ${formatDate(row.date)}?\n\n` +
          `Their login and work entries are kept — only the logout (and the logout notes) are cleared, ` +
          `so they can continue and mark logout again.`
      )
    )
      return;
    setBusyId(row.id);
    setError(null);
    try {
      const res = await fetch(`/api/logs/${row.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action: "undoLogout" }),
      });
      if (!res.ok) {
        const d = await res.json().catch(() => ({}));
        throw new Error(d.error ?? "Failed to undo logout");
      }
      setRows((prev) =>
        prev.map((r) =>
          r.id === row.id
            ? {
                ...r,
                logoutAt: null,
                workCompleted: null,
                remarks: null,
                sessionStatus: "ACTIVE",
                loginHours: 0,
                netActiveHours: 0,
              }
            : r
        )
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to undo logout");
    } finally {
      setBusyId(null);
    }
  }

  const load = useCallback(async (f: Filters) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/logs?${buildQuery(f)}`);
      if (!res.ok) throw new Error(`Request failed (${res.status})`);
      const data = (await res.json()) as { rows: Row[]; summary: Summary };
      setRows(data.rows);
      setSummary(data.summary);
      setExpanded(new Set());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load logs");
      setRows([]);
      setSummary({ totalLogs: 0, totalHours: 0 });
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch on mount with the default filters.
  useEffect(() => {
    load(defaultFilters());
  }, [load]);

  const setField = (key: keyof Filters, value: string) =>
    setFilters((prev) => ({ ...prev, [key]: value }));

  const apply = () => load(filters);
  const reset = () => {
    const d = defaultFilters();
    setFilters(d);
    load(d);
  };

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportHref = `/api/export?${buildQuery(filters)}`;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Work Logs</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Filter and export daily work logs across the team.
        </p>
      </div>

      {/* Filter bar */}
      <Card>
        <CardContent className="pt-5">
          <div className="flex flex-wrap items-end gap-3">
            <div className="w-full sm:w-44">
              <Label htmlFor="f-user">User</Label>
              <Select
                id="f-user"
                value={filters.userId}
                onChange={(e) => setField("userId", e.target.value)}
              >
                <option value="">All users</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="w-full sm:w-44">
              <Label htmlFor="f-project">Project</Label>
              <Select
                id="f-project"
                value={filters.projectId}
                onChange={(e) => setField("projectId", e.target.value)}
              >
                <option value="">All projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>

            <div className="w-full sm:w-40">
              <Label htmlFor="f-status">Status</Label>
              <Select
                id="f-status"
                value={filters.status}
                onChange={(e) => setField("status", e.target.value)}
              >
                <option value="">All statuses</option>
                {STATUS_OPTIONS.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="w-full sm:w-auto">
              <Label htmlFor="f-from">From</Label>
              <Input
                id="f-from"
                type="date"
                value={filters.from}
                onChange={(e) => setField("from", e.target.value)}
              />
            </div>

            <div className="w-full sm:w-auto">
              <Label htmlFor="f-to">To</Label>
              <Input
                id="f-to"
                type="date"
                value={filters.to}
                onChange={(e) => setField("to", e.target.value)}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button onClick={apply} disabled={loading}>
                Apply
              </Button>
              <Button variant="outline" onClick={reset} disabled={loading}>
                Reset
              </Button>
              <a href={exportHref}>
                <Button variant="secondary" type="button">
                  ⬇ Export CSV
                </Button>
              </a>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Summary strip */}
      <div className="grid grid-cols-2 gap-4 sm:max-w-md">
        <StatCard label="Total logs" value={summary.totalLogs} />
        <StatCard label="Total work" value={formatDurationPrecise(summary.totalHours)} />
      </div>

      {/* Table */}
      <Card>
        <CardContent className="pt-5">
          {error ? (
            <p className="py-8 text-center text-sm text-destructive">{error}</p>
          ) : loading ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Loading logs…
            </p>
          ) : rows.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No work logs match these filters.
            </p>
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[860px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="w-8 px-2 py-2" />
                    <th className="px-2 py-2">Date</th>
                    <th className="px-2 py-2">User</th>
                    <th className="px-2 py-2">Login</th>
                    <th className="px-2 py-2">Logout</th>
                    <th className="px-2 py-2 text-right">Hours</th>
                    <th className="px-2 py-2 text-right">Break</th>
                    <th className="px-2 py-2 text-right">Net Active</th>
                    <th className="px-2 py-2 text-right">Work Hours</th>
                    <th className="px-2 py-2">Status</th>
                    <th className="px-2 py-2 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row) => {
                    const isOpen = expanded.has(row.id);
                    return (
                      <Fragment key={row.id}>
                        <tr className="border-b border-border align-top hover:bg-accent/50">
                          <td className="px-2 py-2">
                            <button
                              type="button"
                              onClick={() => toggle(row.id)}
                              aria-expanded={isOpen}
                              aria-label={isOpen ? "Collapse details" : "Expand details"}
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
                            {formatDate(row.date)}
                          </td>
                          <td className="px-2 py-2">
                            <div className="font-medium text-foreground">
                              {row.userName}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {row.userEmail}
                            </div>
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                            {row.loginAt ? formatTime(row.loginAt) : "—"}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 text-muted-foreground">
                            {row.logoutAt ? formatTime(row.logoutAt) : "—"}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                            {row.sessionStatus === "UNCALCULATED"
                              ? "—"
                              : formatDurationPrecise(row.loginHours)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-[hsl(var(--warning))]">
                            {row.breakHours ? formatDurationPrecise(row.breakHours) : "—"}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-muted-foreground">
                            {row.sessionStatus === "UNCALCULATED"
                              ? "—"
                              : formatDurationPrecise(row.netActiveHours)}
                          </td>
                          <td className="px-2 py-2 text-right tabular-nums text-foreground">
                            {formatDurationPrecise(row.totalWorkHours)}
                          </td>
                          <td className="px-2 py-2">
                            <StatusBadge status={row.sessionStatus} />
                          </td>
                          <td className="px-2 py-2">
                            <div className="flex items-center justify-end gap-1">
                              {row.loginAt && !row.logoutAt && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Forgot to log out — set the logout time"
                                  aria-label="Set logout time"
                                  disabled={busyId === row.id}
                                  onClick={() => setSettingLogout(row)}
                                >
                                  ⏱️
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                title={
                                  row.entries.length === 0
                                    ? "No work split logged — add one"
                                    : "Edit work split"
                                }
                                aria-label="Edit work split"
                                disabled={busyId === row.id}
                                onClick={() => setEditing(row)}
                              >
                                {row.entries.length === 0 ? "⚠️" : "✏️"}
                              </Button>
                              {row.logoutAt && (
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  title="Undo logout (keeps login & work entries)"
                                  aria-label="Undo logout"
                                  disabled={busyId === row.id}
                                  onClick={() => undoLogout(row)}
                                >
                                  ↩️
                                </Button>
                              )}
                              <Button
                                variant="ghost"
                                size="icon"
                                title="Delete this day's entry so the member can redo it"
                                aria-label="Delete entry"
                                disabled={busyId === row.id}
                                onClick={() => deleteEntry(row)}
                              >
                                🗑
                              </Button>
                            </div>
                          </td>
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-border bg-muted/20">
                            {/* 11 columns in the header above */}
                            <td colSpan={11} className="p-0">
                              <RowDetail
                                row={row}
                                onSlotsSaved={(hourSlots) =>
                                  setRows((prev) =>
                                    prev.map((r) =>
                                      r.id === row.id ? { ...r, hourSlots } : r
                                    )
                                  )
                                }
                              />
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {editing && (
        <EditEntriesModal
          row={editing}
          projects={projects}
          tasks={tasks}
          onClose={() => setEditing(null)}
          onSaved={(entries, totalWorkHours) =>
            applyEntries(editing.id, entries, totalWorkHours)
          }
        />
      )}

      {settingLogout && (
        <SetLogoutModal
          row={settingLogout}
          onClose={() => setSettingLogout(null)}
          onSaved={applyLogout}
        />
      )}
    </div>
  );
}
