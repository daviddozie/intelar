import { getDB } from "@/lib/db";
import {
  preferencesSchema,
  type UserPreferences,
} from "@/lib/user-preferences";

async function initializeSettings() {
  await getDB().execute(`CREATE TABLE IF NOT EXISTS user_settings (
        user_email TEXT PRIMARY KEY,
        theme TEXT NOT NULL DEFAULT 'system',
        motion TEXT NOT NULL DEFAULT 'system'
    )`);
}

export async function getUserSettings(
  userEmail: string,
): Promise<UserPreferences | null> {
  await initializeSettings();
  const result = await getDB().execute({
    sql: "SELECT theme, motion FROM user_settings WHERE user_email = ?",
    args: [userEmail],
  });
  return result.rows[0] ? preferencesSchema.parse(result.rows[0]) : null;
}

export async function updateUserSettings(
  userEmail: string,
  patch: Partial<UserPreferences>,
): Promise<UserPreferences> {
  await initializeSettings();
  const result = await getDB().execute({
    sql: `INSERT INTO user_settings (user_email, theme, motion)
            VALUES (?, COALESCE(?, 'system'), COALESCE(?, 'system'))
            ON CONFLICT(user_email) DO UPDATE SET
                theme = COALESCE(?, user_settings.theme),
                motion = COALESCE(?, user_settings.motion)
            RETURNING theme, motion`,
    args: [
      userEmail,
      patch.theme ?? null,
      patch.motion ?? null,
      patch.theme ?? null,
      patch.motion ?? null,
    ],
  });
  return preferencesSchema.parse(result.rows[0]);
}
