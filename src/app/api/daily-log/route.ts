import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { todayUtc } from "@/lib/utils";

export async function GET() {
  let user;
  try {
    user = await requireUser();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const date = todayUtc();

  const [log, projects] = await Promise.all([
    prisma.dailyLog.findUnique({
      where: { userId_date: { userId: user.sub, date } },
      include: {
        workEntries: {
          include: { project: { select: { id: true, name: true } } },
          orderBy: { id: "asc" },
        },
        breaks: { orderBy: { startAt: "asc" } },
      },
    }),
    prisma.project.findMany({ orderBy: { name: "asc" } }),
  ]);

  return Response.json({ log, projects });
}
