import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayUtc } from "@/lib/utils";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const s = await getSession();
  if (!s) redirect("/login");

  const date = todayUtc();

  const [log, projects] = await Promise.all([
    prisma.dailyLog.findUnique({
      where: { userId_date: { userId: s.sub, date } },
      include: {
        workEntries: {
          include: { project: { select: { id: true, name: true } } },
          orderBy: { id: "asc" },
        },
        breaks: { orderBy: { startAt: "asc" } },
      },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  // Dates serialize to ISO strings over the client boundary; the client parses them.
  return (
    <DashboardClient
      initialLog={log ? JSON.parse(JSON.stringify(log)) : null}
      projects={projects}
      userName={s.name}
    />
  );
}
