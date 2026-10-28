"use client";

import { useState } from "react";
import { useSession, signIn } from "next-auth/react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  aiProviders,
  type AIProvider,
  type AISettingsStatus,
} from "@/lib/ai-providers";
import {
  aiSettingsKey,
  fetchAISettings,
  removeAISettings,
  saveAISettings,
} from "@/lib/queries/ai-settings";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";

export function useAISettings() {
  const { data: session, status } = useSession();
  const email = session?.user?.email ?? null;
  return useQuery({
    queryKey: aiSettingsKey(email),
    queryFn: ({ signal }) => fetchAISettings(signal),
    enabled: status !== "loading",
    staleTime: 0,
    retry: 1,
  });
}

export default function AIProviderSettings() {
  const { data: session, status } = useSession();
  const settings = useAISettings();
  if (status === "loading" || settings.isPending)
    return (
      <p role="status" className="mt-4 text-sm text-muted-foreground">
        Loading AI settings…
      </p>
    );
  if (settings.isError)
    return (
      <div className="mt-4 text-sm" role="alert">
        Couldn’t load AI settings.{" "}
        <button
          onClick={() => void settings.refetch()}
          className="cursor-pointer underline"
        >
          Retry
        </button>
      </div>
    );
  if (!session?.user?.email)
    return (
      <div className="mt-4 space-y-4 text-sm leading-6">
        <p>
          You have {settings.data.remaining} of 3 free prompts left. Sign in to
          save your own provider, model, and API key.
        </p>
        <Button
          onClick={() => void signIn()}
          className="cursor-pointer rounded-full"
        >
          Sign in to configure
        </Button>
      </div>
    );
  return (
    <ProviderForm
      key={session.user.email}
      email={session.user.email}
      settings={settings.data}
    />
  );
}

function ProviderForm({
  email,
  settings,
}: {
  email: string;
  settings: AISettingsStatus;
}) {
  const queryClient = useQueryClient();
  const saved = settings.configuration;
  const [provider, setProvider] = useState<AIProvider>(
    saved?.provider ?? "openrouter",
  );
  const [model, setModel] = useState(saved?.model ?? "");
  const [apiKey, setApiKey] = useState("");
  const [showKey, setShowKey] = useState(false);
  const [notice, setNotice] = useState("");
  const mutation = useMutation({
    mutationFn: async (action: "save" | "remove") =>
      action === "remove"
        ? removeAISettings()
        : saveAISettings({
            provider,
            model: model.trim(),
            ...(apiKey.trim() ? { apiKey: apiKey.trim() } : {}),
          }),
    onSuccess: (data, action) => {
      queryClient.setQueryData(aiSettingsKey(email), data);
      setApiKey("");
      setShowKey(false);
      if (action === "remove") {
        setProvider("openrouter");
        setModel("");
      }
      setNotice(
        action === "remove"
          ? "Saved key removed. Your free allowance has not reset."
          : "Configuration saved. Your next request will use this provider and model.",
      );
    },
  });
  const providerInfo = aiProviders.find((item) => item.id === provider)!;
  const keyRequired = !saved || provider !== saved.provider;
  const inputStyle =
    "mt-2 w-full rounded-xl border border-foreground/20 bg-transparent px-3 py-2.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50";
  return (
    <form
      className="mt-4 space-y-5 text-sm"
      onSubmit={(event) => {
        event.preventDefault();
        setNotice("");
        mutation.mutate("save");
      }}
    >
      <p className="leading-6 text-muted-foreground">
        Use your own provider and model for AI requests. Your provider bills
        your account directly. Intelar’s shared allowance is{" "}
        {settings.remaining} of 3 prompts.
      </p>
      <div>
        <label htmlFor="ai-provider" className="font-medium">
          Provider
        </label>
        <Select
          value={provider}
          disabled={mutation.isPending}
          onValueChange={(value) => {
            setProvider(value as AIProvider);
            setModel("");
            setApiKey("");
            setNotice("");
            mutation.reset();
          }}
        >
          <SelectTrigger id="ai-provider" className="mt-2">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {aiProviders.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div>
        <label htmlFor="ai-model" className="font-medium">
          Model ID
        </label>
        <input
          id="ai-model"
          value={model}
          onChange={(event) => setModel(event.target.value)}
          placeholder={`e.g. ${providerInfo.example}`}
          maxLength={200}
          required
          disabled={mutation.isPending}
          autoComplete="off"
          className={inputStyle}
          aria-describedby="ai-model-help"
        />
        <p
          id="ai-model-help"
          className="mt-2 text-xs leading-5 text-muted-foreground"
        >
          Enter the exact model ID available to your provider account. Chat and
          research models need tool calling support.
        </p>
      </div>
      <div>
        <label htmlFor="ai-api-key" className="font-medium">
          API key
        </label>
        <input
          id="ai-api-key"
          type={showKey ? "text" : "password"}
          value={apiKey}
          onChange={(event) => setApiKey(event.target.value)}
          placeholder={
            keyRequired
              ? "Paste your provider API key"
              : "Key saved — leave blank to keep it"
          }
          required={keyRequired}
          maxLength={4096}
          autoComplete="new-password"
          spellCheck={false}
          disabled={mutation.isPending}
          className={inputStyle}
        />
        <button
          type="button"
          className="mt-2 cursor-pointer text-xs underline"
          onClick={() => setShowKey(!showKey)}
        >
          {showKey ? "Hide key" : "Show entered key"}
        </button>
        <p className="mt-2 text-xs leading-5 text-muted-foreground">
          Keys are encrypted before storage and never returned to this screen.
          Saving does not verify provider access; your next request checks the
          key and model.
        </p>
      </div>
      <div className="flex flex-wrap gap-3">
        <Button
          type="submit"
          disabled={
            mutation.isPending ||
            !model.trim() ||
            (keyRequired && !apiKey.trim())
          }
          className="cursor-pointer rounded-full"
        >
          {mutation.isPending ? "Saving…" : "Save configuration"}
        </Button>
        {saved && (
          <Button
            type="button"
            variant="outline"
            disabled={mutation.isPending}
            className="cursor-pointer rounded-full"
            onClick={() => {
              setNotice("");
              mutation.mutate("remove");
            }}
          >
            Remove saved key
          </Button>
        )}
      </div>
      {mutation.isError && (
        <p role="alert" className="text-destructive">
          {mutation.error.message}
        </p>
      )}
      {notice && (
        <p role="status" className="text-muted-foreground">
          {notice}
        </p>
      )}
    </form>
  );
}
