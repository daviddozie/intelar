"use client";

import React, { useState } from "react";
import type { LearningQuestion } from "@/lib/learning-types";
import { Check, X, Lightbulb, RotateCcw } from "lucide-react";

interface PracticeQuestionCardProps {
    question: LearningQuestion;
    questionIndex: number;
    totalQuestions: number;
    savedAnswer?: string;
    onAnswerSelected: (questionId: string, optionId: string) => void;
    onRetry?: (questionId: string) => void;
    theme?: "light" | "dark";
}

export default function PracticeQuestionCard({
    question,
    questionIndex,
    totalQuestions,
    savedAnswer,
    onAnswerSelected,
    onRetry,
    theme = "dark",
}: PracticeQuestionCardProps) {
    const [selectedOptionId, setSelectedOptionId] = useState<string | null>(savedAnswer || null);
    const [isSubmitted, setIsSubmitted] = useState<boolean>(Boolean(savedAnswer));
    const [showHint, setShowHint] = useState<boolean>(false);

    const isCorrect = selectedOptionId === question.correctOptionId;

    function handleOptionClick(optionId: string) {
        setSelectedOptionId(optionId);
        setIsSubmitted(true);
        onAnswerSelected(question.id, optionId);
    }

    function handleRetry() {
        setSelectedOptionId(null);
        setIsSubmitted(false);
        setShowHint(false);
        onRetry?.(question.id);
    }

    return (
        <fieldset className="rounded-2xl border border-border bg-card p-5 sm:p-6 transition-colors">
            {/* Header */}
            <legend className="sr-only">Question {questionIndex + 1} of {totalQuestions}: {question.prompt}</legend>
            <div className="flex items-center justify-between gap-2 mb-3">
                <span className="text-xs font-medium text-muted-foreground">
                    Question {questionIndex + 1} of {totalQuestions}
                </span>
                {isSubmitted && (
                    <span
                        role="status"
                        aria-live="polite"
                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-border bg-muted text-foreground"
                    >
                        {isCorrect ? (
                            <>
                                <Check className="w-3.5 h-3.5" />
                                <span>Correct</span>
                            </>
                        ) : (
                            <>
                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="text-muted-foreground">Try Again</span>
                            </>
                        )}
                    </span>
                )}
            </div>

            {/* Prompt */}
            <p className="text-sm sm:text-base font-medium leading-relaxed mb-4 text-neutral-900 dark:text-neutral-100">
                {question.prompt}
            </p>

            {/* Options */}
            <div className="space-y-2.5 mb-4">
                {question.options.map((option) => {
                    const isSelected = selectedOptionId === option.id;
                    const isOptionCorrect = option.id === question.correctOptionId;

                    let buttonClass = "border-border bg-card hover:bg-muted text-foreground";

                    if (isSubmitted) {
                        if (isSelected && isCorrect) {
                            buttonClass = "border-foreground/40 bg-foreground/10 text-foreground ring-1 ring-foreground/20 font-medium";
                        } else if (isSelected && !isCorrect) {
                            buttonClass = "border-border bg-muted/60 text-muted-foreground ring-1 ring-border";
                        } else if (isOptionCorrect && !isCorrect) {
                            buttonClass = "border-border bg-card text-muted-foreground";
                        }
                    }

                    return (
                        <button
                            key={option.id}
                            type="button"
                            aria-pressed={isSelected}
                            onClick={() => handleOptionClick(option.id)}
                            className={`w-full text-left p-3.5 sm:p-4 rounded-xl border text-sm transition-all flex items-start gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${buttonClass}`}
                        >
                            <span
                                className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-xs font-medium transition-colors ${
                                    isSelected
                                        ? isCorrect
                                            ? "border-foreground bg-foreground text-background"
                                            : "border-border bg-muted text-muted-foreground"
                                        : "border-border text-muted-foreground"
                                }`}
                            >
                                {isSelected ? (
                                    isCorrect ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />
                                ) : (
                                    <span className="w-1.5 h-1.5 rounded-full bg-transparent" />
                                )}
                            </span>
                            <span className="flex-1 leading-snug">{option.text}</span>
                        </button>
                    );
                })}
            </div>

            {/* Hint & Retry Toolbar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border text-xs">
                <div>
                    {!isSubmitted || !isCorrect ? (
                        <button
                            type="button"
                            onClick={() => setShowHint(!showHint)}
                            className="inline-flex items-center gap-1.5 font-medium text-muted-foreground hover:text-foreground hover:underline cursor-pointer py-1 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md"
                        >
                            <Lightbulb className="w-3.5 h-3.5" />
                            <span>{showHint ? "Hide hint" : "Need a hint?"}</span>
                        </button>
                    ) : null}
                </div>

                {isSubmitted && !isCorrect && (
                    <button
                        type="button"
                        onClick={handleRetry}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-medium border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retry Question (Unlimited)</span>
                    </button>
                )}
            </div>

            {/* Hint Box */}
            {showHint && (
                <div
                    role="note"
                    className="mt-3 p-3.5 rounded-xl border border-border bg-muted/60 text-xs leading-relaxed text-foreground"
                >
                    <strong className="font-semibold block mb-1">Concept Hint:</strong>
                    {question.hint}
                </div>
            )}

            {/* Explanation Box */}
            {isSubmitted && (
                <div
                    role="alert"
                    className="mt-3 p-4 rounded-xl border border-border bg-muted/40 text-xs sm:text-sm leading-relaxed transition-all text-foreground"
                >
                    <strong className="font-semibold block mb-1">
                        {isCorrect ? "Well done! Explanation:" : "Concept Review:"}
                    </strong>
                    {question.explanation}
                </div>
            )}
        </fieldset>
    );
}
