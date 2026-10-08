"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (
            typeof window === "undefined" ||
            !("serviceWorker" in navigator) ||
            !window.location.protocol.startsWith("http")
        ) {
            return;
        }

        // In development, avoid service worker caching Turbopack / Next.js dev bundles
        // and actively clean up any previously registered service workers and caches.
        if (process.env.NODE_ENV !== "production") {
            navigator.serviceWorker.getRegistrations().then((registrations) => {
                for (const registration of registrations) {
                    registration.unregister().catch(() => {});
                }
            });
            if ("caches" in window) {
                caches.keys().then((keys) => {
                    for (const key of keys) {
                        caches.delete(key).catch(() => {});
                    }
                });
            }
            return;
        }

        navigator.serviceWorker
            .register("/sw.js")
            .then((reg) => {
                // Check for updates periodically
                reg.update().catch(() => {});
            })
            .catch((err) => {
                console.debug("[SW] Registration skipped or failed:", err);
            });
    }, []);

    return null;
}
