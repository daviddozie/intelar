import { z } from "zod";

export const preferencesSchema = z
  .object({
    theme: z.enum(["light", "dark", "system"]),
    motion: z.enum(["system", "reduced", "full"]),
  })
  .strict();

export const preferencesPatchSchema = preferencesSchema
  .partial()
  .refine(
    (value) => Object.keys(value).length > 0,
    "At least one preference is required",
  );

export type UserPreferences = z.infer<typeof preferencesSchema>;
export const defaultPreferences: UserPreferences = {
  theme: "system",
  motion: "system",
};
