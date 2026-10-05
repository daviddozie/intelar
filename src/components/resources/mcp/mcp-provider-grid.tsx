"use client";

import React from "react";
import { FolderGit2, HardDrive, FileText, Check } from "lucide-react";
import { McpIcon } from "@/components/icons/mcp-icon";
import type { McpSourceProvider } from "@/lib/mcp/mcp-types";

interface ProviderOption {
    id: McpSourceProvider;
    title: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
    badge: string;
}

const PROVIDERS: ProviderOption[] = [
    {
        id: "github",
        title: "GitHub",
        description: "Import repositories, READMEs, lecture slides, or research papers",
        icon: FolderGit2,
        badge: "Git / Raw",
    },
    {
        id: "google-drive",
        title: "Google Drive",
        description: "Import Google Docs, Sheets, Slides, and PDFs via Drive MCP",
        icon: HardDrive,
        badge: "Drive MCP",
    },
    {
        id: "notion",
        title: "Notion",
        description: "Import team workspaces, notes, and database pages via Notion MCP",
        icon: FileText,
        badge: "Notion MCP",
    },
    {
        id: "custom",
        title: "Custom MCP",
        description: "Connect to any standard SSE or Streamable HTTP MCP server",
        icon: McpIcon,
        badge: "SSE / HTTP",
    },
];

interface McpProviderGridProps {
    selectedProvider: McpSourceProvider;
    onSelectProvider: (provider: McpSourceProvider) => void;
    isDark?: boolean;
}

export default function McpProviderGrid({
    selectedProvider,
    onSelectProvider,
    isDark = true,
}: McpProviderGridProps) {
    return (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {PROVIDERS.map((p) => {
                const isSelected = selectedProvider === p.id;
                const Icon = p.icon;

                return (
                    <button
                        key={p.id}
                        type="button"
                        onClick={() => onSelectProvider(p.id)}
                        className={`group relative text-left p-4 rounded-2xl border transition-all duration-200 cursor-pointer flex flex-col justify-between ${
                            isSelected
                                ? isDark
                                    ? "border-foreground bg-foreground/10 shadow-xs"
                                    : "border-foreground bg-foreground/5 shadow-xs"
                                : isDark
                                ? "border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]"
                                : "border-black/10 bg-black/[0.02] hover:border-black/20 hover:bg-black/[0.04]"
                        }`}
                    >
                        <div>
                            <div className="flex items-center justify-between gap-2 mb-2">
                                <div
                                    className={`p-2 rounded-xl ${
                                        isSelected
                                            ? "bg-foreground text-background"
                                            : isDark
                                            ? "bg-white/10 text-white"
                                            : "bg-black/10 text-black"
                                    }`}
                                >
                                    <Icon className="w-4 h-4" />
                                </div>
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full border border-border/60 text-muted-foreground uppercase">
                                    {p.badge}
                                </span>
                            </div>

                            <h4 className="text-sm font-semibold tracking-tight text-foreground flex items-center gap-1.5">
                                {p.title}
                                {isSelected && <Check className="w-3.5 h-3.5 text-foreground" />}
                            </h4>
                            <p className="text-xs text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                                {p.description}
                            </p>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
