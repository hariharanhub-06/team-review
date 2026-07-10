import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { todayUtc } from "@/lib/utils";
import { markLoginSchema } from "@/lib/validation";

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

  const parsed = markLoginSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const date = todayUtc();
  const { plannedWork } = parsed.data;

  const existing = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId: user.sub, date } },
    select: { loginAt: true },
  });

  const log = await prisma.dailyLog.upsert({
    where: { userId_date: { userId: user.sub, date } },
    create: {
      userId: user.sub,
      date,
      loginAt: new Date(),
      plannedWork,
      status: "IN_PROGRESS",
    },
    update: {
      // keep existing loginAt if already set
      loginAt: existing?.loginAt ?? new Date(),
      plannedWork,
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
