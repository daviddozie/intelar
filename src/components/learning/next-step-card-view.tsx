"use client";

import React from "react";
import type { NextStepCardData } from "@/lib/learning-types";
import { ArrowLeft, ExternalLink, Lightbulb, Compass } from "lucide-react";

interface NextStepCardViewProps {
    data: NextStepCardData;
    onBack: () => void;
    theme?: "light" | "dark";
}

export default function NextStepCardView({
    data,
    onBack,
}: NextStepCardViewProps) {
    return (
        <div className="w-full p-6 sm:p-8">
            {/* Navigation back */}
            <div className="mb-6 flex items-center justify-between">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span>Back to Learning Dashboard</span>
                </button>
            </div>

            {/* Header Banner */}
            <div className="rounded-3xl border border-border bg-card p-6 sm:p-8 mb-8 relative overflow-hidden">
                <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-border bg-muted/60 text-muted-foreground mb-3">
                    <Compass className="w-3 h-3" />
                    <span>Career & Research Pathway</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 text-foreground">
                    {data.headline}
                </h1>
                <p className="text-sm sm:text-base leading-relaxed text-muted-foreground max-w-2xl">
                    {data.description}
                </p>
            </div>

            {/* Opportunities Cards */}
            <div className="space-y-5 mb-10">
                <h2 className="text-lg font-bold tracking-tight text-foreground">
                    Where These Skills Directly Apply
                </h2>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    {data.opportunities.map((opp) => (
                        <div
                            key={opp.id}
                            className="rounded-2xl border border-border bg-card p-5 flex flex-col justify-between transition-colors hover:bg-muted/20"
                        >
                            <div>
                                <span className="inline-block px-2.5 py-0.5 rounded text-[11px] font-medium border border-border bg-muted/60 text-muted-foreground mb-3">
                                    {opp.sector}
                                </span>
                                <h3 className="text-base font-semibold leading-snug mb-2 text-foreground">
                                    {opp.title}
                                </h3>
                                <p className="text-xs leading-relaxed text-muted-foreground mb-4">
                                    {opp.description}
                                </p>
                            </div>

                            <div className="pt-4 border-t border-border">
                                <div className="mb-3">
                                    <span className="text-[10px] font-medium text-muted-foreground block mb-1.5">
                                        Skills used
                                    </span>
                                    <div className="flex flex-wrap gap-1">
                                        {opp.relevantSkills.map((skill) => (
                                            <span
                                                key={skill}
                                                className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-border bg-muted/50 text-muted-foreground"
                                            >
                                                {skill}
                                            </span>
                                        ))}
                                    </div>
                                </div>
                                <div className="p-2.5 rounded-xl border border-border bg-muted/40 text-[11px] font-medium text-foreground flex items-start gap-1.5">
                                    <Lightbulb className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
                                    <span>{opp.actionPrompt}</span>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recommended Resources for Nigerian Undergraduates */}
            <div className="rounded-2xl border border-border bg-card p-6 mb-8">
                <h3 className="text-base font-semibold mb-3 text-foreground">
                    Recommended Open Datasets & Portals
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                    <div className="p-3.5 rounded-xl border border-border bg-muted/30">
                        <strong className="block text-sm font-medium mb-1 text-foreground">National Bureau of Statistics (NBS)</strong>
                        <p className="text-muted-foreground leading-relaxed mb-2">
                            Explore authentic Nigerian datasets covering CPI inflation, labor statistics, and state GDP figures.
                        </p>
                        <a
                            href="https://nigerianstat.gov.ng"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                        >
                            <span>Visit nigerianstat.gov.ng</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>

                    <div className="p-3.5 rounded-xl border border-border bg-muted/30">
                        <strong className="block text-sm font-medium mb-1 text-foreground">OpenIntro Statistics Free Portal</strong>
                        <p className="text-muted-foreground leading-relaxed mb-2">
                            Download free textbook PDFs, complete dataset CSVs, and video tutorials for further study.
                        </p>
                        <a
                            href="https://www.openintro.org"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 font-medium text-foreground hover:underline"
                        >
                            <span>Visit openintro.org</span>
                            <ExternalLink className="w-3 h-3" />
                        </a>
                    </div>
                </div>
            </div>

            {/* Return Button */}
            <div className="text-center">
                <button
                    type="button"
                    onClick={onBack}
                    className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-full text-sm font-medium bg-foreground text-background hover:opacity-85 transition-opacity cursor-pointer"
                >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Return to Course Dashboard</span>
                </button>
            </div>
        </div>
    );
}
