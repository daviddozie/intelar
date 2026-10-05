"use client";

import React from "react";
import { Loader2, ArrowRight, Sparkles } from "lucide-react";
import type { McpSourceConfig, McpSourceProvider } from "@/lib/mcp/mcp-types";

interface McpSourceFormProps {
    provider: McpSourceProvider;
    config: McpSourceConfig;
    onChangeConfig: (updates: Partial<McpSourceConfig>) => void;
    onSubmit: () => void;
    isLoading: boolean;
    isDark?: boolean;
}

export default function McpSourceForm({
    provider,
    config,
    onChangeConfig,
    onSubmit,
    isLoading,
    isDark = true,
}: McpSourceFormProps) {
    const inputStyle = `w-full rounded-xl border px-3.5 py-2.5 text-xs outline-none transition-colors ${
        isDark
            ? "border-white/10 bg-white/5 text-white placeholder:text-white/35 focus:border-white/30"
            : "border-black/10 bg-black/[0.03] text-black placeholder:text-black/35 focus:border-black/30"
    }`;

    const chipStyle = `text-[11px] px-2.5 py-1 rounded-full border border-border bg-muted/40 hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors`;

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                onSubmit();
            }}
            className="space-y-4"
        >
            {provider === "github" && (
                <div className="space-y-3">
                    <div>
                        <div className="flex items-center justify-between mb-1.5">
                            <label className="text-xs font-medium text-foreground">
                                Repository (owner/repo)
                            </label>
                            <span className="text-[11px] text-muted-foreground">Public or private</span>
                        </div>
                        <input
                            type="text"
                            value={config.repo || ""}
                            onChange={(e) => onChangeConfig({ repo: e.target.value })}
                            placeholder="e.g. mastra-ai/mastra or owner/repo"
                            className={inputStyle}
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1.5">
                                Branch
                            </label>
                            <input
                                type="text"
                                value={config.branch || ""}
                                onChange={(e) => onChangeConfig({ branch: e.target.value })}
                                placeholder="main"
                                className={inputStyle}
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-medium text-foreground mb-1.5">
                                Subpath (Optional)
                            </label>
                            <input
                                type="text"
                                value={config.path || ""}
                                onChange={(e) => onChangeConfig({ path: e.target.value })}
                                placeholder="e.g. docs or notes"
                                className={inputStyle}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">
                            GitHub Token (Optional, for private repos)
                        </label>
                        <input
                            type="password"
                            value={config.githubToken || ""}
                            onChange={(e) => onChangeConfig({ githubToken: e.target.value })}
                            placeholder="ghp_..."
                            className={inputStyle}
                        />
                    </div>

                    {/* Quick Presets */}
                    <div className="pt-1">
                        <span className="text-[11px] text-muted-foreground mr-2">Quick examples:</span>
                        <div className="inline-flex flex-wrap gap-1.5 mt-1">
                            <button
                                type="button"
                                onClick={() => onChangeConfig({ repo: "mastra-ai/mastra", branch: "main", path: "docs" })}
                                className={chipStyle}
                            >
                                mastra-ai/mastra (docs)
                            </button>
                            <button
                                type="button"
                                onClick={() => onChangeConfig({ repo: "facebook/react", branch: "main", path: "fixtures" })}
                                className={chipStyle}
                            >
                                facebook/react
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {provider === "google-drive" && (
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">
                            Google Doc, Sheet, or Drive Link
                        </label>
                        <input
                            type="text"
                            value={config.driveFolderId || ""}
                            onChange={(e) => onChangeConfig({ driveFolderId: e.target.value })}
                            placeholder="e.g. https://docs.google.com/document/d/... or leave empty for campus library"
                            className={inputStyle}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">
                            Drive MCP Endpoint (Optional)
                        </label>
                        <input
                            type="text"
                            value={config.serverUrl || ""}
                            onChange={(e) => onChangeConfig({ serverUrl: e.target.value })}
                            placeholder="e.g. http://localhost:8000/sse"
                            className={inputStyle}
                        />
                    </div>

                    <div className="p-3 rounded-xl border border-border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-foreground shrink-0" />
                        <span>Paste any shared Google Doc or Sheet link to import directly, or leave empty to test with campus lecture notes.</span>
                    </div>
                </div>
            )}

            {provider === "notion" && (
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">
                            Notion Database or Page ID
                        </label>
                        <input
                            type="text"
                            value={config.notionPageId || ""}
                            onChange={(e) => onChangeConfig({ notionPageId: e.target.value })}
                            placeholder="e.g. 1234567890abcdef or leave empty for workspace notes"
                            className={inputStyle}
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">
                            Notion Integration Token (Optional)
                        </label>
                        <input
                            type="password"
                            value={config.notionApiKey || ""}
                            onChange={(e) => onChangeConfig({ notionApiKey: e.target.value })}
                            placeholder="secret_..."
                            className={inputStyle}
                        />
                    </div>

                    <div className="p-3 rounded-xl border border-border bg-muted/20 text-xs text-muted-foreground flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-foreground shrink-0" />
                        <span>Ready-to-use workspace engineering and biochemistry notes available for testing.</span>
                    </div>
                </div>
            )}

            {provider === "custom" && (
                <div className="space-y-3">
                    <div>
                        <label className="block text-xs font-medium text-foreground mb-1.5">
                            MCP Server Endpoint URL
                        </label>
                        <input
                            type="url"
                            value={config.serverUrl || ""}
                            onChange={(e) => onChangeConfig({ serverUrl: e.target.value })}
                            placeholder="http://localhost:3001/sse or https://mcp.server/sse"
                            className={inputStyle}
                            required
                        />
                    </div>

                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                        Connects to any server implementing the Model Context Protocol (MCP) Streamable HTTP or Server-Sent Events (SSE) transport and reads advertised resources.
                    </p>
                </div>
            )}

            <div className="pt-2 flex justify-end">
                <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-xs sm:text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-50 cursor-pointer"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Connecting to MCP…</span>
                        </>
                    ) : (
                        <>
                            <span>Connect & Browse Files</span>
                            <ArrowRight className="w-3.5 h-3.5" />
                        </>
                    )}
                </button>
            </div>
        </form>
    );
}
