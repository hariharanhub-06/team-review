import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { todayUtc } from "@/lib/utils";
import { markLogoutSchema } from "@/lib/validation";

export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const parsed = markLogoutSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const date = todayUtc();

  const existing = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId: user.sub, date } },
    select: { loginAt: true },
  });

  if (!existing?.loginAt) {
    return Response.json({ error: "Mark login first" }, { status: 400 });
  }

  const { workCompleted, remarks } = parsed.data;

  // Block logout while a break is still open — the member must click "Back to Work"
  // first so break/active time is recorded accurately.
  const openBreak = await prisma.break.findFirst({
    where: { dailyLog: { userId: user.sub, date }, endAt: null },
    select: { id: true },
  });
  if (openBreak) {
    return Response.json(
      { error: "You're still on a break. Click \"Back to Work\" before logging out." },
      { status: 400 }
    );
  }

  // Block logout until the day's work is split across projects. Without this the
  // member's presence is recorded but their work hours are 0, which reads as a full
  // day of zero output and silently zeroes the effort half of their score.
  const entryCount = await prisma.workEntry.count({
    where: { dailyLog: { userId: user.sub, date } },
  });
  if (entryCount === 0) {
    return Response.json(
      {
        error:
          "Add your work split before logging out — log at least one project entry with the hours you spent on it.",
      },
      { status: 400 }
    );
  }

  const now = new Date();

  const log = await prisma.dailyLog.update({
    where: { userId_date: { userId: user.sub, date } },
    data: {
      logoutAt: now,
      workCompleted,
      remarks,
    },
    include: {
      workEntries: {
        include: { project: { select: { id: true, name: true } } },
        orderBy: { id: "asc" },
      },
      breaks: { orderBy: { startAt: "asc" } },
    },
  });

  return Response.json({ log });
}
