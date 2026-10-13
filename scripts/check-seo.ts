import assert from "node:assert/strict";
import { loadEnvConfig } from "@next/env";

loadEnvConfig(process.cwd());

async function main() {
    const { SITE_URL } = await import("../src/lib/seo");
    const { publicPaths, publicFeatures } = await import("../src/lib/public-features");
    const base = process.env.SEO_CHECK_URL || "http://localhost:3001";
    const request = (path: string) => fetch(new URL(path, base), {
        redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "Googlebot" },
    });
    const titles = new Set<string>();
    for (const path of publicPaths) {
        const response = await request(path);
        assert.equal(response.status, 200, `${path}: public page must return 200`);
        assert.ok(!response.headers.get("x-robots-tag")?.includes("noindex"), `${path}: public page cannot be noindex`);
        const html = await response.text();
        const canonical = html.match(/<link[^>]+rel="canonical"[^>]+href="([^"]+)"/);
        assert.equal(new URL(canonical?.[1] || "https://invalid.example").href, new URL(path, SITE_URL).href, `${path}: incorrect canonical`);
        const title = html.match(/<title>([^<]+)<\/title>/)?.[1];
        assert.ok(title && title.includes("Intelar"), `${path}: missing branded title`);
        assert.ok(!titles.has(title), `${path}: duplicate title`);
        titles.add(title);
        assert.equal((html.match(/<h1(?:\s|>)/g) || []).length, 1, `${path}: expected one visible H1`);
        assert.match(html, /<meta name="description" content="[^"]{40,}"/, `${path}: missing useful description`);
        assert.match(html, /<meta name="robots" content="index, follow"/, `${path}: missing index directive`);
        assert.match(html, /property="og:image" content="[^"]+\/og-image\.png"/, `${path}: missing social image`);
        if (path === "/") {
            assert.ok(!html.includes('style="display:none"'), "homepage must not use hidden promotional text");
            for (const feature of publicFeatures) assert.ok(html.includes(`href="/features/${feature.slug}"`), "homepage must link to all public feature pages");
        }
        const schemaBlocks = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)].map((match) => JSON.parse(match[1]));
        if (path === "/") assert.ok(schemaBlocks.some((schema) => schema["@graph"]?.some((item: { "@type": string }) => item["@type"] === "WebApplication")), "homepage schema missing");
        if (path.startsWith("/features/")) assert.ok(schemaBlocks.some((schema) => schema["@type"] === "BreadcrumbList"), `${path}: breadcrumb schema missing`);
    }

    for (const path of ["/chat", "/learn", "/exam-prep", "/resources", "/workspaces", "/login", "/c/example", "/invite/example", "/share", "/api/auth/session"]) {
        const response = await request(path);
        assert.ok(response.headers.get("x-robots-tag")?.includes("noindex"), `${path}: private/app response must have noindex header, including redirects`);
        if (response.status === 200 && !path.startsWith("/api/")) {
            const html = await response.text();
            assert.match(html, /<meta name="robots" content="noindex, nofollow"/, `${path}: app metadata must be noindex`);
            assert.ok(!html.includes('rel="canonical"'), `${path}: app must not inherit homepage canonical`);
        }
    }

    const robotsResponse = await request("/robots.txt");
    assert.equal(robotsResponse.status, 200);
    const robots = await robotsResponse.text();
    assert.match(robots, /User-Agent: OAI-SearchBot/i);
    assert.match(robots, /User-Agent: GPTBot/i);
    const aiGroup = robots.split(/\n\s*\n/).find((group) => /User-Agent: OAI-SearchBot/i.test(group));
    assert.ok(aiGroup?.includes("Disallow: /share"), "AI crawlers must not collect shared conversation content");
    assert.ok(aiGroup?.includes("Disallow: /learn"), "AI crawlers must not collect personal study pages");
    assert.match(robots, /Allow: \/(?:\r?\n|$)/);
    assert.match(robots, /Disallow: \/api\//);
    assert.ok(!/^Disallow: \/$/m.test(robots), "production crawlers must not be blocked");
    assert.ok(!robots.includes("Disallow: /_next"), "rendering assets must remain crawlable");
    assert.ok(robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`));

    const sitemapResponse = await request("/sitemap.xml");
    assert.equal(sitemapResponse.status, 200);
    const sitemap = await sitemapResponse.text();
    assert.deepEqual([...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).sort(), publicPaths.map((path) => new URL(path, SITE_URL).href).sort());
    assert.ok(!sitemap.includes("<lastmod>"), "do not publish artificial last-modified dates");

    const imageResponse = await request("/og-image.png");
    assert.equal(imageResponse.status, 200);
    assert.match(imageResponse.headers.get("content-type") || "", /image\/png/);
    const image = Buffer.from(await imageResponse.arrayBuffer());
    assert.equal(image.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(image.readUInt32BE(16), 1200);
    assert.equal(image.readUInt32BE(20), 630);

    const llmsResponse = await request("/llms.txt");
    assert.equal(llmsResponse.status, 200);
    const llms = await llmsResponse.text();
    for (const feature of publicFeatures) assert.ok(llms.includes(`${SITE_URL}/features/${feature.slug}`));
    const missing = await request("/features/not-a-feature");
    assert.equal(missing.status, 404, "unknown feature must not be a soft 404");
    console.log(`SEO HTTP checks passed: ${publicPaths.length} public pages, app noindex headers/metadata, robots, sitemap, JSON-LD, 1200×630 image, llms.txt, and real 404.`);
}

main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : "SEO checks failed");
    process.exitCode = 1;
});
