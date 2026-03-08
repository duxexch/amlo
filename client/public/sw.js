/**
 * Ablox — Service Worker (Production-ready, Pure JS)
 *
 * Caching strategies:
 *   - App Shell (HTML/CSS/JS): Cache-First + background update
 *   - API calls: Network-First with 5s timeout + cache fallback
 *   - Images/Icons: Cache-First (long-lived)
 *   - Fonts: Cache-First (immutable)
 *   - Socket.io / WebSocket: NEVER cache
 *   - Offline: Custom offline page fallback
 */

var CACHE_VERSION = "ablox-v5";
var STATIC_CACHE = CACHE_VERSION + "-static";
var DYNAMIC_CACHE = CACHE_VERSION + "-dynamic";
var IMAGE_CACHE = CACHE_VERSION + "-images";

// App shell files — pre-cached on install
var APP_SHELL = [
  "/",
  "/offline.html",
  "/manifest.json",
  "/favicon.svg",
  "/icons/icon-192x192.png",
  "/icons/icon-512x512.png",
];

// Paths that must NEVER be cached
var NEVER_CACHE = [
  "/socket.io/",
  "/api/health",
  "/api/metrics",
  "/share",
  "/api/widgets/",
];

// Maximum cache sizes
var MAX_DYNAMIC_ITEMS = 50;
var MAX_IMAGE_ITEMS = 100;

// ══════════════════════════════════════════════════
// Install: pre-cache app shell
// ══════════════════════════════════════════════════
self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(STATIC_CACHE).then(function (cache) {
      return cache.addAll(APP_SHELL).catch(function (err) {
        console.warn("[SW] Pre-cache partial failure:", err);
      });
    })
  );
  self.skipWaiting();
});

// ══════════════════════════════════════════════════
// Activate: clean old caches
// ══════════════════════════════════════════════════
self.addEventListener("activate", function (event) {
  var currentCaches = [STATIC_CACHE, DYNAMIC_CACHE, IMAGE_CACHE];
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key.startsWith("ablox-") && currentCaches.indexOf(key) === -1;
          })
          .map(function (key) {
            console.log("[SW] Deleting old cache:", key);
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

// ══════════════════════════════════════════════════
// Fetch: strategy router
// ══════════════════════════════════════════════════
self.addEventListener("fetch", function (event) {
  var request = event.request;
  var url = new URL(request.url);

  // Skip non-GET
  if (request.method !== "GET") return;

  // Skip WebSocket upgrades
  if (request.headers.get("upgrade") === "websocket") return;

  // Skip paths that should never be cached
  for (var i = 0; i < NEVER_CACHE.length; i++) {
    if (url.pathname.startsWith(NEVER_CACHE[i])) return;
  }

  // Skip cross-origin requests
  if (url.origin !== self.location.origin) return;

  // ── API calls → Network-First (5s timeout) ──
  if (url.pathname.startsWith("/api/")) {
    event.respondWith(networkFirst(request, DYNAMIC_CACHE, 5000));
    return;
  }

  // ── Images → Cache-First ──
  if (isImageRequest(url.pathname)) {
    event.respondWith(cacheFirst(request, IMAGE_CACHE, MAX_IMAGE_ITEMS));
    return;
  }

  // ── Fonts → Cache-First ──
  if (isFontRequest(url.pathname)) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, null));
    return;
  }

  // ── JS/CSS (hashed assets) → Cache-First ──
  if (url.pathname.startsWith("/assets/")) {
    event.respondWith(cacheFirst(request, STATIC_CACHE, null));
    return;
  }

  // ── HTML navigations → Network-First to avoid stale app shell after deploy ──
  if (request.mode === "navigate" || (request.headers.get("accept") || "").includes("text/html")) {
    event.respondWith(networkFirst(request, STATIC_CACHE, 5000));
    return;
  }

  // ── Other shell requests → Stale-While-Revalidate ──
  event.respondWith(staleWhileRevalidate(request, STATIC_CACHE));
});

// ══════════════════════════════════════════════════
// Push Notifications
// ══════════════════════════════════════════════════
self.addEventListener("push", function (event) {
  if (!event.data) return;

  var data;
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: "Ablox", body: event.data.text() };
  }

  event.waitUntil(
    self.registration.showNotification(data.title || "Ablox", {
      body: data.body || "",
      icon: data.icon || "/icons/icon-192x192.png",
      badge: data.badge || "/icons/icon-96x96.png",
      tag: data.tag || "ablox-notification",
      dir: data.dir || "auto",
      lang: data.lang || "en",
      renotify: true,
      requireInteraction: Boolean(data.requireInteraction),
      silent: false,
      vibrate: data.vibrate || [120, 80, 120, 80, 200],
      data: { url: data.url || "/", type: data.type || "system" },
      actions: [
        { action: "open", title: data.openActionTitle || "Open" },
        { action: "dismiss", title: data.dismissActionTitle || "Dismiss" },
      ],
    })
  );
});

// ══════════════════════════════════════════════════
// Notification Click
// ══════════════════════════════════════════════════
self.addEventListener("notificationclick", function (event) {
  event.notification.close();

  if (event.action === "dismiss") return;

  var targetUrl = (event.notification.data && event.notification.data.url) || "/";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (clients) {
      // Focus existing tab
      for (var i = 0; i < clients.length; i++) {
        var client = clients[i];
        if (client.url.indexOf(self.location.origin) !== -1 && "focus" in client) {
          client.navigate(targetUrl);
          return client.focus();
        }
      }
      // Open new window
      return self.clients.openWindow(targetUrl);
    })
  );
});

