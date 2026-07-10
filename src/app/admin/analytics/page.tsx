import { prisma } from "@/lib/db";
import { requireAdmin } from "@/lib/auth";
import { toDateOnly, todayUtc } from "@/lib/utils";
import { getAnalytics } from "@/lib/analytics";
import { AnalyticsClient } from "./AnalyticsClient";

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  await requireAdmin();
  const sp = await searchParams;

  const today = todayUtc();
  const defaultFrom = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));

  const clean = (v: string | undefined): string | undefined =>
    v && v !== "all" && v !== "" ? v : undefined;

  const fromStr = sp.from ?? ymd(defaultFrom);
  const toStr = sp.to ?? ymd(today);
  const userId = clean(sp.userId);
  const projectId = clean(sp.projectId);
  const status = clean(sp.status) as "COMPLETED" | "IN_PROGRESS" | "BLOCKED" | undefined;

  const [members, projects, result] = await Promise.all([
    prisma.user.findMany({
      where: { role: "MEMBER", active: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.project.findMany({
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    getAnalytics({
      from: toDateOnly(fromStr),
      to: toDateOnly(toStr),
      userId,
      projectId,
      status,
    }),
  ]);

  // Normalize Date fields to plain JSON so the initial render matches the
  // shape returned by /api/analytics on subsequent refetches.
  const initial = JSON.parse(JSON.stringify(result));

  return (
    <AnalyticsClient
      initial={initial}
      members={members}
      projects={projects}
      initialFilters={{
        from: fromStr,
        to: toStr,
        userId: userId ?? "all",
        projectId: projectId ?? "all",
        status: status ?? "all",
      }}
    />
  );
}
