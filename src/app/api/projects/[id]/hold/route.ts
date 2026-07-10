import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

const bodySchema = z.object({ hold: z.boolean() });

/**
 * Put a project on hold or resume it.
 * - hold=true  : mark onHold, stamp holdSince (if not already held).
 * - hold=false : accumulate the elapsed hold days into heldDays and clear the hold.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const { id } = await params;
  const json = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request body" }, { status: 400 });
  }

  const project = await prisma.project.findUnique({ where: { id } });
  if (!project) {
    return Response.json({ error: "Project not found" }, { status: 404 });
  }

  const now = new Date();
  let data: { onHold: boolean; holdSince: Date | null; heldDays?: number };

  if (parsed.data.hold) {
    if (project.onHold) {
      return Response.json({ error: "Project is already on hold" }, { status: 400 });
    }
    data = { onHold: true, holdSince: now };
  } else {
    if (!project.onHold) {
      return Response.json({ error: "Project is not on hold" }, { status: 400 });
    }
    const elapsedDays = project.holdSince
      ? Math.max(
          0,
          Math.floor((now.getTime() - project.holdSince.getTime()) / 86_400_000)
        )
      : 0;
    data = { onHold: false, holdSince: null, heldDays: project.heldDays + elapsedDays };
  }

  const updated = await prisma.project.update({ where: { id }, data });
  return Response.json({ project: updated });
}
