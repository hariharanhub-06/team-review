import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Offline — HH Team",
};

/** Shown by the service worker when a page is requested with no network. */
export default function OfflinePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-8 text-center">
      <div className="text-5xl">📡</div>
      <h1 className="text-2xl font-bold text-foreground">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        HH Team needs a connection to load your work — hours, tasks and
        approvals are always fetched live so you never act on stale data.
        Reconnect and try again.
      </p>
      <a
        href="/dashboard"
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
      >
        Retry
      </a>
    </main>
  );
}
