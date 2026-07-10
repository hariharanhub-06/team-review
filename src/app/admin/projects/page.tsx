import { prisma } from "@/lib/db";
import ProjectsClient from "./ProjectsClient";

export default async function AdminProjectsPage() {
  const [projects, members] = await Promise.all([
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
  ]);

  return (
    <ProjectsClient
      initialProjects={JSON.parse(JSON.stringify(projects))}
      members={members}
    />
  );
}
