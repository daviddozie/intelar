import type { MetadataRoute } from "next";
import { APP_PATHS, IS_PREVIEW, SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
    // App HTML remains crawlable so engines can see its noindex meta/header.
    // API responses are never discovery content. CSS, scripts, and images stay available.
    const rule = IS_PREVIEW ? { disallow: "/" } : { allow: "/", disallow: ["/api/"] };
    const aiRule = IS_PREVIEW ? { disallow: "/" } : { allow: "/", disallow: ["/api/", ...APP_PATHS.map((path) => `/${path}`)] };
    return {
        rules: [{ userAgent: "*", ...rule }, { userAgent: ["OAI-SearchBot", "GPTBot"], ...aiRule }],
        sitemap: `${SITE_URL}/sitemap.xml`,
    };
}
