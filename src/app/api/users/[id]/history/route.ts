import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hoursBetween, round } from "@/lib/utils";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { id } = await params;

  const user = await prisma.user.findUnique({
    where: { id },
    select: { id: true, name: true, email: true },
  });

  if (!user) {
    return Response.json({ error: "User not found" }, { status: 404 });
  }

  const logs = await prisma.dailyLog.findMany({
    where: { userId: id },
    orderBy: { date: "desc" },
    take: 60,
    select: {
      date: true,
      loginAt: true,
      logoutAt: true,
      status: true,
      plannedWork: true,
      workCompleted: true,
      remarks: true,
      workEntries: { select: { hoursWorked: true } },
    },
  });

  const history = logs.map((log) => {
    const workHours = log.workEntries.reduce((sum, e) => sum + e.hoursWorked, 0);
    return {
      date: log.date,
      loginAt: log.loginAt,
      logoutAt: log.logoutAt,
      status: log.status,
      plannedWork: log.plannedWork,
      workCompleted: log.workCompleted,
      remarks: log.remarks,
      loginHours: round(hoursBetween(log.loginAt, log.logoutAt)),
      workEntriesCount: log.workEntries.length,
      workHours: round(workHours),
    };
  });

  return Response.json({ user, history });
}
