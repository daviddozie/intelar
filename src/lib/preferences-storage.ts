import {
  defaultPreferences,
  preferencesSchema,
  type UserPreferences,
} from "@/lib/user-preferences";

export type CachedPreferences = {
  preferences: UserPreferences;
  pending: boolean;
  patch?: Partial<UserPreferences>;
};
const cacheKey = (email: string | null) =>
  `intelar_preferences:${email ? encodeURIComponent(email) : "guest"}`;

export function readPreferencesCache(
  email: string | null,
): CachedPreferences & { storageAvailable: boolean } {
  try {
    const stored = localStorage.getItem(cacheKey(email));
    if (stored) {
      const parsed = JSON.parse(stored);
      const result = preferencesSchema.safeParse(parsed.preferences);
      if (result.success)
        return {
          preferences: result.data,
          pending: parsed.pending === true,
          patch: preferencesSchema.partial().safeParse(parsed.patch).success
            ? parsed.patch
            : undefined,
          storageAvailable: true,
        };
    }
    if (email) {
      const guest = localStorage.getItem(cacheKey(null));
      if (guest) {
        const parsed = preferencesSchema.safeParse(
          JSON.parse(guest).preferences,
        );
        if (parsed.success)
          return {
            preferences: { theme: parsed.data.theme, motion: "system" },
            pending: false,
            storageAvailable: true,
          };
      }
    }
    const legacy = localStorage.getItem("theme");
    return {
      preferences: {
        ...defaultPreferences,
        theme: legacy === "light" || legacy === "dark" ? legacy : "system",
      },
      pending: false,
      storageAvailable: true,
    };
  } catch {
    return {
      preferences: defaultPreferences,
      pending: false,
      storageAvailable: false,
    };
  }
}

export function writePreferencesCache(
  email: string | null,
  value: CachedPreferences,
) {
  try {
    localStorage.setItem(cacheKey(email), JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
