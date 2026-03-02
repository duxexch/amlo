/// <reference lib="webworker" />

/**
 * Ablox — Service Worker
 * Caching strategy:
 *   - App shell (HTML/CSS/JS): Cache-First with network update
 *   - API calls: Network-First with cache fallback
 *   - Images: Cache-First (long-lived)
 *   - Fonts: Cache-First (immutable)
 *   - Socket.io: SKIP (real-time, never cache)
 */

const CACHE_VERSION = "ablox-v1";
const STATIC_CACHE = `${CACHE_VERSION}-static`;
const DYNAMIC_CACHE = `${CACHE_VERSION}-dynamic`;
const IMAGE_CACHE = `${CACHE_VERSION}-images`;

// App shell — cached on install
const APP_SHELL = [
  "/",
  "/manifest.json",
];

// Paths to NEVER cache
const NEVER_CACHE = [
  "/socket.io/",
  "/api/health",
  "/api/metrics",
];

const sw = self as unknown as ServiceWorkerGlobalScope;

// ── Install: pre-cache app shell ──
sw.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(APP_SHELL).catch((err) => {
        console.warn("[SW] Pre-cache failed (offline?):", err);
      });
    })
  );
  // Activate immediately (don't wait for old SW to terminate)
  sw.skipWaiting();
});

// ── Activate: clean old caches ──
sw.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("ablox-") && key !== STATIC_CACHE && key !== DYNAMIC_CACHE && key !== IMAGE_CACHE)
          .map((key) => caches.delete(key))
      )
    )
  );
  // Claim all open tabs immediately
  sw.clients.claim();
});

// ── Fetch: strategy router ──
sw.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") return;

  // Skip socket.io and WebSocket
  if (NEVER_CACHE.some((path) => url.pathname.startsWith(path))) return;

  // Skip cross-origin (CDN, analytics, etc.)
  if (url.origin !== sw.location.origin) return;

  // ── Strategy: API calls → Network-First ──
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE, 5000));
    return;
  }

  // ── Strategy: Images → Cache-First ──
  if (
    url.pathname.startsWith("/assets/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.endsWith(".png") ||
    url.pathname.endsWith(".jpg") ||
    url.pathname.endsWith(".webp") ||
    url.pathname.endsWith(".svg")
  ) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE));
    return;
  }

  // ── Strategy: Fonts → Cache-First ──
  if (
    url.pathname.endsWith(".woff2") ||
    url.pathname.endsWith(".woff") ||
    url.pathname.endsWith(".ttf")
  ) {
    event.respondWith(cacheFirst(request, STATIC_CACHE));
    return;
  }

  // ── Strategy: App shell (HTML/JS/CSS) → Stale-While-Revalidate ──
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ── Push notifications ──
sw.addEventListener("push", (event) => {
  if (!event.data) return;

  let data: { title?: string; body?: string; icon?: string; badge?: string; url?: string; tag?: string };
  try {
    data = event.data.json();
  } catch {
    data = { title: "Ablox", body: event.data.text() };
  }

  event.waitUntil(
    sw.registration.showNotification(data.title || "Ablox", {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192x192.png",
      badge: data.badge || "/icons/icon-72x72.png",
      tag: data.tag || "ablox-notification",
      dir: "rtl",
      lang: "ar",
      data: { url: data.url || "/" },
      actions: [
        { action: "open", title: "فتح" },
        { action: "dismiss", title: "تجاهل" },
      ],
    })
  );
});

// ── Notification click ──
sw.addEventListener("notificationclick", (event) => {
  event.notification.close();

  if (event.action === "dismiss") return;

  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    sw.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      // Focus existing tab if possible
      for (const client of clients) {
        if (client.url.includes(sw.location.origin) && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Otherwise open new window
      return sw.clients.openWindow(targetUrl);
    })
  );
});

// ── Background sync (for offline message queue) ──
sw.addEventListener("sync", (event) => {
  if (event.tag === "send-messages") {
    event.waitUntil(flushOfflineQueue());
  }
});

// ══════════════════════════════════════════════════════════
// Caching Strategies
// ══════════════════════════════════════════════════════════

/** Cache-First: check cache, fallback to network */
async function cacheFirst(request: Request, cacheName: string): Promise<Response> {
  const cached = await caches.match(request);
  if (cached) return cached;

  try {
    const response = await fetch(request);
    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    return new Response("", { status: 408, statusText: "Offline" });
  }
}

/** Network-First: try network with timeout, fallback to cache */
async function networkFirst(request: Request, cacheName: string, timeoutMs: number): Promise<Response> {
  try {
    const response = await Promise.race([
      fetch(request),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("timeout")), timeoutMs)
      ),
    ]);

    if (response.ok) {
      const cache = await caches.open(cacheName);
      cache.put(request, response.clone());
    }
    return response;
  } catch {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response(JSON.stringify({ error: "offline" }), {
      status: 503,
      headers: { "Content-Type": "application/json" },
    });
  }
}

/** Stale-While-Revalidate: return cache immediately, update in background */
async function staleWhileRevalidate(request: Request, cacheName: string): Promise<Response> {
  const cache = await caches.open(cacheName);
  const cached = await cache.match(request);

  const networkPromise = fetch(request)
    .then((response) => {
      if (response.ok) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cached || (await networkPromise) || new Response("Offline", { status: 503 });
}

/** Flush offline message queue (called by background sync) */
async function flushOfflineQueue(): Promise<void> {
  // The socketManager handles this in-app;
  // this is a backup for when the app is fully closed
  const clients = await sw.clients.matchAll({ type: "window" });
  for (const client of clients) {
    client.postMessage({ type: "FLUSH_OFFLINE_QUEUE" });
  }
}
