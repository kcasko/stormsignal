// Storm Signal offline support. The app shell is cached; weather and history use network-first
// with the last good response as an offline fallback. The app's own staleness notices still apply,
// because each response carries its retrieval time.
const VERSION = "ss-v1";
const SHELL = ["./", "./index.html"];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

async function networkFirst(req) {
  const cache = await caches.open(VERSION);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch {
    const hit = await cache.match(req, { ignoreSearch: false });
    if (hit) return hit;
    if (req.mode === "navigate") return (await cache.match("./index.html")) || Response.error();
    return Response.error();
  }
}
async function cacheFirst(req) {
  const cache = await caches.open(VERSION);
  const hit = await cache.match(req);
  if (hit) return hit;
  const res = await fetch(req);
  if (res.ok) cache.put(req, res.clone());
  return res;
}

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== "GET" || url.origin !== self.location.origin) return;
  // Only the weather and history responses are kept offline; searches are never cached.
  if (url.pathname === "/api/weather" || url.pathname === "/api/history") return e.respondWith(networkFirst(e.request));
  if (url.pathname.startsWith("/api/")) return;
  if (url.pathname.startsWith("/assets/") || url.pathname.startsWith("/licenses/")) return e.respondWith(cacheFirst(e.request));
  if (e.request.mode === "navigate") return e.respondWith(networkFirst(e.request));
});
