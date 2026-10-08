import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { databaseErrorResponse } from "@/lib/database-errors";
import { getUserSettings, updateUserSettings } from "@/lib/settings-db";
import { preferencesPatchSchema } from "@/lib/user-preferences";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json(
      { error: "Sign in to access settings" },
      { status: 401 },
    );
  try {
    return Response.json(
      { preferences: await getUserSettings(session.user.email) },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    return (
      databaseErrorResponse(error) ??
      Response.json({ error: "Could not load settings" }, { status: 500 })
    );
  }
}

export async function PATCH(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email)
    return Response.json(
      { error: "Sign in to update settings" },
      { status: 401 },
    );
  try {
    const parsed = preferencesPatchSchema.safeParse(await request.json());
    if (!parsed.success)
      return Response.json({ error: "Invalid settings" }, { status: 400 });
    return Response.json(
      {
        preferences: await updateUserSettings(session.user.email, parsed.data),
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof SyntaxError)
      return Response.json({ error: "Invalid JSON body" }, { status: 400 });
    return (
      databaseErrorResponse(error) ??
      Response.json({ error: "Could not save settings" }, { status: 500 })
    );
  }
}
