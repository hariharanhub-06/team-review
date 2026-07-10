import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { toDateOnly } from "@/lib/utils";
import { projectSchema } from "@/lib/validation";

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

  const parsed = projectSchema.partial().safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const data = parsed.data;
  const update: Record<string, unknown> = {};
  if (data.name !== undefined) update.name = data.name;
  if (data.description !== undefined) update.description = data.description ?? "";
  if (data.deliverables !== undefined)
    update.deliverables = data.deliverables ?? "";
  if (data.startDate !== undefined)
    update.startDate = data.startDate ? toDateOnly(data.startDate) : null;
  if (data.endDate !== undefined)
    update.endDate = data.endDate ? toDateOnly(data.endDate) : null;

  const project = await prisma.project.update({
    where: { id },
    data: update,
    include: {
      _count: { select: { tasks: true } },
      tasks: {
        orderBy: { endDate: "asc" },
        include: { assignee: { select: { id: true, name: true } } },
      },
    },
  });

  return Response.json({ project });
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
  await prisma.project.delete({ where: { id } });

  return Response.json({ ok: true });
}
