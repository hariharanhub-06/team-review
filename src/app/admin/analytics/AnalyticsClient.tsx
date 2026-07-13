"use client";

import * as React from "react";
import {
  Button,
  Input,
  Select,
  Label,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  StatCard,
  StarRating,
} from "@/components/ui";
import {
  BarChartCard,
  LineChartCard,
  PieChartCard,
  CHART_COLORS,
} from "@/components/charts";
import { formatDate, cn } from "@/lib/utils";
import { scoreLabel, criticalityLabel } from "@/lib/scoring";

/* ---------------- Types (mirror AnalyticsResult) ---------------- */
interface ScoreBreakdown {
  score: number;
  effort: number;
  timeliness: number;
  consistency: number;
  impact: number;
}
interface ProjectHours {
  projectId: string;
  name: string;
  hours: number;
}
interface DailyPoint {
  date: string;
  hours: number;
  loginHours: number;
}
interface UserMetric {
  userId: string;
  name: string;
  email: string;
  expectedDailyHours: number;
  totalHours: number;
  expectedHours: number;
  loginHours: number;
  daysLogged: number;
  workingDays: number;
  absentDays: number;
  projectCount: number;
  projects: ProjectHours[];
  dailySeries: DailyPoint[];
  tasksCompleted: number;
  tasksCompletedOnTime: number;
  overdueTasks: number;
  criticalityCompleted: number;
  criticalityAssigned: number;
  breakdown: ScoreBreakdown;
  rank: number;
}
interface Analytics {
  perUser: UserMetric[];
  productivityOverTime: DailyPoint[];
  projectDistribution: ProjectHours[];
  loginVsActive: { name: string; loginHours: number; activeHours: number }[];
  taskStats: {
    total: number;
    completed: number;
    onTime: number;
    overdue: number;
    completionRate: number;
    onTimeRate: number;
  };
  overdueTasks: {
    id: string;
    title: string;
    project: string;
    assignee: string | null;
    endDate: string | null;
    criticality: number;
    daysOverdue: number;
  }[];
  totals: {
    totalHours: number;
    totalLoginHours: number;
    activeMembers: number;
    avgScore: number;
    totalProjects: number;
  };
}

interface Filters {
  from: string;
  to: string;
  userId: string;
  projectId: string;
  status: string;
}

type Preset = "week" | "month" | "last30" | "custom";

interface NamedRef {
  id: string;
  name: string;
}

