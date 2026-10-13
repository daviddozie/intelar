import type { MetadataRoute } from "next";
import { publicPaths } from "@/lib/public-features";
import { IS_PREVIEW, SITE_URL } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
    // Do not pretend every build changes content by emitting artificial lastmod dates.
    return IS_PREVIEW ? [] : publicPaths.map((path) => ({ url: new URL(path, SITE_URL).href }));
}
