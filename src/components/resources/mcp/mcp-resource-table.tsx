"use client";

import React, { useState, useMemo } from "react";
import { Search, FileText, FileSpreadsheet, FileCode, CheckSquare, Square, Download, ArrowLeft, Loader2 } from "lucide-react";
import type { McpResourceItem } from "@/lib/mcp/mcp-types";

interface McpResourceTableProps {
    items: McpResourceItem[];
    sourceName: string;
    onBack: () => void;
    onImport: (selectedItems: McpResourceItem[]) => void;
    isIngesting: boolean;
    isDark?: boolean;
}

function getFileIcon(fileName: string, mimeType: string) {
    if (fileName.endsWith(".csv") || mimeType.includes("csv") || mimeType.includes("spreadsheet")) {
        return <FileSpreadsheet className="w-4 h-4 text-emerald-500 shrink-0" />;
    }
    if (fileName.endsWith(".json") || fileName.endsWith(".ts") || fileName.endsWith(".js")) {
        return <FileCode className="w-4 h-4 text-amber-500 shrink-0" />;
    }
    return <FileText className="w-4 h-4 text-blue-400 shrink-0" />;
}

function formatSize(bytes?: number): string {
    if (!bytes || bytes <= 0) return "--";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function McpResourceTable({
    items,
    sourceName,
    onBack,
    onImport,
    isIngesting,
    isDark = true,
}: McpResourceTableProps) {
    const [search, setSearch] = useState("");
    const [selectedUris, setSelectedUris] = useState<Set<string>>(() => {
        // Pre-select all returned documents by default so the user can import with one click
        return new Set(items.map((i) => i.uri));
    });

    const filteredItems = useMemo(() => {
        if (!search.trim()) return items;
        const q = search.toLowerCase();
        return items.filter(
            (i) => i.name.toLowerCase().includes(q) || (i.description && i.description.toLowerCase().includes(q))
        );
    }, [items, search]);

    const isAllSelected = filteredItems.length > 0 && filteredItems.every((i) => selectedUris.has(i.uri));

    function toggleSelectAll() {
        if (isAllSelected) {
            setSelectedUris(new Set());
        } else {
            const next = new Set(selectedUris);
            for (const item of filteredItems) {
                next.add(item.uri);
            }
            setSelectedUris(next);
        }
    }

    function toggleItem(uri: string) {
        const next = new Set(selectedUris);
        if (next.has(uri)) {
            next.delete(uri);
        } else {
            next.add(uri);
        }
        setSelectedUris(next);
    }

    function handleStartImport() {
        const toImport = items.filter((i) => selectedUris.has(i.uri));
        onImport(toImport);
    }

    return (
        <div className="space-y-4">
            {/* Header info & back */}
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border">
                <button
                    type="button"
                    onClick={onBack}
                    disabled={isIngesting}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Change source</span>
                </button>
                <span className="text-xs text-muted-foreground truncate max-w-xs">
                    Connected to <strong className="text-foreground">{sourceName}</strong> ({items.length} files)
                </span>
            </div>

            {/* Filter search & Select All toggle */}
            <div className="flex items-center gap-2">
                <div
                    className={`flex flex-1 items-center gap-2 rounded-xl border px-3 py-2 text-xs ${
                        isDark ? "border-white/10 bg-white/5" : "border-black/10 bg-black/[0.03]"
                    }`}
                >
                    <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <input
                        type="text"
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Filter documents…"
                        className="w-full bg-transparent outline-none placeholder:text-muted-foreground/60 text-foreground"
                    />
                </div>

                <button
                    type="button"
                    onClick={toggleSelectAll}
                    disabled={filteredItems.length === 0 || isIngesting}
                    className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border border-border bg-card hover:bg-muted text-xs font-medium text-foreground transition-colors cursor-pointer disabled:opacity-50 shrink-0"
                >
                    {isAllSelected ? (
                        <CheckSquare className="w-3.5 h-3.5 text-foreground" />
                    ) : (
                        <Square className="w-3.5 h-3.5 text-muted-foreground" />
                    )}
                    <span>{isAllSelected ? "Deselect All" : "Select All"}</span>
                </button>
            </div>

            {/* Scrollable Document List */}
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-border divide-y divide-border/60">
                {filteredItems.length === 0 ? (
                    <div className="p-8 text-center text-xs text-muted-foreground">
                        No matching documents found.
                    </div>
                ) : (
                    filteredItems.map((item) => {
                        const isChecked = selectedUris.has(item.uri);
                        return (
                            <div
                                key={item.uri}
                                onClick={() => !isIngesting && toggleItem(item.uri)}
                                className={`flex items-center justify-between gap-3 p-3 transition-colors cursor-pointer select-none ${
                                    isChecked
                                        ? isDark
                                            ? "bg-white/[0.06]"
                                            : "bg-black/[0.04]"
                                        : isDark
                                        ? "hover:bg-white/[0.03]"
                                        : "hover:bg-black/[0.02]"
                                }`}
                            >
                                <div className="flex items-center gap-2.5 min-w-0">
                                    <div className="shrink-0">
                                        {isChecked ? (
                                            <CheckSquare className="w-4 h-4 text-foreground" />
                                        ) : (
                                            <Square className="w-4 h-4 text-muted-foreground" />
                                        )}
                                    </div>
                                    {getFileIcon(item.name, item.mimeType)}
                                    <div className="min-w-0">
                                        <div className="text-xs font-medium text-foreground truncate">
                                            {item.name}
                                        </div>
                                        {item.description && (
                                            <div className="text-[11px] text-muted-foreground truncate">
                                                {item.description}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="text-[11px] text-muted-foreground shrink-0 tabular-nums">
                                    {formatSize(item.size)}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            {/* Action Bar */}
            <div className="flex items-center justify-between pt-2">
                <span className="text-xs text-muted-foreground">
                    {selectedUris.size} document{selectedUris.size === 1 ? "" : "s"} selected
                </span>

                <button
                    type="button"
                    onClick={handleStartImport}
                    disabled={selectedUris.size === 0 || isIngesting}
                    className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-xs sm:text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-50 cursor-pointer"
                >
                    {isIngesting ? (
                        <>
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            <span>Ingesting into Resources…</span>
                        </>
                    ) : (
                        <>
                            <Download className="w-3.5 h-3.5" />
                            <span>Import Selected ({selectedUris.size})</span>
                        </>
                    )}
                </button>
            </div>
        </div>
    );
}
