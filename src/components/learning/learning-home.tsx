"use client";

import React, { useState, useEffect, useCallback, useMemo, useSyncExternalStore } from "react";
import { useSession } from "next-auth/react";
import {
    loadLocalLearningProgress,
    saveLocalLearningProgress,
    mergeLearningProgress,
    getStorageKey,
    isLessonUnlocked,
} from "@/lib/learning-progress-store";
import type { LearningLesson, LearningPath, LessonProgressState, OfflineStudyPack } from "@/lib/learning-types";
import {
    buildStudyPackFromPath,
    saveStudyPack,
    listStudyPacks,
    deleteStudyPack,
    queueAttempt,
    getPendingAttempts,
    syncPendingAttemptsWithServer,
} from "@/lib/offline-learning-store";
import LessonPlayer from "./lesson-player";
import CreatePathModal from "./create-path-modal";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import {
    BookOpen,
    GraduationCap,
    Plus,
    Check,
    ArrowRight,
    ArrowLeft,
    Download,
    Trash2,
    Loader2,
    CloudOff,
    RefreshCw,
    Sparkles,
    Lock,
    ClipboardCheck,
} from "lucide-react";

interface LearningHomeProps {
    theme?: "light" | "dark";
    onOpenChat?: () => void;
}

export default function LearningHome({
    theme = "dark",
    onOpenChat,
}: LearningHomeProps) {
    const { data: session, status } = useSession();
    const mounted = useSyncExternalStore(subscribeToMount, () => true, () => false);

    if (!mounted || status === "loading") {
        return (
            <main className="w-full flex-1 overflow-y-auto p-6 sm:p-8">
                <div className="flex items-center gap-3">
                    <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Loading learning paths…</span>
                </div>
            </main>
        );
    }

    const userEmail = session?.user?.email ?? null;
    return <LearningCourse key={userEmail || "guest"} userEmail={userEmail} theme={theme} onOpenChat={onOpenChat} />;
}

function subscribeToMount() { return () => {}; }

function formatGoalPreview(goal: string, maxLen = 95): string {
    if (!goal) return "";
    const clean = goal.trim();
    if (clean.length <= maxLen) return clean;
    const cut = clean.slice(0, maxLen);
    const lastSpace = cut.lastIndexOf(" ");
    const boundary = lastSpace > 45 ? cut.slice(0, lastSpace) : cut;
    return `${boundary.replace(/[.,;:]+$/, "")}...`;
}

function readLearningUrlState(): { pathId: string | null; lessonId: string | null; view: "dashboard" | "lesson" } {
    if (typeof window === "undefined") {
        return { pathId: null, lessonId: null, view: "dashboard" };
    }
    const params = new URLSearchParams(window.location.search);
    const pathId = params.get("path") || params.get("pathId");
    const lessonId = params.get("lesson") || params.get("lessonId");
    const viewParam = params.get("view");
    const view: "dashboard" | "lesson" = (viewParam === "lesson" || Boolean(lessonId)) ? "lesson" : "dashboard";
    return { pathId, lessonId, view };
}

function writeLearningUrlState(
    params: { pathId?: string | null; lessonId?: string | null; view?: "dashboard" | "lesson" },
    mode: "push" | "replace" = "push"
) {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);

    if (params.pathId) {
        url.searchParams.set("path", params.pathId);
    } else {
        url.searchParams.delete("path");
    }

    if (params.view === "lesson" && params.lessonId) {
        url.searchParams.set("lesson", params.lessonId);
    } else {
        url.searchParams.delete("lesson");
    }

    url.searchParams.delete("pathId");
    url.searchParams.delete("lessonId");
    url.searchParams.delete("view");

    const newUrl = `${url.pathname}${url.search}${url.hash}`;
    if (window.location.pathname + window.location.search + window.location.hash !== newUrl) {
        if (mode === "push") {
            window.history.pushState(window.history.state, "", newUrl);
        } else {
            window.history.replaceState(window.history.state, "", newUrl);
        }
    }
}

