const CACHE_NAME = "studytrack-shell-v7";
const SHELL_FILES = [
  "/",
  "/index.html",
  "/manifest.json",
  "/css/style.css",
  "/js/app.js",
  "/js/icons.js",
  "/js/i18n.js",
  "/js/pwa.js",
  "/js/storage.js",
  "/js/auth.js",
  "/js/dashboard.js",
  "/js/subjects.js",
  "/js/scores.js",
  "/js/planner.js",
  "/js/timer.js",
  "/js/goals.js",
  "/js/notes.js",
  "/js/analytics.js",
  "/js/achievements.js",
  "/js/classroom.js",
  "/js/messages.js",
  "/js/admin.js",
  "/assets/images/studytrack-icon.png",
  "/assets/images/studytrack-icon-512.png",
  "/assets/images/studytrack-maskable-512.png",
  "/assets/images/studytrack-apple-touch-icon.png",
  "/assets/images/angkor-wat-dawn.png"
];

self.addEventListener("install", event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(SHELL_FILES))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith("studytrack-shell-") && key !== CACHE_NAME).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;
  const url = new URL(request.url);

  // Keep account, class, chat, and uploaded-file responses private and online-only.
  if (request.method !== "GET" || url.origin !== self.location.origin || /^\/api(?:\/|$)/.test(url.pathname)) return;

  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const cacheKey = request.mode === "navigate" ? "/index.html" : request;
    try {
      const response = await fetch(request);
      if (response.ok && response.type === "basic") await cache.put(cacheKey, response.clone());
      return response;
    } catch {
      const cached = await cache.match(cacheKey);
      if (cached) return cached;
      if (request.mode === "navigate") return (await cache.match("/index.html")) || Response.error();
      return Response.error();
    }
  })());
});
