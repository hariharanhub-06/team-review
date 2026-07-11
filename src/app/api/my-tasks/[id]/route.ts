import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({
  action: z.enum(["submit", "withdraw"]).default("submit"),
});

/**
 * Member action on one of THEIR OWN assigned tasks.
 * - "submit"  : mark complete -> IN_REVIEW (awaits admin approval). Allowed from
 *               TODO / IN_PROGRESS / REJECTED.
 * - "withdraw": pull back a pending submission -> IN_PROGRESS.
 * Members can never set DONE directly — only an admin approval does that.
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  const action = parsed.success ? parsed.data.action : "submit";

  const task = await prisma.task.findUnique({ where: { id } });
  if (!task) {
    return Response.json({ error: "Task not found" }, { status: 404 });
  }
  if (task.assigneeId !== user.sub) {
    return Response.json({ error: "This task is not assigned to you" }, { status: 403 });
  }

  if (action === "submit") {
    if (!["TODO", "IN_PROGRESS", "REJECTED"].includes(task.status)) {
      return Response.json(
        { error: `Cannot submit a task that is ${task.status}` },
        { status: 400 }
      );
    }
    const updated = await prisma.task.update({
      where: { id },
      data: { status: "IN_REVIEW", submittedAt: new Date(), reviewNote: null },
    });
    await prisma.taskEvent.create({
      data: {
        taskId: id,
        type: "SUBMITTED",
        actorId: user.sub,
        actorName: user.name,
      },
    });
    return Response.json({ task: updated });
  }

  // withdraw
  if (task.status !== "IN_REVIEW") {
    return Response.json({ error: "Only a pending task can be withdrawn" }, { status: 400 });
  }
  const updated = await prisma.task.update({
    where: { id },
    data: { status: "IN_PROGRESS", submittedAt: null },
  });
  await prisma.taskEvent.create({
    data: {
      taskId: id,
      type: "WITHDRAWN",
      actorId: user.sub,
      actorName: user.name,
    },
  });
  return Response.json({ task: updated });
}
