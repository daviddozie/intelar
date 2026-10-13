import { publicFeatures } from "@/lib/public-features";
import { SITE_DESCRIPTION, SITE_URL } from "@/lib/seo";

export const dynamic = "force-static";
export function GET() {
    const content = [
        "# Intelar", "", `> ${SITE_DESCRIPTION}`, "",
        "Intelar is a web platform for students, researchers, and study groups. Its public product pages describe available capabilities and their limitations. Personal conversations, documents, study paths, exam results, and workspaces are not public reference material.", "",
        "## Public product information", "",
        `- [Intelar](${SITE_URL}/): Product overview.`,
        `- [Features](${SITE_URL}/features): Research, learning, exam preparation, and collaboration.`,
        ...publicFeatures.map((feature) => `- [${feature.title}](${SITE_URL}/features/${feature.slug}): ${feature.description}`), "",
        "## Usage limits", "",
        "Live research, AI tutoring, and collaboration require internet access. Offline lessons and practice must be downloaded first. Personal study paths, exams, and workspaces require an account. AI-prepared answers and explanations should be checked against original sources. Practice exams are not official credentials. Use authorized, non-sensitive materials while upload privacy improvements are pending.", "",
    ].join("\n");
    return new Response(content, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
}
