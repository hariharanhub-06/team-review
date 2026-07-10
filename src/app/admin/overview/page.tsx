import { prisma } from "@/lib/db";
import OverviewClient from "./OverviewClient";

export default async function AdminWorkLogsPage() {
  const [members, projects] = await Promise.all([
    prisma.user.findMany({
      where: { role: "MEMBER" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  return <OverviewClient members={members} projects={projects} />;
}
