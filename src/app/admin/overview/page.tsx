import { prisma } from "@/lib/db";
import OverviewClient from "./OverviewClient";

export default async function AdminWorkLogsPage() {
  const [members, projects, tasks] = await Promise.all([
    prisma.user.findMany({
      where: { role: "MEMBER" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    // Every assigned task, so the work-split editor can offer a member the same
    // task list they'd see on their own dashboard.
    prisma.task.findMany({
      where: { assigneeId: { not: null } },
      select: { id: true, title: true, projectId: true, assigneeId: true },
      orderBy: { title: "asc" },
    }),
  ]);

  return <OverviewClient members={members} projects={projects} tasks={tasks} />;
}
