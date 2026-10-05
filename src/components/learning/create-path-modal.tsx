"use client";

import React, { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";
import type { LearningPath } from "@/lib/learning-types";
import { FileIcon } from "@public/svg/icon";
import {
    Sparkles,
    AlertTriangle,
    Check,
    Plus,
    X,
    ArrowRight,
    Loader2,
} from "lucide-react";

interface UserResource {
    name: string;
    url: string;
    type: string;
}

interface CreatePathModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (path: LearningPath) => void;
    theme?: "light" | "dark";
}

export default function CreatePathModal({
    isOpen,
    onClose,
    onSuccess,
    theme = "dark",
}: CreatePathModalProps) {
    const isDark = theme === "dark";

    const [resources, setResources] = useState<UserResource[]>([]);
    const [isLoadingResources, setIsLoadingResources] = useState(false);
    const [selectedUrls, setSelectedUrls] = useState<string[]>([]);
    const [goal, setGoal] = useState("");
    const [title, setTitle] = useState("");
    const [language, setLanguage] = useState<"en" | "fr">("en");

    // Outline items (3 to 5 lessons)
    const [outlineLessons, setOutlineLessons] = useState<Array<{ title: string; summary?: string }>>([
        { title: "Foundations and Core Definitions" },
        { title: "Key Principles and Analysis Techniques" },
        { title: "Practical Application and Review" },
    ]);

    const [isGenerating, setIsGenerating] = useState(false);
    const [isSuggestingOutline, setIsSuggestingOutline] = useState(false);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Fetch user's uploaded resources
    useEffect(() => {
        if (!isOpen) return;
        setIsLoadingResources(true);
        setErrorMessage(null);

        fetch("/api/resources")
            .then((res) => {
                if (!res.ok) throw new Error("Could not load resources");
                return res.json();
            })
            .then((data) => {
                const list = (data.resources || []) as UserResource[];
                setResources(list);
                if (list.length > 0) {
                    setSelectedUrls((prev) => (prev.length === 0 ? [list[0].url] : prev));
                }
            })
            .catch(() => {
                // If offline or resources load fails
            })
            .finally(() => setIsLoadingResources(false));
    }, [isOpen]);

    function toggleResource(url: string) {
        setErrorMessage(null);
        if (selectedUrls.includes(url)) {
            setSelectedUrls(selectedUrls.filter((u) => u !== url));
        } else {
            if (selectedUrls.length >= 3) {
                setErrorMessage("You can select a maximum of 3 resources.");
                return;
            }
            setSelectedUrls([...selectedUrls, url]);
        }
    }

    async function handleSuggestOutline() {
        if (selectedUrls.length === 0) {
            setErrorMessage("Please select at least 1 resource above to suggest an outline.");
            return;
        }

        setIsSuggestingOutline(true);
        setErrorMessage(null);

        try {
            const res = await fetch("/api/learning/paths/outline", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    goal: goal.trim(),
                    language,
                    resourceUrls: selectedUrls,
                }),
            });

            const data = await res.json();
            if (!res.ok) {
                throw new Error(data.error || "Could not generate outline");
            }

            if (Array.isArray(data.lessons) && data.lessons.length >= 3) {
                setOutlineLessons(data.lessons.slice(0, 5));
            }
            if (!goal.trim() && data.suggestedGoal) {
                setGoal(data.suggestedGoal);
            }
            if (!title.trim() && data.suggestedTitle) {
                setTitle(data.suggestedTitle);
            }
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to suggest outline");
        } finally {
            setIsSuggestingOutline(false);
        }
    }

    function handleAddLesson() {
        if (outlineLessons.length >= 5) {
            setErrorMessage("An outline cannot have more than 5 lessons.");
            return;
        }
        setErrorMessage(null);
        setOutlineLessons([...outlineLessons, { title: `Lesson ${outlineLessons.length + 1}` }]);
    }

    function handleRemoveLesson(index: number) {
        if (outlineLessons.length <= 3) {
            setErrorMessage("An outline requires at least 3 lessons.");
            return;
        }
        setErrorMessage(null);
        setOutlineLessons(outlineLessons.filter((_, idx) => idx !== index));
    }

    function handleUpdateLessonTitle(index: number, newTitle: string) {
        setOutlineLessons(
            outlineLessons.map((l, idx) => (idx === index ? { ...l, title: newTitle } : l))
        );
    }

    async function handleGenerateStudyPath() {
        setErrorMessage(null);

        if (selectedUrls.length === 0) {
            setErrorMessage("Please select at least 1 authorized resource.");
            return;
        }
        if (selectedUrls.length > 3) {
            setErrorMessage("You can select up to 3 authorized resources.");
            return;
        }
        if (!goal.trim()) {
            setErrorMessage("Please define your study goal.");
            return;
        }
        if (outlineLessons.length < 3 || outlineLessons.length > 5) {
            setErrorMessage("A study path requires between 3 and 5 lessons.");
            return;
        }
        if (outlineLessons.some((l) => !l.title.trim())) {
            setErrorMessage("All lessons in the outline must have a title.");
            return;
        }

        setIsGenerating(true);

        try {
            // Step 1: Create draft outline
            const createRes = await fetch("/api/learning/paths", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    title: title.trim() || outlineLessons[0].title,
                    goal: goal.trim(),
                    language,
                    resourceUrls: selectedUrls,
                    lessons: outlineLessons.map((l) => ({ title: l.title.trim() })),
                }),
            });

            const createData = await createRes.json();
            if (!createRes.ok) {
                throw new Error(createData.error || "Failed to create study path outline");
            }

            const createdPath = createData.path as LearningPath;

            // Step 2: Generate complete lessons with verified source citations
            const genRes = await fetch(`/api/learning/paths/${createdPath.id}/generate`, {
                method: "POST",
            });

            const genData = await genRes.json();
            if (!genRes.ok) {
                throw new Error(genData.error || "Failed to generate grounded lessons");
            }

            onSuccess(genData.path);
            onClose();
        } catch (err: unknown) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to generate study path");
        } finally {
            setIsGenerating(false);
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => { if (!open && !isGenerating) onClose(); }}>
            <DialogContent
                showCloseButton={false}
                className={`sm:max-w-2xl max-h-[90vh] overflow-y-auto p-5 sm:p-6 border rounded-2xl shadow-2xl transition-all ${
                    isDark ? "bg-[#18181b] border-white/10 text-white" : "bg-white border-black/10 text-neutral-900"
                }`}
            >
                {/* Header */}
                <div className="flex items-start justify-between gap-4 mb-4">
                    <div>
                        <DialogTitle className="text-xl font-bold tracking-tight">
                            Create Personal Study Path
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-1">
                            Turn up to three authorized resources into structured lessons with citations and practice questions.
                        </DialogDescription>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isGenerating}
                        aria-label="Close dialog"
                        className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                        <X className="w-4 h-4" />
                    </button>
                </div>

                {errorMessage && (
                    <div role="alert" className="p-3 mb-4 rounded-lg text-xs bg-destructive/10 border border-destructive/20 text-destructive flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-destructive mt-0.5" />
                        <span>{errorMessage}</span>
                    </div>
                )}

                {/* Section 1: Select Resources */}
                <div className="mb-5 space-y-2">
                    <label className="text-xs font-semibold text-foreground">
                        1. Select authorized resources (1 to 3)
                    </label>

                    {isLoadingResources ? (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {[1, 2, 3, 4].map((i) => (
                                <div
                                    key={i}
                                    className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-muted/20 animate-pulse"
                                >
                                    <div className="flex items-center gap-2.5 min-w-0">
                                        <div className="w-4 h-4 rounded bg-muted-foreground/20 shrink-0" />
                                        <div
                                            className="h-3 rounded bg-muted-foreground/20"
                                            style={{ width: `${80 + (i * 35) % 65}px` }}
                                        />
                                    </div>
                                    <div className="w-4 h-4 rounded bg-muted-foreground/20 shrink-0" />
                                </div>
                            ))}
                        </div>
                    ) : resources.length === 0 ? (
                        <p className="text-xs text-muted-foreground py-2">
                            No uploaded resources found. Upload lecture slides, PDFs, or notes in Resources first.
                        </p>
                    ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-0.5">
                            {resources.map((res) => {
                                const isSelected = selectedUrls.includes(res.url);
                                return (
                                    <button
                                        key={res.url}
                                        type="button"
                                        onClick={() => toggleResource(res.url)}
                                        disabled={isGenerating || isSuggestingOutline}
                                        className={`p-2.5 rounded-lg border text-left text-xs transition-colors flex items-center justify-between cursor-pointer disabled:cursor-not-allowed ${
                                            isSelected
                                                ? "border-foreground bg-muted font-medium text-foreground shadow-xs"
                                                : "border-border bg-card hover:bg-muted/60 text-foreground"
                                        }`}
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0 pr-2">
                                            <FileIcon fileName={res.name} fileType={res.type} size={22} className="shrink-0" />
                                            <span className="truncate">{res.name}</span>
                                        </div>
                                        <span className="shrink-0">
                                            {isSelected ? (
                                                <Check className="w-3.5 h-3.5 text-foreground" />
                                            ) : (
                                                <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                                            )}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Section 2: Details & Inputs */}
                <div className="mb-5 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <div className="sm:col-span-2 space-y-1.5">
                            <label className="text-xs font-medium text-foreground">Study path title (optional)</label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                disabled={isGenerating || isSuggestingOutline}
                                placeholder="e.g. Advanced Estimation & Modeling"
                                className="w-full h-9 rounded-sm px-3 py-2 text-xs border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-medium text-foreground">Language</label>
                            <Select
                                value={language}
                                onValueChange={(val) => setLanguage(val as "en" | "fr")}
                                disabled={isGenerating || isSuggestingOutline}
                            >
                                <SelectTrigger className="w-full h-9 rounded-sm border-border bg-card text-xs focus:ring-1 focus:ring-ring disabled:opacity-60 disabled:cursor-not-allowed">
                                    <SelectValue placeholder="Language" />
                                </SelectTrigger>
                                <SelectContent className="z-[60]">
                                    <SelectItem value="en">English</SelectItem>
                                    <SelectItem value="fr">Français</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>

                    <div className="space-y-1.5">
                        <label className="text-xs font-medium text-foreground">Study goal or learning objective *</label>
                        <input
                            type="text"
                            value={goal}
                            onChange={(e) => setGoal(e.target.value)}
                            disabled={isGenerating || isSuggestingOutline}
                            placeholder="e.g. Master discrete probability and hypothesis testing"
                            className="w-full h-9 rounded-sm px-3 py-2 text-xs border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                        />
                    </div>
                </div>

                {/* Section 3: Editable Outline */}
                <div className="mb-6 space-y-2">
                    <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-foreground">
                            2. Review & edit outline (3 to 5 lessons)
                        </label>
                        {isSuggestingOutline ? (
                            <div
                                className="inline-flex items-center gap-1.5 text-xs select-none pointer-events-none"
                                role="status"
                                aria-live="polite"
                                aria-label="Analyzing documents"
                            >
                                <span className={`thinking-shine font-medium ${isDark ? "thinking-shine-dark" : "thinking-shine-light"}`}>
                                    Analyzing documents
                                </span>
                                <span className="inline-flex shrink-0 items-center gap-0.5 ml-0.5" aria-hidden="true">
                                    {[0, 1, 2].map((dot) => (
                                        <span
                                            key={dot}
                                            className={`w-1 h-1 rounded-full animate-bounce ${isDark ? "bg-white/60" : "bg-black/50"}`}
                                            style={{ animationDelay: `${dot * 140}ms` }}
                                        />
                                    ))}
                                </span>
                            </div>
                        ) : (
                            <button
                                type="button"
                                onClick={handleSuggestOutline}
                                disabled={isGenerating}
                                className="inline-flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground hover:underline font-medium cursor-pointer disabled:opacity-50 transition-colors"
                            >
                                <Sparkles className="w-3.5 h-3.5 text-foreground" />
                                <span>Suggest Outline</span>
                            </button>
                        )}
                    </div>

                    <div className="space-y-2">
                        {outlineLessons.map((lesson, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <span className="w-5 text-xs text-muted-foreground font-mono text-center shrink-0">
                                    {idx + 1}.
                                </span>
                                <input
                                    type="text"
                                    value={lesson.title}
                                    onChange={(e) => handleUpdateLessonTitle(idx, e.target.value)}
                                    disabled={isGenerating || isSuggestingOutline}
                                    placeholder={`Lesson ${idx + 1} topic`}
                                    className={`flex-1 h-9 rounded-sm px-3 py-2 text-xs border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-all ${
                                        isSuggestingOutline ? "opacity-60 cursor-not-allowed" : ""
                                    }`}
                                />
                                {outlineLessons.length > 3 && (
                                    <button
                                        type="button"
                                        onClick={() => handleRemoveLesson(idx)}
                                        disabled={isGenerating || isSuggestingOutline}
                                        title="Remove lesson"
                                        className="p-1.5 text-muted-foreground hover:text-destructive text-xs cursor-pointer rounded-sm hover:bg-muted/50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                                    >
                                        <X className="w-3.5 h-3.5" />
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>

                    {outlineLessons.length < 5 && (
                        <button
                            type="button"
                            onClick={handleAddLesson}
                            disabled={isGenerating || isSuggestingOutline}
                            className="inline-flex items-center gap-1 mt-2 text-xs text-muted-foreground hover:text-foreground font-medium cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Add another lesson (up to 5)</span>
                        </button>
                    )}
                </div>

                {/* Footer Buttons */}
                <div className="pt-4 border-t border-border flex items-center justify-between gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isGenerating || isSuggestingOutline}
                        className="px-4 py-2 rounded-sm text-xs font-medium border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Cancel
                    </button>

                    <button
                        type="button"
                        onClick={handleGenerateStudyPath}
                        disabled={isGenerating || isSuggestingOutline || selectedUrls.length === 0 || !goal.trim()}
                        className="inline-flex items-center gap-1.5 rounded-full bg-foreground px-5 py-2.5 text-xs font-medium text-background hover:opacity-85 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity cursor-pointer shadow-sm"
                    >
                        {isGenerating && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        <span>{isGenerating ? "Grounding & Validating Lessons…" : "Generate Study Path"}</span>
                        {!isGenerating && <ArrowRight className="w-3.5 h-3.5" />}
                    </button>
                </div>
            </DialogContent>
        </Dialog>
    );
}
