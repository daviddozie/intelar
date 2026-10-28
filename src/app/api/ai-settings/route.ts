import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { aiSettingsInput } from "@/lib/ai-providers";
import { getAISubject } from "@/lib/ai-access";
import {
  aiErrorResponse,
  deleteAIConfiguration,
  getAIStatus,
  saveAIConfiguration,
} from "@/lib/ai-settings-db";
import { databaseErrorResponse } from "@/lib/database-errors";

function failure(error: unknown) {
  if (error instanceof SyntaxError)
    return Response.json({ error: "Invalid JSON body" }, { status: 400 });
  return (
    aiErrorResponse(error) ??
    databaseErrorResponse(error) ??
    Response.json({ error: "Could not update AI settings" }, { status: 500 })
  );
}
export async function GET() {
  const session = await getServerSession(authOptions);
  try {
    const owner = session?.user?.email;
    return Response.json(
      await getAIStatus(await getAISubject(owner), owner ?? undefined),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function PUT(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json(
      { error: "Sign in to save your API key" },
      { status: 401 },
    );
  try {
    const parsed = aiSettingsInput.safeParse(await request.json());
    if (!parsed.success)
      return Response.json(
        { error: "Choose a provider and enter a valid model ID and API key" },
        { status: 400 },
      );
    await saveAIConfiguration(session.user.email, parsed.data);
    return Response.json(
      await getAIStatus(`user:${session.user.email}`, session.user.email),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
export async function DELETE() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json(
      { error: "Sign in to remove your API key" },
      { status: 401 },
    );
  try {
    await deleteAIConfiguration(session.user.email);
    return Response.json(
      await getAIStatus(`user:${session.user.email}`, session.user.email),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return failure(error);
  }
}
