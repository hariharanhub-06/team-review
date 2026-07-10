import Link from "next/link";
import { prisma } from "@/lib/db";
import { getAnalytics } from "@/lib/analytics";
import { todayUtc, round } from "@/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  StatCard,
} from "@/components/ui";

export default async function AdminOverviewPage() {
  const to = todayUtc();
  const from = new Date(Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), 1));

  const [analytics, totalUsers, totalMembers, totalProjects, totalTasks] =
    await Promise.all([
      getAnalytics({ from, to }),
      prisma.user.count(),
      prisma.user.count({ where: { role: "MEMBER" } }),
      prisma.project.count(),
      prisma.task.count(),
    ]);

  const { totals, taskStats, perUser, overdueTasks, projectDistribution } =
    analytics;

  const scoreTone =
    totals.avgScore >= 60
      ? "success"
      : totals.avgScore >= 40
      ? "warning"
      : "destructive";

  const topPerformers = [...perUser].sort((a, b) => a.rank - b.rank).slice(0, 3);

  const topProjects = [...projectDistribution]
    .sort((a, b) => b.hours - a.hours)
    .slice(0, 6);
  const maxProjectHours = Math.max(1, ...topProjects.map((p) => p.hours));

  const scoreBadgeTone = (score: number) =>
    score >= 60 ? "success" : score >= 40 ? "warning" : "destructive";

  const quickLinks = [
    { href: "/admin/users", label: "Users", icon: "👥" },
    { href: "/admin/projects", label: "Projects", icon: "📁" },
    { href: "/admin/overview", label: "Work Logs", icon: "📋" },
    { href: "/admin/analytics", label: "Analytics", icon: "📈" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Overview</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This month at a glance
        </p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard
          label="Total Members"
          value={totalMembers}
          hint={`${totalUsers} total users`}
        />
        <StatCard label="Total Projects" value={totalProjects} />
        <StatCard
          label="Hours Logged"
          value={round(totals.totalHours)}
          hint="This month"
        />
        <StatCard
          label="Avg Productivity"
          value={round(totals.avgScore)}
          tone={scoreTone}
          hint="Score 0–100"
        />
        <StatCard
          label="Task Completion"
          value={`${round(taskStats.completionRate)}%`}
          hint={`${taskStats.completed}/${taskStats.total} tasks`}
        />
        <StatCard
          label="Overdue Tasks"
          value={taskStats.overdue}
          tone={taskStats.overdue > 0 ? "destructive" : "success"}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Top performers */}
        <Card>
          <CardHeader>
            <CardTitle>Top Performers</CardTitle>
          </CardHeader>
          <CardContent>
            {topPerformers.length === 0 ? (
              <p className="text-sm text-muted-foreground">No activity yet.</p>
            ) : (
              <ul className="space-y-3">
                {topPerformers.map((u, i) => (
                  <li
                    key={u.userId}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-muted-foreground">
                        {i + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {u.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {round(u.totalHours)}h logged
                        </p>
                      </div>
                    </div>
                    <Badge tone={scoreBadgeTone(u.breakdown.score)}>
                      {round(u.breakdown.score)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Overdue tasks */}
        <Card>
          <CardHeader>
            <CardTitle>Overdue Tasks</CardTitle>
          </CardHeader>
          <CardContent>
            {overdueTasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                🎉 No overdue tasks
              </p>
            ) : (
              <ul className="space-y-3">
                {overdueTasks.slice(0, 6).map((t) => (
                  <li
                    key={t.id}
                    className="flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {t.title}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {t.project} · {t.assignee}
                      </p>
                    </div>
                    <Badge tone="destructive">
                      {t.daysOverdue}d overdue
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Project effort */}
        <Card>
          <CardHeader>
            <CardTitle>Project Effort</CardTitle>
          </CardHeader>
          <CardContent>
            {topProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No hours logged this month.
              </p>
            ) : (
              <ul className="space-y-3">
                {topProjects.map((p) => (
                  <li key={p.projectId}>
                    <div className="mb-1 flex items-center justify-between gap-3 text-sm">
                      <span className="truncate text-foreground">{p.name}</span>
                      <span className="shrink-0 text-muted-foreground">
                        {round(p.hours)}h
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-primary"
                        style={{
                          width: `${(p.hours / maxProjectHours) * 100}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* Quick links */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Links</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 gap-3">
              {quickLinks.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="inline-flex h-10 items-center justify-start gap-2 rounded-md border border-border bg-transparent px-4 text-sm font-medium transition-colors hover:bg-accent"
                >
                  <span>{l.icon}</span>
                  {l.label}
                </Link>
              ))}
            </div>
            <p className="mt-4 text-xs text-muted-foreground">
              {totals.activeMembers} active members · {totalTasks} tasks tracked
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
