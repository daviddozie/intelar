import ChatApp from "@/components/chat-app";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Conversation");

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <ChatApp initialConversationId={id} />;
}
