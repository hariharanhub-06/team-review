import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { saveEntriesSchema } from "@/lib/validation";
import { round } from "@/lib/utils";

/**
 * Admin edit of a member's work split for one day.
 *
 * PUT { entries: [...] } -> replaces the whole set of work entries on that daily log.
 *
 * Members are blocked from logging out without a split, but days that predate that
 * rule (or that an admin re-opened) can still be missing one — this is how they get
 * fixed, without deleting the day and making the member redo their login/logout.
 */
export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { id } = await params;

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

  const log = await prisma.dailyLog.findUnique({
    where: { id },
    select: { id: true },
  });
  if (!log) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }

  const rows = parsed.data.entries
    .filter((e) => e.projectId.trim() !== "" && e.hoursWorked > 0)
    .map((e) => ({
      dailyLogId: log.id,
      projectId: e.projectId,
      taskId: e.taskId || null,
      taskDescription: e.taskDescription,
      hoursWorked: e.hoursWorked,
    }));

  // Reject unknown projects up front; createMany would otherwise fail the foreign
  // key and surface as an opaque 500.
  const projectIds = [...new Set(rows.map((r) => r.projectId))];
  if (projectIds.length > 0) {
    const found = await prisma.project.count({
      where: { id: { in: projectIds } },
    });
    if (found !== projectIds.length) {
      return Response.json(
        { error: "One or more of those projects no longer exist" },
        { status: 400 }
      );
    }
  }

  await prisma.$transaction([
    prisma.workEntry.deleteMany({ where: { dailyLogId: log.id } }),
    ...(rows.length > 0 ? [prisma.workEntry.createMany({ data: rows })] : []),
  ]);

  const updated = await prisma.workEntry.findMany({
    where: { dailyLogId: log.id },
    include: { project: { select: { name: true } } },
    orderBy: { id: "asc" },
  });

  return Response.json({
    entries: updated.map((e) => ({
      projectId: e.projectId,
      taskId: e.taskId,
      project: e.project.name,
      taskDescription: e.taskDescription,
      hours: e.hoursWorked,
    })),
    totalWorkHours: round(updated.reduce((s, e) => s + e.hoursWorked, 0)),
  });
}
