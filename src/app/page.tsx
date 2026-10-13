import LandingPage from "@/components/landing/landing-page";
import { jsonLd, publicMetadata, SITE_DESCRIPTION, websiteSchema } from "@/lib/seo";

export const metadata = publicMetadata("AI research, learning, and exam preparation", SITE_DESCRIPTION, "/");

export default function Home() {
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLd(websiteSchema) }} /><LandingPage /></>;
}
