import type { NextConfig } from "next";
import { APP_PATHS, IS_PREVIEW } from "./src/lib/seo";

const nextConfig: NextConfig = {
    async headers() {
        return [
            ...APP_PATHS.map((path) => ({
                source: `/${path}/:path*`,
                headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }],
            })),
            { source: "/api/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] },
            ...(IS_PREVIEW ? [{ source: "/:path*", headers: [{ key: "X-Robots-Tag", value: "noindex, nofollow" }] }] : []),
        ];
    },
    serverExternalPackages: ["pdf-parse"],

    experimental: {
        // Uploads pass through proxy.ts, so raise its default 10 MB body buffer.
        proxyClientMaxBodySize: "55mb",
    },

    turbopack: {
        resolveAlias: {
            canvas: { browser: "./empty-module.js", default: "./empty-module.js" },
        },
    },
};

export default nextConfig;
