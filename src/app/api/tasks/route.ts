import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { toDateOnly } from "@/lib/utils";
import { taskSchema } from "@/lib/validation";

export async function GET(request: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const projectId = new URL(request.url).searchParams.get("projectId");

  const tasks = await prisma.task.findMany({
    where: projectId ? { projectId } : undefined,
    orderBy: [{ endDate: "asc" }, { createdAt: "asc" }],
    include: {
      project: { select: { id: true, name: true } },
      assignee: { select: { id: true, name: true } },
    },
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
