// Forge Service Worker — offline shell caching
const CACHE = "forge-shell-v1";

// Only cache navigational shell assets (app shell strategy)
const SHELL = ["/", "/login"];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  // Only intercept same-origin GET navigation requests
  const { request } = e;
  if (request.method !== "GET") return;
  if (!request.url.startsWith(self.location.origin)) return;
  // Skip API, auth, and Next.js internal routes
  const path = new URL(request.url).pathname;
  if (path.startsWith("/api/") || path.startsWith("/_next/") || path.startsWith("/auth/")) return;

  e.respondWith(
    // `caches.match(...) ?? caches.match(...)` was the bug: caches.match()
    // always returns a Promise (truthy), so ?? never actually fell through
    // to the "/" fallback. Any route other than the two pre-cached SHELL
    // paths resolved the first lookup to undefined, and respondWith(undefined)
    // throws "Failed to convert value to 'Response'" — which surfaces to the
    // page as the whole navigation failing as a network error, not just a
    // missed cache. Chain with .then() so the fallback actually runs.
    fetch(request).catch(() =>
      caches.match(request).then((cached) => cached || caches.match("/"))
    )
  );
});
