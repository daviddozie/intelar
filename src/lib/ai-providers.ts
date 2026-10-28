import { z } from "zod";

export const aiProviders = [
  { id: "openrouter", name: "OpenRouter", example: "openai/gpt-4o-mini" },
  { id: "openai", name: "OpenAI", example: "gpt-4o-mini" },
  { id: "google", name: "Google Gemini", example: "gemini-2.5-flash" },
  { id: "anthropic", name: "Anthropic Claude", example: "claude-sonnet-4-5" },
  { id: "xai", name: "Grok (xAI)", example: "grok-3-mini" },
  { id: "mistral", name: "Mistral", example: "mistral-small-latest" },
] as const;
export const providerSchema = z.enum([
  "openrouter",
  "openai",
  "google",
  "anthropic",
  "xai",
  "mistral",
]);
export type AIProvider = z.infer<typeof providerSchema>;
export const aiSettingsInput = z
  .object({
    provider: providerSchema,
    model: z
      .string()
      .trim()
      .min(1)
      .max(200)
      .regex(/^[a-zA-Z0-9][a-zA-Z0-9._:/@+-]*$/, "Enter a valid model ID"),
    apiKey: z
      .string()
      .trim()
      .min(1)
      .max(4096)
      .regex(/^\S+$/, "API keys cannot contain whitespace")
      .optional(),
  })
  .strict();
export type AISettingsInput = z.infer<typeof aiSettingsInput>;
export interface AISettingsStatus {
  configuration: { provider: AIProvider; model: string; hasKey: true } | null;
  used: number;
  limit: number;
  remaining: number;
}
export const FREE_PROMPT_LIMIT = 3;
