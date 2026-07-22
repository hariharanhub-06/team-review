import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { todayUtc } from "@/lib/utils";
import { saveEntriesSchema } from "@/lib/validation";
import { allowedProjectIds } from "@/lib/member-projects";

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

  const submitted = parsed.data.entries.filter(
    (e) => e.projectId.trim() !== "" && e.hoursWorked > 0
  );

  // A member may only log against projects they're on. The dropdown already
  // limits this, but the check belongs here — the UI is not a security boundary.
  const allowed = await allowedProjectIds(user.sub, existing.id);
  const bad = submitted.find((e) => !allowed.has(e.projectId));
  if (bad) {
    return Response.json(
      { error: "You can only log work against projects you're assigned to" },
      { status: 403 }
    );
  }

  // Keep a task link only if that task is really this member's, on that project.
  // Anything else is stored as free text rather than rejected, so a task that was
  // reassigned or deleted can't block them from saving the hours they worked.
  const ownTasks = await prisma.task.findMany({
    where: { assigneeId: user.sub },
    select: { id: true, projectId: true },
  });
  const ownTaskProject = new Map(ownTasks.map((t) => [t.id, t.projectId]));

  const rows = submitted.map((e) => ({
    dailyLogId: existing.id,
    projectId: e.projectId,
    taskId:
      e.taskId && ownTaskProject.get(e.taskId) === e.projectId ? e.taskId : null,
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
