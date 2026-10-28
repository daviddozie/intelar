import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import {
  AIConfigurationError,
  decryptAPIKey,
  getAIConfiguration,
  getAIStatus,
  reserveFreePrompt,
} from "@/lib/ai-settings-db";
import { runWithAIModel } from "@/lib/ai-model";

function signingSecret() {
  const secret = process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new AIConfigurationError(
      "AI access needs a server session secret of at least 32 characters.",
      "AI_CONFIGURATION_UNAVAILABLE",
      503,
    );
  return secret;
}
function sign(value: string) {
  return createHmac("sha256", signingSecret())
    .update(`ai-guest:${value}`)
    .digest("hex");
}
export async function getAISubject(owner?: string | null) {
  if (owner) return `user:${owner}`;
  const jar = await cookies();
  const token = jar.get("intelar_ai_guest")?.value ?? "";
  const [id, signature] = token.split(".");
  if (
    id &&
    /^[a-f0-9-]{36}$/.test(id) &&
    /^[a-f0-9]{64}$/.test(signature ?? "")
  ) {
    const expected = sign(id);
    if (timingSafeEqual(Buffer.from(expected), Buffer.from(signature)))
      return `guest:${id}`;
  }
  const fresh = randomUUID();
  jar.set("intelar_ai_guest", `${fresh}.${sign(fresh)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return `guest:${fresh}`;
}
type AccessOptions = { charge?: boolean; vision?: boolean };
export async function prepareAIAccess(owner?: string | null, options: AccessOptions = {}) {
  const subject = await getAISubject(owner);
  const config = owner ? await getAIConfiguration(owner) : null;
  if (config)
    return {
      credentials: {
        provider: config.provider,
        model: config.model,
        apiKey: decryptAPIKey(config.encryptedKey, owner!),
      },
      remaining: null,
    };
  if (!process.env.OPENROUTER_API_KEY)
    throw new AIConfigurationError(
      "Intelar's shared AI service is unavailable. Configure your own API key in Settings → AI provider.",
      "AI_CONFIGURATION_UNAVAILABLE",
      503,
    );
  const remaining = options.charge === false
    ? (await getAIStatus(subject)).remaining
    : await reserveFreePrompt(subject);
  if (options.charge === false && remaining === 0) throw new AIConfigurationError("Your free prompts are used up. Configure your own API key in Settings → AI provider to continue.");
  return {
    credentials: {
      provider: "openrouter" as const,
      model: (options.vision ? process.env.OPENROUTER_VISION_MODEL : undefined) || process.env.OPENROUTER_MODEL || "openai/gpt-4o-mini",
      apiKey: process.env.OPENROUTER_API_KEY,
    },
    remaining,
  };
}
export async function withAIAccess<T>(
  owner: string | null | undefined,
  run: () => Promise<T>,
  options: AccessOptions = {},
): Promise<T> {
  const access = await prepareAIAccess(owner, options);
  return runWithAIModel(access.credentials, run);
}
