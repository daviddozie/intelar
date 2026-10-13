# Intelar search and AI discovery

The canonical production origin is `https://intelar.vercel.app`. Set
`SITE_URL` at build time if the official domain changes. Metadata, robots,
sitemap, structured data, and the optional text reference use this origin.
Do not set it to a Vercel preview URL or localhost in production.

## Public discovery pages

- `/` — product overview.
- `/features` — feature directory.
- `/features/ai-research` — cited research and document questions.
- `/features/personal-learning` — study paths, practice, and offline study.
- `/features/exam-preparation` — timed practice and revision.
- `/features/collaborative-workspaces` — shared resources and discussion.

These pages are pre-rendered, linked from the homepage and each other, have
individual titles/descriptions/canonicals/social metadata, and are the only
entries in `/sitemap.xml`. Do not add private learner data or thin generated
pages to the sitemap. Add accurate public content to `public-features.ts`
when product capabilities change. Last-modified dates are intentionally
omitted until there is a reliable content-update timestamp.

The homepage provides server-rendered WebSite, Organization, and WebApplication
JSON-LD; feature pages have breadcrumbs matching their visible navigation.
No ratings, credentials, pricing, or reviews are invented for schema markup.
`/og-image.png` serves a real 1200×630 PNG using the existing Intelar mark.
Hidden promotional text was removed from the root layout.

## Indexing boundaries

App screens, login, invitations, conversations, and shared conversations have
`noindex, nofollow` metadata and HTTP headers. APIs also carry the header and
are disallowed in robots. General crawlers may fetch app HTML to see its
noindex instruction; blocking those pages in robots would prevent that.
Authentication and ownership checks remain the access controls. Robots and
noindex directives are not security mechanisms.

`OAI-SearchBot` is allowed on public product pages, with personal app routes
excluded. `GPTBot` has the same app-route exclusions; public content retains
the previously permissive crawler policy. OpenAI search and model-training
controls are distinct; permitting training does not ensure product mentions.
Other crawlers use the general public crawling policy.

Vercel preview deployments (`VERCEL_ENV=preview`) receive noindex headers and
metadata, a disallow-all robots rule, and an empty sitemap. This prevents
preview copies from competing with production URLs. Public pages intentionally
do not advertise unimplemented multilingual versions via hreflang.

`/llms.txt` is an optional plain-text product reference linking to the same
public pages. It is not a search registration, ranking signal, or guarantee
that an AI system reads or cites Intelar. Useful, accessible public content
and crawler access remain the foundation.

## Deployment and registration

1. Deploy the changes to the official domain. Confirm that deployment
   protection, hosting firewall rules, or bot filters do not block legitimate
   search crawlers. Do not disable account authentication or access controls.
2. Create or open the property's Google Search Console account. For the
   Vercel subdomain, choose the URL-prefix property
   `https://intelar.vercel.app/`. Copy its HTML-tag verification code into
   `GOOGLE_SITE_VERIFICATION` in Vercel's production environment and redeploy,
   or use another supported verification method if already configured.
3. Verify ownership, submit `https://intelar.vercel.app/sitemap.xml`, and use
   URL Inspection to check and request indexing for the homepage and feature
   pages. Indexing is not immediate or guaranteed.
4. Add the same site and sitemap to Bing Webmaster Tools. Its optional
   HTML-tag token can be configured as `BING_SITE_VERIFICATION` and deployed.
5. Run `SEO_CHECK_URL=https://intelar.vercel.app npm run check:seo` after
   deployment. This checks HTTP responses; it does not prove indexing,
   ranking, rich-result eligibility, or AI citation visibility.
6. Validate structured data with Google's Rich Results Test and Schema.org's
   validator. Not every valid schema type earns a Google rich result.
7. Monitor Search Console indexing, impressions, clicks, queries, and Core
   Web Vitals. Check mobile page experience with PageSpeed Insights using
   production URLs. No performance score improvement is claimed by this work.

## Ongoing visibility

Publish useful, reviewed guides that answer specific learner questions and
link to credible sources. Keep product descriptions current, including AI
limitations and offline prerequisites. Earn relevant links from legitimate
university, community, and hackathon pages. Avoid keyword stuffing, mass
generated pages, fabricated claims, and paid link schemes.

No code change can ensure a first-place search ranking or an AI recommendation.
Measure results after deployment rather than treating metadata as evidence
of increased traffic. Search-based AI discovery is also different from a
model's answers without live search.

## Local validation

```sh
npm run build
npm run start -- --port 3001
# In a separate terminal:
npm run check:seo
```

`SEO_CHECK_URL` defaults to `http://localhost:3001`. The check verifies all six
public responses and HTML, app noindex boundaries (including guest redirects),
robots policy, sitemap entries, parseable JSON-LD, image dimensions, the text
reference, and a genuine 404 for an unknown feature. Browser/mobile checks and
production search dashboards provide separate evidence.

## References

- [Google SEO basics](https://developers.google.com/search/docs/fundamentals/seo-starter-guide)
- [Google noindex guidance](https://developers.google.com/search/docs/crawling-indexing/block-indexing)
- [Google AI search features](https://developers.google.com/search/docs/appearance/ai-features)
- [OpenAI crawler controls](https://developers.openai.com/api/docs/bots)
