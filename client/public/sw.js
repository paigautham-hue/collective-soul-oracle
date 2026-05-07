// The Collective Soul: Oracle — Service Worker
// Caches: app shell (static assets) only.
// API routes (/api/*) are NEVER intercepted — always go to the network.
// Intercepting API routes causes "Unexpected token DOCTYPE" JSON parse errors.

const CACHE_VERSION = "oracle-v2";
const SHELL_CACHE = `${CACHE_VERSION}-shell`;

// App shell assets to pre-cache on install
const SHELL_ASSETS = [
  "/manifest.json",
  "/icon-192.png",
  "/icon-512.png",
];

// ─── Install: pre-cache shell ─────────────────────────────────────────────────
self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(SHELL_CACHE).then((cache) => {
      return cache.addAll(SHELL_ASSETS);
    })
  );
  self.skipWaiting();
});

// ─── Activate: clean old caches ───────────────────────────────────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== SHELL_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // CRITICAL: Never intercept API or storage routes.
  // Returning cached HTML for JSON API calls causes
  // "Unexpected token '<', '<!DOCTYPE'" parse errors.
  if (
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/manus-storage/")
  ) {
    return; // pass through to network
  }

  // Skip non-GET and cross-origin requests
  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  // Static assets (JS, CSS, fonts, images): cache-first
  if (url.pathname.match(/\.(js|css|woff2?|ttf|png|svg|ico|webp)$/) || url.pathname === "/manifest.json") {
    event.respondWith(
      caches.match(request).then((cached) => {
        if (cached) return cached;
        return fetch(request).then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(SHELL_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        });
      })
    );
    return;
  }

  // SPA navigation: network-first, no HTML cache fallback for API paths
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(() => fetch("/"))
    );
  }
});

// ─── Push notifications ───────────────────────────────────────────────────────
self.addEventListener("push", (event) => {
  if (!event.data) return;
  const data = event.data.json();
  event.waitUntil(
    self.registration.showNotification(data.title || "Oracle", {
      body: data.body || "Your simulation has completed.",
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      tag: data.tag || "oracle-notification",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = event.notification.data?.url || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url === url && "focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});
