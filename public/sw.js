// Intelar Learning MVP — Service Worker for Offline App Shell Caching
const CACHE_NAME = "intelar-app-shell-v2";
const SHELL_ASSETS = [
    "/learn",
    "/manifest.json",
    "/favicon.ico",
];

// Install: precache the core application shell
self.addEventListener("install", (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            return cache.addAll(SHELL_ASSETS).catch((err) => {
                console.warn("[SW] Pre-caching some shell assets failed:", err);
            });
        }).then(() => self.skipWaiting())
    );
});

// Activate: clean up old caches and take control
self.addEventListener("activate", (event) => {
    event.waitUntil(
        caches.keys().then((keys) => {
            return Promise.all(
                keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
            );
        }).then(() => self.clients.claim())
    );
});

// Fetch: serve cached shell when offline, handle navigation and static assets
self.addEventListener("fetch", (event) => {
    const { request } = event;
    const url = new URL(request.url);

    // Skip non-GET requests and chrome-extension schemes
    if (request.method !== "GET" || !url.protocol.startsWith("http")) {
        return;
    }

    // Skip Next.js Turbopack and HMR development requests
    if (
        url.pathname.includes("webpack-hmr") ||
        url.pathname.includes("__nextjs") ||
        url.pathname.includes("turbopack")
    ) {
        return;
    }

    // Skip API routes — let client code manage offline IndexedDB & attempt queue
    if (url.pathname.startsWith("/api/")) {
        return;
    }

    // 1. Navigation requests (HTML pages)
    if (request.mode === "navigate") {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    // Update cache with the latest page version
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => {
                            cache.put(request, copy).catch(() => {});
                        });
                    }
                    return networkResponse;
                })
                .catch(async () => {
                    // Offline fallback: serve cached page or /learn shell
                    const cached = await caches.match(request);
                    if (cached) return cached;
                    const learnFallback = await caches.match("/learn");
                    if (learnFallback) return learnFallback;
                    return new Response(
                        "<!DOCTYPE html><html><head><title>Intelar Learning (Offline)</title></head><body style='font-family:sans-serif;padding:2rem;background:#09090b;color:#f4f4f5'><h2>You are currently offline</h2><p>Please check your connection or reload to access your downloaded study packs.</p><p><a href='/learn' style='color:#14b8a6'>Go to Learn Dashboard</a></p></body></html>",
                        { headers: { "Content-Type": "text/html; charset=utf-8" } }
                    );
                })
        );
        return;
    }

    // 2. Next.js static assets & scripts (/_next/static/*)
    // Network-First with Cache fallback: prevents serving stale JS over fresh SSR HTML while keeping offline functionality
    if (url.pathname.startsWith("/_next/static/") || url.pathname.endsWith(".js") || url.pathname.endsWith(".css")) {
        event.respondWith(
            fetch(request)
                .then((networkResponse) => {
                    if (networkResponse && networkResponse.status === 200) {
                        const copy = networkResponse.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return networkResponse;
                })
                .catch(() => {
                    return caches.match(request);
                })
        );
        return;
    }

    // 3. Static assets, fonts, icons, images
    event.respondWith(
        caches.match(request).then((cached) => {
            return (
                cached ||
                fetch(request).then((response) => {
                    if (response && response.status === 200) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then((cache) => cache.put(request, copy));
                    }
                    return response;
                }).catch(() => {
                    // Ignore offline missing non-essential assets
                })
            );
        })
    );
});
