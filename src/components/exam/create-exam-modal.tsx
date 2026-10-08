"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
    Dialog,
    DialogContent,
    DialogTitle,
    DialogDescription,
} from "@/components/ui/dialog";
import {
    ClipboardCheck,
    Upload,
    FileText,
    Check,
    Loader2,
    Clock,
    AlertCircle,
    Sliders,
    Sparkles,
    X,
    BookOpen,
    Lightbulb,
    CheckCircle2,
    WifiOff,
    ShieldCheck,
} from "lucide-react";
import { FileIcon } from "@public/svg/icon";
import {
    EXAM_DIFFICULTIES,
    VALID_QUESTION_COUNTS,
    type ExamDifficulty,
    type ExamPrep,
    type ExamQuestionCount,
} from "@/lib/exam-types";

const STORAGE_DRAFT_KEY = "intelar_exam_modal_draft";
const STORAGE_ACTIVE_GEN_KEY = "intelar_exam_active_generation";
const MAX_GEN_AGE_MS = 240000; // 4 minutes

interface StoredActiveGeneration {
    jobId: string;
    startedAt: number;
    resourceUrl: string;
    resourceName: string;
    difficulty: ExamDifficulty;
    questionCount: ExamQuestionCount;
    timeLimitMinutes: number;
    title: string;
    courseName?: string;
}

interface StoredExamDraft {
    selectedResourceUrl?: string;
    selectedResourceName?: string;
    difficulty?: ExamDifficulty;
    questionCount?: ExamQuestionCount;
    timeLimitMinutes?: number;
    title?: string;
    courseName?: string;
}

interface UserResource {
    name: string;
    url: string;
    type?: string;
    size?: number;
}

interface CreateExamModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (exam: ExamPrep) => void;
    theme?: "light" | "dark";
}

