"use client";

import React, { useState } from "react";
import {
    RotateCcw,
    Plus,
    ChevronLeft,
    Check,
    X,
    Flag,
    BookOpen,
    HelpCircle,
} from "lucide-react";
import type { ExamAttempt, ExamPrep } from "@/lib/exam-types";

interface ExamResultsViewProps {
    exam: ExamPrep;
    attempt: ExamAttempt;
    onRetake: () => void;
    onCreateNew: () => void;
    onBackToDashboard: () => void;
    theme?: "light" | "dark";
}

type FilterTab = "all" | "incorrect" | "correct" | "flagged";

export default function ExamResultsView({
    exam,
    attempt,
    onRetake,
    onCreateNew,
    onBackToDashboard,
}: ExamResultsViewProps) {
    const [filter, setFilter] = useState<FilterTab>("all");

    const questions = exam.questions;
    const { score, totalQuestions, percentage, timeSpentSeconds, answers } = attempt;

    // Classification based on standard university grading
    const gradeInfo = (() => {
        if (percentage >= 70) {
            return {
                grade: "Distinction (First Class)",
                color: "text-emerald-400 border-emerald-500/30 bg-emerald-500/10",
                badge: "Outstanding Mastery",
                message: "Excellent performance! You demonstrate thorough mastery of this course material.",
            };
        }
        if (percentage >= 60) {
            return {
                grade: "Credit (Second Class Upper)",
                color: "text-blue-400 border-blue-500/30 bg-blue-500/10",
                badge: "Strong Understanding",
                message: "Good job! You have a solid grasp of the core concepts with room for polish.",
            };
        }
        if (percentage >= 50) {
            return {
                grade: "Pass (Second Class Lower)",
                color: "text-amber-400 border-amber-500/30 bg-amber-500/10",
                badge: "Adequate Passing",
                message: "You passed the benchmark, but review the explanations below before the real exam.",
            };
        }
        return {
            grade: "Revision Needed",
            color: "text-rose-400 border-rose-500/30 bg-rose-500/10",
            badge: "Needs Attention",
            message: "Focus on the highlighted questions below to strengthen foundational understanding.",
        };
    })();

    function formatTime(totalSec: number): string {
        const mins = Math.floor(totalSec / 60);
        const secs = totalSec % 60;
        return `${mins}m ${secs}s`;
    }

    const incorrectQuestions = questions.filter(
        (q) => answers[q.id] === undefined || answers[q.id] !== q.correctAnswer
    );
    const correctQuestions = questions.filter(
        (q) => answers[q.id] !== undefined && answers[q.id] === q.correctAnswer
    );
    const flaggedQuestions = questions.filter((q) => attempt.flaggedQuestions?.includes(q.id));

    const displayedQuestions = {
        all: questions,
        incorrect: incorrectQuestions,
        correct: correctQuestions,
        flagged: flaggedQuestions,
    }[filter];

    const optionLetters = ["A", "B", "C", "D"];

    return (
        <div className="w-full flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
            {/* Top Navigation Back */}
            <div className="flex items-center justify-between">
                <button
                    type="button"
                    onClick={onBackToDashboard}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground cursor-pointer transition-colors"
                >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Back to Exam Prep</span>
                </button>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={onRetake}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border bg-card text-xs font-medium hover:bg-muted cursor-pointer transition-colors"
                    >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Retake Exam</span>
                    </button>
                    <button
                        type="button"
                        onClick={onCreateNew}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 cursor-pointer transition-opacity"
                    >
                        <Plus className="w-3.5 h-3.5" />
                        <span>New Practice Exam</span>
                    </button>
                </div>
            </div>

            {/* Score Hero Summary Card */}
            <div className="p-6 sm:p-8 rounded-2xl border border-border bg-card shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className={`text-xs px-2.5 py-0.5 rounded-full border font-semibold ${gradeInfo.color}`}>
                                {gradeInfo.badge}
                            </span>
                            <span className="text-xs text-muted-foreground capitalize">
                                {exam.difficulty} Difficulty
                            </span>
                        </div>
                        <h1 className="text-xl sm:text-2xl font-bold text-foreground">
                            {exam.title}
                        </h1>
                        <p className="text-xs text-muted-foreground mt-1">
                            {exam.courseName ? `${exam.courseName} • ` : ""}Completed on {new Date(attempt.completedAt).toLocaleDateString()}
                        </p>
                    </div>

                    <div className="flex items-baseline gap-2 sm:text-right">
                        <span className="text-4xl sm:text-5xl font-extrabold text-foreground tracking-tight">
                            {percentage}%
                        </span>
                        <span className="text-sm font-medium text-muted-foreground">
                            ({score}/{totalQuestions})
                        </span>
                    </div>
                </div>

                <p className="text-xs sm:text-sm text-foreground/80 leading-relaxed border-t border-border pt-4">
                    {gradeInfo.message}
                </p>

                {/* Metrics Breakdown Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                    <div className="p-3 rounded-xl border border-border bg-muted/20">
                        <span className="text-xs text-muted-foreground font-medium block mb-0.5">
                            Grade
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-foreground truncate block">
                            {gradeInfo.grade.split(" ")[0]}
                        </span>
                    </div>
                    <div className="p-3 rounded-xl border border-border bg-muted/20">
                        <span className="text-xs text-muted-foreground font-medium block mb-0.5">
                            Time Taken
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-foreground font-mono">
                            {formatTime(timeSpentSeconds)}
                        </span>
                    </div>
                    <div className="p-3 rounded-xl border border-border bg-muted/20">
                        <span className="text-xs text-muted-foreground font-medium block mb-0.5">
                            Correct / Total
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-emerald-400">
                            {score} of {totalQuestions}
                        </span>
                    </div>
                    <div className="p-3 rounded-xl border border-border bg-muted/20">
                        <span className="text-xs text-muted-foreground font-medium block mb-0.5">
                            Flagged for Review
                        </span>
                        <span className="text-xs sm:text-sm font-semibold text-amber-400">
                            {attempt.flaggedQuestions?.length || 0} questions
                        </span>
                    </div>
                </div>
            </div>

            {/* Question Review Section */}
            <div className="space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <h2 className="text-base font-semibold text-foreground">
                        Detailed Question Review
                    </h2>

                    {/* Filter Tabs */}
                    <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
                        {(
                            [
                                { id: "all", label: `All (${questions.length})` },
                                { id: "incorrect", label: `Incorrect (${incorrectQuestions.length})` },
                                { id: "correct", label: `Correct (${correctQuestions.length})` },
                                { id: "flagged", label: `Flagged (${flaggedQuestions.length})` },
                            ] as const
                        ).map((tab) => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setFilter(tab.id)}
                                className={`px-3 py-1.5 rounded-full text-xs font-medium cursor-pointer transition-colors shrink-0 ${
                                    filter === tab.id
                                        ? "bg-foreground text-background"
                                        : "border border-border bg-card text-muted-foreground hover:text-foreground"
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>

                {displayedQuestions.length === 0 ? (
                    <div className="p-8 rounded-2xl border border-border bg-card text-center text-xs text-muted-foreground">
                        No questions in this filter view.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {displayedQuestions.map((q) => {
                            const originalIdx = questions.findIndex((orig) => orig.id === q.id);
                            const userChoice = answers[q.id];
                            const isCorrect = userChoice !== undefined && userChoice === q.correctAnswer;
                            const isUnanswered = userChoice === undefined;
                            const wasFlagged = attempt.flaggedQuestions?.includes(q.id);

                            return (
                                <div
                                    key={q.id}
                                    className="p-5 sm:p-6 rounded-2xl border border-border bg-card space-y-4"
                                >
                                    {/* Question Header */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-medium text-muted-foreground">
                                                Question {originalIdx + 1}
                                            </span>

                                            {isCorrect ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-semibold border border-emerald-500/20">
                                                    <Check className="w-3 h-3" />
                                                    <span>Correct</span>
                                                </span>
                                            ) : isUnanswered ? (
                                                <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-muted text-muted-foreground font-semibold border border-border">
                                                    <HelpCircle className="w-3 h-3" />
                                                    <span>Unanswered</span>
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-[11px] px-2.5 py-0.5 rounded-full bg-rose-500/10 text-rose-400 font-semibold border border-rose-500/20">
                                                    <X className="w-3 h-3" />
                                                    <span>Incorrect</span>
                                                </span>
                                            )}
                                        </div>

                                        {wasFlagged && (
                                            <span className="inline-flex items-center gap-1 text-[11px] text-amber-400">
                                                <Flag className="w-3 h-3 fill-amber-400" />
                                                <span>Flagged</span>
                                            </span>
                                        )}
                                    </div>

                                    {/* Question Prompt */}
                                    <p className="text-sm sm:text-base font-medium text-foreground">
                                        {q.question}
                                    </p>

                                    {/* Options Matrix */}
                                    <div className="space-y-2">
                                        {q.options.map((optText, optIdx) => {
                                            const isSelected = userChoice === optIdx;
                                            const isTheCorrectOne = q.correctAnswer === optIdx;

                                            let optionClass = "border-border bg-muted/10 text-muted-foreground";

                                            if (isTheCorrectOne) {
                                                optionClass = "border-emerald-500/50 bg-emerald-500/10 text-foreground font-medium ring-1 ring-emerald-500/30";
                                            } else if (isSelected && !isCorrect) {
                                                optionClass = "border-rose-500/50 bg-rose-500/10 text-foreground font-medium ring-1 ring-rose-500/30";
                                            }

                                            return (
                                                <div
                                                    key={optIdx}
                                                    className={`flex items-start gap-3 p-3 rounded-xl border text-xs sm:text-sm ${optionClass}`}
                                                >
                                                    <span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold bg-background shrink-0 mt-0.5 border border-border">
                                                        {optionLetters[optIdx]}
                                                    </span>
                                                    <span className="flex-1">{optText}</span>
                                                    {isTheCorrectOne && (
                                                        <span className="text-[11px] font-semibold text-emerald-400 shrink-0">
                                                            Correct Answer
                                                        </span>
                                                    )}
                                                    {isSelected && !isTheCorrectOne && (
                                                        <span className="text-[11px] font-semibold text-rose-400 shrink-0">
                                                            Your Answer
                                                        </span>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>

                                    {/* Grounded Explanation Box */}
                                    <div className="p-4 rounded-xl border border-border bg-muted/20 space-y-1.5 text-xs text-muted-foreground">
                                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                                            <BookOpen className="w-3.5 h-3.5 text-foreground" />
                                            <span>Document Rationale:</span>
                                        </div>
                                        <p className="leading-relaxed text-foreground/80">
                                            {q.explanation}
                                        </p>
                                        {q.sourceExcerpt && (
                                            <div className="pt-1 text-[11px] text-muted-foreground/80 italic border-t border-border/40 mt-2">
                                                Manual Excerpt: &ldquo;{q.sourceExcerpt}&rdquo;
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
}
