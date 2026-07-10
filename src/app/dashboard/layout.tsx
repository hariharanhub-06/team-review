import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const s = await getSession();
  if (!s) redirect("/login");

  return (
    <AppShell role={s.role} name={s.name} email={s.email}>
      {children}
    </AppShell>
  );
}