function LearningCourse({ userEmail, theme = "dark" }: LearningHomeProps & { userEmail: string | null }) {
    // Read initial URL state
    const initialUrlState = useMemo(() => readLearningUrlState(), []);

    // Personal study paths state
    const [personalPaths, setPersonalPaths] = useState<LearningPath[]>([]);
    const [isLoadingPaths, setIsLoadingPaths] = useState<boolean>(Boolean(userEmail));
    const [selectedPathId, setSelectedPathId] = useState<string | null>(() => initialUrlState.pathId);
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [isGeneratingPath, setIsGeneratingPath] = useState(false);
    const [pathActionError, setPathActionError] = useState<string | null>(null);
    const [deletePathTarget, setDeletePathTarget] = useState<{ id: string; title: string } | null>(null);
    const [isDeletingPath, setIsDeletingPath] = useState(false);

    // View navigation state initialized from URL
    const [activeSubView, setActiveSubView] = useState<"dashboard" | "lesson">(() => initialUrlState.view);
    const [activeLessonId, setActiveLessonId] = useState<string | null>(() => initialUrlState.lessonId);

    // Offline, study packs, and sync state
    const [isOnline, setIsOnline] = useState<boolean>(() =>
        typeof navigator !== "undefined" ? navigator.onLine : true
    );
    const [downloadedPacks, setDownloadedPacks] = useState<Record<string, OfflineStudyPack>>({});
    const [downloadingPathId, setDownloadingPathId] = useState<string | null>(null);
    const [pendingSyncCount, setPendingSyncCount] = useState<number>(0);
    const [isSyncing, setIsSyncing] = useState<boolean>(false);
    const [syncSuccessMessage, setSyncSuccessMessage] = useState<string | null>(null);
    const [syncErrorMessage, setSyncErrorMessage] = useState<string | null>(null);

    const refreshOfflineState = useCallback(async () => {
        try {
            const packs = await listStudyPacks(userEmail);
            const packMap: Record<string, OfflineStudyPack> = {};
            for (const p of packs) packMap[p.id] = p;
            setDownloadedPacks(packMap);

            if (userEmail) {
                const pending = await getPendingAttempts(userEmail);
                setPendingSyncCount(pending.length);
            }
        } catch (e) {
            console.error("Could not refresh offline state:", e);
        }
    }, [userEmail]);

    const loadPersonalPaths = useCallback(async () => {
        if (userEmail) {
            setIsLoadingPaths(true);
            try {
                const res = await fetch("/api/learning/paths");
                if (res.ok) {
                    const data = await res.json();
                    const paths = (data.paths || []) as LearningPath[];
                    setPersonalPaths(paths);
                    const urlState = readLearningUrlState();
                    const targetPath = urlState.pathId ? paths.find((p) => p.id === urlState.pathId) || null : null;

                    if (targetPath) {
                        setSelectedPathId(targetPath.id);
                        if (urlState.view === "lesson") {
                            setActiveSubView("lesson");
                            const compIds = targetPath.progress?.completedLessonIds || [];
                            if (
                                urlState.lessonId &&
                                targetPath.lessons.some((l) => l.id === urlState.lessonId) &&
                                isLessonUnlocked(urlState.lessonId, targetPath.lessons, compIds)
                            ) {
                                setActiveLessonId(urlState.lessonId);
                            } else if (targetPath.lessons.length > 0) {
                                setActiveLessonId(targetPath.lessons[0].id);
                            }
                        } else {
                            setActiveSubView("dashboard");
                            setActiveLessonId(null);
                        }
                    } else {
                        setSelectedPathId(null);
                        setActiveSubView("dashboard");
                        setActiveLessonId(null);
                    }

                    // Seed progress store with server progress
                    for (const p of paths) {
                        if (p.progress && (p.progress.completedLessonIds.length > 0 || p.progress.lastLessonId)) {
                            const existing = loadLocalLearningProgress(p.id, userEmail);
                            if (existing.completedLessonIds.length === 0 && !existing.lastLessonId) {
                                try {
                                    saveLocalLearningProgress(p.id, {
                                        lastLessonId: p.progress.lastLessonId,
                                        completedLessonIds: p.progress.completedLessonIds,
                                    }, userEmail);
                                } catch {
                                    // ignore storage errors
                                }
                            }
                        }
                    }
                    return;
                }
            } catch (err) {
                console.error("Could not load study paths:", err);
            } finally {
                setIsLoadingPaths(false);
            }
        } else {
            setIsLoadingPaths(false);
        }

        // Offline fallback: populate paths from downloaded study packs
        try {
            const packs = await listStudyPacks(userEmail);
            const offlinePaths: LearningPath[] = packs.map((p) => ({
                id: p.id,
                title: p.title,
                goal: p.goal,
                language: p.language,
                status: "ready",
                resourceUrls: [],
                lessons: p.lessons,
                version: p.version,
                progress: { lastLessonId: null, completedLessonIds: [] },
                createdAt: p.downloadedAt,
                updatedAt: p.downloadedAt,
            }));
            if (offlinePaths.length > 0) {
                setPersonalPaths(offlinePaths);
                const urlState = readLearningUrlState();
                const targetPath = urlState.pathId ? offlinePaths.find((p) => p.id === urlState.pathId) || null : null;
                if (targetPath) {
                    setSelectedPathId(targetPath.id);
                    if (urlState.view === "lesson") {
                        setActiveSubView("lesson");
                        const compIds = targetPath.progress?.completedLessonIds || [];
                        if (
                            urlState.lessonId &&
                            targetPath.lessons.some((l) => l.id === urlState.lessonId) &&
                            isLessonUnlocked(urlState.lessonId, targetPath.lessons, compIds)
                        ) {
                            setActiveLessonId(urlState.lessonId);
                        } else if (targetPath.lessons.length > 0) {
                            setActiveLessonId(targetPath.lessons[0].id);
                        }
                    } else {
                        setActiveSubView("dashboard");
                        setActiveLessonId(null);
                    }
                } else {
                    setSelectedPathId(null);
                    setActiveSubView("dashboard");
                    setActiveLessonId(null);
                }
            }
        } catch {
            // ignore
        }
    }, [userEmail]);

    const handleSyncAttempts = useCallback(async () => {
        if (!userEmail || isSyncing) return;
        setIsSyncing(true);
        setSyncSuccessMessage(null);
        try {
            const res = await syncPendingAttemptsWithServer(userEmail);
            if (res.syncedCount > 0 || res.duplicatesCount > 0) {
                setSyncSuccessMessage(
                    `Synced ${res.syncedCount} attempt${res.syncedCount === 1 ? "" : "s"}${
                        res.duplicatesCount > 0 ? ` (${res.duplicatesCount} duplicate${res.duplicatesCount === 1 ? "" : "s"} ignored)` : ""
                    }`
                );
                setTimeout(() => setSyncSuccessMessage(null), 4000);
            }
            await refreshOfflineState();
            await loadPersonalPaths();
        } catch (err: unknown) {
            setSyncErrorMessage(err instanceof Error ? err.message : "Sync temporarily unavailable");
            setTimeout(() => setSyncErrorMessage(null), 5000);
        } finally {
            setIsSyncing(false);
        }
    }, [userEmail, isSyncing, refreshOfflineState, loadPersonalPaths]);

    useEffect(() => {
        loadPersonalPaths();
        refreshOfflineState();

        const onOnline = () => {
            setIsOnline(true);
            if (userEmail) {
                handleSyncAttempts();
            }
        };
        const onOffline = () => setIsOnline(false);

        window.addEventListener("online", onOnline);
        window.addEventListener("offline", onOffline);

        return () => {
            window.removeEventListener("online", onOnline);
            window.removeEventListener("offline", onOffline);
        };
    }, [loadPersonalPaths, refreshOfflineState, userEmail, handleSyncAttempts]);

    async function handleDownloadStudyPack(targetId: string) {
        setDownloadingPathId(targetId);
        try {
            const targetPath = personalPaths.find((p) => p.id === targetId);
            if (targetPath && userEmail) {
                const pack = buildStudyPackFromPath(targetPath, userEmail);
                await saveStudyPack(pack);
            }
            await refreshOfflineState();
        } catch (err) {
            console.error("Download failed:", err);
        } finally {
            setDownloadingPathId(null);
        }
    }

    async function handleRemoveDownloadedPack(targetId: string) {
        try {
            await deleteStudyPack(targetId, userEmail);
            await refreshOfflineState();
        } catch (err) {
            console.error("Failed to remove downloaded pack:", err);
        }
    }

    const activePersonalPath = selectedPathId ? personalPaths.find((p) => p.id === selectedPathId) || null : null;
    const activeCourseId = activePersonalPath ? activePersonalPath.id : "";
    const activeLessons: LearningLesson[] = activePersonalPath ? activePersonalPath.lessons : [];
    const activeTitle = activePersonalPath ? activePersonalPath.title : "";
    const activeGoal = activePersonalPath ? activePersonalPath.goal : "";
    const totalLessons = activeLessons.length;

    // Persistent learning progress
    const [progress, setProgress] = useState<LessonProgressState>(() =>
        activeCourseId ? loadLocalLearningProgress(activeCourseId, userEmail) : {
            lastLessonId: null,
            completedLessonIds: [],
            questionAnswers: {},
            practicalTaskAnswers: {},
            practicalCompleted: false,
            activeLanguage: "en",
        }
    );

    useEffect(() => {
        if (activeCourseId) {
            setProgress(loadLocalLearningProgress(activeCourseId, userEmail));
        }
    }, [activeCourseId, userEmail]);

    // Listen to browser Back/Forward (popstate) to sync URL with view state
    useEffect(() => {
        function handlePopState() {
            const urlState = readLearningUrlState();
            if (urlState.pathId) {
                setSelectedPathId(urlState.pathId);
                const targetPath = personalPaths.find((p) => p.id === urlState.pathId);
                const pathLessons = targetPath ? targetPath.lessons : [];
                const userProgress = loadLocalLearningProgress(urlState.pathId, userEmail);

                if (urlState.view === "lesson" && urlState.lessonId) {
                    if (isLessonUnlocked(urlState.lessonId, pathLessons, userProgress.completedLessonIds)) {
                        setActiveSubView("lesson");
                        setActiveLessonId(urlState.lessonId);
                    } else {
                        setActiveSubView("dashboard");
                        setActiveLessonId(null);
                    }
                } else {
                    setActiveSubView("dashboard");
                    setActiveLessonId(null);
                }
            } else {
                setSelectedPathId(null);
                setActiveSubView("dashboard");
                setActiveLessonId(null);
            }
        }
        window.addEventListener("popstate", handlePopState);
        return () => window.removeEventListener("popstate", handlePopState);
    }, [personalPaths, userEmail]);

    const [storageFailed, setStorageFailed] = useState(false);

    function updateProgress(updates: Partial<LessonProgressState>) {
        if (!activeCourseId) return;
        const next = mergeLearningProgress(progress, updates, activeCourseId);
        setProgress(next);
        try {
            saveLocalLearningProgress(activeCourseId, next, userEmail, progress);
            setStorageFailed(false);
        } catch {
            setStorageFailed(true);
        }
    }

    useEffect(() => {
        if (!activeCourseId) return;
        const handleStorage = (event: StorageEvent) => {
            if (event.key !== null && event.key !== getStorageKey(activeCourseId, userEmail)) return;
            setProgress(loadLocalLearningProgress(activeCourseId, userEmail));
        };
        window.addEventListener("storage", handleStorage);
        return () => window.removeEventListener("storage", handleStorage);
    }, [activeCourseId, userEmail]);

    // Handle question answer & offline queueing
    async function handleAnswerQuestion(questionId: string, optionId: string) {
        updateProgress({ questionAnswers: { [questionId]: optionId } });

        if (currentLesson && activeCourseId) {
            const isCorrect = currentLesson.questions?.find((q) => q.id === questionId)?.correctOptionId === optionId;
            try {
                await queueAttempt({
                    userEmail,
                    pathId: activeCourseId,
                    lessonId: currentLesson.id,
                    questionId,
                    selectedOptionId: optionId,
                    isCorrect: Boolean(isCorrect),
                    timestamp: new Date().toISOString(),
                });
                if (userEmail) {
                    const pending = await getPendingAttempts(userEmail);
                    setPendingSyncCount(pending.length);
                }
            } catch (err) {
                console.error("Could not queue attempt:", err);
            }
        }
    }

    // Handle clearing question answer to retry freshly
    function handleRetryQuestion(questionId: string) {
        if (!activeCourseId) return;
        const nextAnswers = { ...progress.questionAnswers };
        delete nextAnswers[questionId];
        const nextState: LessonProgressState = {
            ...progress,
            questionAnswers: nextAnswers,
        };
        setProgress(nextState);
        try {
            if (typeof localStorage !== "undefined") {
                localStorage.setItem(getStorageKey(activeCourseId, userEmail), JSON.stringify(nextState));
            }
            setStorageFailed(false);
        } catch {
            setStorageFailed(true);
        }
    }

    // Handle marking lesson completed or toggling
    async function handleToggleLessonComplete(lessonId: string) {
        const currentCompleted = new Set(progress.completedLessonIds);
        if (currentCompleted.has(lessonId)) {
            currentCompleted.delete(lessonId);
        } else {
            currentCompleted.add(lessonId);
        }
        const nextCompleted = Array.from(currentCompleted);
        updateProgress({ completedLessonIds: nextCompleted });

        if (userEmail && activeCourseId) {
            try {
                await fetch(`/api/learning/paths/${activeCourseId}/progress`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lastLessonId: progress.lastLessonId || lessonId,
                        completedLessonIds: nextCompleted,
                    }),
                });
            } catch (err) {
                console.error("Could not sync progress to server:", err);
            }
        }
    }

    // Handle open lesson (with sequential lock protection)
    async function handleOpenLesson(lessonId: string) {
        if (!isLessonUnlocked(lessonId, activeLessons, progress.completedLessonIds)) {
            return;
        }
        setActiveLessonId(lessonId);
        setActiveSubView("lesson");
        updateProgress({ lastLessonId: lessonId });
        writeLearningUrlState({ pathId: activeCourseId, lessonId, view: "lesson" }, "push");

        if (userEmail && activeCourseId) {
            try {
                await fetch(`/api/learning/paths/${activeCourseId}/progress`, {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        lastLessonId: lessonId,
                        completedLessonIds: progress.completedLessonIds,
                    }),
                });
            } catch {
                // ignore
            }
        }
    }

    // Advance to next lesson with automatic completion of current lesson
    async function handleAdvanceToNextLesson(currentId: string, nextId: string) {
        let currentCompleted = progress.completedLessonIds;
        if (!currentCompleted.includes(currentId)) {
            const nextCompleted = [...currentCompleted, currentId];
            currentCompleted = nextCompleted;
            updateProgress({ completedLessonIds: nextCompleted, lastLessonId: nextId });
            if (userEmail && activeCourseId) {
                try {
                    await fetch(`/api/learning/paths/${activeCourseId}/progress`, {
                        method: "PUT",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            lastLessonId: nextId,
                            completedLessonIds: nextCompleted,
                        }),
                    });
                } catch {
                    // ignore
                }
            }
        } else {
            updateProgress({ lastLessonId: nextId });
        }
        setActiveLessonId(nextId);
        setActiveSubView("lesson");
        writeLearningUrlState({ pathId: activeCourseId, lessonId: nextId, view: "lesson" }, "push");
    }

    function handleBackToDashboard() {
        setActiveSubView("dashboard");
        setActiveLessonId(null);
        writeLearningUrlState({ pathId: activeCourseId, lessonId: null, view: "dashboard" }, "push");
    }

    function handleBackToCatalog() {
        setSelectedPathId(null);
        setActiveSubView("dashboard");
        setActiveLessonId(null);
        writeLearningUrlState({ pathId: null, lessonId: null, view: "dashboard" }, "push");
    }

    function handleSelectPath(pathId: string) {
        setSelectedPathId(pathId);
        setActiveSubView("dashboard");
        setActiveLessonId(null);
        writeLearningUrlState({ pathId, lessonId: null, view: "dashboard" }, "push");
    }

    async function handleGenerateDraftPath(pathId: string) {
        setIsGeneratingPath(true);
        setPathActionError(null);
        try {
            const res = await fetch(`/api/learning/paths/${pathId}/generate`, { method: "POST" });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "Failed to generate path");
            setPersonalPaths((prev) => prev.map((p) => (p.id === pathId ? data.path : p)));
        } catch (err: unknown) {
            setPathActionError(err instanceof Error ? err.message : "Generation failed");
        } finally {
            setIsGeneratingPath(false);
        }
    }

    function handleRequestDeletePath(target: { id: string; title: string }) {
        setDeletePathTarget(target);
    }

    async function handleConfirmDeletePath() {
        if (!deletePathTarget) return;
        const targetId = deletePathTarget.id;
        setIsDeletingPath(true);
        try {
            const res = await fetch(`/api/learning/paths/${targetId}`, { method: "DELETE" });
            if (res.ok) {
                setPersonalPaths((prev) => prev.filter((p) => p.id !== targetId));
                if (selectedPathId === targetId) {
                    setSelectedPathId(null);
                    setActiveSubView("dashboard");
                    setActiveLessonId(null);
                    writeLearningUrlState({ pathId: null, lessonId: null, view: "dashboard" }, "push");
                }
                setDeletePathTarget(null);
            }
        } catch (err) {
            console.error("Could not delete path:", err);
        } finally {
            setIsDeletingPath(false);
        }
    }

    // Active lesson object
    const currentLessonIndex = activeLessons.findIndex((l) => l.id === activeLessonId);
    const currentLesson = currentLessonIndex >= 0 ? activeLessons[currentLessonIndex] : activeLessons[0];

    // Compute progress stats
    const completedCount = progress.completedLessonIds.length;
    const progressPercent = totalLessons > 0 ? Math.round((completedCount / totalLessons) * 100) : 0;

    // Determine the resume target (always pointing to an unlocked lesson)
    const firstIncompleteUnlockedLesson = activeLessons.find((l) => {
        const isDone = progress.completedLessonIds.includes(l.id);
        if (isDone) return false;
        return isLessonUnlocked(l.id, activeLessons, progress.completedLessonIds);
    }) || activeLessons[0];

    const isResumeUnlocked = progress.lastLessonId
        ? isLessonUnlocked(progress.lastLessonId, activeLessons, progress.completedLessonIds)
        : false;

    const resumeLesson = (isResumeUnlocked && activeLessons.find((l) => l.id === progress.lastLessonId))
        || firstIncompleteUnlockedLesson
        || activeLessons[0];

    const persistenceNotice = storageFailed ? (
        <div role="alert" className="p-3 text-sm rounded-xl border border-border bg-card mb-4">
            Progress is available for this visit, but could not be saved to device storage.
            <button type="button" className="underline ml-2 cursor-pointer font-medium" onClick={() => updateProgress(progress)}>Retry saving</button>
        </div>
    ) : null;

    // Synchronize current state to URL automatically
    useEffect(() => {
        if (!activeCourseId) return;
        if (activeSubView === "lesson" && currentLesson) {
            writeLearningUrlState({ pathId: activeCourseId, lessonId: currentLesson.id, view: "lesson" }, "replace");
        } else if (activeSubView === "dashboard") {
            writeLearningUrlState({ pathId: activeCourseId, lessonId: null, view: "dashboard" }, "replace");
        }
    }, [activeCourseId, activeSubView, currentLesson]);

    // Sub-view: Lesson Player
    if (activeSubView === "lesson") {
        if (!currentLesson && isLoadingPaths) {
            return (
                <main className="w-full flex-1 overflow-y-auto p-6 sm:p-8 animate-pulse space-y-6">
                    <div className="h-6 w-36 rounded-md bg-muted" />
                    <div className="h-10 w-72 rounded-lg bg-muted" />
                    <div className="h-4 w-96 rounded-md bg-muted" />
                    <div className="h-96 w-full rounded-3xl bg-muted/60" />
                </main>
            );
        }
        if (currentLesson) {
            return (
                <main className="w-full flex-1 overflow-y-auto p-6 sm:p-8">
                    {persistenceNotice}
                    <LessonPlayer
                        key={currentLesson.id}
                        lesson={currentLesson}
                        courseId={activeCourseId}
                        language={progress.activeLanguage}
                        onLanguageChange={(activeLanguage) => updateProgress({ activeLanguage })}
                        lessonIndex={currentLessonIndex >= 0 ? currentLessonIndex : 0}
                        totalLessons={totalLessons}
                        isCompleted={progress.completedLessonIds.includes(currentLesson.id)}
                        savedAnswers={progress.questionAnswers}
                        onAnswerQuestion={handleAnswerQuestion}
                        onRetryQuestion={handleRetryQuestion}
                        onToggleLessonComplete={handleToggleLessonComplete}
                        onNextLesson={
                            currentLessonIndex < totalLessons - 1
                                ? () => handleAdvanceToNextLesson(currentLesson.id, activeLessons[currentLessonIndex + 1].id)
                                : undefined
                        }
                        onPreviousLesson={
                            currentLessonIndex > 0
                                ? () => handleOpenLesson(activeLessons[currentLessonIndex - 1].id)
                                : undefined
                        }
                        onBackToDashboard={handleBackToDashboard}
                        theme={theme}
                        isOnline={isOnline}
                    />
                </main>
            );
        }
    }

    // Main Dashboard View
    return (
        <main className="w-full flex-1 overflow-y-auto p-6 sm:p-8">
            {persistenceNotice}

            {/* Header Section matching Workspaces & Resources */}
            {activePersonalPath ? (
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <button
                        type="button"
                        onClick={handleBackToCatalog}
                        className="inline-flex items-center gap-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer group"
                    >
                        <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
                        <span>All study paths</span>
                    </button>
                    {userEmail && (
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center gap-2 rounded-full bg-foreground px-4 py-2 text-xs sm:text-sm font-medium text-background transition-opacity hover:opacity-85 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create Study Path</span>
                        </button>
                    )}
                </div>
            ) : (
                <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
                    <div>
                        <h1 className="text-2xl font-semibold tracking-tight">Learn</h1>
                        <p className="mt-1 text-sm text-muted-foreground">
                            Personalized study paths generated from your uploaded resources.
                        </p>
                    </div>
                    {userEmail && (
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create Study Path</span>
                        </button>
                    )}
                </div>
            )}

            {/* Exam Prep Cross-Link Card */}
            {!activePersonalPath && (
                <a
                    href="/exam-prep"
                    className="mb-6 p-4 sm:p-5 rounded-2xl border border-border bg-card/60 hover:bg-card hover:border-foreground/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 group cursor-pointer block shadow-sm"
                >
                    <div className="flex items-start gap-3.5">
                        <span className="p-2 rounded-xl bg-foreground/10 text-foreground shrink-0 mt-0.5">
                            <ClipboardCheck className="w-5 h-5" />
                        </span>
                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-sm font-semibold text-foreground">
                                    Simulate Your Upcoming Exam
                                </h3>
                                <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-foreground/10 text-foreground border border-foreground/20">
                                    Exam Prep
                                </span>
                            </div>
                            <p className="text-xs text-muted-foreground mt-0.5 leading-relaxed">
                                Finished reading your lecture notes or course manual? Practice under realistic countdown timers with automatic grading.
                            </p>
                        </div>
                    </div>
                    <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-foreground shrink-0">
                        <span>Launch Exam Prep</span>
                        <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
                    </div>
                </a>
            )}

            {/* Offline and Sync Status Banner */}
            {(!isOnline || pendingSyncCount > 0 || syncSuccessMessage || syncErrorMessage) && (
                <div
                    role="status"
                    aria-live="polite"
                    className="mb-6 p-4 rounded-2xl border border-border bg-card transition-all flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                    <div className="flex items-center gap-2.5">
                        {!isOnline ? (
                            <CloudOff className="w-4 h-4 text-muted-foreground shrink-0" />
                        ) : (
                            <RefreshCw className={`w-4 h-4 text-muted-foreground shrink-0 ${isSyncing ? "animate-spin" : ""}`} />
                        )}
                        <span className="font-medium text-foreground">
                            {!isOnline
                                ? "Offline Mode — You are studying offline. Downloaded study packs and practice work without internet."
                                : syncErrorMessage
                                ? syncErrorMessage
                                : syncSuccessMessage
                                ? syncSuccessMessage
                                : `${pendingSyncCount} offline attempt${pendingSyncCount === 1 ? "" : "s"} ready to synchronize.`}
                        </span>
                    </div>

                    {isOnline && pendingSyncCount > 0 && (
                        <button
                            type="button"
                            onClick={handleSyncAttempts}
                            disabled={isSyncing}
                            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full font-medium bg-foreground text-background text-xs transition-opacity hover:opacity-85 disabled:opacity-50 cursor-pointer focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                        >
                            {isSyncing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                            <span>{isSyncing ? "Synchronizing…" : "Sync Now"}</span>
                        </button>
                    )}
                </div>
            )}

            {/* Unauthenticated State */}
            {!userEmail && (
                <div className="rounded-3xl border border-dashed border-border p-12 text-center">
                    <div className="mx-auto max-w-sm">
                        <GraduationCap className="mx-auto h-10 w-10 text-muted-foreground" />
                        <h2 className="mt-4 text-lg font-medium">Sign in to start learning</h2>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                            Sign in to generate personalized study paths from your uploaded documents, study offline, and track your progress.
                        </p>
                        <a
                            href="/login?callbackUrl=%2Flearn"
                            className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85"
                        >
                            Sign in to Learn
                        </a>
                    </div>
                </div>
            )}

            {/* Loading Paths Skeleton */}
            {userEmail && isLoadingPaths && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                    {[1, 2, 3].map((i) => (
                        <div key={i} className="h-48 animate-pulse rounded-2xl bg-muted" />
                    ))}
                </div>
            )}

            {/* Empty State: No Study Paths Yet */}
            {userEmail && !isLoadingPaths && personalPaths.length === 0 && (
                <div className="rounded-3xl border border-dashed border-border p-12 text-center">
                    <div className="mx-auto max-w-md">
                        <BookOpen className="mx-auto h-10 w-10 text-muted-foreground" />
                        <h2 className="mt-4 text-lg font-medium">No study paths yet</h2>
                        <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                            Select up to 3 documents from your Resources to generate a personalized, source-grounded study path with lessons, practice questions, and an AI tutor.
                        </p>
                        <button
                            type="button"
                            onClick={() => setIsCreateModalOpen(true)}
                            className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-opacity hover:opacity-85 cursor-pointer"
                        >
                            <Plus className="w-4 h-4" />
                            <span>Create your first study path</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Study Paths Catalog Grid: When on /learn and user has paths */}
            {userEmail && !isLoadingPaths && !activePersonalPath && personalPaths.length > 0 && (
                <div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {personalPaths.map((path) => {
                            const localProg = loadLocalLearningProgress(path.id, userEmail);
                            const compCount = Math.max(
                                localProg.completedLessonIds?.length || 0,
                                path.progress?.completedLessonIds?.length || 0
                            );
                            const total = path.lessons.length;
                            const pct = total > 0 ? Math.round((compCount / total) * 100) : 0;
                            const isOffline = Boolean(downloadedPacks[path.id]);
                            const isDraft = path.status === "draft";

                            return (
                                <div
                                    key={path.id}
                                    onClick={() => handleSelectPath(path.id)}
                                    className="group relative flex flex-col justify-between rounded-2xl border border-border bg-card p-5 sm:p-6 transition-all duration-200 hover:border-foreground/30 hover:shadow-xs cursor-pointer min-h-[220px]"
                                >
                                    <div>
                                        {/* Top Badges & Actions */}
                                        <div className="flex items-center justify-between gap-2 mb-3">
                                            <div className="flex items-center gap-1.5 flex-wrap">
                                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full border border-border bg-muted/60 text-xs font-medium text-muted-foreground">
                                                    <BookOpen className="w-3 h-3" />
                                                    <span>{isDraft ? "Draft Outline" : "Study Path"}</span>
                                                </span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-border bg-muted/40 text-muted-foreground uppercase">
                                                    {path.language || "en"}
                                                </span>
                                                {isOffline && (
                                                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium border border-border bg-muted/40 text-foreground">
                                                        <Check className="w-3 h-3 text-muted-foreground" />
                                                        <span>Offline</span>
                                                    </span>
                                                )}
                                            </div>

                                            {/* Quick Delete */}
                                            <button
                                                type="button"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    handleRequestDeletePath({ id: path.id, title: path.title });
                                                }}
                                                className="text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-destructive/10 cursor-pointer"
                                                title="Delete study path"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>

                                        {/* Title */}
                                        <h3
                                            className="text-base sm:text-lg font-semibold tracking-tight text-foreground transition-colors"
                                            style={{
                                                display: "-webkit-box",
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: "vertical",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {path.title}
                                        </h3>

                                        {/* Goal Description (truncated with '...') */}
                                        <p
                                            className="mt-2 text-xs sm:text-sm text-muted-foreground leading-relaxed"
                                            style={{
                                                display: "-webkit-box",
                                                WebkitLineClamp: 2,
                                                WebkitBoxOrient: "vertical",
                                                overflow: "hidden",
                                            }}
                                        >
                                            {formatGoalPreview(path.goal)}
                                        </p>
                                    </div>

                                    {/* Bottom Progress & Action */}
                                    <div className="mt-6 pt-4 border-t border-border/60">
                                        {!isDraft && total > 0 ? (
                                            <div>
                                                <div className="flex items-center justify-between text-xs text-muted-foreground mb-1.5">
                                                    <span>{pct}% Completed</span>
                                                    <span>{compCount} of {total} lessons</span>
                                                </div>
                                                <div className="w-full bg-muted rounded-full h-1.5 overflow-hidden">
                                                    <div
                                                        className="bg-foreground h-1.5 rounded-full transition-all duration-300"
                                                        style={{ width: `${pct}%` }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-muted-foreground">
                                                <span>{total} topics in outline</span>
                                            </div>
                                        )}

                                        <div className="mt-4 flex items-center justify-between">
                                            <span className="text-xs font-semibold text-foreground group-hover:underline inline-flex items-center gap-1.5">
                                                {isDraft ? "Generate Lessons" : pct === 100 ? "Review Path" : pct > 0 ? "Continue Learning" : "Start Learning"}
                                                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-1" />
                                            </span>

                                            <span className="text-[11px] text-muted-foreground">
                                                {total} lesson{total === 1 ? "" : "s"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Active Study Path Content */}
            {userEmail && !isLoadingPaths && activePersonalPath && (
                <div>

                    {/* Path Header Info */}
                    <div className="mb-6">
                        <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                            <div className="flex items-center gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full border border-border bg-muted/60 text-xs font-medium text-muted-foreground">
                                    <BookOpen className="w-3 h-3" />
                                    <span>{activePersonalPath.status === "ready" ? "Study Path" : "Draft Outline"}</span>
                                </span>
                                <span className="px-2 py-0.5 rounded-full text-[10px] font-medium border border-border bg-muted/40 text-muted-foreground capitalize">
                                    {activePersonalPath.language === "fr" ? "Français" : "English"}
                                </span>
                            </div>

                            <div className="flex items-center gap-2">
                                {downloadedPacks[activeCourseId] ? (
                                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl border border-border bg-muted/50 text-foreground text-xs font-medium">
                                        <Check className="w-3.5 h-3.5 text-muted-foreground" />
                                        <span>Offline ({(downloadedPacks[activeCourseId].sizeBytes / 1024).toFixed(1)} KB)</span>
                                        <button
                                            type="button"
                                            onClick={() => handleRemoveDownloadedPack(activeCourseId)}
                                            className="text-muted-foreground hover:text-destructive transition-colors cursor-pointer text-[11px] underline ml-1"
                                        >
                                            Remove
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => handleDownloadStudyPack(activeCourseId)}
                                        disabled={downloadingPathId === activeCourseId}
                                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium border border-border bg-card hover:bg-muted text-foreground transition-colors cursor-pointer disabled:opacity-50"
                                    >
                                        {downloadingPathId === activeCourseId ? (
                                            <>
                                                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                <span>Downloading…</span>
                                            </>
                                        ) : (
                                            <>
                                                <Download className="w-3.5 h-3.5" />
                                                <span>Download offline</span>
                                            </>
                                        )}
                                    </button>
                                )}

                                <button
                                    type="button"
                                    onClick={() => handleRequestDeletePath({ id: activeCourseId, title: activeTitle })}
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors cursor-pointer border border-transparent hover:border-destructive/20"
                                    title="Delete study path"
                                >
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                </button>
                            </div>
                        </div>

                        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground mb-2">
                            {activeTitle}
                        </h1>
                        <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-3xl">
                            {activeGoal}
                        </p>
                    </div>

                    {/* If Active Path is Draft Outline: Show Generation Card */}
                    {activePersonalPath.status === "draft" && (
                        <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 mb-8 transition-colors">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
                                <div>
                                    <span className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border border-border bg-muted/60 text-muted-foreground mb-2 inline-block">
                                        Outline Ready
                                    </span>
                                    <h2 className="text-lg sm:text-xl font-bold text-foreground">
                                        Generate Source-Grounded Lessons ({activeLessons.length} Topics)
                                    </h2>
                                    <p className="text-xs sm:text-sm text-muted-foreground mt-1 max-w-xl leading-relaxed">
                                        Gluk will extract authorized excerpts from your selected documents, generate grounded lesson explanations, verify source references, and create 3 practice questions per lesson.
                                    </p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => handleGenerateDraftPath(activePersonalPath.id)}
                                    disabled={isGeneratingPath}
                                    className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-2.5 text-xs sm:text-sm font-medium text-background transition-opacity hover:opacity-85 cursor-pointer self-start sm:self-auto shrink-0 disabled:opacity-50"
                                >
                                    {isGeneratingPath && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                                    <span>{isGeneratingPath ? "Generating & Validating…" : "Generate Lessons with AI"}</span>
                                    {!isGeneratingPath && <Sparkles className="w-3.5 h-3.5" />}
                                </button>
                            </div>

                            {pathActionError && (
                                <div role="alert" className="mt-3 p-3 rounded-xl text-xs bg-destructive/10 border border-destructive/20 text-destructive">
                                    {pathActionError}
                                </div>
                            )}
                        </section>
                    )}

                    {/* Ready Path: Hero Progress Card */}
                    {activePersonalPath.status === "ready" && totalLessons > 0 && (
                        <section
                            aria-labelledby="continue-learning-heading"
                            className="rounded-3xl border border-border bg-card p-6 sm:p-8 mb-8 relative overflow-hidden transition-colors"
                        >
                            <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-2">
                                        <span className="text-xs font-medium text-muted-foreground">
                                            Continue learning
                                        </span>
                                        {completedCount > 0 && (
                                            <span className="text-xs text-muted-foreground">
                                                • {progressPercent}% Completed
                                            </span>
                                        )}
                                    </div>

                                    <h2 id="continue-learning-heading" className="text-xl sm:text-2xl font-bold tracking-tight mb-2 text-foreground">
                                        {!progress.lastLessonId
                                            ? "Begin Your Study Path"
                                            : `Continue: ${resumeLesson?.title || "Active Lesson"}`}
                                    </h2>

                                    <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed mb-4 max-w-xl">
                                        {!progress.lastLessonId
                                            ? "Start with the first lesson generated from your uploaded resources."
                                            : resumeLesson?.summary}
                                    </p>

                                    {/* Progress Bar */}
                                    <div className="space-y-1.5 max-w-md">
                                        <div className="flex justify-between text-xs text-muted-foreground">
                                            <span>{completedCount} of {totalLessons} lessons marked complete</span>
                                            <span className="font-semibold text-foreground">{progressPercent}%</span>
                                        </div>
                                        <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                                            <div
                                                className="h-full bg-foreground transition-all duration-500 rounded-full"
                                                style={{ width: `${progressPercent}%` }}
                                            />
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col sm:flex-row md:flex-col gap-3 shrink-0">
                                    {resumeLesson && (
                                        <button
                                            type="button"
                                            onClick={() => handleOpenLesson(resumeLesson.id)}
                                            className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-medium text-background transition-opacity hover:opacity-85 cursor-pointer focus-visible:ring-1 focus-visible:ring-ring"
                                        >
                                            <span>{!progress.lastLessonId ? "Start Path" : "Continue Learning"}</span>
                                            <ArrowRight className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Course Outline: Lessons */}
                    <section aria-labelledby="course-lessons-heading" className="mb-10">
                        <div className="flex items-center justify-between gap-3 mb-5">
                            <div>
                                <h2 id="course-lessons-heading" className="text-lg sm:text-xl font-bold tracking-tight text-foreground">
                                    Lessons ({totalLessons})
                                </h2>
                                <p className="text-xs text-muted-foreground">
                                    {activePersonalPath.status === "draft"
                                        ? "Review the planned lesson topics before generating content."
                                        : "Study lessons at your own pace, inspect traceable citations, and test your knowledge."}
                                </p>
                            </div>
                        </div>

                        <div className="space-y-3">
                            {activeLessons.map((lesson, idx) => {
                                const isDone = progress.completedLessonIds.includes(lesson.id);
                                const isCurrent = progress.lastLessonId === lesson.id;
                                const isPrecedingDone = idx === 0 || progress.completedLessonIds.includes(activeLessons[idx - 1].id);
                                const isUnlocked = idx === 0 || isPrecedingDone || isDone;
                                const isLocked = !isUnlocked;
                                const answeredInLesson = (lesson.questions || []).filter((q) => Boolean(progress.questionAnswers[q.id])).length;
                                const totalInLesson = (lesson.questions || []).length;
                                const isDraft = !lesson.content;

                                return (
                                    <div
                                        key={lesson.id}
                                        className={`rounded-2xl border p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                                            isLocked
                                                ? "border-border bg-card/50 opacity-75"
                                                : isCurrent
                                                ? "border-foreground/30 bg-muted/40"
                                                : "border-border bg-card hover:bg-muted/30"
                                        }`}
                                    >
                                        <div className="flex items-start gap-3.5 flex-1">
                                            <span
                                                className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 text-xs font-medium ${
                                                    isDone
                                                        ? "bg-foreground text-background"
                                                        : isLocked
                                                        ? "bg-muted/60 text-muted-foreground border border-border"
                                                        : "bg-muted text-foreground border border-border"
                                                }`}
                                            >
                                                {isDone ? (
                                                    <Check className="w-4 h-4" />
                                                ) : isLocked ? (
                                                    <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                                                ) : (
                                                    idx + 1
                                                )}
                                            </span>
                                            <div>
                                                <div className="flex flex-wrap items-center gap-2 mb-1">
                                                    <h3 className={`text-sm sm:text-base font-semibold ${isLocked ? "text-muted-foreground" : "text-foreground"}`}>
                                                        {lesson.title}
                                                    </h3>
                                                    {isDone && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                                            <Check className="w-3 h-3" />
                                                            <span>Completed</span>
                                                        </span>
                                                    )}
                                                    {isLocked && (
                                                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                                                            <Lock className="w-3 h-3" />
                                                            <span>Locked (Complete Lesson {idx} first)</span>
                                                        </span>
                                                    )}
                                                </div>
                                                {lesson.summary && (
                                                    <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                                                        {lesson.summary}
                                                    </p>
                                                )}
                                                {!isDraft && (
                                                    <div className="flex items-center gap-3 mt-2 text-[11px] text-muted-foreground">
                                                        <span>Practice: {answeredInLesson}/{totalInLesson} answered</span>
                                                        <span>•</span>
                                                        <span>Sources: {lesson.sources?.length || 0} cited</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                                            <button
                                                type="button"
                                                onClick={() => !isDraft && !isLocked && handleOpenLesson(lesson.id)}
                                                disabled={isDraft || isLocked}
                                                title={
                                                    isLocked
                                                        ? `Complete "${activeLessons[idx - 1]?.title || `Lesson ${idx}`}" to unlock`
                                                        : undefined
                                                }
                                                className={`px-4 py-2 text-xs font-medium transition-colors ${
                                                    isDraft || isLocked
                                                        ? "inline-flex items-center gap-1.5 rounded-xl border border-border bg-muted/60 text-muted-foreground cursor-not-allowed"
                                                        : isDone
                                                        ? "rounded-xl border border-border bg-card hover:bg-muted text-foreground cursor-pointer"
                                                        : "rounded-full bg-foreground text-background hover:opacity-85 transition-opacity cursor-pointer"
                                                }`}
                                            >
                                                {isLocked && <Lock className="w-3 h-3" />}
                                                <span>{isDraft ? "Outline Topic" : isLocked ? "Locked" : isDone ? "Review Lesson" : isCurrent ? "Continue" : "Start Lesson"}</span>
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </section>
                </div>
            )}

            {/* Create Personal Study Path Modal */}
            <CreatePathModal
                isOpen={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                onSuccess={(newPath) => {
                    setPersonalPaths((prev) => [newPath, ...prev.filter((p) => p.id !== newPath.id)]);
                    setSelectedPathId(newPath.id);
                    setActiveSubView("dashboard");
                    setActiveLessonId(null);
                    writeLearningUrlState({ pathId: newPath.id, lessonId: null, view: "dashboard" }, "push");
                    setIsCreateModalOpen(false);
                }}
                theme={theme}
            />

            {/* Delete Study Path Confirmation Dialog */}
            <Dialog
                open={deletePathTarget !== null}
                onOpenChange={(open) => {
                    if (!open && !isDeletingPath) setDeletePathTarget(null);
                }}
            >
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>Delete study path?</DialogTitle>
                        <DialogDescription className="mt-2 text-sm text-muted-foreground leading-relaxed">
                            Are you sure you want to delete{" "}
                            <strong className="text-foreground font-semibold">
                                &quot;{deletePathTarget?.title}&quot;
                            </strong>
                            ?
                            <br />
                            <br />
                            This will permanently delete this study path, all its generated lessons, and your progress history.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter className="flex flex-row items-center justify-end gap-2 mt-4 sm:justify-end">
                        <button
                            type="button"
                            disabled={isDeletingPath}
                            onClick={() => setDeletePathTarget(null)}
                            className="px-4 py-2 rounded-xl text-xs font-medium cursor-pointer transition-colors border border-border bg-card hover:bg-muted text-foreground disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="button"
                            disabled={isDeletingPath}
                            onClick={handleConfirmDeletePath}
                            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-semibold bg-red-600 hover:bg-red-700 text-white cursor-pointer transition-colors disabled:opacity-50"
                        >
                            {isDeletingPath ? (
                                <>
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    <span>Deleting…</span>
                                </>
                            ) : (
                                <>
                                    <Trash2 className="w-3.5 h-3.5" />
                                    <span>Delete</span>
                                </>
                            )}
                        </button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </main>
    );
}
