import {
  createCipheriv,
  createDecipheriv,
  hkdfSync,
  randomBytes,
} from "node:crypto";
import { getDB } from "@/lib/db";
import {
  FREE_PROMPT_LIMIT,
  providerSchema,
  type AISettingsInput,
  type AISettingsStatus,
} from "@/lib/ai-providers";

export class AIConfigurationError extends Error {
  constructor(
    message: string,
    public code = "AI_CONFIGURATION_REQUIRED",
    public status = 402,
  ) {
    super(message);
  }
}

function encryptionKey() {
  const secret =
    process.env.AI_KEY_ENCRYPTION_SECRET ||
    process.env.NEXTAUTH_SECRET ||
    process.env.AUTH_SECRET;
  if (!secret || secret.length < 32)
    throw new AIConfigurationError(
      "API key storage needs a server encryption secret of at least 32 characters.",
      "AI_CONFIGURATION_UNAVAILABLE",
      503,
    );
  return Buffer.from(
    hkdfSync("sha256", secret, "intelar-api-keys", "encryption-v1", 32),
  );
}
export function encryptAPIKey(value: string, owner: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  cipher.setAAD(Buffer.from(owner));
  const encrypted = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  return [
    "v1",
    iv.toString("base64"),
    cipher.getAuthTag().toString("base64"),
    encrypted.toString("base64"),
  ].join(".");
}
export function decryptAPIKey(value: string, owner: string) {
  try {
    const [version, iv, tag, data] = value.split(".");
    if (version !== "v1" || !iv || !tag || !data)
      throw new Error("Invalid envelope");
    const cipher = createDecipheriv(
      "aes-256-gcm",
      encryptionKey(),
      Buffer.from(iv, "base64"),
    );
    cipher.setAAD(Buffer.from(owner));
    cipher.setAuthTag(Buffer.from(tag, "base64"));
    return Buffer.concat([
      cipher.update(Buffer.from(data, "base64")),
      cipher.final(),
    ]).toString("utf8");
  } catch {
    throw new AIConfigurationError(
      "Your saved API key could not be read. Save your key again in Settings → AI provider.",
      "AI_KEY_UNREADABLE",
      503,
    );
  }
}

let initialization: Promise<unknown> | undefined;
export function initializeAISettings() {
  return (initialization ??= getDB()
    .batch(
      [
        `CREATE TABLE IF NOT EXISTS user_ai_settings (user_email TEXT PRIMARY KEY, provider TEXT NOT NULL, model TEXT NOT NULL, encrypted_key TEXT NOT NULL)`,
        `CREATE TABLE IF NOT EXISTS ai_prompt_usage (subject TEXT PRIMARY KEY, used INTEGER NOT NULL DEFAULT 0 CHECK (used >= 0))`,
      ],
      "write",
    )
    .catch((error) => {
      initialization = undefined;
      throw error;
    }));
}
export async function getAIConfiguration(owner: string) {
  await initializeAISettings();
  const { rows } = await getDB().execute({
    sql: "SELECT provider, model, encrypted_key FROM user_ai_settings WHERE user_email = ?",
    args: [owner],
  });
  const row = rows[0];
  return row
    ? {
        provider: providerSchema.parse(row.provider),
        model: String(row.model),
        encryptedKey: String(row.encrypted_key),
      }
    : null;
}
export async function getAIStatus(
  subject: string,
  owner?: string,
): Promise<AISettingsStatus> {
  await initializeAISettings();
  const configuration = owner ? await getAIConfiguration(owner) : null;
  const { rows } = await getDB().execute({
    sql: "SELECT used FROM ai_prompt_usage WHERE subject = ?",
    args: [subject],
  });
  const used = Number(rows[0]?.used ?? 0);
  return {
    configuration: configuration
      ? {
          provider: configuration.provider,
          model: configuration.model,
          hasKey: true,
        }
      : null,
    used,
    limit: FREE_PROMPT_LIMIT,
    remaining: Math.max(0, FREE_PROMPT_LIMIT - used),
  };
}
export async function saveAIConfiguration(
  owner: string,
  input: AISettingsInput,
) {
  const previous = await getAIConfiguration(owner);
  if (!input.apiKey && (!previous || previous.provider !== input.provider))
    throw new AIConfigurationError(
      "Enter an API key for this provider.",
      "AI_KEY_REQUIRED",
      400,
    );
  const encrypted = input.apiKey
    ? encryptAPIKey(input.apiKey, owner)
    : previous!.encryptedKey;
  await getDB().execute({
    sql: `INSERT INTO user_ai_settings (user_email, provider, model, encrypted_key) VALUES (?, ?, ?, ?) ON CONFLICT(user_email) DO UPDATE SET provider=excluded.provider, model=excluded.model, encrypted_key=excluded.encrypted_key`,
    args: [owner, input.provider, input.model, encrypted],
  });
}
export async function deleteAIConfiguration(owner: string) {
  await initializeAISettings();
  await getDB().execute({
    sql: "DELETE FROM user_ai_settings WHERE user_email = ?",
    args: [owner],
  });
}
export async function reserveFreePrompt(subject: string) {
  await initializeAISettings();
  // One statement makes the allowance safe across concurrent tabs and server instances.
  const { rows } = await getDB().execute({
    sql: `INSERT INTO ai_prompt_usage (subject, used) VALUES (?, 1) ON CONFLICT(subject) DO UPDATE SET used=used+1 WHERE used < ? RETURNING used`,
    args: [subject, FREE_PROMPT_LIMIT],
  });
  if (!rows.length)
    throw new AIConfigurationError(
      "Your 3 free prompts are used up. Configure your own API key in Settings → AI provider to continue.",
    );
  return FREE_PROMPT_LIMIT - Number(rows[0].used);
}
export function aiErrorResponse(error: unknown) {
  return error instanceof AIConfigurationError
    ? Response.json(
        { error: error.message, code: error.code },
        { status: error.status, headers: { "Cache-Control": "no-store" } },
      )
    : null;
}
