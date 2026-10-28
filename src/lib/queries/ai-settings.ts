import type { AISettingsInput, AISettingsStatus } from "@/lib/ai-providers";

export const aiSettingsKey = (email: string | null) =>
  ["ai-settings", email ?? "guest"] as const;
export const AI_USAGE_EVENT = "intelar:ai-usage-changed";
export function refreshAIUsage() {
  if (typeof window !== "undefined")
    window.dispatchEvent(new Event(AI_USAGE_EVENT));
}
export const AI_ACCESS_EVENT = "intelar:ai-access-required";
export function notifyAIAccessRequired(code?: string) {
  if (
    typeof window !== "undefined" &&
    (code === "AI_CONFIGURATION_REQUIRED" || code === "AI_KEY_UNREADABLE")
  )
    window.dispatchEvent(new Event(AI_ACCESS_EVENT));
}
async function read(response: Response): Promise<AISettingsStatus> {
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || "Could not load AI settings");
  return body;
}
export async function fetchAISettings(signal?: AbortSignal) {
  return read(await fetch("/api/ai-settings", { cache: "no-store", signal }));
}
export async function saveAISettings(input: AISettingsInput) {
  return read(
    await fetch("/api/ai-settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    }),
  );
}
export async function removeAISettings() {
  return read(await fetch("/api/ai-settings", { method: "DELETE" }));
}
