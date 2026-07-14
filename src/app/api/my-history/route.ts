import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hoursBetween, round } from "@/lib/utils";

export const dynamic = "force-dynamic";

/** A member's own work-log history. Read-only — there is no PATCH/DELETE here by design. */
export async function GET() {
  let session;
  try {
    session = await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const logs = await prisma.dailyLog.findMany({
    where: { userId: session.sub },
    orderBy: { date: "desc" },
    take: 60,
    select: {
      id: true,
      date: true,
      loginAt: true,
      logoutAt: true,
      status: true,
      plannedWork: true,
      workCompleted: true,
      remarks: true,
      workEntries: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          taskDescription: true,
          hoursWorked: true,
          project: { select: { name: true } },
        },
      },
      breaks: {
        orderBy: { startAt: "asc" },
        select: { id: true, type: true, startAt: true, endAt: true },
      },
    },
  });

  const history = logs.map((log) => {
    const workHours = log.workEntries.reduce((sum, e) => sum + e.hoursWorked, 0);
    // An unclosed break is capped at logout; if the day never ended, it contributes nothing.
    const breakHours = log.breaks.reduce(
      (sum, b) => sum + hoursBetween(b.startAt, b.endAt ?? log.logoutAt),
      0
    );
    const loginHours = hoursBetween(log.loginAt, log.logoutAt);

    return {
      id: log.id,
      date: log.date,
      loginAt: log.loginAt,
      logoutAt: log.logoutAt,
      status: log.status,
      plannedWork: log.plannedWork,
      workCompleted: log.workCompleted,
      remarks: log.remarks,
      loginHours: round(loginHours),
      breakHours: round(breakHours),
      netHours: round(Math.max(0, loginHours - breakHours)),
      workHours: round(workHours),
      entries: log.workEntries.map((e) => ({
        id: e.id,
        project: e.project?.name ?? "—",
        taskDescription: e.taskDescription,
        hours: e.hoursWorked,
      })),
      breaks: log.breaks,
    };
  });

  return Response.json({ history });
}
