import { prisma } from "@/lib/db";
import { taskHoursWorked } from "@/lib/tasks";
import ProjectsClient from "./ProjectsClient";

export default async function AdminProjectsPage() {
  const [projects, members, entries] = await Promise.all([
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { tasks: true } },
        tasks: {
          orderBy: { endDate: "asc" },
          include: { assignee: { select: { id: true, name: true } } },
        },
      },
    }),
    prisma.user.findMany({
      where: { role: "MEMBER", active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.workEntry.findMany({
      select: {
        taskId: true,
        projectId: true,
        taskDescription: true,
        hoursWorked: true,
      },
    }),
  ]);

  // Must match what GET /api/projects returns — the client swaps this initial
  // payload for that one on the first refetch, and a mismatch shows up as hours
  // that appear out of nowhere when you touch an unrelated task.
  const withHours = projects.map((p) => ({
    ...p,
    tasks: p.tasks.map((t) => ({ ...t, hoursWorked: taskHoursWorked(t, entries) })),
  }));

  return (
    <ProjectsClient
      initialProjects={JSON.parse(JSON.stringify(withHours))}
      members={members}
    />
  );
}
