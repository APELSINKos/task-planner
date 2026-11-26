/* Lightweight PWA service worker: caches static shell and fonts, passes API traffic directly to network. */
const CACHE_NAME = "task-planner-shell-v4";
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/api.js",
  "./js/motion.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/favicon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;

  if (
    isSameOrigin &&
    (url.pathname.startsWith("/api/") ||
      url.pathname === "/docs" ||
      url.pathname === "/openapi.json")
  ) {
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) return cached;
        return fetch(event.request)
          .then((response) => {
            if (response && (response.ok || response.type === "opaque")) {
              const clone = response.clone();
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
            }
            return response;
          })
          .catch(
            () =>
              new Response("", {
                status: 200,
                headers: {
                  "Content-Type":
                    url.hostname === "fonts.googleapis.com"
                      ? "text/css; charset=utf-8"
                      : "application/octet-stream",
                },
              })
          );
      })
    );
    return;
  }

  if (!isSameOrigin) {
    return;
  }

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        if (response && response.ok) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(async () => {
        const direct = await caches.match(event.request);
        if (direct) return direct;
        if (event.request.mode === "navigate") {
          const fallback = (await caches.match("./index.html")) || (await caches.match("./"));
          if (fallback) return fallback;
        }
        return new Response("Offline", {
          status: 503,
          headers: { "Content-Type": "text/plain; charset=utf-8" },
        });
      })
  );
});
