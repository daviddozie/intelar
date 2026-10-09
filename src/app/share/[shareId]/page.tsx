import { Metadata } from "next";
import { notFound } from "next/navigation";
import { getSharedConversationSnapshot } from "@/lib/db";
import SharedChatViewer from "@/components/shared-chat-viewer";

interface SharePageProps {
  params: Promise<{ shareId: string }>;
}

export async function generateMetadata({
  params,
}: SharePageProps): Promise<Metadata> {
  const { shareId } = await params;
  if (!shareId) return { title: "Shared Conversation | Intelar" };

  try {
    const snapshot = await getSharedConversationSnapshot(shareId);
    if (!snapshot) {
      return { title: "Shared Conversation Not Found | Intelar" };
    }

    const firstMsg = snapshot.messages.find((m: { role: string }) => m.role === "assistant" || m.role === "user");
    const snippet = firstMsg?.content ? firstMsg.content.slice(0, 160) : "Shared research conversation on Intelar";

    return {
      title: `${snapshot.title} — Shared Conversation`,
      description: snippet,
      openGraph: {
        title: `${snapshot.title} — Intelar`,
        description: snippet,
        type: "article",
        url: `https://intelar.vercel.app/share/${shareId}`,
      },
      twitter: {
        card: "summary_large_image",
        title: `${snapshot.title} — Intelar`,
        description: snippet,
      },
    };
  } catch {
    return { title: "Shared Conversation | Intelar" };
  }
}

export default async function SharedConversationPage({
  params,
}: SharePageProps) {
  const { shareId } = await params;
  if (!shareId) notFound();

  const snapshot = await getSharedConversationSnapshot(shareId);
  if (!snapshot) notFound();

  return <SharedChatViewer snapshot={snapshot} />;
}
