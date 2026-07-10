import Papa from "papaparse";
import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import {
  formatDate,
  formatTime,
  hoursBetween,
  toDateOnly,
  round,
  sessionStatus,
} from "@/lib/utils";
import type { Prisma } from "@prisma/client";

const SESSION_STATUSES = ["COMPLETED", "ACTIVE", "UNCALCULATED", "ABSENT"];

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
  const wantStatus =
    statusParam && SESSION_STATUSES.includes(statusParam) ? statusParam : undefined;
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
    },
  });

  const data: (string | number)[][] = [];

  for (const log of logs) {
    if (projectId && log.workEntries.length === 0) continue;

    const session = sessionStatus(log.date, log.loginAt, log.logoutAt);
    if (wantStatus && session !== wantStatus) continue;
    const calculable = session === "COMPLETED";

    const base: (string | number)[] = [
      formatDate(log.date),
      log.user.name,
      log.user.email,
      log.loginAt ? formatTime(log.loginAt) : "",
      log.logoutAt ? formatTime(log.logoutAt) : "",
      calculable ? round(hoursBetween(log.loginAt, log.logoutAt)) : "",
      session,
    ];
    const remarks = log.remarks ?? "";

    if (log.workEntries.length === 0) {
      data.push([...base, "", "", "", remarks]);
    } else {
      for (const e of log.workEntries) {
        data.push([
          ...base,
          e.project.name,
          e.taskDescription,
          e.hoursWorked,
          remarks,
        ]);
      }
    }
  }

  const csv = Papa.unparse({
    fields: [
      "Date",
      "User",
      "Email",
      "Login",
      "Logout",
      "LoginHours",
      "Status",
      "Project",
      "Task",
      "HoursWorked",
      "Remarks",
    ],
    data,
  });

  return new Response(csv, {
    headers: {
      "content-type": "text/csv",
      "content-disposition": `attachment; filename="work-logs.csv"`,
    },
  });
}
