import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { UsersClient, type User } from "./UsersClient";

export default async function AdminUsersPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.role !== "ADMIN") redirect("/dashboard");

  const users = await prisma.user.findMany({
    select: {
      id: true,
      name: true,
      email: true,
      role: true,
      expectedDailyHours: true,
      active: true,
      createdAt: true,
      hourModuleEnabled: true,
      hourModuleHours: true,
    },
    orderBy: { createdAt: "desc" },
  });

  const initialUsers: User[] = users.map((u) => ({
    ...u,
    createdAt: u.createdAt.toISOString(),
  }));

  return <UsersClient initialUsers={initialUsers} currentUserId={session.sub} />;
}
