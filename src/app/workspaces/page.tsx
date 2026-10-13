import ChatApp from "@/components/chat-app";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Workspaces");
export default function WorkspacesPage() {
  return <ChatApp initialView="workspaces" />;
}
