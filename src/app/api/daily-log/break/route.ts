import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { todayUtc } from "@/lib/utils";
import { z } from "zod";

const bodySchema = z.object({
  type: z.enum(["LUNCH", "SHORT", "OTHER"]).default("LUNCH"),
});

/**
 * Toggle a break for today.
 * - If there is an OPEN break (endAt null) -> close it (Back to Work).
 * - Otherwise -> start a new break (Out for Break/Lunch).
 * Requires the user to have marked login and not yet marked logout.
 *
 * Break tracking can be switched off per member (User.breaksEnabled). That blocks
 * STARTING a break, but never closing one: an admin can flip the switch while
 * someone is mid-break, and refusing to close it would strand them on break — with
 * logout gated behind "Back to Work", that would lock them out of ending their day.
 */
export async function POST(req: Request) {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const json = await req.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(json);
  const type = parsed.success ? parsed.data.type : "LUNCH";

  const date = todayUtc();
  const log = await prisma.dailyLog.findUnique({
    where: { userId_date: { userId: user.sub, date } },
    include: { breaks: { orderBy: { startAt: "asc" } } },
  });

  if (!log || !log.loginAt) {
    return new Response(JSON.stringify({ error: "Mark login first" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }
  if (log.logoutAt) {
    return new Response(JSON.stringify({ error: "You have already logged out for today" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  const open = log.breaks.find((b) => b.endAt === null);
  if (open) {
    // Always allowed — see the note above about not stranding a mid-break member.
    await prisma.break.update({ where: { id: open.id }, data: { endAt: new Date() } });
  } else {
    const config = await prisma.user.findUnique({
      where: { id: user.sub },
      select: { breaksEnabled: true },
    });
    if (!config?.breaksEnabled) {
      return Response.json(
        { error: "Break tracking isn't enabled for your account" },
        { status: 403 }
      );
    }
    await prisma.break.create({
      data: { dailyLogId: log.id, type, startAt: new Date() },
    });
  }

  const refreshed = await prisma.dailyLog.findUnique({
    where: { id: log.id },
    include: {
      workEntries: { include: { project: { select: { id: true, name: true } } }, orderBy: { id: "asc" } },
      breaks: { orderBy: { startAt: "asc" } },
    },
  });

  return Response.json({ log: refreshed });
}
