"use client";

import { useRef, useState } from "react";
import { Check, Copy, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ShareConversationDialogProps {
  url: string;
  title: string;
  onClose: () => void;
}

export default function ShareConversationDialog({ url, title, onClose }: ShareConversationDialogProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [copied, setCopied] = useState(false);
  const [copying, setCopying] = useState(false);
  const [copyError, setCopyError] = useState(false);

  const copyLink = async () => {
    setCopying(true);
    setCopyError(false);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
    } catch {
      setCopied(false);
      setCopyError(true);
      inputRef.current?.focus();
      inputRef.current?.select();
    } finally {
      setCopying(false);
    }
  };

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Share conversation</DialogTitle>
          <DialogDescription>
            Anyone with this link can view this snapshot of your conversation.
          </DialogDescription>
        </DialogHeader>
        <p className="truncate text-sm font-medium" title={title}>{title}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="min-w-0 flex-1">
            <label htmlFor="conversation-share-link" className="sr-only">Public conversation link</label>
            <input
              ref={inputRef}
              id="conversation-share-link"
              value={url}
              readOnly
              onFocus={(event) => event.currentTarget.select()}
              className="h-9 w-full rounded-lg border border-border bg-muted/50 px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </div>
          <Button onClick={copyLink} disabled={copying} className="cursor-pointer rounded-full">
            {copying ? <Loader2 className="animate-spin" /> : copied ? <Check /> : <Copy />}
            {copying ? "Copying…" : copied ? "Copied" : "Copy link"}
          </Button>
        </div>
        <p role="status" className="text-xs text-muted-foreground">
          {copyError
            ? "Clipboard access was blocked. You can copy the selected link manually."
            : copied ? "Link copied to your clipboard." : "Copy the link to share it with others."}
        </p>
      </DialogContent>
    </Dialog>
  );
}
