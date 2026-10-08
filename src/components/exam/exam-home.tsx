"use client";

import React, { useState, useEffect, useCallback } from "react";
import {
    ClipboardCheck,
    Plus,
    Play,
    RotateCcw,
    Trash2,
    Clock,
    FileText,
    Award,
    Sliders,
    Loader2,
    AlertCircle,
    Sparkles,
    CheckCircle2,
    Calendar,
} from "lucide-react";
import CreateExamModal from "./create-exam-modal";
import ExamPlayer from "./exam-player";
import ExamResultsView from "./exam-results-view";
import type { ExamAttempt, ExamPrep } from "@/lib/exam-types";

export interface ExamUrlState {
    examId: string | null;
    attemptId: string | null;
    view: "dashboard" | "playing" | "results";
    modal: "create" | null;
}

export function readExamUrlState(): ExamUrlState {
    if (typeof window === "undefined") {
        return { examId: null, attemptId: null, view: "dashboard", modal: null };
    }
    const params = new URLSearchParams(window.location.search);
    const examId = params.get("exam") || params.get("examId");
    const attemptId = params.get("attempt") || params.get("attemptId");
    const viewParam = params.get("view");
    const modalParam = params.get("modal");

    let view: "dashboard" | "playing" | "results" = "dashboard";
    if (examId) {
        if (viewParam === "playing") {
            view = "playing";
        } else if (viewParam === "results" || Boolean(attemptId)) {
            view = "results";
        } else {
            view = "playing";
        }
    }

    const modal = modalParam === "create" ? "create" : null;
    return { examId, attemptId, view, modal };
}

export function writeExamUrlState(
    params: {
        examId?: string | null;
        attemptId?: string | null;
        view?: "dashboard" | "playing" | "results";
        modal?: "create" | null;
    },
    mode: "push" | "replace" = "push"
) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);

    if (params.examId) {
        url.searchParams.set("exam", params.examId);
    } else if (params.examId === null) {
        url.searchParams.delete("exam");
    }

    if (params.view === "results" && params.attemptId) {
        url.searchParams.set("attempt", params.attemptId);
    } else if (params.attemptId === null || params.view !== "results") {
        url.searchParams.delete("attempt");
    }

    if (params.view && params.view !== "dashboard" && (params.examId || url.searchParams.get("exam"))) {
        url.searchParams.set("view", params.view);
    } else if (params.view === "dashboard") {
        url.searchParams.delete("view");
    }

    if (params.modal === "create") {
        url.searchParams.set("modal", "create");
    } else if (params.modal === null) {
        url.searchParams.delete("modal");
    }

    url.searchParams.delete("examId");
    url.searchParams.delete("attemptId");

    const newUrl = `${url.pathname}${url.search}${url.hash}`;
    if (window.location.pathname + window.location.search + window.location.hash !== newUrl) {
        if (mode === "push") {
            window.history.pushState(window.history.state, "", newUrl);
        } else {
            window.history.replaceState(window.history.state, "", newUrl);
        }
    }
}

interface ExamHomeProps {
    theme?: "light" | "dark";
    onOpenChat?: () => void;
}

