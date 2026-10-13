import Link from "next/link";
import { notFound } from "next/navigation";
import PublicShell from "@/components/marketing/public-shell";
import { publicFeatures } from "@/lib/public-features";
import { jsonLd, publicMetadata, SITE_URL } from "@/lib/seo";

export const dynamicParams = false;
export function generateStaticParams() { return publicFeatures.map(({ slug }) => ({ slug })); }

type Props = { params: Promise<{ slug: string }> };
export async function generateMetadata({ params }: Props) {
    const { slug } = await params;
    const feature = publicFeatures.find((item) => item.slug === slug);
    if (!feature) notFound();
    return publicMetadata(feature.title, feature.description, `/features/${slug}`);
}

export default async function FeaturePage({ params }: Props) {
    const { slug } = await params;
    const feature = publicFeatures.find((item) => item.slug === slug);
    if (!feature) notFound();
    const breadcrumbs = {
        "@context": "https://schema.org", "@type": "BreadcrumbList",
        itemListElement: [
            { "@type": "ListItem", position: 1, name: "Intelar", item: SITE_URL },
            { "@type": "ListItem", position: 2, name: "Features", item: `${SITE_URL}/features` },
            { "@type": "ListItem", position: 3, name: feature.label, item: `${SITE_URL}/features/${slug}` },
        ],
    };
    return (
        <PublicShell>
            <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(breadcrumbs) }} />
            <nav aria-label="Breadcrumb" className="mb-8 flex flex-wrap gap-2 text-sm text-muted-foreground"><Link href="/" className="hover:underline">Intelar</Link><span aria-hidden="true">/</span><Link href="/features" className="hover:underline">Features</Link><span aria-hidden="true">/</span><span aria-current="page">{feature.label}</span></nav>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">{feature.title}</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">{feature.introduction}</p>
            <Link href={feature.appHref} className="mt-8 inline-flex rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background hover:opacity-85">{feature.action}</Link>
            <section aria-labelledby="benefits-title" className="mt-16">
                <h2 id="benefits-title" className="text-2xl font-semibold">What you can do</h2>
                <div className="mt-6 grid gap-5 md:grid-cols-3">{feature.benefits.map(([title, description]) => <article key={title} className="rounded-3xl border border-border bg-card p-6"><h3 className="font-semibold">{title}</h3><p className="mt-3 text-sm leading-relaxed text-muted-foreground">{description}</p></article>)}</div>
            </section>
            <div className="mt-14 grid gap-10 md:grid-cols-2">
                <section aria-labelledby="steps-title"><h2 id="steps-title" className="text-2xl font-semibold">How to get started</h2><ol className="mt-5 list-decimal space-y-4 pl-5 text-sm leading-relaxed text-muted-foreground">{feature.steps.map((step) => <li key={step}>{step}</li>)}</ol></section>
                <section aria-labelledby="example-title"><h2 id="example-title" className="text-2xl font-semibold">An example learning journey</h2><p className="mt-5 text-sm leading-relaxed text-muted-foreground">{feature.example}</p></section>
            </div>
            <section aria-labelledby="limits-title" className="mt-12 rounded-3xl border border-border bg-muted/30 p-6 sm:p-8"><h2 id="limits-title" className="text-xl font-semibold">Before you start</h2><p className="mt-4 text-sm leading-relaxed text-muted-foreground">{feature.limits}</p></section>
        </PublicShell>
    );
}
