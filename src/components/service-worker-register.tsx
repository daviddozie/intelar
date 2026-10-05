"use client";

import { useEffect } from "react";

export default function ServiceWorkerRegister() {
    useEffect(() => {
        if (
            typeof window !== "undefined" &&
            "serviceWorker" in navigator &&
            window.location.protocol.startsWith("http")
        ) {
            navigator.serviceWorker
                .register("/sw.js")
                .then((reg) => {
                    // Check for updates periodically
                    reg.update().catch(() => {});
                })
                .catch((err) => {
                    console.debug("[SW] Registration skipped or failed:", err);
                });
        }
    }, []);

    return null;
}
