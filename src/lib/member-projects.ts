import { prisma } from "./db";

/**
 * The projects a member may log work against.
 *
 * A member should only see projects they're actually on, so the set is driven by
 * their task assignments — not the whole company's project list.
 *
 * Today's already-logged projects are folded in as well. Without that, a project
 * they were unassigned from mid-day would vanish from the dropdown while their
 * saved row still referenced it: the row would render with no project selected
 * and be silently dropped on the next save. Keeping it lets them finish the day
 * (and re-save) without losing hours they already recorded.
 */
export async function allowedProjectIds(
  userId: string,
  dailyLogId?: string | null
): Promise<Set<string>> {
  const [assigned, logged] = await Promise.all([
    prisma.task.findMany({
      where: { assigneeId: userId },
      select: { projectId: true },
      distinct: ["projectId"],
    }),
    dailyLogId
      ? prisma.workEntry.findMany({
          where: { dailyLogId },
          select: { projectId: true },
          distinct: ["projectId"],
        })
      : Promise.resolve([]),
  ]);

  return new Set([
    ...assigned.map((t) => t.projectId),
    ...logged.map((e) => e.projectId),
  ]);
}

/** Those projects as id/name pairs, for a dropdown. */
export async function allowedProjects(
  userId: string,
  dailyLogId?: string | null
): Promise<{ id: string; name: string }[]> {
  const ids = await allowedProjectIds(userId, dailyLogId);
  if (ids.size === 0) return [];

  return prisma.project.findMany({
    where: { id: { in: [...ids] } },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}
