import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { round, toDateOnly } from "@/lib/utils";
import { taskSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const projectId = new URL(request.url).searchParams.get("projectId");

  const [rows, entries] = await Promise.all([
    prisma.task.findMany({
      where: projectId ? { projectId } : undefined,
      orderBy: [{ endDate: "asc" }, { createdAt: "asc" }],
      include: {
        project: {
          select: {
            id: true,
            name: true,
            onHold: true,
            holdSince: true,
            heldDays: true,
          },
        },
        assignee: { select: { id: true, name: true } },
        events: { select: { type: true } },
      },
    }),
    // Fetched once and matched in memory — avoids an aggregate query per task.
    prisma.workEntry.findMany({
      select: {
        taskId: true,
        projectId: true,
        taskDescription: true,
        hoursWorked: true,
      },
    }),
  ]);

  const tasks = rows.map((t) => {
    const hoursWorked = round(
      entries.reduce((sum, e) => {
        const linked = e.taskId === t.id;
        // Legacy entries predate WorkEntry.taskId: match on project + title.
        const legacy =
          !e.taskId &&
          e.projectId === t.projectId &&
          e.taskDescription === t.title;
        return linked || legacy ? sum + e.hoursWorked : sum;
      }, 0)
    );

    let submitCount = 0;
    let rejectCount = 0;
    for (const ev of t.events) {
      if (ev.type === "SUBMITTED") submitCount += 1;
      else if (ev.type === "REJECTED") rejectCount += 1;
    }

    return {
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      project: t.project,
      assigneeId: t.assigneeId,
      assignee: t.assignee,
      status: t.status,
      startDate: t.startDate,
      endDate: t.endDate,
      completedAt: t.completedAt,
      submittedAt: t.submittedAt,
      reviewNote: t.reviewNote,
      hoursWorked,
      submitCount,
      // How many times the task bounced back from review.
      rejectCount,
    };
  });

  return Response.json({ tasks });
}

export async function POST(request: Request) {
  try {
    await requireAdmin();
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

  const parsed = taskSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { projectId, title, startDate, endDate, status, assigneeId } =
    parsed.data;

  const task = await prisma.task.create({
    data: {
      projectId,
      title,
      status,
      startDate: startDate ? toDateOnly(startDate) : null,
      endDate: endDate ? toDateOnly(endDate) : null,
      assigneeId: assigneeId ? assigneeId : null,
      completedAt: status === "DONE" ? new Date() : null,
    },
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
  });

  return Response.json({ task }, { status: 201 });
}
