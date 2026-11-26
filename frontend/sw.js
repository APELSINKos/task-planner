/* Lightweight PWA service worker: caches static shell and fonts, passes API traffic directly to network. */
const CACHE_PREFIX = "task-planner-shell-";
const CACHE_NAME = `${CACHE_PREFIX}v12`;
const SHELL_ASSETS = [
  "./",
  "./index.html",
  "./css/styles.css",
  "./js/api.js",
  "./js/motion.js",
  "./js/app.js",
  "./manifest.webmanifest",
  "./icons/favicon.svg",
  "./images/hero-stage-light.webp",
  "./images/hero-stage-dark.webp",
  "./images/auth-visual.webp"
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches
      .open(CACHE_NAME)
      .then((cache) => cache.addAll(SHELL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key.startsWith(CACHE_PREFIX) && key !== CACHE_NAME)
            .map((key) => caches.delete(key))
        )
      )
      .then(() => self.clients.claim())
  );
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
      url.pathname === "/redoc" ||
      url.pathname === "/openapi.json")
  ) {
    return;
  }

  if (url.hostname === "fonts.googleapis.com" || url.hostname === "fonts.gstatic.com") {
    let fontCacheWrite = Promise.resolve();
    const fontResponsePromise = caches.match(event.request).then((cached) => {
      if (cached) return cached;
      return fetch(event.request)
        .then((response) => {
          if (response && (response.ok || response.type === "opaque")) {
            const clone = response.clone();
            fontCacheWrite = caches
              .open(CACHE_NAME)
              .then((cache) => cache.put(event.request, clone))
              .catch(() => {});
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
    });
    event.waitUntil(fontResponsePromise.then(() => fontCacheWrite, () => {}));
    event.respondWith(fontResponsePromise);
    return;
  }

  if (!isSameOrigin) {
    return;
  }

  let assetCacheWrite = Promise.resolve();
  const networkPromise = fetch(event.request).then((response) => {
    const cacheControl = (response && response.headers.get("Cache-Control") || "").toLowerCase();
    if (
      response &&
      response.ok &&
      !cacheControl.includes("no-store") &&
      !cacheControl.includes("private")
    ) {
      const clone = response.clone();
      assetCacheWrite = caches
        .open(CACHE_NAME)
        .then((cache) => cache.put(event.request, clone))
        .catch(() => {});
    }
    return response;
  });
  event.waitUntil(networkPromise.then(() => assetCacheWrite, () => {}));
  event.respondWith(
    networkPromise.catch(async () => {
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
