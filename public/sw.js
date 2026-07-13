/**
 * Service worker for the HH Team PWA.
 *
 * Deliberately conservative about what it stores. Every page in this app is
 * behind a session cookie, so caching HTML or API responses would leave one
 * member's data on disk for the next person to open the app on a shared
 * machine — and would happily serve it after logout. So:
 *
 *   - hashed build assets (/_next/static, /icons)  -> cache-first, they are immutable
 *   - everything else (pages, /api, auth)          -> network only
 *   - a failed navigation                          -> the /offline page
 *
 * The upshot: the app installs, launches instantly, and degrades to a polite
 * "you're offline" screen rather than showing stale or foreign data.
 */

const VERSION = "v1";
const STATIC_CACHE = `hh-static-${VERSION}`;
const OFFLINE_URL = "/offline";

// Precached so the offline screen works on the very first disconnection.
const PRECACHE = [OFFLINE_URL, "/icons/icon-192.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys.filter((k) => k !== STATIC_CACHE).map((k) => caches.delete(k))
        )
      )
      .then(() => self.clients.claim())
  );
});

/** Immutable, non-sensitive build output — safe to keep. */
function isStaticAsset(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  );
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Never touch non-GET, cross-origin, or API traffic.
  if (request.method !== "GET") return;
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (isStaticAsset(url)) {
    event.respondWith(
      caches.match(request).then(
        (hit) =>
          hit ??
          fetch(request).then((res) => {
            // Only stash complete, successful responses.
            if (res.ok && res.status === 200) {
              const copy = res.clone();
              caches.open(STATIC_CACHE).then((c) => c.put(request, copy));
            }
            return res;
          })
      )
    );
    return;
  }

  // Pages: always go to the network so data is never stale, and never store the
  // response. If the network is gone, show the offline screen instead.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() =>
        caches.match(OFFLINE_URL).then((hit) => hit ?? Response.error())
      )
    );
  }
});
