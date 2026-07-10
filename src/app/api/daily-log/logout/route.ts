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
  const now = new Date();

  // If the member forgot to end a break, close it at logout time so break/active
  // hours don't keep counting after they've left.
  await prisma.break.updateMany({
    where: { dailyLog: { userId: user.sub, date }, endAt: null },
    data: { endAt: now },
  });

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
