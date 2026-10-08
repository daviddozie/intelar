import {
  preferencesSchema,
  type UserPreferences,
} from "@/lib/user-preferences";

async function readSettings(
  response: Response,
): Promise<UserPreferences | null> {
  const body = await response.json();
  if (!response.ok) throw new Error(body?.error ?? "Could not sync settings");
  return body.preferences === null
    ? null
    : preferencesSchema.parse(body.preferences);
}

export async function fetchSettings(signal?: AbortSignal) {
  return readSettings(
    await fetch("/api/settings", { signal, cache: "no-store" }),
  );
}

export async function saveSettings(preferences: Partial<UserPreferences>) {
  const result = await readSettings(
    await fetch("/api/settings", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(preferences),
    }),
  );
  if (!result) throw new Error("Could not sync settings");
  return result;
}
