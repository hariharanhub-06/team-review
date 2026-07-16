import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { todayUtc } from "@/lib/utils";
import { hourSlotSchema } from "@/lib/validation";
import { activeSlot } from "@/lib/hour-slots";

/**
 * Autosave what a member is doing in the CURRENT hour-module window.
 *
 * The window rule is enforced here, not just in the UI: a member may only write
 * to the window that contains "now". Once a window passes it is frozen, and only
 * an admin can amend it (PUT /api/logs/[id]/hour-slots). A stale tab replaying an
 * old save is therefore rejected rather than silently rewriting history.
 */
export async function POST(request: Request) {
  let user;
  try {
    user = await requireUser();
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

  const parsed = hourSlotSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const config = await prisma.user.findUnique({
    where: { id: user.sub },
    select: { hourModuleEnabled: true, hourModuleHours: true },
  });

  if (!config?.hourModuleEnabled || !config.hourModuleHours) {
    return Response.json(
      { error: "The hour module isn't enabled for your account" },
      { status: 403 }
    );
  }

  const log = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId: user.sub, date: todayUtc() } },
    select: { id: true, loginAt: true, logoutAt: true },
  });

  if (!log?.loginAt) {
    return Response.json({ error: "Mark login first" }, { status: 400 });
  }
  if (log.logoutAt) {
    return Response.json(
      { error: "Your day is closed — ask an admin to amend it" },
      { status: 403 }
    );
  }

  const current = activeSlot(log.loginAt, log.logoutAt, config.hourModuleHours);
  if (!current) {
    return Response.json({ error: "No reporting window is open" }, { status: 400 });
  }

  // The client must be writing to the window that is actually open right now.
  if (current.key !== new Date(parsed.data.startAt).toISOString()) {
    return Response.json(
      { error: "That time range has closed and can no longer be edited" },
      { status: 409 }
    );
  }

  const content = parsed.data.content.trim();

  // Nothing written: drop any row so the window reads "No entries" rather than blank.
  if (content.length === 0) {
    await prisma.hourSlot.deleteMany({
      where: { dailyLogId: log.id, startAt: current.startAt },
    });
    return Response.json({ slot: null });
  }

  const slot = await prisma.hourSlot.upsert({
    where: {
      dailyLogId_startAt: { dailyLogId: log.id, startAt: current.startAt },
    },
    create: {
      dailyLogId: log.id,
      startAt: current.startAt,
      endAt: current.endAt,
      content,
    },
    update: { content, endAt: current.endAt },
    select: { id: true, startAt: true, endAt: true, content: true },
  });

  return Response.json({ slot });
}
