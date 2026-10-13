import Link from "next/link";
import IntelarLogo from "@/components/svg";
import { publicFeatures } from "@/lib/public-features";

export default function PublicShell({ children }: { children: React.ReactNode }) {
    return (
        <div className="min-h-screen bg-background text-foreground">
            <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-full focus:bg-foreground focus:px-4 focus:py-2 focus:text-background">Skip to content</a>
            <header className="border-b border-border">
                <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-5 sm:px-8">
                    <Link href="/" className="flex items-center gap-2 font-semibold" aria-label="Intelar home"><IntelarLogo size={28} />Intelar</Link>
                    <nav aria-label="Main navigation" className="flex items-center gap-5 text-sm">
                        <Link href="/features" className="hover:underline">Features</Link>
                        <Link href="/chat" className="rounded-full bg-foreground px-4 py-2 text-background hover:opacity-85">Open Intelar</Link>
                    </nav>
                </div>
            </header>
            <main id="main" className="mx-auto max-w-6xl px-5 py-12 sm:px-8 sm:py-20">{children}</main>
            <footer className="border-t border-border">
                <div className="mx-auto max-w-6xl px-5 py-10 sm:px-8">
                    <p className="mb-5 font-semibold">Research. Learning. Collaboration.</p>
                    <nav aria-label="Explore Intelar features" className="flex flex-wrap gap-x-6 gap-y-3 text-sm text-muted-foreground">
                        {publicFeatures.map((feature) => <Link key={feature.slug} href={`/features/${feature.slug}`} className="hover:text-foreground hover:underline">{feature.label}</Link>)}
                        <Link href="/" className="hover:text-foreground hover:underline">Home</Link>
                    </nav>
                    <p className="mt-6 text-xs text-muted-foreground">AI answers are a starting point. Always check the sources.</p>
                </div>
            </footer>
        </div>
    );
}
