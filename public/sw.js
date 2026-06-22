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
    fetch(request).catch(() => caches.match(request) ?? caches.match("/"))
  );
});
