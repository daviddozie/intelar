import ChatApp from "@/components/chat-app";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Research chat");

export default function ChatPage() {
  return <ChatApp />;
}
