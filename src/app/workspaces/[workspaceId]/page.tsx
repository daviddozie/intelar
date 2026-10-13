import ChatApp from "@/components/chat-app";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Workspace");

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ workspaceId: string }>;
}) {
  const { workspaceId } = await params;
  return <ChatApp initialView="workspace" initialWorkspaceId={workspaceId} />;
}
