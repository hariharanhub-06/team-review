import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";

const LIMIT = 40;
const WINDOW_DAYS = 7;

type NotificationKind = "APPROVAL" | "LOGIN" | "LOGOUT";

type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  at: Date;
  taskId?: string;
};

export async function GET() {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const sevenDaysAgo = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);

  const [submissions, logins, logouts, pendingApprovals] = await Promise.all([
    prisma.taskEvent.findMany({
      where: { type: "SUBMITTED", createdAt: { gte: sevenDaysAgo } },
      include: { task: { include: { project: { select: { name: true } } } } },
      orderBy: { createdAt: "desc" },
      take: LIMIT,
    }),
    prisma.dailyLog.findMany({
      where: { loginAt: { gte: sevenDaysAgo } },
      include: { user: { select: { name: true } } },
      orderBy: { loginAt: "desc" },
      take: LIMIT,
    }),
    prisma.dailyLog.findMany({
      where: { logoutAt: { gte: sevenDaysAgo } },
      include: { user: { select: { name: true } } },
      orderBy: { logoutAt: "desc" },
      take: LIMIT,
    }),
    prisma.task.count({ where: { status: "IN_REVIEW" } }),
  ]);

  const items: NotificationItem[] = [
    ...submissions.map((e) => ({
      id: `evt-${e.id}`,
      kind: "APPROVAL" as const,
      title: "Approval request",
      detail: `${e.actorName ?? "Someone"} submitted “${e.task.title}” (${e.task.project.name})`,
      at: e.createdAt,
      taskId: e.taskId,
    })),
    ...logins.flatMap((log) =>
      log.loginAt
        ? [
            {
              id: `in-${log.id}`,
              kind: "LOGIN" as const,
              title: "Marked login",
              detail: `${log.user.name} marked login`,
              at: log.loginAt,
            },
          ]
        : []
    ),
    ...logouts.flatMap((log) =>
      log.logoutAt
        ? [
            {
              id: `out-${log.id}`,
              kind: "LOGOUT" as const,
              title: "Marked logout",
              detail: `${log.user.name} marked logout`,
              at: log.logoutAt,
            },
          ]
        : []
    ),
  ]
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, LIMIT);

  return Response.json({ items, pendingApprovals });
}
