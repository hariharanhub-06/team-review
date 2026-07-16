import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { z } from "zod";

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("undoLogout") }),
  z.object({ action: z.literal("undoBreaks") }),
  z.object({ action: z.literal("setLogout"), logoutAt: z.string().datetime() }),
]);

/**
 * Admin correction actions on a member's daily log.
 *
 * PATCH { action: "undoLogout" }              -> clears logoutAt / workCompleted / remarks so the
 *                                                member can carry on and mark logout properly later
 *                                                (e.g. they hit "Mark Logout" by mistake in the morning).
 * PATCH { action: "undoBreaks" }              -> removes every break recorded for that day.
 * PATCH { action: "setLogout", logoutAt }     -> back-fills a logout time when the member forgot to
 *                                                mark logout, so the day's hours can be calculated.
 */
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

  const body = await request.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: "Invalid action" }, { status: 400 });
  }

  const log = await prisma.dailyLog.findUnique({ where: { id } });
  if (!log) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }

  if (parsed.data.action === "undoLogout") {
    if (!log.logoutAt) {
      return Response.json(
        { error: "This entry has no logout to undo" },
        { status: 400 }
      );
    }
    const updated = await prisma.dailyLog.update({
      where: { id },
      data: { logoutAt: null, workCompleted: null, remarks: null, status: null },
    });
    return Response.json({ log: updated });
  }

  if (parsed.data.action === "setLogout") {
    if (!log.loginAt) {
      return Response.json(
        { error: "This day has no login to attach a logout to" },
        { status: 400 }
      );
    }
    const logoutAt = new Date(parsed.data.logoutAt);
    if (logoutAt.getTime() <= log.loginAt.getTime()) {
      return Response.json(
        { error: "Logout time must be after the login time" },
        { status: 400 }
      );
    }
    if (logoutAt.getTime() > Date.now()) {
      return Response.json(
        { error: "Logout time can't be in the future" },
        { status: 400 }
      );
    }
    const updated = await prisma.dailyLog.update({
      where: { id },
      data: { logoutAt },
    });
    return Response.json({ log: updated });
  }

  // undoBreaks
  await prisma.break.deleteMany({ where: { dailyLogId: id } });
  return Response.json({ ok: true });
}

/**
 * Delete a member's whole daily entry (login, logout, notes, work entries, breaks)
 * so they can re-do the day from scratch.
 */
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

  const log = await prisma.dailyLog.findUnique({ where: { id } });
  if (!log) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }

  // WorkEntry + Break cascade on delete.
  await prisma.dailyLog.delete({ where: { id } });

  return Response.json({ ok: true });
}
