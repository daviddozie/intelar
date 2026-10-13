import ChatApp from "@/components/chat-app";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Resources");

export default function ResourcesPage() {
    return <ChatApp initialView="resources" />;
}