/* ---------------- Date helpers ---------------- */
function ymd(d: Date): string {
  const x = new Date(d);
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(
    x.getDate()
  ).padStart(2, "0")}`;
}
function presetRange(preset: Exclude<Preset, "custom">): { from: string; to: string } {
  const now = new Date();
  const to = ymd(now);
  if (preset === "week") {
    const day = now.getDay(); // 0 Sun..6 Sat
    const diff = (day + 6) % 7; // days since Monday
    const monday = new Date(now);
    monday.setDate(now.getDate() - diff);
    return { from: ymd(monday), to };
  }
  if (preset === "month") {
    return { from: ymd(new Date(now.getFullYear(), now.getMonth(), 1)), to };
  }
  // last30
  const start = new Date(now);
  start.setDate(now.getDate() - 29);
  return { from: ymd(start), to };
}

function buildQs(f: Filters): string {
  const p = new URLSearchParams();
  if (f.from) p.set("from", f.from);
  if (f.to) p.set("to", f.to);
  if (f.userId && f.userId !== "all") p.set("userId", f.userId);
  if (f.projectId && f.projectId !== "all") p.set("projectId", f.projectId);
  if (f.status && f.status !== "all") p.set("status", f.status);
  return p.toString();
}

const medal = (rank: number): string =>
  rank === 1 ? "🥇" : rank === 2 ? "🥈" : rank === 3 ? "🥉" : "";

function pct(n: number): string {
  return `${Math.round(n * 100)}%`;
}

/* ---------------- Mini breakdown bar ---------------- */
function MiniBar({ value, color }: { value: number; color: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <div
        className="h-full rounded-full"
        style={{ width: `${Math.max(0, Math.min(100, value * 100))}%`, background: color }}
      />
    </div>
  );
}

/* ---------------- Main ---------------- */
export function AnalyticsClient({
  initial,
  members,
  projects,
  initialFilters,
}: {
  initial: Analytics;
  members: NamedRef[];
  projects: NamedRef[];
  initialFilters: Filters;
}) {
  const [data, setData] = React.useState<Analytics>(initial);
  const [filters, setFilters] = React.useState<Filters>(initialFilters);
  const [applied, setApplied] = React.useState<Filters>(initialFilters);
  const [preset, setPreset] = React.useState<Preset>("month");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  async function runFetch(f: Filters) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/analytics?${buildQs(f)}`);
      if (!res.ok) {
        setError("Failed to load analytics.");
        return;
      }
      const result = (await res.json()) as Analytics;
      setData(result);
      setApplied(f);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  function applyPreset(p: Exclude<Preset, "custom">) {
    setPreset(p);
    const range = presetRange(p);
    const next = { ...filters, ...range };
    setFilters(next);
    runFetch(next);
  }

  function selectMember(userId: string) {
    const next = { ...applied, userId };
    setFilters(next);
    runFetch(next);
  }

  const rangeLabel = `${formatDate(applied.from)} – ${formatDate(applied.to)}`;

  // Resolve the drill-down member (from the applied user filter).
  const selectedMember: UserMetric | null =
    applied.userId && applied.userId !== "all"
      ? data.perUser.find((u) => u.userId === applied.userId) ?? data.perUser[0] ?? null
      : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Analytics &amp; Productivity</h1>
          <p className="text-sm text-muted-foreground">
            {rangeLabel}
            {applied.userId !== "all" && selectedMember
              ? ` · ${selectedMember.name}`
              : " · All members"}
          </p>
        </div>
        {loading && (
          <span className="text-sm text-muted-foreground print:hidden">Updating…</span>
        )}
      </div>

      {/* A. Filter bar */}
      <Card className="print:hidden">
        <CardContent className="space-y-4 pt-5">
          <div className="flex flex-wrap items-center gap-2">
            {(
              [
                ["week", "This Week"],
                ["month", "This Month"],
                ["last30", "Last 30 Days"],
                ["custom", "Custom"],
              ] as [Preset, string][]
            ).map(([p, label]) => (
              <Button
                key={p}
                size="sm"
                variant={preset === p ? "primary" : "outline"}
                onClick={() => (p === "custom" ? setPreset("custom") : applyPreset(p))}
              >
                {label}
              </Button>
            ))}
            <div className="ml-auto flex gap-2">
              <Button size="sm" variant="secondary" onClick={() => window.print()}>
                🖨 Print / Export
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {preset === "custom" && (
              <>
                <div>
                  <Label htmlFor="f-from">From</Label>
                  <Input
                    id="f-from"
                    type="date"
                    value={filters.from}
                    onChange={(e) => setFilters({ ...filters, from: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="f-to">To</Label>
                  <Input
                    id="f-to"
                    type="date"
                    value={filters.to}
                    onChange={(e) => setFilters({ ...filters, to: e.target.value })}
                  />
                </div>
              </>
            )}
            <div>
              <Label htmlFor="f-user">Individual</Label>
              <Select
                id="f-user"
                value={filters.userId}
                onChange={(e) => setFilters({ ...filters, userId: e.target.value })}
              >
                <option value="all">All Members</option>
                {members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="f-project">Project</Label>
              <Select
                id="f-project"
                value={filters.projectId}
                onChange={(e) => setFilters({ ...filters, projectId: e.target.value })}
              >
                <option value="all">All Projects</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="f-status">Status</Label>
              <Select
                id="f-status"
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
              >
                <option value="all">All Statuses</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="IN_PROGRESS">IN_PROGRESS</option>
                <option value="BLOCKED">BLOCKED</option>
              </Select>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button onClick={() => runFetch(filters)} disabled={loading}>
              {loading ? "Applying…" : "Apply"}
            </Button>
            {error && <span className="text-sm text-destructive">{error}</span>}
          </div>
        </CardContent>
      </Card>

      {/* B. Team KPI row */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          label="Productivity Hours"
          value={`${data.totals.totalHours}h`}
          hint="Total logged work"
        />
        <StatCard
          label="Login Hours"
          value={`${data.totals.totalLoginHours}h`}
          hint="Total time online"
        />
        <StatCard label="Active Members" value={data.totals.activeMembers} />
        <StatCard
          label="Avg Score"
          value={<StarRating score={data.totals.avgScore} size={18} showValue />}
        />
        <StatCard label="Projects" value={data.totals.totalProjects} />
        <StatCard
          label="Task Completion"
          value={`${data.taskStats.completionRate}%`}
          hint={`${data.taskStats.completed}/${data.taskStats.total} done`}
        />
        <StatCard
          label="On-time"
          value={`${data.taskStats.onTimeRate}%`}
          hint={`${data.taskStats.onTime} on time`}
        />
        <StatCard
          label="Overdue"
          value={data.taskStats.overdue}
          tone={data.taskStats.overdue > 0 ? "destructive" : "default"}
        />
      </div>

      {/* C. Charts grid */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BarChartCard
          title="Hours per Member"
          data={data.perUser}
          xKey="name"
          bars={[{ key: "totalHours", name: "Hours", color: CHART_COLORS[0] }]}
        />
        <LineChartCard
          title="Productivity Over Time"
          data={data.productivityOverTime}
          xKey="date"
          lines={[
            { key: "hours", name: "Work Hours", color: CHART_COLORS[1] },
            { key: "loginHours", name: "Login Hours", color: CHART_COLORS[0] },
          ]}
        />
        <PieChartCard
          title="Project Effort Distribution"
          data={data.projectDistribution}
          nameKey="name"
          valueKey="hours"
        />
        <BarChartCard
          title="Login vs Active Hours"
          data={data.loginVsActive}
          xKey="name"
          bars={[
            { key: "loginHours", name: "Login", color: CHART_COLORS[0] },
            { key: "activeHours", name: "Active", color: CHART_COLORS[1] },
          ]}
        />
      </div>

      {/* D. Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle>Team Leaderboard</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto scroll-thin">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="px-4 py-3 font-medium">#</th>
                  <th className="px-4 py-3 font-medium">Member</th>
                  <th className="px-4 py-3 font-medium">Score</th>
                  <th className="px-4 py-3 font-medium">Breakdown</th>
                  <th className="px-4 py-3 font-medium">Hours</th>
                  <th className="px-4 py-3 font-medium">Expected</th>
                  <th className="px-4 py-3 font-medium">Days</th>
                  <th className="px-4 py-3 font-medium">Projects</th>
                  <th className="px-4 py-3 font-medium">Tasks</th>
                  <th className="px-4 py-3 font-medium">Overdue</th>
                </tr>
              </thead>
              <tbody>
                {data.perUser.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">
                      No member activity for this period.
                    </td>
                  </tr>
                )}
                {data.perUser.map((u) => {
                  const sl = scoreLabel(u.breakdown.score);
                  return (
                    <tr
                      key={u.userId}
                      className={cn(
                        "border-b border-border last:border-0 hover:bg-accent/50",
                        u.rank <= 3 && "bg-accent/30"
                      )}
                    >
                      <td className="px-4 py-3 font-semibold whitespace-nowrap">
                        {medal(u.rank)} {u.rank}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          className="text-left font-medium hover:text-primary hover:underline print:no-underline"
                          onClick={() => selectMember(u.userId)}
                          title="View member detail"
                        >
                          {u.name}
                        </button>
                        <div className="text-xs text-muted-foreground">{u.email}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <StarRating score={u.breakdown.score} />
                          <Badge tone={sl.tone}>{sl.label}</Badge>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="w-40 space-y-1">
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-16 text-muted-foreground">Effort</span>
                            <MiniBar value={u.breakdown.effort} color={CHART_COLORS[0]} />
                            <span className="w-9 text-right tabular-nums">
                              {pct(u.breakdown.effort)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-16 text-muted-foreground">Timely</span>
                            <MiniBar value={u.breakdown.timeliness} color={CHART_COLORS[1]} />
                            <span className="w-9 text-right tabular-nums">
                              {pct(u.breakdown.timeliness)}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs">
                            <span className="w-16 text-muted-foreground">Consist.</span>
                            <MiniBar value={u.breakdown.consistency} color={CHART_COLORS[4]} />
                            <span className="w-9 text-right tabular-nums">
                              {pct(u.breakdown.consistency)}
                            </span>
                          </div>
                          <div
                            className="flex items-center gap-2 text-xs"
                            title={`${u.criticalityCompleted} of ${u.criticalityAssigned} criticality points delivered`}
                          >
                            <span className="w-16 text-muted-foreground">Impact</span>
                            <MiniBar value={u.breakdown.impact} color={CHART_COLORS[2]} />
                            <span className="w-9 text-right tabular-nums">
                              {pct(u.breakdown.impact)}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-medium whitespace-nowrap">{u.totalHours}h</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">
                        {u.expectedHours}h
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {u.daysLogged}/{u.workingDays}
                        {u.absentDays > 0 && (
                          <span className="text-xs text-destructive">
                            {" "}
                            ({u.absentDays} absent)
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">{u.projectCount}</td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        {u.tasksCompleted}
                        <span className="text-xs text-muted-foreground">
                          {" "}
                          ({u.tasksCompletedOnTime} on time)
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {u.overdueTasks > 0 ? (
                          <Badge tone="destructive">{u.overdueTasks}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* E. Individual drill-down OR member grid */}
      {selectedMember ? (
        <MemberDetail member={selectedMember} onBack={() => selectMember("all")} />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
          </CardHeader>
          <CardContent>
            {data.perUser.length === 0 ? (
              <p className="py-6 text-center text-muted-foreground">No members to show.</p>
            ) : (
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.perUser.map((u) => {
                  return (
                    <button
                      key={u.userId}
                      onClick={() => selectMember(u.userId)}
                      className="rounded-lg border border-border bg-card p-4 text-left transition-colors hover:bg-accent/50 print:hover:bg-transparent"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-medium">
                          {medal(u.rank)} {u.name}
                        </span>
                        <StarRating score={u.breakdown.score} />
                      </div>
                      <div className="mt-2 grid grid-cols-3 gap-2 text-xs text-muted-foreground">
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {u.totalHours}h
                          </div>
                          hours
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {u.projectCount}
                          </div>
                          projects
                        </div>
                        <div>
                          <div className="text-sm font-semibold text-foreground">
                            {u.daysLogged}
                          </div>
                          days
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* F. Overdue tasks */}
      <Card>
        <CardHeader>
          <CardTitle>Overdue Tasks</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data.overdueTasks.length === 0 ? (
            <p className="px-4 py-8 text-center text-muted-foreground">No overdue tasks 🎉</p>
          ) : (
            <div className="overflow-x-auto scroll-thin">
              <table className="w-full min-w-[720px] text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-muted-foreground">
                    <th className="px-4 py-3 font-medium">Task</th>
                    <th className="px-4 py-3 font-medium">Project</th>
                    <th className="px-4 py-3 font-medium">Assignee</th>
                    <th className="px-4 py-3 font-medium">Criticality</th>
                    <th className="px-4 py-3 font-medium">Due</th>
                    <th className="px-4 py-3 font-medium">Overdue</th>
                  </tr>
                </thead>
                <tbody>
                  {data.overdueTasks.map((t) => {
                    const cl = criticalityLabel(t.criticality);
                    return (
                    <tr key={t.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3 font-medium">{t.title}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.project}</td>
                      <td className="px-4 py-3 text-muted-foreground">{t.assignee ?? "—"}</td>
                      <td className="px-4 py-3">
                        <Badge tone={cl.tone}>
                          {t.criticality} · {cl.label}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">{formatDate(t.endDate)}</td>
                      <td className="px-4 py-3">
                        <Badge tone="destructive">
                          {t.daysOverdue} {t.daysOverdue === 1 ? "day" : "days"}
                        </Badge>
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
    </div>
  );
}

/* ---------------- Individual detail panel ---------------- */
function MemberDetail({ member, onBack }: { member: UserMetric; onBack: () => void }) {
  const sl = scoreLabel(member.breakdown.score);
  const maxProjectHours = Math.max(1, ...member.projects.map((p) => p.hours));

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3 pb-2">
        <CardTitle>
          {medal(member.rank)} {member.name} — Detail
        </CardTitle>
        <Button size="sm" variant="outline" className="print:hidden" onClick={onBack}>
          ← All members
        </Button>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Big stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <div className="rounded-lg border border-border p-4">
            <p className="text-sm text-muted-foreground">Score</p>
            <div className="mt-2 flex flex-col gap-1">
              <StarRating score={member.breakdown.score} size={22} />
              <Badge tone={sl.tone} className="w-fit">
                {sl.label}
              </Badge>
            </div>
          </div>
          <StatCard
            label="Productivity Time"
            value={`${member.totalHours}h`}
            hint={`of ${member.expectedHours}h expected`}
          />
          <StatCard label="Login Hours" value={`${member.loginHours}h`} />
          <StatCard
            label="Days Logged"
            value={`${member.daysLogged}/${member.workingDays}`}
            hint={
              member.absentDays > 0
                ? `${member.absentDays} absent`
                : "full attendance"
            }
          />
        </div>

        {/* Task stats */}
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <StatCard label="Tasks Completed" value={member.tasksCompleted} />
          <StatCard label="On Time" value={member.tasksCompletedOnTime} />
          <StatCard
            label="Overdue"
            value={member.overdueTasks}
            tone={member.overdueTasks > 0 ? "destructive" : "default"}
          />
          <StatCard
            label="Impact Points"
            value={`${member.criticalityCompleted}/${member.criticalityAssigned}`}
            hint={`${pct(member.breakdown.impact)} of assigned criticality delivered`}
          />
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Per-project breakdown */}
          <div>
            <h4 className="mb-3 text-sm font-semibold">Projects</h4>
            {member.projects.length === 0 ? (
              <p className="text-sm text-muted-foreground">No project activity.</p>
            ) : (
              <div className="space-y-3">
                {member.projects.map((p, i) => (
                  <div key={p.projectId}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="truncate">{p.name}</span>
                      <span className="ml-2 whitespace-nowrap font-medium">{p.hours}h</span>
                    </div>
                    <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${(p.hours / maxProjectHours) * 100}%`,
                          background: CHART_COLORS[i % CHART_COLORS.length],
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Daily hours line chart */}
          <div>
            <LineChartCard
              title="Daily Hours"
              data={member.dailySeries}
              xKey="date"
              lines={[
                { key: "hours", name: "Work", color: CHART_COLORS[1] },
                { key: "loginHours", name: "Login", color: CHART_COLORS[0] },
              ]}
            />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
