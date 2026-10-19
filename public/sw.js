// Khaapa service worker: keeps the app shell and last-seen data available
// offline. Writes never go through here; the POS queues them in IndexedDB.

const VERSION = "v1";
const SHELL = `khaapa-shell-${VERSION}`;
const STATIC = `khaapa-static-${VERSION}`;
const DATA = `khaapa-data-${VERSION}`;

const SHELL_ROUTES = [
  "/",
  "/pos",
  "/items",
  "/sales",
  "/orders",
  "/schedule",
  "/shifts",
  "/report",
  "/stats",
  "/login",
  "/preorder",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL).then((cache) =>
      // One failing route must not abort the whole install.
      Promise.all(SHELL_ROUTES.map((url) => cache.add(url).catch(() => undefined))),
    ),
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => ![SHELL, STATIC, DATA].includes(k)).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

async function cacheFirst(request, cacheName) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const res = await fetch(request);
  if (res.ok) (await caches.open(cacheName)).put(request, res.clone());
  return res;
}

async function networkFirst(request, cacheName, fallbackUrl) {
  try {
    const res = await fetch(request);
    if (res.ok) (await caches.open(cacheName)).put(request, res.clone());
    return res;
  } catch (e) {
    const cached = (await caches.match(request)) || (fallbackUrl && (await caches.match(fallbackUrl)));
    if (cached) return cached;
    throw e;
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (url.pathname.startsWith("/_next/static/") || url.pathname.startsWith("/api/img/") || url.pathname.startsWith("/icons/")) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }

  if (url.pathname.startsWith("/api/")) {
    if (url.pathname.startsWith("/api/auth") || url.pathname.startsWith("/api/sync")) return;
    event.respondWith(networkFirst(request, DATA));
    return;
  }

  if (request.mode === "navigate") {
    // Unknown deep links offline fall back to the counter shell.
    event.respondWith(networkFirst(request, SHELL, url.pathname.startsWith("/pos") ? "/pos" : undefined));
    return;
  }

  // RSC payloads for client-side navigation (?_rsc=…) and other same-origin GETs.
  event.respondWith(networkFirst(request, SHELL));
});
