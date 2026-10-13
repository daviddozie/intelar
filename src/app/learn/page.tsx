import ChatApp from "@/components/chat-app";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Learn");

export default function LearnPage() {
    return <ChatApp initialView="learn" />;
}
