"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useAISettings } from "@/components/ai-provider-settings";
import { usePreferences } from "@/context/preferences-context";
import { AI_ACCESS_EVENT, AI_USAGE_EVENT } from "@/lib/queries/ai-settings";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export default function AIAllowanceDialog() {
  const { data: session } = useSession();
  const settings = useAISettings();
  const queryClient = useQueryClient();
  const { openSettings } = usePreferences();
  const [openFor, setOpenFor] = useState<string | null>(null);
  const scope = session?.user?.email ?? "guest";
  const shown = useRef<string | null>(null);
  useEffect(() => {
    const show = () => setOpenFor(scope);
    const refresh = () => {
      void queryClient.invalidateQueries({ queryKey: ["ai-settings"] });
    };
    window.addEventListener(AI_ACCESS_EVENT, show);
    window.addEventListener(AI_USAGE_EVENT, refresh);
    return () => {
      window.removeEventListener(AI_ACCESS_EVENT, show);
      window.removeEventListener(AI_USAGE_EVENT, refresh);
    };
  }, [scope, queryClient]);
  useEffect(() => {
    if (
      settings.data?.configuration ||
      settings.data?.remaining !== 0 ||
      shown.current === scope
    )
      return;
    shown.current = scope;
    // Defer opening until the query notification has settled.
    const timer = window.setTimeout(() => setOpenFor(scope), 0);
    return () => window.clearTimeout(timer);
  }, [scope, settings.data]);
  return (
    <Dialog
      open={openFor === scope && !settings.data?.configuration}
      onOpenChange={(open) => {
        if (!open) setOpenFor(null);
      }}
    >
      <DialogContent className="max-w-md rounded-2xl bg-background text-foreground">
        <DialogTitle>Your free prompts are used up</DialogTitle>
        <DialogDescription>
          You’ve used Intelar’s 3 free prompts. Choose an AI provider, enter
          your own API key, and select a model to keep going. You can close this
          and configure it later in Settings.
        </DialogDescription>
        <div className="mt-4 flex flex-wrap gap-3">
          <Button
            className="cursor-pointer rounded-full"
            onClick={() => {
              setOpenFor(null);
              openSettings(undefined, "ai-provider");
            }}
          >
            Configure API key
          </Button>
          <Button
            variant="outline"
            className="cursor-pointer rounded-full"
            onClick={() => setOpenFor(null)}
          >
            Maybe later
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
