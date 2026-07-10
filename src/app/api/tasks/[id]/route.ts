import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { toDateOnly } from "@/lib/utils";
import { taskSchema } from "@/lib/validation";

export async function PATCH(
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

  const parsed = taskSchema.partial().safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const existing = await prisma.task.findUnique({
    where: { id },
    select: { status: true, completedAt: true },
  });
  if (!existing) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }

  const data = parsed.data;
  const update: Record<string, unknown> = {};
  if (data.projectId !== undefined) update.projectId = data.projectId;
  if (data.title !== undefined) update.title = data.title;
  if (data.startDate !== undefined)
    update.startDate = data.startDate ? toDateOnly(data.startDate) : null;
  if (data.endDate !== undefined)
    update.endDate = data.endDate ? toDateOnly(data.endDate) : null;
  if (data.assigneeId !== undefined)
    update.assigneeId = data.assigneeId ? data.assigneeId : null;

  if (data.status !== undefined) {
    update.status = data.status;
    if (data.status === "DONE" && existing.status !== "DONE") {
      update.completedAt = existing.completedAt ?? new Date();
    } else if (data.status !== "DONE" && existing.status === "DONE") {
      update.completedAt = null;
    }
  }

  const task = await prisma.task.update({
    where: { id },
    data: update,
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });

  return Response.json({ task });
}

export async function DELETE(
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
  await prisma.task.delete({ where: { id } });

  return Response.json({ ok: true });
}
