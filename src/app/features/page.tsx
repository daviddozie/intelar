import Link from "next/link";
import PublicShell from "@/components/marketing/public-shell";
import { publicFeatures } from "@/lib/public-features";
import { publicMetadata } from "@/lib/seo";

export const metadata = publicMetadata("Research, learning, and collaboration tools", "Explore Intelar's cited research, personal learning paths, offline study, timed exam practice, revision plans, and collaborative workspaces.", "/features");

export default function FeaturesPage() {
    return (
        <PublicShell>
            <p className="mb-4 text-sm text-muted-foreground">Explore Intelar</p>
            <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">From a question to a clearer understanding.</h1>
            <p className="mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground">Intelar brings research, learning, exam preparation, and peer collaboration together. Choose the tools that fit your learning journey.</p>
            <div className="mt-12 grid gap-6 md:grid-cols-2">
                {publicFeatures.map((feature) => (
                    <article key={feature.slug} className="flex flex-col rounded-3xl border border-border bg-card p-6 sm:p-8">
                        <h2 className="text-xl font-semibold"><Link href={`/features/${feature.slug}`} className="hover:underline">{feature.title}</Link></h2>
                        <p className="mb-6 mt-4 flex-1 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                        <Link href={`/features/${feature.slug}`} className="text-sm font-medium underline underline-offset-4">Explore {feature.label.toLowerCase()}</Link>
                    </article>
                ))}
            </div>
            <p className="mt-10 max-w-2xl text-sm leading-relaxed text-muted-foreground">Built with university learners in Nigeria in mind, including study on mobile devices and intermittent internet connections. Live research and tutoring need connectivity; downloaded lessons and practice can be studied offline.</p>
        </PublicShell>
    );
}
