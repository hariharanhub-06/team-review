"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "./theme-toggle";
import { Button } from "./ui";

export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** For member dashboard sections: which ?tab= value this item represents. */
  tab?: "today" | "work" | "tasks";
}

const MEMBER_NAV: NavItem[] = [
  { href: "/dashboard", label: "Today", icon: "🗓️", tab: "today" },
  { href: "/dashboard?tab=work", label: "Work Log", icon: "📝", tab: "work" },
  { href: "/dashboard?tab=tasks", label: "My Tasks", icon: "✅", tab: "tasks" },
  { href: "/dashboard/account", label: "Change Password", icon: "🔒" },
];

const ADMIN_NAV: NavItem[] = [
  { href: "/admin", label: "Overview", icon: "🏠" },
  { href: "/admin/users", label: "Users", icon: "👥" },
  { href: "/admin/projects", label: "Projects", icon: "📁" },
  { href: "/admin/overview", label: "Work Logs", icon: "📋" },
  { href: "/admin/analytics", label: "Analytics", icon: "📈" },
  { href: "/admin/account", label: "Account", icon: "🔒" },
];

export function AppShell({
  role,
  name,
  email,
  children,
}: {
  role: "ADMIN" | "MEMBER";
  name: string;
  email: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const nav = role === "ADMIN" ? ADMIN_NAV : MEMBER_NAV;
  const currentTab = searchParams.get("tab") ?? "today";

  function isActive(item: NavItem): boolean {
    if (item.tab) {
      // Member dashboard sections live on /dashboard with a ?tab= value.
      return pathname === "/dashboard" && currentTab === item.tab;
    }
    if (item.href === "/admin" || item.href === "/dashboard") {
      return pathname === item.href && !searchParams.get("tab");
    }
    return pathname.startsWith(item.href);
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-40 w-64 transform border-r border-border bg-card transition-transform md:static md:translate-x-0",
          open ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex h-16 items-center gap-2 border-b border-border px-5">
          <span className="text-xl">⚡</span>
          <span className="font-semibold">Team Tracker</span>
        </div>
        <nav className="space-y-1 p-3">
          {nav.map((item) => {
            const active = isActive(item);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active ? "bg-primary text-primary-foreground" : "hover:bg-accent"
                )}
              >
                <span>{item.icon}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="absolute bottom-0 w-full border-t border-border p-4">
          <p className="truncate text-sm font-medium">{name}</p>
          <p className="truncate text-xs text-muted-foreground">{email}</p>
          <span className="mt-1 inline-block rounded bg-muted px-2 py-0.5 text-xs">{role}</span>
        </div>
      </aside>

      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/40 md:hidden"
          onClick={() => setOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-border bg-background/80 px-4 backdrop-blur md:px-6">
          <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setOpen(true)}>
            ☰
          </Button>
          <div className="flex-1" />
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" onClick={logout}>
              Logout
            </Button>
          </div>
        </header>
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
