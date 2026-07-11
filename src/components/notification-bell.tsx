"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui";
import { cn } from "@/lib/utils";

const SEEN_KEY = "twt_notif_seen";
const POLL_MS = 30_000;

type NotificationKind = "APPROVAL" | "LOGIN" | "LOGOUT";

interface Item {
  id: string;
  kind: NotificationKind;
  title: string;
  detail: string;
  /** ISO timestamp */
  at: string;
  taskId?: string;
}

const ICONS: Record<NotificationKind, string> = {
  APPROVAL: "📝",
  LOGIN: "🟢",
  LOGOUT: "🔴",
};

/** "just now" / "5m ago" / "2h ago" / "3d ago" */
function timeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "";
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 60) return "just now";
  const mins = Math.floor(secs / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function NotificationBell() {
  const [items, setItems] = useState<Item[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState(0);
  const [open, setOpen] = useState(false);
  const [lastSeen, setLastSeen] = useState<string | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Read the persisted "last seen" marker once on mount (localStorage is
  // browser-only, so it can't be part of the initial render state).
  useEffect(() => {
    try {
      setLastSeen(window.localStorage.getItem(SEEN_KEY));
    } catch {
      /* storage unavailable — treat everything as unread */
    }
  }, []);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications");
      if (!res.ok) return;
      const data: unknown = await res.json();
      if (!data || typeof data !== "object") return;
      const { items: nextItems, pendingApprovals: nextPending } = data as {
        items?: Item[];
        pendingApprovals?: number;
      };
      if (Array.isArray(nextItems)) setItems(nextItems);
      if (typeof nextPending === "number") setPendingApprovals(nextPending);
    } catch {
      /* offline or transient failure — keep showing the last good data */
    }
  }, []);

  useEffect(() => {
    void load();
    const id = setInterval(() => void load(), POLL_MS);
    return () => clearInterval(id);
  }, [load]);

  const unreadCount = useMemo(() => {
    if (!lastSeen) return items.length;
    const seenMs = new Date(lastSeen).getTime();
    if (Number.isNaN(seenMs)) return items.length;
    return items.filter((i) => new Date(i.at).getTime() > seenMs).length;
  }, [items, lastSeen]);

  const isUnread = useCallback(
    (item: Item) => {
      if (!lastSeen) return true;
      const seenMs = new Date(lastSeen).getTime();
      if (Number.isNaN(seenMs)) return true;
      return new Date(item.at).getTime() > seenMs;
    },
    [lastSeen]
  );

  // Opening the panel marks everything currently listed as seen.
  const toggle = useCallback(() => {
    setOpen((prev) => {
      if (!prev) {
        const now = new Date().toISOString();
        try {
          window.localStorage.setItem(SEEN_KEY, now);
        } catch {
          /* storage unavailable — badge will reappear on reload */
        }
        setLastSeen(now);
      }
      return !prev;
    });
  }, []);

  // Close on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div ref={wrapperRef} className="relative">
      <Button
        variant="ghost"
        size="icon"
        onClick={toggle}
        aria-label={
          unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"
        }
        aria-expanded={open}
        aria-haspopup="true"
        title="Notifications"
        className="relative"
      >
        <span aria-hidden>🔔</span>
        {unreadCount > 0 && (
          <span
            aria-hidden
            className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-bold leading-none text-destructive-foreground"
          >
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div
          role="dialog"
          aria-label="Notifications"
          className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-lg border border-border bg-card shadow-lg sm:w-96"
        >
          <div className="border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            <p
              className={cn(
                "mt-0.5 text-xs",
                pendingApprovals > 0
                  ? "text-[hsl(var(--warning))]"
                  : "text-muted-foreground"
              )}
            >
              {pendingApprovals} pending approval{pendingApprovals === 1 ? "" : "s"}
            </p>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                No recent activity.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {items.map((item) => (
                  <li
                    key={item.id}
                    className={cn(
                      "flex gap-3 px-4 py-3",
                      isUnread(item) && "bg-primary/5"
                    )}
                  >
                    <span className="mt-0.5 shrink-0 text-base leading-none" aria-hidden>
                      {ICONS[item.kind] ?? "🔔"}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-foreground break-words">
                        {item.detail}
                      </p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {timeAgo(item.at)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