export default function ExamHome({
    theme = "dark",
    onOpenChat,
}: ExamHomeProps) {
    const [view, setView] = useState<"dashboard" | "playing" | "results">("dashboard");
    const [exams, setExams] = useState<ExamPrep[]>([]);
    const [latestAttempts, setLatestAttempts] = useState<Record<string, ExamAttempt>>({});
    const [activeExam, setActiveExam] = useState<ExamPrep | null>(null);
    const [activeAttempt, setActiveAttempt] = useState<ExamAttempt | null>(null);

    const [isLoading, setIsLoading] = useState(true);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Fetch user exams
    const loadExams = useCallback(async () => {
        setIsLoading(true);
        setError(null);

        try {
            const res = await fetch("/api/exams");
            if (!res.ok) {
                if (res.status === 401) {
                    setIsLoading(false);
                    return;
                }
                throw new Error("Failed to load exams");
            }

            const data = await res.json();
            const examList = (data.exams || []) as ExamPrep[];
            setExams(examList);

            // Fetch latest attempts for each exam
            const attemptsMap: Record<string, ExamAttempt> = {};
            for (const ex of examList) {
                try {
                    const aRes = await fetch(`/api/exams/${ex.id}/attempt`);
                    if (aRes.ok) {
                        const aData = await aRes.json();
                        if (aData.attempts && aData.attempts.length > 0) {
                            attemptsMap[ex.id] = aData.attempts[0];
                        }
                    }
                } catch {
                    // Ignore attempt loading failures for individual exams
                }
            }
            setLatestAttempts(attemptsMap);

            // Restore active state from URL
            const urlState = readExamUrlState();
            if (urlState.modal === "create") {
                setIsCreateModalOpen(true);
            }

            if (urlState.examId) {
                let targetExam = examList.find((ex) => ex.id === urlState.examId);
                if (!targetExam) {
                    try {
                        const singleRes = await fetch(`/api/exams/${urlState.examId}`);
                        if (singleRes.ok) {
                            const sData = await singleRes.json();
                            targetExam = sData.exam;
                        }
                    } catch {
                        // Ignore single fetch error
                    }
                }

                if (targetExam) {
                    setActiveExam(targetExam);
                    if (urlState.view === "results") {
                        let targetAttempt = attemptsMap[targetExam.id];
                        if (urlState.attemptId) {
                            try {
                                const attRes = await fetch(`/api/exams/${targetExam.id}/attempt`);
                                if (attRes.ok) {
                                    const attData = await attRes.json();
                                    const list = (attData.attempts || []) as ExamAttempt[];
                                    targetAttempt = list.find((a) => a.id === urlState.attemptId) || list[0] || targetAttempt;
                                }
                            } catch {
                                // Ignore attempt fetch error
                            }
                        }

                        if (targetAttempt) {
                            setActiveAttempt(targetAttempt);
                            setView("results");
                            writeExamUrlState(
                                { examId: targetExam.id, attemptId: targetAttempt.id, view: "results" },
                                "replace"
                            );
                        } else {
                            setView("playing");
                            writeExamUrlState({ examId: targetExam.id, view: "playing" }, "replace");
                        }
                    } else if (urlState.view === "playing") {
                        setActiveAttempt(null);
                        setView("playing");
                        writeExamUrlState({ examId: targetExam.id, view: "playing" }, "replace");
                    } else {
                        setView("dashboard");
                    }
                } else {
                    writeExamUrlState({ view: "dashboard" }, "replace");
                    setView("dashboard");
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : "Error loading exams");
        } finally {
            setIsLoading(false);
        }
    }, []);

    useEffect(() => {
        const urlState = readExamUrlState();
        if (urlState.modal === "create") {
            setIsCreateModalOpen(true);
        }
        loadExams();
    }, [loadExams]);

    // Handle browser back and forward navigation
    useEffect(() => {
        async function handlePopState() {
            const urlState = readExamUrlState();
            setIsCreateModalOpen(urlState.modal === "create");

            if (urlState.examId) {
                let targetExam = exams.find((e) => e.id === urlState.examId);
                if (!targetExam) {
                    try {
                        const res = await fetch(`/api/exams/${urlState.examId}`);
                        if (res.ok) {
                            const data = await res.json();
                            targetExam = data.exam;
                        }
                    } catch {
                        // ignore
                    }
                }

                if (targetExam) {
                    setActiveExam(targetExam);
                    if (urlState.view === "results") {
                        let targetAttempt = latestAttempts[targetExam.id];
                        if (urlState.attemptId) {
                            try {
                                const attRes = await fetch(`/api/exams/${targetExam.id}/attempt`);
                                if (attRes.ok) {
                                    const attData = await attRes.json();
                                    const list = (attData.attempts || []) as ExamAttempt[];
                                    targetAttempt = list.find((a) => a.id === urlState.attemptId) || list[0] || targetAttempt;
                                }
                            } catch {
                                // ignore
                            }
                        }

                        if (targetAttempt) {
                            setActiveAttempt(targetAttempt);
                            setView("results");
                        } else {
                            setView("playing");
                        }
                    } else if (urlState.view === "playing") {
                        setActiveAttempt(null);
                        setView("playing");
                    } else {
                        setView("dashboard");
                        setActiveExam(null);
                        setActiveAttempt(null);
                    }
                } else {
                    setView("dashboard");
                    setActiveExam(null);
                    setActiveAttempt(null);
                }
            } else {
                setView("dashboard");
                setActiveExam(null);
                setActiveAttempt(null);
            }
        }

        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [exams, latestAttempts]);

    const openCreateModal = useCallback(() => {
        setIsCreateModalOpen(true);
        writeExamUrlState({ modal: "create" }, "push");
    }, []);

    const closeCreateModal = useCallback(() => {
        setIsCreateModalOpen(false);
        writeExamUrlState({ modal: null }, "replace");
    }, []);

    function startExam(exam: ExamPrep) {
        setIsCreateModalOpen(false);
        setActiveExam(exam);
        setActiveAttempt(null);
        setView("playing");
        writeExamUrlState({ examId: exam.id, view: "playing", modal: null });
    }

    function viewResults(exam: ExamPrep, attempt: ExamAttempt) {
        setActiveExam(exam);
        setActiveAttempt(attempt);
        setView("results");
        writeExamUrlState({ examId: exam.id, attemptId: attempt.id, view: "results" });
    }

    async function handleDelete(examId: string, e: React.MouseEvent) {
        e.stopPropagation();
        if (!confirm("Are you sure you want to delete this exam and its past attempts?")) return;

        try {
            const res = await fetch(`/api/exams/${examId}`, { method: "DELETE" });
            if (!res.ok) throw new Error("Could not delete exam");

            setExams((prev) => prev.filter((ex) => ex.id !== examId));
            if (activeExam?.id === examId) {
                setView("dashboard");
                setActiveExam(null);
                setActiveAttempt(null);
                writeExamUrlState({ view: "dashboard" });
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : "Failed to delete exam");
        }
    }

    if (isLoading) {
        return (
            <main className="w-full flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
                <div className="flex flex-col items-center justify-center min-h-[50vh] space-y-3">
                    <Loader2 className="w-7 h-7 animate-spin text-muted-foreground mx-auto" />
                    <p className="text-xs text-muted-foreground">Loading your exam papers…</p>
                </div>
            </main>
        );
    }

    if (view === "playing" && activeExam) {
        return (
            <ExamPlayer
                exam={activeExam}
                theme={theme}
                onComplete={(attempt) => {
                    setLatestAttempts((prev) => ({ ...prev, [activeExam.id]: attempt }));
                    setActiveAttempt(attempt);
                    setView("results");
                    writeExamUrlState({ examId: activeExam.id, attemptId: attempt.id, view: "results" });
                }}
                onExit={() => {
                    try {
                        sessionStorage.removeItem(`intelar_exam_active_${activeExam.id}`);
                    } catch {}
                    setView("dashboard");
                    setActiveExam(null);
                    setActiveAttempt(null);
                    writeExamUrlState({ view: "dashboard" });
                }}
            />
        );
    }

    if (view === "results" && activeExam && activeAttempt) {
        return (
            <ExamResultsView
                exam={activeExam}
                attempt={activeAttempt}
                theme={theme}
                onRetake={() => {
                    try {
                        sessionStorage.removeItem(`intelar_exam_active_${activeExam.id}`);
                    } catch {}
                    setActiveAttempt(null);
                    setView("playing");
                    writeExamUrlState({ examId: activeExam.id, view: "playing" });
                }}
                onCreateNew={() => {
                    setView("dashboard");
                    setActiveExam(null);
                    setActiveAttempt(null);
                    openCreateModal();
                }}
                onBackToDashboard={() => {
                    setView("dashboard");
                    setActiveExam(null);
                    setActiveAttempt(null);
                    writeExamUrlState({ view: "dashboard", modal: null });
                }}
            />
        );
    }

    return (
        <main className="w-full flex-1 overflow-y-auto p-6 sm:p-8 space-y-8">
            {/* Top Dashboard Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-6">
                <div>
                    <div className="flex items-center gap-2 mb-1.5">
                        <span className="p-1.5 rounded-lg bg-foreground/10 text-foreground">
                            <ClipboardCheck className="w-5 h-5" />
                        </span>
                        <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                            Exam Prep Simulation
                        </h1>
                    </div>
                    <p className="text-xs sm:text-sm text-muted-foreground max-w-2xl leading-relaxed">
                        Generate and practice authentic university examinations with realistic countdown timers, concrete multiple-choice questions, and detailed rationale grounded in your uploaded course manuals.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={openCreateModal}
                    className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2.5 text-xs sm:text-sm font-medium hover:opacity-90 cursor-pointer transition-opacity shadow-sm self-start sm:self-auto shrink-0"
                >
                    <Plus className="w-4 h-4" />
                    <span>Create Practice Exam</span>
                </button>
            </div>

            {/* Workflow Banner */}
            <div className="p-5 rounded-2xl border border-border bg-card/60 grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-foreground/10 text-foreground flex items-center justify-center font-bold text-[11px] shrink-0">
                        1
                    </span>
                    <div>
                        <span className="font-semibold text-foreground block mb-0.5">Select Lecture Manual</span>
                        <span className="text-muted-foreground text-[11px]">Upload any textbook chapter or course handout.</span>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-foreground/10 text-foreground flex items-center justify-center font-bold text-[11px] shrink-0">
                        2
                    </span>
                    <div>
                        <span className="font-semibold text-foreground block mb-0.5">Set Difficulty & Timer</span>
                        <span className="text-muted-foreground text-[11px]">Pick 10, 20, 30, or 50 questions with countdown limits.</span>
                    </div>
                </div>

                <div className="flex items-start gap-3">
                    <span className="w-6 h-6 rounded-full bg-foreground/10 text-foreground flex items-center justify-center font-bold text-[11px] shrink-0">
                        3
                    </span>
                    <div>
                        <span className="font-semibold text-foreground block mb-0.5">Take Exam & Review</span>
                        <span className="text-muted-foreground text-[11px]">Get graded automatically with grounded explanations.</span>
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    <span>{error}</span>
                </div>
            )}

            {/* Exams List */}
            <div className="space-y-4">
                <div className="flex items-center justify-between">
                    <h2 className="text-sm font-medium text-foreground">
                        Your practice exams ({exams.length})
                    </h2>
                </div>

                {exams.length === 0 ? (
                    <div className="p-12 text-center rounded-2xl border border-dashed border-border bg-card/40 space-y-4">
                        <div className="w-12 h-12 rounded-2xl bg-muted/30 border border-border flex items-center justify-center mx-auto text-muted-foreground">
                            <ClipboardCheck className="w-6 h-6" />
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-sm font-semibold text-foreground">No practice exams created yet</h3>
                            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                                Upload a course manual or textbook to generate your first realistic timed examination simulation.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={openCreateModal}
                            className="inline-flex items-center gap-2 rounded-full bg-foreground text-background px-5 py-2 text-xs font-medium hover:opacity-90 cursor-pointer transition-opacity"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            <span>Create Your First Exam</span>
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {exams.map((ex) => {
                            const latest = latestAttempts[ex.id];
                            return (
                                <div
                                    key={ex.id}
                                    className="p-5 rounded-2xl border border-border bg-card hover:border-foreground/30 transition-all flex flex-col justify-between space-y-4 shadow-sm"
                                >
                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-[11px] px-2.5 py-0.5 rounded-full font-medium border border-border bg-muted/40 text-muted-foreground capitalize">
                                                {ex.difficulty}
                                            </span>

                                            <button
                                                type="button"
                                                onClick={(e) => handleDelete(ex.id, e)}
                                                className="p-1 text-muted-foreground hover:text-destructive cursor-pointer transition-colors"
                                                title="Delete Exam"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        <h3 className="text-base font-semibold text-foreground leading-snug">
                                            {ex.title}
                                        </h3>

                                        <div className="flex flex-wrap items-center gap-y-1 gap-x-3 text-xs text-muted-foreground">
                                            {ex.courseName && (
                                                <span className="font-medium text-foreground/80">
                                                    {ex.courseName}
                                                </span>
                                            )}
                                            <span className="flex items-center gap-1">
                                                <FileText className="w-3 h-3" />
                                                <span>{ex.questionCount} Questions</span>
                                            </span>
                                            <span className="flex items-center gap-1">
                                                <Clock className="w-3 h-3" />
                                                <span>{ex.timeLimitMinutes} mins</span>
                                            </span>
                                        </div>
                                    </div>

                                    {/* Footer with latest score & actions */}
                                    <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                                        {latest ? (
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-xs font-bold text-foreground">
                                                    {latest.percentage}%
                                                </span>
                                                <span className="text-[11px] text-muted-foreground">
                                                    ({latest.score}/{latest.totalQuestions})
                                                </span>
                                            </div>
                                        ) : (
                                            <span className="text-[11px] text-muted-foreground italic">
                                                Not attempted yet
                                            </span>
                                        )}

                                        <div className="flex items-center gap-2">
                                            {latest && (
                                                <button
                                                    type="button"
                                                    onClick={() => viewResults(ex, latest)}
                                                    className="px-3 py-1.5 rounded-full border border-border text-xs font-medium text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer transition-colors"
                                                >
                                                    Review
                                                </button>
                                            )}

                                            <button
                                                type="button"
                                                onClick={() => startExam(ex)}
                                                className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-foreground text-background text-xs font-medium hover:opacity-90 cursor-pointer transition-opacity"
                                            >
                                                <Play className="w-3 h-3 fill-background" />
                                                <span>{latest ? "Retake" : "Start Exam"}</span>
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {/* Create Exam Dialog */}
            <CreateExamModal
                isOpen={isCreateModalOpen}
                onClose={closeCreateModal}
                onSuccess={(newExam) => {
                    setExams((prev) => [newExam, ...prev]);
                    startExam(newExam);
                }}
                theme={theme}
            />
        </main>
    );
}
