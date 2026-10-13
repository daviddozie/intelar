import InvitationPage from "@/components/workspace/workspace-invitation";
import { privateMetadata } from "@/lib/seo";

export const metadata = privateMetadata("Workspace invitation");
export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  return <InvitationPage token={token} />;
}
