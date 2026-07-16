import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { todayUtc } from "@/lib/utils";
import { taskOverdue, taskHoursWorked } from "@/lib/tasks";
import { DashboardClient } from "./DashboardClient";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const s = await getSession();
  if (!s) redirect("/login");

  const date = todayUtc();

  const [log, projects, assigned, myEntries, hourModule] = await Promise.all([
    prisma.dailyLog.findUnique({
      where: { userId_date: { userId: s.sub, date } },
      include: {
        workEntries: {
          include: { project: { select: { id: true, name: true } } },
          orderBy: { id: "asc" },
        },
        breaks: { orderBy: { startAt: "asc" } },
        hourSlots: { orderBy: { startAt: "asc" } },
      },
    }),
    prisma.project.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    // All tasks assigned to this member (every status — the "My Tasks" panel shows all).
    prisma.task.findMany({
      where: { assigneeId: s.sub },
      orderBy: [{ status: "asc" }, { endDate: "asc" }],
      include: {
        project: {
          select: { name: true, onHold: true, holdSince: true, heldDays: true },
        },
      },
    }),
    // Every work entry this member has logged (to total hours per task, incl. legacy title-matched).
    prisma.workEntry.findMany({
      where: { dailyLog: { userId: s.sub } },
      select: { taskId: true, projectId: true, taskDescription: true, hoursWorked: true },
    }),
    prisma.user.findUnique({
      where: { id: s.sub },
      select: { hourModuleEnabled: true, hourModuleHours: true },
    }),
  ]);

  const hoursForTask = (t: { id: string; projectId: string; title: string }) =>
    taskHoursWorked(t, myEntries);

  const tasks = assigned.map((t) => {
    const od = taskOverdue(t.endDate, t.status, {
      onHold: t.project.onHold,
      heldDays: t.project.heldDays,
      holdSince: t.project.holdSince,
    });
    return {
      id: t.id,
      title: t.title,
      projectId: t.projectId,
      projectName: t.project.name,
      status: t.status,
      criticality: t.criticality,
      endDate: t.endDate ? t.endDate.toISOString() : null,
      completedAt: t.completedAt ? t.completedAt.toISOString() : null,
      submittedAt: t.submittedAt ? t.submittedAt.toISOString() : null,
      reviewNote: t.reviewNote ?? null,
      hoursWorked: hoursForTask(t),
      isOverdue: od.overdue,
      daysOverdue: od.daysOverdue,
      onHold: od.onHold,
    };
  });

  // Dates serialize to ISO strings over the client boundary; the client parses them.
  return (
    <DashboardClient
      initialLog={log ? JSON.parse(JSON.stringify(log)) : null}
      projects={projects}
      tasks={tasks}
      userName={s.name}
      hourModuleHours={
        hourModule?.hourModuleEnabled ? hourModule.hourModuleHours ?? null : null
      }
    />
  );
}
