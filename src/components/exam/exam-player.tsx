"use client";

import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import {
    Clock,
    Flag,
    CheckCircle2,
    AlertTriangle,
    ChevronLeft,
    ChevronRight,
    Loader2,
    Check,
    X,
} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import type { ExamAttempt, ExamPrep, ExamQuestion } from "@/lib/exam-types";

interface ExamPlayerProps {
    exam: ExamPrep;
    onComplete: (attempt: ExamAttempt) => void;
    onExit: () => void;
    theme?: "light" | "dark";
}

export default function ExamPlayer({
    exam,
    onComplete,
    onExit,
}: ExamPlayerProps) {
    const sessionKey = `gluk_exam_active_${exam.id}`;

    const initialSaved = useMemo(() => {
        if (typeof window === "undefined") return null;
        try {
            const raw = sessionStorage.getItem(sessionKey);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }, [sessionKey]);

    const [currentIndex, setCurrentIndex] = useState<number>(() => {
        if (initialSaved && typeof initialSaved.currentIndex === "number") {
            return Math.min(Math.max(0, initialSaved.currentIndex), Math.max(0, exam.questions.length - 1));
        }
        return 0;
    });
    const [answers, setAnswers] = useState<Record<string, number>>(() => initialSaved?.answers ?? {});
    const [flagged, setFlagged] = useState<Set<string>>(() => new Set(initialSaved?.flagged ?? []));

    // Timer setup (countdown in seconds)
    const initialSeconds = exam.timeLimitMinutes * 60;
    const [secondsLeft, setSecondsLeft] = useState<number>(() => {
        if (initialSaved && typeof initialSaved.secondsLeft === "number" && initialSaved.secondsLeft > 0) {
            return initialSaved.secondsLeft;
        }
        return initialSeconds;
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showSubmitModal, setShowSubmitModal] = useState(false);

    // Save in-progress exam answers & timer to sessionStorage
    useEffect(() => {
        if (typeof window === "undefined") return;
        try {
            sessionStorage.setItem(
                sessionKey,
                JSON.stringify({
                    currentIndex,
                    answers,
                    flagged: Array.from(flagged),
                    secondsLeft,
                })
            );
        } catch {
            // Ignore storage quota or disabled errors
        }
    }, [sessionKey, currentIndex, answers, flagged, secondsLeft]);

    const questions: ExamQuestion[] = exam.questions;
    const currentQ = questions[currentIndex];
    const totalQuestions = questions.length;

    const answeredCount = Object.keys(answers).length;
    const unansweredCount = totalQuestions - answeredCount;

    const selectOption = useCallback(
        (optionIndex: number) => {
            if (!currentQ) return;
            setAnswers((prev) => ({
                ...prev,
                [currentQ.id]: optionIndex,
            }));
        },
        [currentQ]
    );

    const toggleFlag = useCallback((questionId: string) => {
        setFlagged((prev) => {
            const next = new Set(prev);
            if (next.has(questionId)) {
                next.delete(questionId);
            } else {
                next.add(questionId);
            }
            return next;
        });
    }, []);

    const handleFinalSubmit = useCallback(
        async (status: "completed" | "timed-out" = "completed") => {
            if (isSubmitting) return;
            setIsSubmitting(true);
            setShowSubmitModal(false);

            const timeSpentSeconds = Math.max(1, initialSeconds - secondsLeft);

            try {
                const res = await fetch(`/api/exams/${exam.id}/attempt`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        answers,
                        flaggedQuestions: Array.from(flagged),
                        timeSpentSeconds,
                        status,
                    }),
                });

                if (!res.ok) {
                    throw new Error("Failed to record exam attempt");
                }

                try {
                    sessionStorage.removeItem(sessionKey);
                } catch {
                    // ignore
                }

                const data = await res.json();
                onComplete(data.attempt);
            } catch (err) {
                console.error("Submission error:", err);
                alert("Could not submit exam attempt. Please check your connection and try again.");
                setIsSubmitting(false);
            }
        },
        [isSubmitting, initialSeconds, secondsLeft, exam.id, answers, flagged, sessionKey, onComplete]
    );

    // Start timer countdown
    useEffect(() => {
        if (secondsLeft <= 0) {
            handleFinalSubmit("timed-out");
            return;
        }

        const timer = setInterval(() => {
            setSecondsLeft((prev) => {
                if (prev <= 1) {
                    clearInterval(timer);
                    return 0;
                }
                return prev - 1;
            });
        }, 1000);

        return () => clearInterval(timer);
    }, [secondsLeft, handleFinalSubmit]);

    // Format time display MM:SS or HH:MM:SS
    function formatTime(totalSec: number): string {
        const hrs = Math.floor(totalSec / 3600);
        const mins = Math.floor((totalSec % 3600) / 60);
        const secs = totalSec % 60;

        if (hrs > 0) {
            return `${hrs}:${mins < 10 ? "0" : ""}${mins}:${secs < 10 ? "0" : ""}${secs}`;
        }
        return `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }

    // Timer urgency styling
    const isUnderFiveMins = secondsLeft <= 300;
    const isUnderOneMin = secondsLeft <= 60;

    const timerColorClass = isUnderOneMin
        ? "border-red-500 bg-red-500/10 text-red-400 animate-pulse font-bold"
        : isUnderFiveMins
        ? "border-amber-500 bg-amber-500/10 text-amber-400 font-semibold"
        : "border-border bg-card text-foreground";

    // Keyboard navigation (A, B, C, D or 1, 2, 3, 4)
    useEffect(() => {
        function handleKeyDown(e: KeyboardEvent) {
            if (showSubmitModal || isSubmitting) return;

            const key = e.key.toLowerCase();
            if (key === "1" || key === "a") selectOption(0);
            else if (key === "2" || key === "b") selectOption(1);
            else if (key === "3" || key === "c") selectOption(2);
            else if (key === "4" || key === "d") selectOption(3);
            else if (key === "arrowright" || key === "n") {
                if (currentIndex < totalQuestions - 1) setCurrentIndex((i) => i + 1);
            } else if (key === "arrowleft" || key === "p") {
                if (currentIndex > 0) setCurrentIndex((i) => i - 1);
            } else if (key === "f") {
                if (currentQ) toggleFlag(currentQ.id);
            }
        }

        window.addEventListener("keydown", handleKeyDown);
        return () => window.removeEventListener("keydown", handleKeyDown);
    }, [currentIndex, currentQ, showSubmitModal, isSubmitting, totalQuestions, selectOption, toggleFlag]);

    function handleExit() {
        try {
            sessionStorage.removeItem(sessionKey);
        } catch {
            // ignore
        }
        onExit();
    }

    const progressPct = totalQuestions > 0 ? (answeredCount / totalQuestions) * 100 : 0;
    const optionLetters = ["A", "B", "C", "D"];

    return (
        <div className="flex flex-col h-full w-full bg-background select-none">
            {/* Top Exam Navigation Bar */}
            <header className="shrink-0 border-b border-border bg-card/60 backdrop-blur px-4 py-3 sm:px-8 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                    <button
                        type="button"
                        onClick={handleExit}
                        className="p-1.5 rounded-lg border border-border hover:bg-muted text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                        title="Exit Exam"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="min-w-0">
                        <h2 className="text-sm font-semibold truncate text-foreground">
                            {exam.title}
                        </h2>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                            <span>{exam.courseName || "General Exam"}</span>
                            <span>•</span>
                            <span className="capitalize">{exam.difficulty}</span>
                        </div>
                    </div>
                </div>

                {/* Center / Right: Countdown Timer and Submit */}
                <div className="flex items-center gap-3">
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs sm:text-sm font-mono transition-colors ${timerColorClass}`}>
                        <Clock className="w-3.5 h-3.5" />
                        <span>{formatTime(secondsLeft)}</span>
                    </div>

                    <button
                        type="button"
                        onClick={() => setShowSubmitModal(true)}
                        disabled={isSubmitting}
                        className="rounded-full bg-foreground text-background px-4 py-1.5 text-xs sm:text-sm font-medium hover:opacity-90 disabled:opacity-50 cursor-pointer transition-all shadow-sm"
                    >
                        {isSubmitting ? (
                            <span className="flex items-center gap-1.5">
                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                <span>Grading…</span>
                            </span>
                        ) : (
                            "Submit Exam"
                        )}
                    </button>
                </div>
            </header>

            {/* Progress indicator bar */}
            <div className="w-full bg-muted/40 h-1">
                <div
                    className="bg-foreground h-1 transition-all duration-300"
                    style={{ width: `${progressPct}%` }}
                />
            </div>

            {/* Main Area: Question View & Palette */}
            <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-0">
                {/* Left/Main Question Area */}
                <main className="flex-1 overflow-y-auto p-5 sm:p-8 flex flex-col justify-between max-w-3xl mx-auto w-full">
                    {currentQ && (
                        <div className="space-y-6">
                            {/* Question Header */}
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                    <span className="text-xs font-medium text-muted-foreground">
                                        Question {currentIndex + 1} of {totalQuestions}
                                    </span>
                                    {answers[currentQ.id] !== undefined && (
                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] bg-emerald-500/10 text-emerald-400 font-medium">
                                            <Check className="w-3 h-3" />
                                            <span>Answered</span>
                                        </span>
                                    )}
                                </div>

                                <button
                                    type="button"
                                    onClick={() => toggleFlag(currentQ.id)}
                                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium cursor-pointer transition-colors border ${
                                        flagged.has(currentQ.id)
                                            ? "border-amber-500/40 bg-amber-500/15 text-amber-400"
                                            : "border-border bg-card text-muted-foreground hover:text-foreground"
                                    }`}
                                >
                                    <Flag className={`w-3.5 h-3.5 ${flagged.has(currentQ.id) ? "fill-amber-400" : ""}`} />
                                    <span>{flagged.has(currentQ.id) ? "Flagged" : "Flag for Review"}</span>
                                </button>
                            </div>

                            {/* Question Prompt */}
                            <div className="text-base sm:text-lg font-medium text-foreground leading-relaxed">
                                {currentQ.question}
                            </div>

                            {/* Options List */}
                            <div className="space-y-3 pt-2">
                                {currentQ.options.map((optionText, optIdx) => {
                                    const isSelected = answers[currentQ.id] === optIdx;
                                    return (
                                        <button
                                            key={optIdx}
                                            type="button"
                                            onClick={() => selectOption(optIdx)}
                                            className={`w-full flex items-start gap-3.5 p-4 rounded-xl border text-left text-sm transition-all cursor-pointer ${
                                                isSelected
                                                    ? "border-foreground bg-foreground/10 text-foreground ring-1 ring-foreground"
                                                    : "border-border bg-card hover:bg-muted/40 text-foreground/80 hover:text-foreground"
                                            }`}
                                        >
                                            <span
                                                className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 transition-colors ${
                                                    isSelected
                                                        ? "bg-foreground text-background"
                                                        : "bg-muted text-muted-foreground"
                                                }`}
                                            >
                                                {optionLetters[optIdx]}
                                            </span>
                                            <span className="flex-1 leading-snug pt-0.5">{optionText}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Bottom Navigation Buttons */}
                    <div className="pt-8 mt-6 border-t border-border flex items-center justify-between gap-3">
                        <button
                            type="button"
                            onClick={() => setCurrentIndex((i) => Math.max(0, i - 1))}
                            disabled={currentIndex === 0}
                            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full border border-border bg-card text-xs sm:text-sm font-medium hover:bg-muted disabled:opacity-40 disabled:pointer-events-none cursor-pointer transition-colors"
                        >
                            <ChevronLeft className="w-4 h-4" />
                            <span>Previous</span>
                        </button>

                        <div className="text-xs text-muted-foreground hidden sm:block">
                            Tip: Press keys <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px]">A</kbd>-<kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px]">D</kbd> or <kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px]">1</kbd>-<kbd className="px-1.5 py-0.5 bg-muted rounded border text-[10px]">4</kbd> to answer
                        </div>

                        {currentIndex < totalQuestions - 1 ? (
                            <button
                                type="button"
                                onClick={() => setCurrentIndex((i) => Math.min(totalQuestions - 1, i + 1))}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-xs sm:text-sm font-medium hover:opacity-90 cursor-pointer transition-opacity"
                            >
                                <span>Next</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={() => setShowSubmitModal(true)}
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-foreground text-background text-xs sm:text-sm font-medium hover:opacity-90 cursor-pointer transition-opacity shadow-sm"
                            >
                                <span>Finish & Submit</span>
                                <CheckCircle2 className="w-4 h-4" />
                            </button>
                        )}
                    </div>
                </main>

                {/* Right / Sidebar Question Palette */}
                <aside className="w-full md:w-72 shrink-0 border-t md:border-t-0 md:border-l border-border bg-card/30 p-5 overflow-y-auto">
                    <div className="space-y-4">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-foreground">
                                Question palette
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                                {answeredCount}/{totalQuestions} Answered
                            </span>
                        </div>

                        {/* Status Legend */}
                        <div className="grid grid-cols-3 gap-2 text-[11px] text-muted-foreground">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded bg-foreground/20 border border-foreground" />
                                <span>Answered</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded border border-border bg-muted/40" />
                                <span>Unanswered</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded bg-amber-500/20 border border-amber-500" />
                                <span>Flagged</span>
                            </div>
                        </div>

                        {/* Grid of Question Numbers */}
                        <div className="grid grid-cols-5 gap-2 pt-2">
                            {questions.map((q, idx) => {
                                const isCurrent = currentIndex === idx;
                                const isAnswered = answers[q.id] !== undefined;
                                const isFlagged = flagged.has(q.id);

                                return (
                                    <button
                                        key={q.id}
                                        type="button"
                                        onClick={() => setCurrentIndex(idx)}
                                        className={`relative h-10 rounded-lg text-xs font-medium cursor-pointer transition-all flex items-center justify-center ${
                                            isCurrent
                                                ? "ring-2 ring-foreground font-bold"
                                                : ""
                                        } ${
                                            isFlagged
                                                ? "border-amber-500/60 bg-amber-500/15 text-amber-400"
                                                : isAnswered
                                                ? "bg-foreground/15 border-foreground/40 text-foreground"
                                                : "border-border bg-card/60 text-muted-foreground hover:bg-muted"
                                        } border`}
                                    >
                                        <span>{idx + 1}</span>
                                        {isFlagged && (
                                            <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400" />
                                        )}
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                </aside>
            </div>

            {/* Submission Confirmation Modal */}
            <Dialog open={showSubmitModal} onOpenChange={setShowSubmitModal}>
                <DialogContent className="sm:max-w-md p-6">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold">
                            Submit Examination?
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground pt-1">
                            Please confirm that you want to complete and submit your exam paper.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-2 my-2 text-xs">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Total Questions:</span>
                            <span className="font-semibold text-foreground">{totalQuestions}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Answered:</span>
                            <span className="font-semibold text-emerald-400">{answeredCount}</span>
                        </div>
                        {unansweredCount > 0 && (
                            <div className="flex justify-between">
                                <span className="text-muted-foreground">Unanswered:</span>
                                <span className="font-semibold text-amber-400">{unansweredCount}</span>
                            </div>
                        )}
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">Time Remaining:</span>
                            <span className="font-semibold text-foreground font-mono">{formatTime(secondsLeft)}</span>
                        </div>
                    </div>

                    {unansweredCount > 0 && (
                        <p className="text-[11px] text-amber-400 flex items-center gap-1.5">
                            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                            <span>You have {unansweredCount} unanswered questions. Unanswered questions count as 0 marks.</span>
                        </p>
                    )}

                    <DialogFooter className="gap-2 sm:gap-0 pt-3">
                        <button
                            type="button"
                            onClick={() => setShowSubmitModal(false)}
                            className="px-4 py-2 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground"
                        >
                            Continue Working
                        </button>
                        <button
                            type="button"
                            onClick={() => handleFinalSubmit("completed")}
                            disabled={isSubmitting}
                            className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2 text-xs font-medium hover:opacity-90 disabled:opacity-50"
                        >
                            {isSubmitting ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Grading…</span>
                                </>
                            ) : (
                                "Confirm & Submit"
                            )}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
