import { AsyncLocalStorage } from "node:async_hooks";
import type { AIProvider } from "@/lib/ai-providers";

type ModelCredentials = { provider: AIProvider; model: string; apiKey: string };
const modelScope = new AsyncLocalStorage<ModelCredentials>();
export const runWithAIModel = <T>(
  credentials: ModelCredentials,
  run: () => T,
): T => modelScope.run(credentials, run);
export function hasAIModel() {
  return Boolean(modelScope.getStore() || process.env.OPENROUTER_API_KEY);
}
export function resolveAIModel() {
  const credentials = modelScope.getStore();
  // Mastra's model router uses each provider's native adapter; no global env mutation.
  return credentials
    ? {
        providerId: credentials.provider,
        modelId: credentials.model,
        apiKey: credentials.apiKey,
      }
    : {
        providerId: "openrouter",
        modelId: process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
        apiKey: process.env.OPENROUTER_API_KEY || "intelar-local-key",
      };
}
