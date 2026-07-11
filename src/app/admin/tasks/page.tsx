import { prisma } from "@/lib/db";
import TasksClient from "./TasksClient";

export default async function AdminTasksPage() {
  const members = await prisma.user.findMany({
    where: { role: "MEMBER", active: true },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Tasks by Member</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Review, approve and track every task across the team.
        </p>
      </div>

      <TasksClient members={members} />
    </div>
  );
}
