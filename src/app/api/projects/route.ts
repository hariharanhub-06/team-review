import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { toDateOnly, round } from "@/lib/utils";
import { projectSchema } from "@/lib/validation";

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const [projects, entries] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          orderBy: { endDate: "asc" },
          include: { assignee: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.workEntry.findMany({
      select: { taskId: true, projectId: true, taskDescription: true, hoursWorked: true },
    }),
  ]);

  // Total hours logged per task (linked via taskId, or legacy title match).
  const withHours = projects.map((p) => ({
    ...p,
    tasks: p.tasks.map((t) => ({
      ...t,
      hoursWorked: round(
        entries
          .filter(
            (e) =>
              e.taskId === t.id ||
              (!e.taskId && e.projectId === t.projectId && e.taskDescription === t.title)
          )
          .reduce((sum, e) => sum + e.hoursWorked, 0)
      ),
    })),
  }));

  return Response.json({ projects: withHours });
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

  const parsed = projectSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const { name, description, startDate, endDate, deliverables } = parsed.data;

  const project = await prisma.project.create({
    data: {
      name,
      description: description ?? "",
      deliverables: deliverables ?? "",
      startDate: startDate ? toDateOnly(startDate) : null,
      endDate: endDate ? toDateOnly(endDate) : null,
    },
    include: {
      _count: { select: { tasks: true } },
      tasks: {
        orderBy: { endDate: "asc" },
        include: { assignee: { select: { id: true, name: true } } },
      },
    },
  });

  return Response.json({ project }, { status: 201 });
}
