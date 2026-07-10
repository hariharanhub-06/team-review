import { requireAdmin } from "@/lib/auth";
import { toDateOnly, todayUtc } from "@/lib/utils";
import { getAnalytics } from "@/lib/analytics";

export async function GET(req: Request) {
  try {
    await requireAdmin();
  } catch (e) {
    if (e instanceof Response) return e;
    throw e;
  }

  const params = new URL(req.url).searchParams;

  const fromRaw = params.get("from");
  const toRaw = params.get("to");
  const userId = params.get("userId");
  const projectId = params.get("projectId");
  const status = params.get("status");

  const today = todayUtc();
  const defaultFrom = new Date(
    Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1)
  );

  const from = fromRaw ? toDateOnly(fromRaw) : toDateOnly(defaultFrom);
  const to = toRaw ? toDateOnly(toRaw) : toDateOnly(today);

  const clean = (v: string | null): string | undefined =>
    v && v !== "all" && v !== "" ? v : undefined;

  const STATUSES = ["COMPLETED", "IN_PROGRESS", "BLOCKED"] as const;
  const rawStatus = clean(status);
  const statusFilter = STATUSES.find((s) => s === rawStatus);

  const filters = {
    from,
    to,
    userId: clean(userId),
    projectId: clean(projectId),
    status: statusFilter,
  };

  const result = await getAnalytics(filters);
  return Response.json(result);
}
