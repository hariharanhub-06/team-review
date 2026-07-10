import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { todayUtc } from "@/lib/utils";
import { saveEntriesSchema } from "@/lib/validation";

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

  const parsed = saveEntriesSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const date = todayUtc();

  // Get or create today's log.
  const existing = await prisma.dailyLog.upsert({
    where: { userId_date: { userId: user.sub, date } },
    create: { userId: user.sub, date },
    update: {},
    select: { id: true },
  });

  const rows = parsed.data.entries
    .filter((e) => e.projectId.trim() !== "" && e.hoursWorked > 0)
    .map((e) => ({
      dailyLogId: existing.id,
      projectId: e.projectId,
      taskDescription: e.taskDescription,
      hoursWorked: e.hoursWorked,
    }));

  await prisma.$transaction([
    prisma.workEntry.deleteMany({ where: { dailyLogId: existing.id } }),
    ...(rows.length > 0
      ? [prisma.workEntry.createMany({ data: rows })]
      : []),
  ]);

  const log = await prisma.dailyLog.findUnique({
    where: { id: existing.id },
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
