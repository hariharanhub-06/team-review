import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { hourSlotSchema } from "@/lib/validation";
import { buildSlots } from "@/lib/hour-slots";

/**
 * Admin amendment of a single hour-module window.
 *
 * This is the ONLY way a closed window can change: the member's own route
 * refuses anything but the window that is currently open. The window must still
 * be one the day actually has (derived from their login time and interval), so an
 * admin can't invent a range that never existed.
 */
export async function PUT(
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

  const parsed = hourSlotSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const log = await prisma.dailyLog.findUnique({
    where: { id },
    select: {
      id: true,
      loginAt: true,
      logoutAt: true,
      user: { select: { hourModuleEnabled: true, hourModuleHours: true } },
    },
  });

  if (!log) {
    return Response.json({ error: "Entry not found" }, { status: 404 });
  }
  if (!log.user.hourModuleEnabled || !log.user.hourModuleHours) {
    return Response.json(
      { error: "The hour module isn't enabled for this member" },
      { status: 400 }
    );
  }

  const windows = buildSlots(log.loginAt, log.logoutAt, log.user.hourModuleHours);
  const target = windows.find(
    (w) => w.key === new Date(parsed.data.startAt).toISOString()
  );

  if (!target) {
    return Response.json(
      { error: "That time range isn't part of this day" },
      { status: 400 }
    );
  }

  const content = parsed.data.content.trim();

  // Clearing an amendment returns the window to "No entries".
  if (content.length === 0) {
    await prisma.hourSlot.deleteMany({
      where: { dailyLogId: log.id, startAt: target.startAt },
    });
    return Response.json({ slot: null });
  }

  const slot = await prisma.hourSlot.upsert({
    where: { dailyLogId_startAt: { dailyLogId: log.id, startAt: target.startAt } },
    create: {
      dailyLogId: log.id,
      startAt: target.startAt,
      endAt: target.endAt,
      content,
    },
    update: { content, endAt: target.endAt },
    select: { id: true, startAt: true, endAt: true, content: true },
  });

  return Response.json({ slot });
}
