"use client";

import { TooltipButton } from "@/components/ui/tooltip-button";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Sun, Moon, ArrowRight, Share2, Copy, Check, MessageSquare, Sparkles } from "lucide-react";
import { Message } from "@/types/chat";
import MessageBubble from "@/components/message-bubble";
import DocumentViewer, { DocumentViewerFile } from "@/components/document-viewer";
import IntelarLogo from "@/components/svg";
import { usePreferences } from "@/context/preferences-context";
import { toast } from "sonner";

interface SharedSnapshotData {
  id: string;
  conversationId: string;
  title: string;
  messages: (Omit<Message, "createdAt"> & { createdAt: string | Date })[];
  createdAt: string | Date;
  viewCount?: number;
}

export default function SharedChatViewer({ snapshot }: { snapshot: SharedSnapshotData }) {
  const router = useRouter();
  const { theme, updatePreferences } = usePreferences();
  const [mounted, setMounted] = useState(false);
  const [previewFile, setPreviewFile] = useState<DocumentViewerFile | null>(null);
  const [copiedLink, setCopiedLink] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const isDark = theme === "dark";

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      toast.success("Public link copied to clipboard", {
        description: "Anyone with this link can view this conversation snapshot.",
      });
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      toast.error("Failed to copy link");
    }
  };

  const handleContinueConversation = () => {
    try {
      localStorage.setItem(
        "intelar_fork_chat",
        JSON.stringify({
          title: snapshot.title,
          messages: snapshot.messages,
        })
      );
      router.push("/chat");
    } catch (err) {
      console.error("Failed to fork conversation:", err);
      router.push("/chat");
    }
  };

  // Use a fixed locale and timezone so SSR and browser hydration agree.
  const formattedDate = new Date(snapshot.createdAt).toLocaleDateString("en-GB", {
    timeZone: "Africa/Lagos",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const normalizedMessages: Message[] = snapshot.messages.map((m) => ({
    ...m,
    createdAt: new Date(m.createdAt),
    isStreaming: false,
  }));

  return (
    <div className="min-h-screen flex flex-col bg-background text-foreground transition-colors duration-300">
      {/* Top Header */}
      <header className="sticky top-0 z-30 flex items-center justify-between h-14 px-4 sm:px-6 border-b border-border/60 bg-background/80 backdrop-blur-md transition-colors duration-300">
        <div className="flex items-center gap-3 min-w-0">
          <Link
            href="/"
            className="flex items-center gap-2 text-foreground font-semibold tracking-tight hover:opacity-85 transition-opacity shrink-0"
          >
            <IntelarLogo size={24} />
            <span className="text-sm font-semibold tracking-tight hidden sm:inline">Intelar</span>
          </Link>
          <span className="text-border/80 hidden sm:inline">/</span>
          <span className="text-xs sm:text-sm font-medium text-foreground/70 truncate max-w-[200px] sm:max-w-md">
            {snapshot.title}
          </span>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <TooltipButton
            onClick={handleCopyLink}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors cursor-pointer ${
              isDark
                ? "border-white/10 hover:bg-white/6 text-white/80 hover:text-white"
                : "border-black/10 hover:bg-black/6 text-black/80 hover:text-black"
            }`}
            title="Copy share link"
          >
            {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
            <span className="hidden sm:inline">{copiedLink ? "Copied" : "Share"}</span>
          </TooltipButton>

          <TooltipButton
            suppressHydrationWarning
            onClick={() => updatePreferences({ theme: theme === "dark" ? "light" : "dark" })}
            className="p-2 rounded-lg hover:bg-black/6 dark:hover:bg-white/6 cursor-pointer transition-colors"
            title={mounted ? `Switch to ${theme === "dark" ? "light" : "dark"} mode` : "Switch theme"}
            aria-label={mounted ? `Switch to ${theme === "dark" ? "light" : "dark"} mode` : "Switch theme"}
          >
            {mounted && theme === "dark" ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
          </TooltipButton>

          <button
            onClick={handleContinueConversation}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all shadow-sm ${
              isDark
                ? "bg-white text-black hover:bg-white/90"
                : "bg-black text-white hover:bg-black/90"
            }`}
          >
            <span>Continue this chat</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </header>

      {/* Snapshot Info Banner */}
      <div className="border-b border-border/40 bg-muted/20 px-4 py-3 text-xs text-muted-foreground transition-colors duration-300">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-medium bg-foreground/6 text-foreground/80 border border-border/60">
              <Share2 className="w-3 h-3" />
              Shared Snapshot
            </span>
            <span className="truncate">Created on {formattedDate}</span>
          </div>
          <span className="hidden sm:inline text-[11px] text-muted-foreground/80">
            Immutable snapshot • Will not reflect subsequent private updates
          </span>
        </div>
      </div>

      {/* Main Conversation Stream */}
      <main className="flex-1 max-w-3xl w-full mx-auto px-4 py-8 space-y-6">
        <div className="pb-4 border-b border-border/40">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
            {snapshot.title}
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1.5 flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5" />
            <span>{snapshot.messages.length} messages in this snapshot</span>
          </p>
        </div>

        <div className="space-y-6">
          {normalizedMessages.map((message) => (
            <MessageBubble
              key={message.id}
              message={message}
              theme={theme}
              onPreviewFile={setPreviewFile}
            />
          ))}
        </div>

        {/* Bottom CTA Card */}
        <div className="mt-12 rounded-2xl border border-border bg-card p-6 sm:p-8 text-center transition-colors duration-300">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-foreground/6 text-foreground mb-4">
            <Sparkles className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Research topics and learn with cited sources
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-md mx-auto mt-1.5">
            Intelar searches the web, reads documents, and delivers cited answers with deep reasoning.
          </p>
          <div className="mt-5 flex items-center justify-center gap-3">
            <button
              onClick={handleContinueConversation}
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-semibold cursor-pointer transition-all shadow-sm ${
                isDark ? "bg-white text-black hover:bg-white/90" : "bg-black text-white hover:bg-black/90"
              }`}
            >
              Continue this conversation
            </button>
            <Link
              href="/chat"
              className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-medium border cursor-pointer transition-colors ${
                isDark
                  ? "border-white/10 hover:bg-white/6 text-white/80"
                  : "border-black/10 hover:bg-black/6 text-black/80"
              }`}
            >
              Start new chat
            </Link>
          </div>
        </div>
      </main>

      {/* Document Viewer Modal if a file preview was triggered */}
      {previewFile && (
        <div className="fixed inset-0 z-50 flex">
          <DocumentViewer
            file={previewFile}
            onClose={() => setPreviewFile(null)}
            theme={theme}
          />
        </div>
      )}
    </div>
  );
}
