import type { Metadata } from "next";

export const SITE_URL = new URL(process.env.SITE_URL || "https://intelar.vercel.app").origin;
export const IS_PREVIEW = process.env.VERCEL_ENV === "preview";
export const SITE_DESCRIPTION = "Research with cited sources, turn your documents into study paths, prepare for exams, and collaborate with peers. Intelar helps you keep learning, including offline.";

export const APP_PATHS = ["chat", "learn", "exam-prep", "resources", "workspaces", "login", "c", "share", "invite"];

export const publicRobots: Metadata["robots"] = {
    index: !IS_PREVIEW,
    follow: true,
    googleBot: { index: !IS_PREVIEW, follow: true, "max-image-preview": "large", "max-snippet": -1, "max-video-preview": -1 },
};

export const privateRobots: Metadata["robots"] = { index: false, follow: false };

export function publicMetadata(title: string, description: string, path: string): Metadata {
    const url = new URL(path, SITE_URL).href;
    return {
        title: { absolute: `${title} | Intelar` },
        description,
        alternates: { canonical: url },
        robots: publicRobots,
        openGraph: {
            title: `${title} | Intelar`, description, url, siteName: "Intelar", type: "website", locale: "en_NG",
            images: [{ url: "/og-image.png", width: 1200, height: 630, alt: "Intelar — Research, learning, and collaboration" }],
        },
        twitter: { card: "summary_large_image", title: `${title} | Intelar`, description, images: ["/og-image.png"] },
    };
}

export function privateMetadata(title: string): Metadata {
    return { title, robots: privateRobots };
}

export function jsonLd(data: unknown): string {
    return JSON.stringify(data).replace(/</g, "\\u003c");
}

export const websiteSchema = {
    "@context": "https://schema.org",
    "@graph": [
        { "@type": "Organization", "@id": `${SITE_URL}/#organization`, name: "Intelar", url: SITE_URL, logo: `${SITE_URL}/logo-official.png` },
        { "@type": "WebSite", "@id": `${SITE_URL}/#website`, name: "Intelar", url: SITE_URL, description: SITE_DESCRIPTION, publisher: { "@id": `${SITE_URL}/#organization` }, inLanguage: "en" },
        {
            "@type": "WebApplication", "@id": `${SITE_URL}/#application`, name: "Intelar", url: SITE_URL,
            description: SITE_DESCRIPTION, applicationCategory: "EducationalApplication", operatingSystem: "Web",
            publisher: { "@id": `${SITE_URL}/#organization` },
            featureList: ["Cited web research", "Document questions and answers", "Personal study paths", "Downloaded lessons and practice", "Timed exam preparation", "Exam revision plans", "Collaborative workspaces"],
        },
    ],
};
