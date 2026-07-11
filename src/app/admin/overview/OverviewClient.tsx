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
} from "@/components/ui";
import { formatDate, formatTime, formatDurationPrecise } from "@/lib/utils";

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
  project: string;
  taskDescription: string;
  hours: number;
}

interface BreakItem {
  type: string;
  startAt: string;
  endAt: string | null;
}

interface Row {
  id: string;
  date: string;
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

/** One labelled free-text block from the member's login/logout forms. */
function NoteBlock({ title, text }: { title: string; text: string }) {
  return (
    <div>
      <div className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {title}
      </div>
      <div className="rounded-md border border-border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap break-words text-foreground">
        {text}
      </div>
    </div>
  );
}

/** Expanded day-detail: notes, work-hour split, and breaks. */
function RowDetail({ row }: { row: Row }) {
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
    </div>
  );
}

export default function OverviewClient({
  members,
  projects,
}: {
  members: Option[];
  projects: Option[];
}) {
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [rows, setRows] = useState<Row[]>([]);
  const [summary, setSummary] = useState<Summary>({ totalLogs: 0, totalHours: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

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
              <table className="w-full min-w-[720px] text-sm">
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
                        </tr>
                        {isOpen && (
                          <tr className="border-b border-border bg-muted/20">
                            {/* 10 columns in the header above */}
                            <td colSpan={10} className="p-0">
                              <RowDetail row={row} />
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
    </div>
  );
}
