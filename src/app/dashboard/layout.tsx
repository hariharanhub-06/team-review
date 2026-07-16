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
  // Admins have no member dashboard — the middleware also enforces this, but the
  // layout guard keeps an admin from ever rendering the member shell.
  if (s.role === "ADMIN") redirect("/admin");

  return (
    <AppShell role={s.role} name={s.name} email={s.email}>
      {children}
    </AppShell>
  );
}