// ══════════════════════════════════════════════════
// Background Sync
// ══════════════════════════════════════════════════
self.addEventListener("sync", function (event) {
  if (event.tag === "send-messages") {
    event.waitUntil(flushOfflineQueue());
  }
});

// ══════════════════════════════════════════════════
// Periodic Background Sync (fresh content)
// ══════════════════════════════════════════════════
self.addEventListener("periodicsync", function (event) {
  if (event.tag === "update-content") {
    event.waitUntil(
      caches.open(DYNAMIC_CACHE).then(function (cache) {
        return cache.add("/api/social/featured-streams").catch(function () { });
      })
    );
  }
});

// ══════════════════════════════════════════════════
// Message handler (skipWaiting + cache injection)
// ══════════════════════════════════════════════════
self.addEventListener("message", function (event) {
  if (event.data && event.data.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
  if (event.data && event.data.type === "CACHE_URLS") {
    var urls = event.data.urls || [];
    caches.open(STATIC_CACHE).then(function (cache) {
      cache.addAll(urls).catch(function () { });
    });
  }
});


// ══════════════════════════════════════════════════════════
//  CACHING STRATEGIES
// ══════════════════════════════════════════════════════════

/**
 * Cache-First: return from cache, fallback to network
 */
function cacheFirst(request, cacheName, maxItems) {
  return caches.match(request).then(function (cached) {
    if (cached) return cached;

    return fetch(request).then(function (response) {
      if (response.ok) {
        var clone = response.clone();
        caches.open(cacheName).then(function (cache) {
          cache.put(request, clone);
          if (maxItems) trimCache(cacheName, maxItems);
        });
      }
      return response;
    }).catch(function () {
      if (isImageRequest(new URL(request.url).pathname)) {
        return new Response("", { status: 408, statusText: "Offline" });
      }
      return caches.match("/offline.html").then(function (offline) {
        return offline || new Response("Offline", { status: 503 });
      });
    });
  });
}

/**
 * Network-First: try network with timeout, fallback to cache
 */
function networkFirst(request, cacheName, timeoutMs) {
  return new Promise(function (resolve) {
    var done = false;

    var timer = setTimeout(function () {
      if (done) return;
      done = true;
      caches.match(request).then(function (cached) {
        if (cached) {
          resolve(cached);
        } else {
          resolve(new Response(JSON.stringify({ error: "offline" }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          }));
        }
      });
    }, timeoutMs);

    fetch(request).then(function (response) {
      if (done) return;
      done = true;
      clearTimeout(timer);

      if (response.ok) {
        var clone = response.clone();
        caches.open(cacheName).then(function (cache) {
          cache.put(request, clone);
          trimCache(cacheName, MAX_DYNAMIC_ITEMS);
        });
      }
      resolve(response);
    }).catch(function () {
      if (done) return;
      done = true;
      clearTimeout(timer);
      caches.match(request).then(function (cached) {
        resolve(cached || new Response(JSON.stringify({ error: "offline" }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        }));
      });
    });
  });
}

/**
 * Stale-While-Revalidate: return cache, fetch update in background
 */
function staleWhileRevalidate(request, cacheName) {
  return caches.open(cacheName).then(function (cache) {
    return cache.match(request).then(function (cached) {
      var fetchPromise = fetch(request).then(function (response) {
        if (response.ok) {
          cache.put(request, response.clone());
        }
        return response;
      }).catch(function () {
        return null;
      });

      if (cached) return cached;

      return fetchPromise.then(function (response) {
        if (response) return response;
        return caches.match("/offline.html").then(function (offline) {
          return offline || new Response("Offline", { status: 503 });
        });
      });
    });
  });
}


// ══════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════

/** Trim cache to maxItems (LRU) */
function trimCache(cacheName, maxItems) {
  caches.open(cacheName).then(function (cache) {
    cache.keys().then(function (keys) {
      if (keys.length > maxItems) {
        cache.delete(keys[0]).then(function () {
          if (keys.length - 1 > maxItems) trimCache(cacheName, maxItems);
        });
      }
    });
  });
}

/** Check if pathname is an image */
function isImageRequest(pathname) {
  return pathname.endsWith(".png") ||
    pathname.endsWith(".jpg") ||
    pathname.endsWith(".jpeg") ||
    pathname.endsWith(".webp") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".gif") ||
    pathname.endsWith(".ico") ||
    pathname.startsWith("/icons/");
}

/** Check if pathname is a font */
function isFontRequest(pathname) {
  return pathname.endsWith(".woff2") ||
    pathname.endsWith(".woff") ||
    pathname.endsWith(".ttf") ||
    pathname.endsWith(".otf");
}

/** Flush offline queue via client postMessage */
function flushOfflineQueue() {
  return self.clients.matchAll({ type: "window" }).then(function (clients) {
    for (var i = 0; i < clients.length; i++) {
      clients[i].postMessage({ type: "FLUSH_OFFLINE_QUEUE" });
    }
  });
}
