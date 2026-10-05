"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { queryKeys } from "@/lib/queries/keys";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, AlertCircle } from "lucide-react";
import { McpIcon } from "@/components/icons/mcp-icon";
import McpProviderGrid from "./mcp-provider-grid";
import McpSourceForm from "./mcp-source-form";
import McpResourceTable from "./mcp-resource-table";
import type { McpBrowseResult, McpIngestResult, McpResourceItem, McpSourceConfig, McpSourceProvider } from "@/lib/mcp/mcp-types";

interface McpImportDialogProps {
    isOpen: boolean;
    onClose: () => void;
    isDark?: boolean;
}

export default function McpImportDialog({
    isOpen,
    onClose,
    isDark = true,
}: McpImportDialogProps) {
    const { data: session } = useSession();
    const userEmail = session?.user?.email ?? null;
    const queryClient = useQueryClient();

    const [provider, setProvider] = useState<McpSourceProvider>("github");
    const [config, setConfig] = useState<McpSourceConfig>({
        provider: "github",
        repo: "mastra-ai/mastra",
        branch: "main",
        path: "docs",
    });

    const [step, setStep] = useState<"configure" | "browse">("configure");
    const [isLoading, setIsLoading] = useState(false);
    const [isIngesting, setIsIngesting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successMessage, setSuccessMessage] = useState<string | null>(null);

    const [browseData, setBrowseData] = useState<McpBrowseResult | null>(null);

    function handleSelectProvider(nextProvider: McpSourceProvider) {
        setProvider(nextProvider);
        setError(null);
        setConfig((prev) => {
            const updated: McpSourceConfig = { ...prev, provider: nextProvider };
            if (nextProvider === "github" && !updated.repo) {
                updated.repo = "mastra-ai/mastra";
                updated.branch = "main";
                updated.path = "docs";
            }
            return updated;
        });
    }

    async function handleBrowse() {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch("/api/mcp/browse", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to browse source");

            setBrowseData(data);
            setStep("browse");
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to connect to MCP source");
        } finally {
            setIsLoading(false);
        }
    }

    async function handleImport(selectedItems: McpResourceItem[]) {
        if (!selectedItems.length) return;
        setIsIngesting(true);
        setError(null);
        try {
            const res = await fetch("/api/mcp/ingest", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ items: selectedItems, config }),
            });
            const data = (await res.json()) as McpIngestResult;
            if (!res.ok || !data.success) throw new Error(data.error || "Ingestion failed");

            // Invalidate resources cache so they appear immediately in the library
            if (userEmail) {
                await queryClient.invalidateQueries({ queryKey: queryKeys.resources.list(userEmail) });
            }

            setSuccessMessage(`Successfully imported ${data.importedCount} document${data.importedCount === 1 ? "" : "s"} into Resources!`);
            setTimeout(() => {
                setSuccessMessage(null);
                setStep("configure");
                onClose();
            }, 1800);
        } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to ingest resources");
        } finally {
            setIsIngesting(false);
        }
    }

    function handleResetToConfigure() {
        setStep("configure");
        setError(null);
    }

    function handleDialogClose() {
        if (isIngesting) return;
        setError(null);
        setSuccessMessage(null);
        setStep("configure");
        onClose();
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleDialogClose()}>
            <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-7">
                <DialogHeader className="mb-4">
                    <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-foreground/10 text-foreground">
                            <McpIcon className="w-4 h-4" />
                        </span>
                        <DialogTitle className="text-lg font-semibold tracking-tight">
                            Import via Model Context Protocol (MCP)
                        </DialogTitle>
                    </div>
                    <DialogDescription className="mt-1 text-xs text-muted-foreground leading-relaxed">
                        Connect to Google Drive, GitHub repositories, Notion, or custom MCP servers to ingest documents directly into your Resources library.
                    </DialogDescription>
                </DialogHeader>

                {/* Error Banner */}
                {error && (
                    <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center gap-2 mb-4">
                        <AlertCircle className="w-4 h-4 shrink-0" />
                        <span>{error}</span>
                    </div>
                )}

                {/* Success Banner */}
                {successMessage && (
                    <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-400 flex items-center gap-2 mb-4">
                        <CheckCircle2 className="w-4 h-4 shrink-0" />
                        <span>{successMessage}</span>
                    </div>
                )}

                {step === "configure" && (
                    <div className="space-y-5">
                        {/* Provider selection grid */}
                        <div>
                            <label className="block text-xs font-semibold text-foreground mb-2">
                                1. Select Document Source
                            </label>
                            <McpProviderGrid
                                selectedProvider={provider}
                                onSelectProvider={handleSelectProvider}
                                isDark={isDark}
                            />
                        </div>

                        {/* Source Configuration Form */}
                        <div className="pt-2 border-t border-border">
                            <label className="block text-xs font-semibold text-foreground mb-2">
                                2. Configure Connection
                            </label>
                            <McpSourceForm
                                provider={provider}
                                config={config}
                                onChangeConfig={(updates) => setConfig((prev) => ({ ...prev, ...updates }))}
                                onSubmit={handleBrowse}
                                isLoading={isLoading}
                                isDark={isDark}
                            />
                        </div>
                    </div>
                )}

                {step === "browse" && browseData && (
                    <div>
                        <McpResourceTable
                            items={browseData.items}
                            sourceName={browseData.sourceName}
                            onBack={handleResetToConfigure}
                            onImport={handleImport}
                            isIngesting={isIngesting}
                            isDark={isDark}
                        />
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
