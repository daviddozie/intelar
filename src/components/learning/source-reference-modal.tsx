"use client";

import React, { useRef } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import type { LearningSourceReference } from "@/lib/learning-types";
import { X, ExternalLink } from "lucide-react";

interface SourceReferenceModalProps {
    reference: LearningSourceReference | null;
    onClose: () => void;
    theme?: "light" | "dark";
}

export default function SourceReferenceModal({ reference, onClose, theme = "dark" }: SourceReferenceModalProps) {
    const returnFocus = useRef<HTMLElement | null>(null);
    return (
        <Dialog open={Boolean(reference)} onOpenChange={(open) => { if (!open) onClose(); }}>
            <DialogContent
                showCloseButton={false}
                onOpenAutoFocus={() => { returnFocus.current = document.activeElement as HTMLElement | null; }}
                onCloseAutoFocus={(event) => { event.preventDefault(); returnFocus.current?.focus(); }}
                className={`sm:max-w-xl max-h-[85vh] overflow-y-auto p-4 sm:p-6 border rounded-2xl ${theme === "dark" ? "bg-[#18181b] border-white/10 text-white" : "bg-white border-black/10 text-neutral-900"}`}
            >
                {reference && <>
                    <div className="flex items-start justify-between gap-4">
                        <DialogTitle className="text-lg font-semibold leading-tight">{reference.title}</DialogTitle>
                        <button
                            type="button"
                            aria-label="Close source reference"
                            onClick={onClose}
                            className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>
                    <DialogDescription className="text-xs text-muted-foreground">Supporting source summary adapted for this lesson; not a verbatim quotation.</DialogDescription>
                    <dl className="text-xs space-y-3">
                        <div><dt className="font-semibold text-muted-foreground">Authors</dt><dd>{reference.author}</dd></div>
                        <div><dt className="font-semibold text-muted-foreground">Section</dt><dd>{reference.section}</dd></div>
                        <div><dt className="font-semibold text-muted-foreground">License</dt><dd>{reference.license}</dd></div>
                    </dl>
                    <p className="p-4 rounded-xl border-l-4 border-foreground/50 bg-muted/40 text-sm leading-relaxed text-foreground">{reference.excerpt}</p>
                    <div className="flex flex-wrap items-center justify-between gap-3 text-xs pt-2">
                        {reference.url && (
                            <a
                                href={reference.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-foreground hover:underline font-medium focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring rounded-sm"
                            >
                                <span>Open supporting textbook</span>
                                <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-4 py-2 rounded-xl border border-border bg-card hover:bg-muted text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring cursor-pointer text-xs font-medium"
                        >
                            Done
                        </button>
                    </div>
                </>}
            </DialogContent>
        </Dialog>
    );
}
