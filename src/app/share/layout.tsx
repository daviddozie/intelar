import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Shared conversation");

export default function ShareLayout({ children }: { children: React.ReactNode }) {
    return children;
}
