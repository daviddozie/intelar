"use client";

import React, { useState, useMemo } from "react";
import type { LearningLesson, LearningSourceReference } from "@/lib/learning-types";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import PracticeQuestionCard from "./practice-question-card";
import SourceReferenceModal from "./source-reference-modal";
import LessonTutorDrawer from "./lesson-tutor-drawer";
import { ArrowLeft, ArrowRight, Bot, Check, BookOpen, Sparkles, Lock } from "lucide-react";

interface LessonPlayerProps {
    lesson: LearningLesson;
    courseId?: string;
    language: "en" | "fr";
    onLanguageChange: (language: "en" | "fr") => void;
    lessonIndex: number;
    totalLessons: number;
    isCompleted: boolean;
    savedAnswers?: Record<string, string>;
    onAnswerQuestion: (questionId: string, optionId: string) => void;
    onRetryQuestion?: (questionId: string) => void;
    onToggleLessonComplete: (lessonId: string) => void;
    onNextLesson?: () => void;
    onPreviousLesson?: () => void;
    onBackToDashboard: () => void;
    theme?: "light" | "dark";
    isOnline?: boolean;
}

export default function LessonPlayer({
    lesson,
    courseId = "sample-statistics-101",
    lessonIndex,
    language,
    onLanguageChange,
    totalLessons,
    isCompleted,
    savedAnswers = {},
    onAnswerQuestion,
    onRetryQuestion,
    onToggleLessonComplete,
    onNextLesson,
    onPreviousLesson,
    onBackToDashboard,
    theme = "dark",
    isOnline = true,
}: LessonPlayerProps) {
    const isDark = theme === "dark";
    const [selectedReference, setSelectedReference] = useState<LearningSourceReference | null>(null);
    const [isTutorOpen, setIsTutorOpen] = useState(false);

    // Support the draft French translation if available for this lesson
    const hasFrench = Boolean(lesson.frenchAlternative);
    const isFrench = language === "fr" && hasFrench;

    const displayTitle = isFrench && lesson.frenchAlternative ? lesson.frenchAlternative.title : lesson.title;
    const displaySummary = isFrench && lesson.frenchAlternative ? lesson.frenchAlternative.summary : lesson.summary;
    const rawContent = isFrench && lesson.frenchAlternative ? lesson.frenchAlternative.content : lesson.content;
    const displayQuestions = isFrench && lesson.frenchAlternative ? lesson.frenchAlternative.questions : (lesson.questions || []);

    const displayContent = useMemo(() => {
        if (!rawContent) return "";
        const escaped = displayTitle.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        const titleRegex = new RegExp(`^#+\\s+${escaped}\\s*\\n*`, "i");
        return rawContent.replace(titleRegex, "").trim();
    }, [rawContent, displayTitle]);

    const totalQuestions = displayQuestions.length;
    const questionsAnsweredCount = displayQuestions.filter((q) => Boolean(savedAnswers[q.id])).length;
    const allQuestionsAnswered = totalQuestions === 0 || questionsAnsweredCount === totalQuestions;
    const correctAnswersCount = displayQuestions.filter((q) => savedAnswers[q.id] === q.correctOptionId).length;
    const scorePercent = totalQuestions > 0 ? Math.round((correctAnswersCount / totalQuestions) * 100) : 100;
    const meetsPassingScore = totalQuestions === 0 || scorePercent >= 80;
    const canMarkComplete = isCompleted || meetsPassingScore;
    const canAdvance = allQuestionsAnswered && (isCompleted || meetsPassingScore);

    return (
        <div lang={isFrench ? "fr" : "en"} className="w-full p-6 sm:p-8">
            {/* Top Navigation */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-6 pb-4 border-b border-inherit">
                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={onBackToDashboard}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-lg p-1"
                    >
                        <ArrowLeft className="w-4 h-4" />
                        <span>Back to dashboard</span>
                    </button>
                    {!isOnline && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-border bg-muted/60 text-muted-foreground">
                            <span className="w-1.5 h-1.5 rounded-full bg-muted-foreground" />
                            <span>Offline study mode</span>
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        onClick={() => setIsTutorOpen(!isTutorOpen)}
                        className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                            isTutorOpen
                                ? "bg-foreground text-background shadow-xs font-semibold"
                                : "border border-border bg-card hover:bg-muted text-foreground"
                        }`}
                    >
                        <Bot className="w-3.5 h-3.5" />
                        <span>Lesson tutor</span>
                    </button>

                    {hasFrench && (
                        <div className="inline-flex items-center rounded-xl p-0.5 border border-border text-xs bg-card">
                            <button
                                type="button"
                                onClick={() => onLanguageChange("en")}
                                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    language === "en"
                                        ? "bg-foreground text-background shadow-xs"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                            >
                                English
                            </button>
                            <button
                                type="button"
                                onClick={() => onLanguageChange("fr")}
                                className={`px-2.5 py-1 rounded-lg font-medium transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${
                                    language === "fr"
                                        ? "bg-foreground text-background shadow-xs"
                                        : "text-muted-foreground hover:text-foreground hover:bg-muted"
                                }`}
                            >
                                Français
                            </button>
                        </div>
                    )}

                    <span className="text-xs font-medium text-muted-foreground">
                        Lesson {lessonIndex + 1} of {totalLessons}
                    </span>
                </div>
            </div>


            {/* Lesson Title & Summary Header */}
            <header className="mb-8">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-border bg-muted/50 text-muted-foreground">
                        <BookOpen className="w-3 h-3" />
                        <span>{courseId === "sample-statistics-101" ? (isFrench ? "Leçon Démonstration" : "Sample Lesson") : `Lesson ${lessonIndex + 1}`}</span>
                    </span>
                    {isCompleted && (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border border-border bg-muted text-foreground">
                            <Check className="w-3 h-3" />
                            <span>{isFrench ? "Terminé" : "Completed"}</span>
                        </span>
                    )}
                </div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight mb-2 text-foreground">
                    {displayTitle}
                </h1>
                {displaySummary && (
                    <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
                        {displaySummary}
                    </p>
                )}
            </header>

            {/* Lesson Body Content */}
            <article
                className={`rounded-3xl border p-6 sm:p-8 mb-10 transition-colors ${
                    isDark ? "bg-[#18181b] border-white/10 text-neutral-200" : "bg-white border-black/10 text-neutral-800 shadow-sm"
                }`}
            >
                <div className="prose prose-sm sm:prose-base dark:prose-invert max-w-none space-y-4">
                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={{
                        h1: ({ children }) => <h1 className="text-2xl font-bold mt-7 mb-3 text-foreground tracking-tight">{children}</h1>,
                        h2: ({ children }) => <h2 className="text-xl font-semibold mt-6 mb-3 text-foreground tracking-tight">{children}</h2>,
                        h3: ({ children }) => <h3 className="text-lg font-semibold mt-5 mb-2 text-foreground tracking-tight">{children}</h3>,
                        h4: ({ children }) => <h4 className="text-base font-medium mt-4 mb-2 text-foreground tracking-tight">{children}</h4>,
                        p: ({ children }) => <p className="leading-relaxed my-3.5 text-foreground/90">{children}</p>,
                        ul: ({ children }) => <ul className="list-disc pl-5 my-3.5 space-y-2 text-foreground/90">{children}</ul>,
                        ol: ({ children }) => <ol className="list-decimal pl-5 my-3.5 space-y-2 text-foreground/90">{children}</ol>,
                        li: ({ children }) => <li className="leading-relaxed">{children}</li>,
                        blockquote: ({ children }) => (
                            <blockquote className="border-l-2 border-foreground/30 pl-4 py-2 my-4 italic text-muted-foreground bg-muted/20 rounded-r-lg">
                                {children}
                            </blockquote>
                        ),
                        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
                        pre: ({ children }) => <pre className="overflow-x-auto p-4 rounded-xl bg-neutral-500/10 text-xs my-3">{children}</pre>,
                        table: ({ children }) => <div className="overflow-x-auto my-4"><table className="w-full text-left text-sm">{children}</table></div>,
                        th: ({ children }) => <th className="p-2 border border-inherit font-semibold">{children}</th>,
                        td: ({ children }) => <td className="p-2 border border-inherit">{children}</td>,
                    }}>{displayContent}</ReactMarkdown>
                </div>

                {/* Inline Citations & Traceable Sources Footer */}
                {lesson.sources && lesson.sources.length > 0 && (
                    <div className="mt-8 pt-6 border-t border-inherit">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
                            <div className="flex items-center gap-2">
                                <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
                                <h3 className="text-xs font-semibold text-muted-foreground">
                                    Supporting sources ({lesson.sources.length})
                                </h3>
                            </div>
                            <span className="text-[11px] text-muted-foreground">
                                {lesson.sources[0]?.title ? lesson.sources[0].title : (lesson.sources[0]?.license || "Authorized study resource")}
                            </span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                            {lesson.sources.map((src) => (
                                <div
                                    key={src.id}
                                    className="p-3.5 rounded-xl border border-border bg-card text-xs flex flex-col justify-between transition-colors"
                                >
                                    <div className="mb-2">
                                        <strong className="block font-semibold text-foreground mb-1">
                                            {src.title}
                                        </strong>
                                        <p className="text-muted-foreground line-clamp-2">
                                            {src.excerpt}
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setSelectedReference(src)}
                                        className="inline-flex items-center gap-1 font-medium text-foreground hover:underline self-start cursor-pointer pt-1"
                                    >
                                        <span>View supporting source</span>
                                        <ArrowRight className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </article>

            {/* Practice Section: 3 Questions */}
            {displayQuestions.length > 0 && (
                <section className="mb-10">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                        <div>
                            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border border-border bg-muted/60 text-muted-foreground mb-1">
                                <Sparkles className="w-3 h-3" />
                                <span>Practice questions</span>
                            </div>
                            <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                                {isFrench ? "Questions de pratique" : "Practice questions"}
                            </h2>
                        </div>
                        <span className="text-xs text-muted-foreground">
                            {questionsAnsweredCount} of {totalQuestions} answered
                            {totalQuestions > 0 && ` • ${correctAnswersCount} correct (${scorePercent}%)`}
                        </span>
                    </div>

                    <div className="space-y-6">
                        {displayQuestions.map((q, idx) => (
                            <PracticeQuestionCard
                                key={`${q.id}:${savedAnswers[q.id] || "unanswered"}`}
                                question={q}
                                questionIndex={idx}
                                totalQuestions={displayQuestions.length}
                                savedAnswer={savedAnswers[q.id]}
                                onAnswerSelected={onAnswerQuestion}
                                onRetry={onRetryQuestion}
                                theme={theme}
                            />
                        ))}
                    </div>
                </section>
            )}

            {/* Bottom Actions & Completion Bar */}
            <div className="rounded-2xl border border-border bg-card p-5 sm:p-6 flex flex-col gap-4 transition-colors">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            type="button"
                            onClick={() => canMarkComplete && onToggleLessonComplete(lesson.id)}
                            disabled={!canMarkComplete}
                            title={
                                !canMarkComplete
                                    ? `Score at least 80% on the quiz to complete this lesson (Current score: ${scorePercent}%)`
                                    : undefined
                            }
                            className={`inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-medium transition-colors ${
                                isCompleted
                                    ? "border border-border bg-muted text-foreground cursor-pointer"
                                    : meetsPassingScore
                                    ? "rounded-full bg-foreground text-background hover:opacity-85 transition-opacity cursor-pointer"
                                    : "border border-border bg-muted/60 text-muted-foreground cursor-not-allowed opacity-80"
                            }`}
                        >
                            {isCompleted ? (
                                <Check className="w-4 h-4" />
                            ) : !meetsPassingScore ? (
                                <Lock className="w-3.5 h-3.5" />
                            ) : null}
                            <span>
                                {isCompleted
                                    ? isFrench
                                        ? "Terminé"
                                        : "Completed"
                                    : meetsPassingScore
                                    ? isFrench
                                        ? "Marquer comme terminé"
                                        : "Mark as complete"
                                    : isFrench
                                    ? "Marquer comme terminé (80% requis)"
                                    : "Mark as complete (80% required)"}
                            </span>
                        </button>

                        {/* Quiz Score & Requirement Status */}
                        {totalQuestions > 0 && (
                            <div className="text-xs text-muted-foreground flex flex-wrap items-center gap-2">
                                <span className="font-medium text-foreground">
                                    Quiz: {correctAnswersCount}/{totalQuestions} correct ({scorePercent}%)
                                </span>
                                <span>•</span>
                                {!meetsPassingScore ? (
                                    <span className="text-muted-foreground">80% needed to complete</span>
                                ) : isCompleted ? (
                                    <span className="text-foreground font-medium flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Completed
                                    </span>
                                ) : (
                                    <span className="text-foreground font-medium flex items-center gap-1">
                                        <Check className="w-3 h-3" /> Passing score achieved
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        {onPreviousLesson && (
                            <button
                                type="button"
                                onClick={onPreviousLesson}
                                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl text-xs font-medium border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer"
                            >
                                <ArrowLeft className="w-3.5 h-3.5" />
                                <span>Previous lesson</span>
                            </button>
                        )}
                        {onNextLesson && (
                            <button
                                type="button"
                                onClick={() => {
                                    if (!canAdvance) return;
                                    if (!isCompleted && meetsPassingScore) {
                                        onToggleLessonComplete(lesson.id);
                                    }
                                    onNextLesson();
                                }}
                                disabled={!canAdvance}
                                title={
                                    !allQuestionsAnswered
                                        ? `Attend to all questions (${questionsAnsweredCount}/${totalQuestions} answered) before proceeding to the next lesson`
                                        : !meetsPassingScore && !isCompleted
                                        ? `Score at least 80% on the quiz to unlock the next lesson (Current score: ${scorePercent}%)`
                                        : undefined
                                }
                                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                                    canAdvance
                                        ? "bg-foreground text-background hover:opacity-85 cursor-pointer"
                                        : "border border-border bg-muted/60 text-muted-foreground cursor-not-allowed opacity-70"
                                }`}
                            >
                                {!canAdvance && <Lock className="w-3 h-3" />}
                                <span>Next lesson</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                            </button>
                        )}
                    </div>
                </div>

                {/* Helpful guidance banner when not ready to advance */}
                {totalQuestions > 0 && !canAdvance && (
                    <div className="text-xs text-muted-foreground pt-3 border-t border-border flex items-center justify-between gap-2">
                        <span>
                            {!allQuestionsAnswered
                                ? `Please attend to all ${totalQuestions} practice questions above to continue (${questionsAnsweredCount}/${totalQuestions} answered so far).`
                                : `You scored ${scorePercent}%. You need at least 80% to pass and unlock the next lesson. You can retry any incorrect question above!`}
                        </span>
                    </div>
                )}
            </div>

            {/* Traceable Source Modal */}
            <SourceReferenceModal
                reference={selectedReference}
                onClose={() => setSelectedReference(null)}
                theme={theme}
            />

            {/* Focused Lesson Tutor Drawer */}
            <LessonTutorDrawer
                isOpen={isTutorOpen}
                onClose={() => setIsTutorOpen(false)}
                lesson={lesson}
                courseId={courseId}
                theme={theme}
            />
        </div>
    );
}
