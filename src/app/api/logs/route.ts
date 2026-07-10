import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hoursBetween, toDateOnly, round } from "@/lib/utils";
import type { Prisma, DayStatus } from "@prisma/client";

const STATUSES: DayStatus[] = ["COMPLETED", "IN_PROGRESS", "BLOCKED"];

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const params = new URL(request.url).searchParams;
  const userId = params.get("userId") || undefined;
  const projectId = params.get("projectId") || undefined;
  const statusParam = params.get("status") || undefined;
  const from = params.get("from") || undefined;
  const to = params.get("to") || undefined;

  const where: Prisma.DailyLogWhereInput = {};

  if (from || to) {
    const dateFilter: Prisma.DateTimeFilter = {};
    if (from) dateFilter.gte = toDateOnly(from);
    if (to) dateFilter.lte = toDateOnly(to);
    where.date = dateFilter;
  }
  if (userId) where.userId = userId;
  if (statusParam && STATUSES.includes(statusParam as DayStatus)) {
    where.status = statusParam as DayStatus;
  }

  const logs = await prisma.dailyLog.findMany({
    where,
    orderBy: { date: "desc" },
    include: {
      user: { select: { name: true, email: true } },
      workEntries: {
        where: projectId ? { projectId } : undefined,
        include: { project: { select: { name: true } } },
        orderBy: { id: "asc" },
      },
      breaks: { orderBy: { startAt: "asc" } },
    },
  });

  const rows = logs
    // If a project filter is set, only keep logs that have a matching entry.
    .filter((log) => (projectId ? log.workEntries.length > 0 : true))
    .map((log) => {
      const totalWorkHours = log.workEntries.reduce(
        (sum, e) => sum + e.hoursWorked,
        0
      );
      const breakHours = log.breaks.reduce(
        (sum, b) => sum + hoursBetween(b.startAt, b.endAt),
        0
      );
      const loginHours = hoursBetween(log.loginAt, log.logoutAt);
      return {
        id: log.id,
        date: log.date,
        userName: log.user.name,
        userEmail: log.user.email,
        loginAt: log.loginAt,
        logoutAt: log.logoutAt,
        loginHours: round(loginHours),
        breakHours: round(breakHours),
        netActiveHours: round(Math.max(0, loginHours - breakHours)),
        breaks: log.breaks.map((b) => ({
          type: b.type,
          startAt: b.startAt,
          endAt: b.endAt,
        })),
        status: log.status,
        plannedWork: log.plannedWork,
        workCompleted: log.workCompleted,
        remarks: log.remarks,
        totalWorkHours: round(totalWorkHours),
        entries: log.workEntries.map((e) => ({
          project: e.project.name,
          taskDescription: e.taskDescription,
          hours: e.hoursWorked,
        })),
      };
    });

  const totalHours = round(
    rows.reduce((sum, r) => sum + r.totalWorkHours, 0)
  );

  return Response.json({
    rows,
    summary: { totalLogs: rows.length, totalHours },
  });
}
