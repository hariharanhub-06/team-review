import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

/** Full review-cycle history for a task (submitted → rejected → resubmitted → …). */
export async function GET(
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

  const events = await prisma.taskEvent.findMany({
    where: { taskId: id },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      type: true,
      note: true,
      actorName: true,
      createdAt: true,
    },
  });

  return Response.json({ events });
}
