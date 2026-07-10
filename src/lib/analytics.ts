import { prisma } from "./db";
import { hoursBetween, round } from "./utils";
import { computeScore, workingDaysBetween, type ScoreBreakdown } from "./scoring";
import { taskOverdue } from "./tasks";

export interface AnalyticsFilters {
  from: Date;
  to: Date;
  userId?: string;
  projectId?: string;
  status?: "COMPLETED" | "IN_PROGRESS" | "BLOCKED";
}

export interface UserMetric {
  userId: string;
  name: string;
  email: string;
  expectedDailyHours: number;
  totalHours: number;
  expectedHours: number;
  loginHours: number;
  daysLogged: number;
  workingDays: number;
  projectCount: number;
  projects: { projectId: string; name: string; hours: number }[];
  dailySeries: { date: string; hours: number; loginHours: number }[];
  tasksCompleted: number;
  tasksCompletedOnTime: number;
  overdueTasks: number;
  breakdown: ScoreBreakdown;
  rank: number;
}

export interface AnalyticsResult {
  perUser: UserMetric[];
  productivityOverTime: { date: string; hours: number; loginHours: number }[];
  projectDistribution: { projectId: string; name: string; hours: number }[];
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
    endDate: Date | null;
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

export async function getAnalytics(filters: AnalyticsFilters): Promise<AnalyticsResult> {
  const { from, to, userId, projectId, status } = filters;

  const users = await prisma.user.findMany({
    where: { role: "MEMBER", active: true, ...(userId ? { id: userId } : {}) },
    orderBy: { name: "asc" },
  });

  const logs = await prisma.dailyLog.findMany({
    where: {
      date: { gte: from, lte: to },
      ...(userId ? { userId } : {}),
      ...(status ? { status } : {}),
    },
    include: {
      workEntries: {
        where: projectId ? { projectId } : undefined,
        include: { project: true },
      },
      user: true,
    },
  });

  const workingDays = Math.max(1, workingDaysBetween(from, to));

  type UserAgg = {
    totalHours: number;
    loginHours: number;
    daysLogged: number;
    projects: Map<string, { name: string; hours: number }>;
    daily: Map<string, { hours: number; loginHours: number }>;
  };
  const perUserMap = new Map<string, UserAgg>();
  const overTimeMap = new Map<string, { hours: number; loginHours: number }>();
  const projectMap = new Map<string, { name: string; hours: number }>();

  function ensureAgg(id: string): UserAgg {
    let a = perUserMap.get(id);
    if (!a) {
      a = { totalHours: 0, loginHours: 0, daysLogged: 0, projects: new Map(), daily: new Map() };
      perUserMap.set(id, a);
    }
    return a;
  }

  for (const log of logs) {
    const agg = ensureAgg(log.userId);
    const entryHours = log.workEntries.reduce((s, e) => s + e.hoursWorked, 0);
    const loginHours = hoursBetween(log.loginAt, log.logoutAt);
    agg.totalHours += entryHours;
    agg.loginHours += loginHours;
    if (log.loginAt || log.workEntries.length > 0) agg.daysLogged += 1;

    const key = log.date.toISOString().slice(0, 10);
    agg.daily.set(key, {
      hours: (agg.daily.get(key)?.hours ?? 0) + entryHours,
      loginHours: (agg.daily.get(key)?.loginHours ?? 0) + loginHours,
    });

    const ot = overTimeMap.get(key) ?? { hours: 0, loginHours: 0 };
    ot.hours += entryHours;
    ot.loginHours += loginHours;
    overTimeMap.set(key, ot);

    for (const e of log.workEntries) {
      const up = agg.projects.get(e.projectId) ?? { name: e.project.name, hours: 0 };
      up.hours += e.hoursWorked;
      agg.projects.set(e.projectId, up);

      const p = projectMap.get(e.projectId) ?? { name: e.project.name, hours: 0 };
      p.hours += e.hoursWorked;
      projectMap.set(e.projectId, p);
    }
  }

  // Tasks for timeliness + overdue
  const tasks = await prisma.task.findMany({
    where: {
      ...(projectId ? { projectId } : {}),
      ...(userId ? { assigneeId: userId } : {}),
    },
    include: { project: true, assignee: true },
  });

  const now = new Date();
  let completed = 0;
  let onTime = 0;
  let overdue = 0;
  const overdueTasks: AnalyticsResult["overdueTasks"] = [];
  const perUserTaskStats = new Map<string, { completed: number; onTime: number; overdue: number }>();

  function ensureTaskStat(id: string) {
    let s = perUserTaskStats.get(id);
    if (!s) {
      s = { completed: 0, onTime: 0, overdue: 0 };
      perUserTaskStats.set(id, s);
    }
    return s;
  }

  for (const t of tasks) {
    if (t.status === "DONE") {
      completed++;
      const ok = !t.endDate || (t.completedAt && t.completedAt <= endOfDay(t.endDate));
      if (ok) onTime++;
      if (t.assigneeId) {
        const s = ensureTaskStat(t.assigneeId);
        s.completed++;
        if (ok) s.onTime++;
      }
    } else {
      const od = taskOverdue(t.endDate, t.status, t.project, now.getTime());
      if (od.overdue) {
        overdue++;
        if (t.assigneeId) ensureTaskStat(t.assigneeId).overdue++;
        overdueTasks.push({
          id: t.id,
          title: t.title,
          project: t.project.name,
          assignee: t.assignee?.name ?? null,
          endDate: t.endDate,
          daysOverdue: od.daysOverdue,
        });
      }
    }
  }

  const totalTasks = tasks.length;

  const perUser: UserMetric[] = users.map((u) => {
    const agg = perUserMap.get(u.id);
    const ts = perUserTaskStats.get(u.id) ?? { completed: 0, onTime: 0, overdue: 0 };
    const expectedHours = u.expectedDailyHours * workingDays;
    const totalHours = agg?.totalHours ?? 0;
    const breakdown = computeScore({
      hoursWorked: totalHours,
      expectedHours,
      tasksCompleted: ts.completed,
      tasksCompletedOnTime: ts.onTime,
      daysLogged: agg?.daysLogged ?? 0,
      workingDays,
    });
    const projects = agg
      ? [...agg.projects.entries()]
          .map(([projectId, v]) => ({ projectId, name: v.name, hours: round(v.hours) }))
          .sort((a, b) => b.hours - a.hours)
      : [];
    const dailySeries = agg
      ? [...agg.daily.entries()]
          .map(([date, v]) => ({ date, hours: round(v.hours), loginHours: round(v.loginHours) }))
          .sort((a, b) => a.date.localeCompare(b.date))
      : [];
    return {
      userId: u.id,
      name: u.name,
      email: u.email,
      expectedDailyHours: u.expectedDailyHours,
      totalHours: round(totalHours),
      expectedHours: round(expectedHours),
      loginHours: round(agg?.loginHours ?? 0),
      daysLogged: agg?.daysLogged ?? 0,
      workingDays,
      projectCount: projects.length,
      projects,
      dailySeries,
      tasksCompleted: ts.completed,
      tasksCompletedOnTime: ts.onTime,
      overdueTasks: ts.overdue,
      breakdown,
      rank: 0,
    };
  });

  perUser.sort((a, b) => b.breakdown.score - a.breakdown.score);
  perUser.forEach((u, i) => (u.rank = i + 1));

  const productivityOverTime = [...overTimeMap.entries()]
    .map(([date, v]) => ({ date, hours: round(v.hours), loginHours: round(v.loginHours) }))
    .sort((a, b) => a.date.localeCompare(b.date));

  const projectDistribution = [...projectMap.entries()]
    .map(([projectId, v]) => ({ projectId, name: v.name, hours: round(v.hours) }))
    .sort((a, b) => b.hours - a.hours);

  const loginVsActive = perUser.map((u) => ({
    name: u.name,
    loginHours: u.loginHours,
    activeHours: u.totalHours,
  }));

  const totalHours = perUser.reduce((s, u) => s + u.totalHours, 0);
  const totalLoginHours = perUser.reduce((s, u) => s + u.loginHours, 0);
  const avgScore =
    perUser.length > 0
      ? Math.round(perUser.reduce((s, u) => s + u.breakdown.score, 0) / perUser.length)
      : 0;

  return {
    perUser,
    productivityOverTime,
    projectDistribution,
    loginVsActive,
    taskStats: {
      total: totalTasks,
      completed,
      onTime,
      overdue,
      completionRate: totalTasks > 0 ? Math.round((completed / totalTasks) * 100) : 0,
      onTimeRate: completed > 0 ? Math.round((onTime / completed) * 100) : 0,
    },
    overdueTasks: overdueTasks.sort((a, b) => b.daysOverdue - a.daysOverdue),
    totals: {
      totalHours: round(totalHours),
      totalLoginHours: round(totalLoginHours),
      activeMembers: perUser.filter((u) => u.daysLogged > 0).length,
      avgScore,
      totalProjects: projectDistribution.length,
    },
  };
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setUTCHours(23, 59, 59, 999);
  return x;
}
