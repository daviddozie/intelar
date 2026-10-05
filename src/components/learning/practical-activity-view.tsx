"use client";

import React, { useState } from "react";
import type { PracticalActivity } from "@/lib/learning-types";
import { ArrowLeft, ArrowRight, Check, X, Sparkles, Lightbulb } from "lucide-react";

interface PracticalActivityViewProps {
    activity: PracticalActivity;
    savedAnswers?: Record<string, string | number>;
    isCompleted?: boolean;
    onSaveTaskAnswer: (taskId: string, answer: string | number) => void;
    onMarkCompleted: () => void;
    onBack: () => void;
    theme?: "light" | "dark";
}

export default function PracticalActivityView({
    activity,
    savedAnswers = {},
    isCompleted = false,
    onSaveTaskAnswer,
    onMarkCompleted,
    onBack,
    theme = "dark",
}: PracticalActivityViewProps) {
    const isDark = theme === "dark";
    const answers = savedAnswers;
    const [openHints, setOpenHints] = useState<Record<string, boolean>>({});

    function handleSelectOption(taskId: string, optionId: string) {
        onSaveTaskAnswer(taskId, optionId);
    }

    const allTasksCompleted = activity.tasks.every(
        (task) => answers[task.id] === task.correctAnswer
    );

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
                {isCompleted && (
                    <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-medium border border-border bg-muted text-foreground">
                        <Check className="w-3.5 h-3.5" />
                        <span>Activity Completed</span>
                    </span>
                )}
            </div>

            {/* Title & Scenario */}
            <div className="mb-8">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border bg-muted/60 text-muted-foreground mb-3">
                    <Sparkles className="w-3 h-3" />
                    <span>Hands-On Statistics Lab</span>
                </div>
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mb-3 text-foreground">
                    {activity.title}
                </h1>
                <p className="text-sm sm:text-base leading-relaxed text-muted-foreground">
                    {activity.scenario}
                </p>
            </div>

            {/* Synthetic Dataset Table */}
            <div
                className="rounded-2xl border border-border bg-card p-5 sm:p-6 mb-8 transition-colors"
            >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
                    <div>
                        <h2 className="text-base font-semibold text-foreground">
                            {activity.datasetTitle}
                        </h2>
                        <p className="text-xs text-muted-foreground">
                            10 invented campus travel observations for practice (Sample Size n = 10)
                        </p>
                    </div>
                    <span className="inline-block px-2.5 py-1 rounded text-xs font-mono border border-border bg-muted/50 text-muted-foreground self-start sm:self-auto">
                        Currency: Nigerian Naira (₦)
                    </span>
                </div>

                <div className="sm:hidden text-[11px] text-muted-foreground mb-2 flex items-center gap-1">
                    <ArrowRight className="w-3.5 h-3.5" />
                    <span>Scroll horizontally to view full routes and fares</span>
                </div>

                <div className="overflow-x-auto -mx-2 sm:mx-0">
                    <table className="w-full text-left border-collapse text-xs sm:text-sm">
                        <thead>
                            <tr className={`border-b ${isDark ? "border-white/10 text-neutral-400" : "border-black/10 text-neutral-500"}`}>
                                <th className="py-2.5 px-3 font-semibold">Route</th>
                                <th className="py-2.5 px-3 font-semibold">Transit Mode</th>
                                <th className="py-2.5 px-3 font-semibold text-right">Cost (₦)</th>
                                <th className="py-2.5 px-3 font-semibold text-right">Distance (km)</th>
                                <th className="py-2.5 px-3 font-semibold hidden md:table-cell">Notes</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-inherit">
                            {activity.dataset.map((row) => (
                                <tr
                                    key={row.id}
                                    className={`transition-colors ${
                                        row.costNaira >= 1000
                                            ? isDark ? "bg-amber-500/10" : "bg-amber-50"
                                            : isDark ? "hover:bg-white/5" : "hover:bg-neutral-50"
                                    }`}
                                >
                                    <td className="py-2.5 px-3 font-medium text-neutral-900 dark:text-neutral-100">
                                        {row.route}
                                    </td>
                                    <td className="py-2.5 px-3 text-neutral-600 dark:text-neutral-300">
                                        {row.mode}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono font-semibold text-neutral-900 dark:text-white">
                                        ₦{row.costNaira.toLocaleString()}
                                    </td>
                                    <td className="py-2.5 px-3 text-right font-mono text-neutral-600 dark:text-neutral-300">
                                        {row.distanceKm.toFixed(1)} km
                                    </td>
                                    <td className="py-2.5 px-3 text-xs text-neutral-500 dark:text-neutral-400 hidden md:table-cell">
                                        {row.notes}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>

                <div className="mt-4 pt-3 border-t border-inherit flex flex-wrap items-center justify-between text-xs text-neutral-500 dark:text-neutral-400 gap-2">
                    <span>Sorted dataset: ₦150, ₦200, ₦200, ₦200, ₦250, ₦250, ₦300, ₦350, ₦500, ₦1,200</span>
                    <span>Sample Sum: ₦3,600 | Arithmetic Mean: ₦360</span>
                </div>
            </div>

            {/* Practical Tasks */}
            <div className="space-y-6 mb-10">
                <h2 className="text-lg font-bold tracking-tight">
                    Analysis Tasks
                </h2>

                {activity.tasks.map((task, index) => {
                    const selected = answers[task.id];
                    const isAnswered = selected !== undefined;
                    const isCorrect = selected === task.correctAnswer;
                    const showHint = Boolean(openHints[task.id]);

                    return (
                        <fieldset
                            key={task.id}
                            className="rounded-2xl border border-border bg-card p-5 sm:p-6 transition-colors"
                        >
                            <legend className="sr-only">Task {index + 1}: {task.prompt}</legend>
                            <div className="flex items-center justify-between gap-2 mb-3">
                                <span className="text-xs font-medium text-muted-foreground">
                                    Task {index + 1} of {activity.tasks.length}
                                </span>
                                {isAnswered && (
                                    <span
                                        role="status"
                                        aria-live="polite"
                                        className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium border border-border bg-muted text-foreground"
                                    >
                                        {isCorrect ? (
                                            <>
                                                <Check className="w-3.5 h-3.5" />
                                                <span>Verified</span>
                                            </>
                                        ) : (
                                            <>
                                                <X className="w-3.5 h-3.5 text-muted-foreground" />
                                                <span className="text-muted-foreground">Review Answer</span>
                                            </>
                                        )}
                                    </span>
                                )}
                            </div>

                            <p className="text-sm sm:text-base font-medium leading-relaxed mb-4 text-foreground">
                                {task.prompt}
                            </p>

                            {task.options && (
                                <div className="space-y-2.5 mb-4">
                                    {task.options.map((opt) => {
                                        const isOptSelected = selected === opt.id;
                                        let btnClass = "border-border bg-card hover:bg-muted text-foreground";

                                        if (isAnswered) {
                                            if (isOptSelected && isCorrect) {
                                                btnClass = "border-foreground/40 bg-foreground/10 text-foreground ring-1 ring-foreground/20 font-medium";
                                            } else if (isOptSelected && !isCorrect) {
                                                btnClass = "border-border bg-muted/60 text-muted-foreground ring-1 ring-border";
                                            }
                                        }

                                        return (
                                            <button
                                                key={opt.id}
                                                type="button"
                                                aria-pressed={isOptSelected}
                                                onClick={() => handleSelectOption(task.id, opt.id)}
                                                className={`w-full text-left p-3.5 sm:p-4 rounded-xl border text-sm transition-all flex items-start gap-3 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${btnClass}`}
                                            >
                                                <span
                                                    className={`mt-0.5 w-5 h-5 rounded-full border flex items-center justify-center shrink-0 text-xs font-medium transition-colors ${
                                                        isOptSelected
                                                            ? isCorrect
                                                                ? "border-foreground bg-foreground text-background"
                                                                : "border-border bg-muted text-muted-foreground"
                                                            : "border-border text-muted-foreground"
                                                    }`}
                                                >
                                                    {isOptSelected ? (isCorrect ? <Check className="w-3 h-3" /> : <X className="w-3 h-3" />) : ""}
                                                </span>
                                                <span className="flex-1 leading-snug">{opt.text}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            )}

                            {/* Hint button */}
                            <div className="flex items-center justify-between text-xs pt-2 border-t border-border">
                                <button
                                    type="button"
                                    onClick={() => setOpenHints((h) => ({ ...h, [task.id]: !h[task.id] }))}
                                    className="inline-flex items-center gap-1.5 text-muted-foreground hover:text-foreground hover:underline font-medium cursor-pointer"
                                >
                                    <Lightbulb className="w-3.5 h-3.5" />
                                    <span>{showHint ? "Hide hint" : "Need a hint?"}</span>
                                </button>
                            </div>

                            {showHint && (
                                <div
                                    role="note"
                                    className="mt-3 p-3 rounded-xl border border-border bg-muted/60 text-xs text-foreground leading-relaxed"
                                >
                                    <strong>Hint: </strong>{task.hint}
                                </div>
                            )}

                            {isAnswered && (
                                <div
                                    role="alert"
                                    className="mt-3 p-3.5 rounded-xl border border-border bg-muted/40 text-xs sm:text-sm text-foreground leading-relaxed"
                                >
                                    <strong>{isCorrect ? "Calculation Confirmed: " : "Review: "}</strong>
                                    {task.explanation}
                                </div>
                            )}
                        </fieldset>
                    );
                })}
            </div>

            {/* Bottom completion card */}
            <div
                className="rounded-2xl border border-border bg-card p-6 text-center"
            >
                <div className="inline-flex items-center justify-center gap-2 mb-2">
                    {allTasksCompleted && <Sparkles className="w-5 h-5 text-foreground" />}
                    <h3 className="text-base font-semibold text-foreground">
                        {allTasksCompleted
                            ? "All Analysis Tasks Correctly Solved!"
                            : "Complete All Tasks to Finalize Practical Activity"}
                    </h3>
                </div>
                <p className="text-xs text-muted-foreground mb-4 max-w-lg mx-auto">
                    You have verified that the sample median (₦250) represents typical campus commute spending much better than the skewed mean (₦360), and confirmed statistical outlier thresholds using the 1.5 × IQR rule.
                </p>
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <button
                        type="button"
                        onClick={onMarkCompleted}
                        disabled={!allTasksCompleted}
                        className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all ${
                            allTasksCompleted
                                ? "bg-foreground text-background hover:opacity-85 cursor-pointer"
                                : "border border-border bg-muted text-muted-foreground cursor-not-allowed opacity-60"
                        }`}
                    >
                        {isCompleted ? "Save & Return to Dashboard" : "Mark Practical as Complete"}
                    </button>
                    <button
                        type="button"
                        onClick={onBack}
                        className="px-4 py-2.5 rounded-xl text-sm font-medium border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer"
                    >
                        Return to Dashboard
                    </button>
                </div>
            </div>
        </div>
    );
}