export default function CreateExamModal({
    isOpen,
    onClose,
    onSuccess,
    theme = "dark",
}: CreateExamModalProps) {
    const isDark = theme === "dark";
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pollerIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const inFlightFetchRef = useRef<boolean>(false);
    const isCheckingCompletionRef = useRef<boolean>(false);

    const [isOnline, setIsOnline] = useState<boolean>(true);
    const [resources, setResources] = useState<UserResource[]>([]);
    const [isLoadingResources, setIsLoadingResources] = useState(false);
    const [selectedResource, setSelectedResource] = useState<UserResource | null>(null);

    const [difficulty, setDifficulty] = useState<ExamDifficulty>("standard");
    const [questionCount, setQuestionCount] = useState<ExamQuestionCount>(10);
    const [timeLimitMinutes, setTimeLimitMinutes] = useState<number>(15);
    const [title, setTitle] = useState("");
    const [courseName, setCourseName] = useState("");

    const [isUploading, setIsUploading] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [generationStage, setGenerationStage] = useState<1 | 2 | 3 | 4>(1);
    const [generationProgress, setGenerationProgress] = useState<number>(15);
    const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
    const [currentTipIndex, setCurrentTipIndex] = useState<number>(0);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    // Dynamic study and exam tips cycling during generation
    const studyTips = [
        {
            title: "Pacing Strategy",
            tip: `For ${questionCount} questions in ${timeLimitMinutes} minutes, aim for ~${Math.max(15, Math.round((timeLimitMinutes * 60) / questionCount))} seconds per question to leave review time at the end.`,
        },
        {
            title: "Process of Elimination",
            tip: "Rule out 2 obviously false distractors first to boost your probability to 50%. Use keyboard shortcuts A-D or 1-4 for fast answering.",
        },
        {
            title: "Question Flagging",
            tip: "You can flag tricky questions during the test. The question palette keeps track of unanswered and flagged items so you can jump back anytime.",
        },
        {
            title: "Syllabus Grounding",
            tip: `Every question is strictly derived from ${selectedResource?.name || "your lecture manual"} with exact textbook citations and explanations.`,
        },
        {
            title: "Distractor Analysis",
            tip: "Each incorrect option reflects common student misconceptions or calculation pitfalls. Read all four choices carefully before confirming.",
        },
    ];

    // Pipeline generation stages
    const generationStages = [
        {
            stage: 1,
            title: "Scanning Lecture Manual & Indexing Content",
            description: selectedResource
                ? `Extracting core definitions, concepts, and principles from ${selectedResource.name}…`
                : "Parsing uploaded document structure…",
            icon: BookOpen,
        },
        {
            stage: 2,
            title: `Calibrating Exam Weighting (${difficulty.toUpperCase()})`,
            description:
                difficulty === "standard"
                    ? "Applying university distribution: 30% foundational recall, 50% applied reasoning, 20% analytical problem solving…"
                    : difficulty === "hard"
                    ? "Focusing on complex edge cases, multi-concept synthesis, and error diagnosis…"
                    : difficulty === "medium"
                    ? "Focusing on applied scenarios, multi-step problem solving, and conceptual comprehension…"
                    : "Focusing on foundational definitions, formula recall, and core textbook principles…",
            icon: Sliders,
        },
        {
            stage: 3,
            title: `Synthesizing ${questionCount} Questions & Distractors`,
            description: "Senior Examiner agent drafting multiple-choice items with 4 plausible options, citations, and educational rationale…",
            icon: Sparkles,
        },
        {
            stage: 4,
            title: "Psychometrics & Grounding Verification",
            description: `All ${questionCount} questions verified against source excerpts. Formatting final examination simulation…`,
            icon: CheckCircle2,
        },
    ];

    const handleFinishSuccess = useCallback(
        (exam: ExamPrep) => {
            if (pollerIntervalRef.current) {
                clearInterval(pollerIntervalRef.current);
                pollerIntervalRef.current = null;
            }
            setGenerationStage(4);
            setGenerationProgress(100);

            setTimeout(() => {
                try {
                    sessionStorage.removeItem(STORAGE_ACTIVE_GEN_KEY);
                    sessionStorage.removeItem(STORAGE_DRAFT_KEY);
                } catch {}
                setIsGenerating(false);
                onSuccess(exam);
                onClose();
            }, 600);
        },
        [onClose, onSuccess]
    );

    const startRecoveryPoller = useCallback(
        (job: StoredActiveGeneration) => {
            if (pollerIntervalRef.current) {
                clearInterval(pollerIntervalRef.current);
            }

            let pollCount = 0;

            const checkServer = async () => {
                if (isCheckingCompletionRef.current) return;
                isCheckingCompletionRef.current = true;

                try {
                    const res = await fetch("/api/exams");
                    if (res.ok) {
                        const data = await res.json();
                        const exams = (data.exams || []) as ExamPrep[];
                        const matched = exams.find((e) => {
                            const createdTime = new Date(e.createdAt).getTime();
                            const isRecent = createdTime >= job.startedAt - 10000;
                            const matchesResource = e.resourceUrls?.some((u) => u === job.resourceUrl);
                            const matchesTitle = e.title === job.title;
                            return isRecent && (matchesTitle || matchesResource);
                        });

                        if (matched) {
                            handleFinishSuccess(matched);
                            return;
                        }
                    }
                } catch {
                    // Ignore transient network errors during poller
                } finally {
                    isCheckingCompletionRef.current = false;
                }

                pollCount++;
                // If after 3 polls (~7.5s) the exam has not appeared in DB and we don't have an in-flight fetch:
                if (pollCount >= 3 && !inFlightFetchRef.current && (typeof navigator === "undefined" || navigator.onLine)) {
                    inFlightFetchRef.current = true;
                    fetch("/api/exams", {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            resourceUrls: [job.resourceUrl],
                            difficulty: job.difficulty,
                            questionCount: job.questionCount,
                            timeLimitMinutes: job.timeLimitMinutes,
                            title: job.title,
                            courseName: job.courseName,
                        }),
                    })
                        .then((res) => {
                            if (res.ok) return res.json();
                            return null;
                        })
                        .then((data) => {
                            if (data?.exam) {
                                handleFinishSuccess(data.exam);
                            }
                        })
                        .catch(() => {})
                        .finally(() => {
                            inFlightFetchRef.current = false;
                        });
                }
            };

            checkServer();
            pollerIntervalRef.current = setInterval(checkServer, 2500);
        },
        [handleFinishSuccess]
    );

    const cancelGeneration = useCallback(() => {
        if (pollerIntervalRef.current) {
            clearInterval(pollerIntervalRef.current);
            pollerIntervalRef.current = null;
        }
        try {
            sessionStorage.removeItem(STORAGE_ACTIVE_GEN_KEY);
        } catch {}
        inFlightFetchRef.current = false;
        setIsGenerating(false);
        setErrorMessage(null);
        setGenerationStage(1);
        setGenerationProgress(15);
        setElapsedSeconds(0);
    }, []);

    // Track online / offline connectivity
    useEffect(() => {
        if (typeof window === "undefined") return;
        setIsOnline(navigator.onLine);

        const handleOnline = () => {
            setIsOnline(true);
            try {
                const raw = sessionStorage.getItem(STORAGE_ACTIVE_GEN_KEY);
                if (raw) {
                    const job = JSON.parse(raw) as StoredActiveGeneration;
                    startRecoveryPoller(job);
                }
            } catch {}
        };
        const handleOffline = () => setIsOnline(false);

        window.addEventListener("online", handleOnline);
        window.addEventListener("offline", handleOffline);
        return () => {
            window.removeEventListener("online", handleOnline);
            window.removeEventListener("offline", handleOffline);
        };
    }, [startRecoveryPoller]);

    // Timer & stage progression during generation
    useEffect(() => {
        if (!isGenerating) {
            setGenerationStage(1);
            setGenerationProgress(15);
            setElapsedSeconds(0);
            setCurrentTipIndex(0);
            return;
        }

        const interval = setInterval(() => {
            setElapsedSeconds((sec) => {
                const nextSec = sec + 1;

                // Stage advancement
                if (nextSec >= 7) {
                    setGenerationStage((prev) => (prev < 3 ? 3 : prev));
                } else if (nextSec >= 3) {
                    setGenerationStage((prev) => (prev < 2 ? 2 : prev));
                }

                // Smooth progress bar advancement
                setGenerationProgress((p) => {
                    if (p >= 92) return p;
                    const delta = nextSec < 5 ? 8 : nextSec < 15 ? 4 : nextSec < 30 ? 2 : 1;
                    return Math.min(92, p + delta);
                });

                // Cycle study tips every 4 seconds
                if (nextSec % 4 === 0) {
                    setCurrentTipIndex((i) => (i + 1) % studyTips.length);
                }

                return nextSec;
            });
        }, 1000);

        return () => clearInterval(interval);
    }, [isGenerating, studyTips.length]);

    // Restore draft or active generation on modal open / mount
    useEffect(() => {
        if (!isOpen || typeof window === "undefined") return;

        // Check active generation first
        try {
            const rawActive = sessionStorage.getItem(STORAGE_ACTIVE_GEN_KEY);
            if (rawActive) {
                const job = JSON.parse(rawActive) as StoredActiveGeneration;
                const age = Date.now() - (job.startedAt || 0);
                if (age < MAX_GEN_AGE_MS) {
                    setSelectedResource({ name: job.resourceName, url: job.resourceUrl });
                    setDifficulty(job.difficulty);
                    setQuestionCount(job.questionCount);
                    setTimeLimitMinutes(job.timeLimitMinutes);
                    setTitle(job.title);
                    if (job.courseName) setCourseName(job.courseName);
                    setIsGenerating(true);

                    const elapsed = Math.max(0, Math.floor(age / 1000));
                    setElapsedSeconds(elapsed);
                    if (elapsed >= 7) setGenerationStage(3);
                    else if (elapsed >= 3) setGenerationStage(2);
                    else setGenerationStage(1);
                    setGenerationProgress(Math.min(92, Math.max(15, elapsed * 3)));

                    startRecoveryPoller(job);
                    return;
                } else {
                    sessionStorage.removeItem(STORAGE_ACTIVE_GEN_KEY);
                }
            }
        } catch {}

        // Restore saved draft
        try {
            const rawDraft = sessionStorage.getItem(STORAGE_DRAFT_KEY);
            if (rawDraft) {
                const draft = JSON.parse(rawDraft) as StoredExamDraft;
                if (draft.selectedResourceUrl && draft.selectedResourceName) {
                    setSelectedResource({ name: draft.selectedResourceName, url: draft.selectedResourceUrl });
                }
                if (draft.difficulty) setDifficulty(draft.difficulty);
                if (draft.questionCount) setQuestionCount(draft.questionCount);
                if (draft.timeLimitMinutes) setTimeLimitMinutes(draft.timeLimitMinutes);
                if (draft.title) setTitle(draft.title);
                if (draft.courseName) setCourseName(draft.courseName);
            }
        } catch {}
    }, [isOpen, startRecoveryPoller]);

    // Persist form draft as user configures
    useEffect(() => {
        if (isGenerating || typeof window === "undefined") return;
        try {
            sessionStorage.setItem(
                STORAGE_DRAFT_KEY,
                JSON.stringify({
                    selectedResourceUrl: selectedResource?.url,
                    selectedResourceName: selectedResource?.name,
                    difficulty,
                    questionCount,
                    timeLimitMinutes,
                    title,
                    courseName,
                })
            );
        } catch {}
    }, [selectedResource, difficulty, questionCount, timeLimitMinutes, title, courseName, isGenerating]);

    // Cleanup poller on unmount
    useEffect(() => {
        return () => {
            if (pollerIntervalRef.current) {
                clearInterval(pollerIntervalRef.current);
                pollerIntervalRef.current = null;
            }
        };
    }, []);

    // Fetch user resources when opened
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
                if (list.length > 0 && !selectedResource) {
                    selectDoc(list[0]);
                }
            })
            .catch((err) => {
                console.warn("Failed to fetch resources:", err);
            })
            .finally(() => {
                setIsLoadingResources(false);
            });
    }, [isOpen]);

    function selectDoc(doc: UserResource) {
        setSelectedResource(doc);
        const cleanName = doc.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
        if (!title || title.includes("Exam Simulation")) {
            setTitle(`${cleanName} Exam Simulation`);
        }
        if (!courseName) {
            setCourseName(cleanName);
        }
    }

    async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsUploading(true);
        setErrorMessage(null);

        try {
            const formData = new FormData();
            formData.append("file", file);

            const res = await fetch("/api/ingest", {
                method: "POST",
                body: formData,
            });

            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || "Failed to upload document");
            }

            const data = await res.json();
            const newRes: UserResource = {
                name: file.name,
                url: data.url || data.resource?.url || `/uploads/${file.name}`,
                type: file.type,
                size: file.size,
            };

            setResources((prev) => [newRes, ...prev]);
            selectDoc(newRes);
        } catch (err) {
            setErrorMessage(err instanceof Error ? err.message : "Failed to upload document");
        } finally {
            setIsUploading(false);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    }

    async function executeGenerate() {
        if (!selectedResource) {
            setErrorMessage("Please select or upload a course manual/textbook.");
            return;
        }

        const job: StoredActiveGeneration = {
            jobId: `exam_gen_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            startedAt: Date.now(),
            resourceUrl: selectedResource.url,
            resourceName: selectedResource.name,
            difficulty,
            questionCount,
            timeLimitMinutes,
            title: title.trim() || `${selectedResource.name} Exam Simulation`,
            courseName: courseName.trim() || undefined,
        };

        try {
            sessionStorage.setItem(STORAGE_ACTIVE_GEN_KEY, JSON.stringify(job));
        } catch {}

        setIsGenerating(true);
        setErrorMessage(null);
        setGenerationStage(1);
        setGenerationProgress(15);
        setElapsedSeconds(0);

        // Start recovery poller immediately alongside fetch
        startRecoveryPoller(job);

        inFlightFetchRef.current = true;
        try {
            const res = await fetch("/api/exams", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    resourceUrls: [job.resourceUrl],
                    difficulty: job.difficulty,
                    questionCount: job.questionCount,
                    timeLimitMinutes: job.timeLimitMinutes,
                    title: job.title,
                    courseName: job.courseName,
                }),
            });

            if (!res.ok) {
                const data = await res.json().catch(() => ({}));
                throw new Error(data.error || "Failed to generate exam.");
            }

            const data = await res.json();
            if (data?.exam) {
                handleFinishSuccess(data.exam);
            }
        } catch (err) {
            // Check if poller found the exam despite local fetch drop
            setTimeout(() => {
                if (isGenerating && !errorMessage) {
                    setErrorMessage(err instanceof Error ? err.message : "Exam generation failed");
                }
            }, 3000);
        } finally {
            inFlightFetchRef.current = false;
        }
    }

    async function handleGenerate(e: React.FormEvent) {
        e.preventDefault();
        executeGenerate();
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && !isGenerating && onClose()}>
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
                            {isGenerating ? "Exam Generation Studio" : "Configure Practice Exam"}
                        </DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground mt-1">
                            {isGenerating
                                ? `Synthesizing ${questionCount} questions strictly grounded in ${selectedResource?.name || "your course manual"}.`
                                : "Generate an authentic timed university examination grounded strictly in your course textbook or lecture manual."}
                        </DialogDescription>
                    </div>
                    {isGenerating ? (
                        <button
                            type="button"
                            onClick={cancelGeneration}
                            aria-label="Cancel generation"
                            className="px-2.5 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 rounded-lg transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                    ) : (
                        <button
                            type="button"
                            onClick={onClose}
                            aria-label="Close dialog"
                            className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors cursor-pointer"
                        >
                            <X className="w-4 h-4" />
                        </button>
                    )}
                </div>

                {isGenerating ? (
                    <div className="py-2 space-y-6">
                        {/* Offline Warning Banner */}
                        {!isOnline && (
                            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-300 text-xs">
                                <WifiOff className="w-4 h-4 animate-pulse shrink-0 text-amber-400" />
                                <div className="min-w-0">
                                    <span className="font-semibold block">Network connection interrupted</span>
                                    <span className="text-[11px] opacity-80">
                                        Simulation synthesis continues safely. Intelar will automatically reconnect once your network returns.
                                    </span>
                                </div>
                            </div>
                        )}

                        {/* Course & Target Header Banner */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border bg-card/60">
                            <div className="space-y-0.5 min-w-0">
                                <span className="text-[11px] font-medium text-muted-foreground block">
                                    Target Examination Paper
                                </span>
                                <h4 className="text-sm font-semibold text-foreground truncate">
                                    {title.trim() || `${selectedResource?.name} Exam Simulation`}
                                </h4>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-border bg-muted/40 font-medium capitalize">
                                    {difficulty}
                                </span>
                                <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-border bg-muted/40 font-medium">
                                    {questionCount} Questions
                                </span>
                                <span className="text-[11px] px-2.5 py-0.5 rounded-full border border-border bg-muted/40 font-medium">
                                    {timeLimitMinutes} Mins
                                </span>
                            </div>
                        </div>

                        {/* Progress Bar & Counter */}
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs">
                                <span className="font-semibold text-foreground flex items-center gap-2">
                                    {generationProgress < 100 ? (
                                        <>
                                            <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                                            <span>Synthesizing questions via Senior Examiner…</span>
                                        </>
                                    ) : (
                                        <>
                                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                                            <span className="text-emerald-500 font-bold">Exam ready! Launching simulation…</span>
                                        </>
                                    )}
                                </span>
                                <span className="text-muted-foreground font-mono text-xs font-semibold">
                                    {Math.round(generationProgress)}%
                                </span>
                            </div>
                            <div className="h-2 w-full rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full bg-foreground rounded-full transition-all duration-700 ease-out"
                                    style={{ width: `${generationProgress}%` }}
                                />
                            </div>
                            <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                                <span className="flex items-center gap-1.5 font-mono">
                                    <Clock className="w-3 h-3" />
                                    <span>Elapsed: {elapsedSeconds}s</span>
                                </span>
                                <span>Typically takes ~15–35s</span>
                            </div>
                        </div>

                        {/* Pipeline Stages */}
                        <div className="space-y-2.5">
                            {generationStages.map((stg) => {
                                const isCompleted = generationStage > stg.stage || generationProgress === 100;
                                const isActive = generationStage === stg.stage && generationProgress < 100;
                                const Icon = stg.icon;

                                return (
                                    <div
                                        key={stg.stage}
                                        className={`p-3.5 rounded-xl border transition-all duration-300 flex items-start gap-3.5 ${
                                            isActive
                                                ? "border-foreground/30 bg-muted/30 shadow-sm"
                                                : isCompleted
                                                ? "border-emerald-500/20 bg-emerald-500/5 text-foreground"
                                                : "border-border/40 opacity-40 bg-card/20"
                                        }`}
                                    >
                                        <div
                                            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
                                                isCompleted
                                                    ? "bg-emerald-500 text-white"
                                                    : isActive
                                                    ? "bg-foreground text-background"
                                                    : "bg-muted text-muted-foreground"
                                            }`}
                                        >
                                            {isCompleted ? (
                                                <Check className="w-4 h-4 stroke-[3]" />
                                            ) : isActive ? (
                                                <Loader2 className="w-4 h-4 animate-spin" />
                                            ) : (
                                                <Icon className="w-4 h-4" />
                                            )}
                                        </div>

                                        <div className="space-y-0.5 min-w-0 flex-1">
                                            <div className="flex items-center justify-between gap-2">
                                                <span
                                                    className={`text-xs font-semibold ${
                                                        isActive
                                                            ? "text-foreground"
                                                            : isCompleted
                                                            ? "text-emerald-500 dark:text-emerald-400"
                                                            : "text-muted-foreground"
                                                    }`}
                                                >
                                                    {stg.title}
                                                </span>
                                                {isActive && (
                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-foreground animate-pulse">
                                                        Active
                                                    </span>
                                                )}
                                                {isCompleted && (
                                                    <span className="text-[10px] uppercase tracking-wider font-bold text-emerald-500">
                                                        Verified
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-[11px] text-muted-foreground leading-relaxed">
                                                {stg.description}
                                            </p>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Rotating Study Tip Card */}
                        <div className="p-3.5 rounded-xl border border-border bg-muted/20 flex items-start gap-3">
                            <div className="p-1.5 rounded-lg bg-foreground/10 text-foreground shrink-0 mt-0.5">
                                <Lightbulb className="w-4 h-4" />
                            </div>
                            <div className="space-y-0.5 text-xs min-w-0 flex-1">
                                <span className="font-semibold text-foreground block">
                                    {studyTips[currentTipIndex].title}
                                </span>
                                <p className="text-muted-foreground text-[11px] leading-relaxed">
                                    {studyTips[currentTipIndex].tip}
                                </p>
                            </div>
                        </div>

                        {/* Error state if failed */}
                        {errorMessage ? (
                            <div className="p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                                <div className="flex items-center gap-2 min-w-0">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    <span>{errorMessage}</span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                                    <button
                                        type="button"
                                        onClick={cancelGeneration}
                                        className="px-3 py-1.5 rounded-md text-xs font-medium border border-border bg-card text-foreground hover:bg-muted cursor-pointer transition-colors"
                                    >
                                        Back to Setup
                                    </button>
                                    <button
                                        type="button"
                                        onClick={executeGenerate}
                                        className="px-3 py-1.5 rounded-md text-xs font-medium bg-foreground text-background hover:opacity-90 cursor-pointer transition-opacity"
                                    >
                                        Try Again
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <div className="pt-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-[11px] text-muted-foreground border-t border-border">
                                <span className="flex items-center gap-1.5 text-foreground/80 font-medium">
                                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    <span>Durable session — safe to refresh or restore anytime</span>
                                </span>
                                <span>{isOnline ? "Senior Examiner agent active" : "Offline (reconnecting…)"}</span>
                            </div>
                        )}
                    </div>
                ) : (
                    <>
                        {errorMessage && (
                            <div className="p-3 rounded-xl border border-destructive/30 bg-destructive/10 text-xs text-destructive flex items-center gap-2 mb-3">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                <span>{errorMessage}</span>
                            </div>
                        )}

                        <form onSubmit={handleGenerate} className="space-y-5">
                            {/* Source Material Selection */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                        <FileText className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span>Source document</span>
                                    </label>
                            <button
                                type="button"
                                onClick={() => fileInputRef.current?.click()}
                                disabled={isUploading}
                                className="inline-flex items-center gap-1.5 text-xs text-foreground/80 hover:text-foreground font-medium cursor-pointer transition-colors"
                            >
                                <Upload className="w-3.5 h-3.5" />
                                <span>{isUploading ? "Uploading…" : "Upload document"}</span>
                            </button>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.doc,.docx,.txt,.md"
                                onChange={handleFileUpload}
                                className="hidden"
                            />
                        </div>

                        {isLoadingResources ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                {[1, 2, 3, 4].map((i) => (
                                    <div
                                        key={i}
                                        className="flex items-center justify-between p-2.5 rounded-lg border border-border/80 bg-muted/20 animate-pulse"
                                    >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                            <div className="w-5 h-5 rounded bg-muted-foreground/20 shrink-0" />
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
                            <div
                                onClick={() => fileInputRef.current?.click()}
                                className="p-6 rounded-lg border border-dashed border-border bg-muted/10 hover:bg-muted/20 cursor-pointer flex flex-col items-center justify-center gap-2 text-center transition-colors"
                            >
                                <Upload className="w-6 h-6 text-muted-foreground" />
                                <p className="text-xs font-medium text-foreground">Upload your lecture manual or textbook</p>
                                <p className="text-[11px] text-muted-foreground">PDF, Word, or text files supported</p>
                            </div>
                        ) : (
                            <div
                                className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-52 overflow-y-auto pr-0.5"
                                style={{ maxHeight: "208px" }}
                            >
                                {resources.map((res) => {
                                    const isSelected = selectedResource?.url === res.url;
                                    return (
                                        <button
                                            key={res.url}
                                            type="button"
                                            onClick={() => selectDoc(res)}
                                            disabled={isGenerating}
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
                                                    <div className="w-3.5 h-3.5" />
                                                )}
                                            </span>
                                        </button>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* Difficulty Level */}
                    <div>
                        <label className="text-xs font-medium text-foreground mb-2 flex items-center gap-1.5">
                            <Sliders className="w-3.5 h-3.5 text-muted-foreground" />
                            <span>Difficulty</span>
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                            {EXAM_DIFFICULTIES.map((diff) => {
                                const isSelected = difficulty === diff.id;
                                return (
                                    <button
                                        key={diff.id}
                                        type="button"
                                        onClick={() => setDifficulty(diff.id)}
                                        className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer flex flex-col justify-between ${
                                            isSelected
                                                ? "border-foreground bg-muted font-medium text-foreground shadow-xs"
                                                : "border-border bg-card hover:bg-muted/60 text-foreground"
                                        }`}
                                    >
                                        <div className="flex items-center justify-between w-full mb-1">
                                            <span className="text-xs font-medium">
                                                {diff.title}
                                            </span>
                                            {isSelected && <Check className="w-3.5 h-3.5 text-foreground" />}
                                        </div>
                                        <p className="text-[11px] text-muted-foreground leading-tight">
                                            {diff.description.split(",")[0]}
                                        </p>
                                    </button>
                                );
                            })}
                        </div>
                    </div>

                    {/* Question Count & Time Limit */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                            <label className="text-xs font-medium text-foreground mb-2 block">
                                Number of questions (max 50)
                            </label>
                            <div className="grid grid-cols-4 gap-2">
                                {VALID_QUESTION_COUNTS.map((count) => {
                                    const isSelected = questionCount === count;
                                    return (
                                        <button
                                            key={count}
                                            type="button"
                                            onClick={() => setQuestionCount(count)}
                                            className={`py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer text-center ${
                                                isSelected
                                                    ? "border-foreground bg-foreground text-background font-semibold"
                                                    : "border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                            }`}
                                        >
                                            {count}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="text-xs font-medium text-foreground flex items-center gap-1.5">
                                    <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                                    <span>Time limit</span>
                                </label>
                                <span className="text-xs text-muted-foreground">
                                    {timeLimitMinutes} minutes
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                {[15, 30, 45, 60].map((mins) => (
                                    <button
                                        key={mins}
                                        type="button"
                                        onClick={() => setTimeLimitMinutes(mins)}
                                        className={`flex-1 py-2 rounded-lg border text-xs font-medium transition-colors cursor-pointer text-center ${
                                            timeLimitMinutes === mins
                                                ? "border-foreground bg-muted text-foreground font-medium shadow-xs"
                                                : "border-border bg-card hover:bg-muted/60 text-muted-foreground hover:text-foreground"
                                        }`}
                                    >
                                        {mins}m
                                    </button>
                                ))}
                                <input
                                    type="number"
                                    min={5}
                                    max={180}
                                    value={timeLimitMinutes}
                                    onChange={(e) => setTimeLimitMinutes(Math.max(5, Math.min(180, Number(e.target.value) || 15)))}
                                    className="w-16 h-8 rounded-lg border border-border bg-card px-2 py-1 text-center text-xs outline-none focus:ring-1 focus:ring-ring"
                                    title="Custom minutes"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Titles */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-foreground">
                                Exam title (optional)
                            </label>
                            <input
                                type="text"
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                placeholder="e.g. Physics 101 Midterm Prep"
                                className="w-full h-9 rounded-sm px-3 py-2 text-xs border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                            />
                        </div>
                        <div className="space-y-1.5">
                            <label className="block text-xs font-medium text-foreground">
                                Course name (optional)
                            </label>
                            <input
                                type="text"
                                value={courseName}
                                onChange={(e) => setCourseName(e.target.value)}
                                placeholder="e.g. General Physics / PHY 101"
                                className="w-full h-9 rounded-sm px-3 py-2 text-xs border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-ring transition-colors"
                            />
                        </div>
                    </div>

                    {/* Action Footer */}
                    <div className="pt-2 flex items-center justify-end gap-3 border-t border-border">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isGenerating}
                            className="px-4 py-2.5 rounded-full text-xs font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isGenerating || !selectedResource}
                            className="inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-xs sm:text-sm font-medium text-background transition-opacity hover:opacity-85 disabled:opacity-50 cursor-pointer shadow-sm"
                        >
                            {isGenerating ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    <span>Generating {questionCount} Exam Questions…</span>
                                </>
                            ) : (
                                <>
                                    <Sparkles className="w-4 h-4" />
                                    <span>Start Exam Simulation</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </>
        )}
    </DialogContent>
</Dialog>
    );
}
