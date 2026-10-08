import type { LessonProgressState } from "./learning-types";
import { SAMPLE_STATISTICS_COURSE } from "./sample-course";

const STORAGE_PREFIX = "intelar_learning_progress_";

export const DEFAULT_PROGRESS_STATE: LessonProgressState = {
    lastLessonId: null,
    completedLessonIds: [],
    questionAnswers: {},
    practicalTaskAnswers: {},
    practicalCompleted: false,
    activeLanguage: "en",
};

function emptyProgress(): LessonProgressState {
    return { ...DEFAULT_PROGRESS_STATE, completedLessonIds: [], questionAnswers: {}, practicalTaskAnswers: {} };
}

export function getStorageKey(courseId: string, userEmail?: string | null): string {
    const scope = userEmail ? `user_${userEmail.trim().toLowerCase()}` : "guest";
    return `${STORAGE_PREFIX}${scope}_${courseId}`;
}

// Browser storage is untrusted. Ignore stale IDs and invalid answers rather than
// letting corrupted data inflate completion or claim successful practice.
export function normalizeLearningProgress(value: unknown, courseId?: string): LessonProgressState {
    if (!value || typeof value !== "object" || Array.isArray(value)) return emptyProgress();
    const parsed = value as Partial<LessonProgressState>;

    // If it's the demonstration sample course, normalize strictly against its known IDs
    if (!courseId || courseId === SAMPLE_STATISTICS_COURSE.id) {
        const course = SAMPLE_STATISTICS_COURSE;
        const lessonIds = new Set(course.lessons.map((lesson) => lesson.id));
        const questionAnswers: Record<string, string> = {};
        for (const lesson of course.lessons) {
            const questions = [...(lesson.questions || []), ...(lesson.frenchAlternative?.questions || [])];
            for (const question of questions) {
                const answer = parsed.questionAnswers?.[question.id];
                if (question.options.some((option) => option.id === answer)) questionAnswers[question.id] = answer!;
            }
        }
        const practicalTaskAnswers: Record<string, string | number> = {};
        for (const task of course.practicalActivity.tasks) {
            const answer = parsed.practicalTaskAnswers?.[task.id];
            if (task.options?.some((option) => option.id === answer) ||
                (task.type === "numeric" && typeof answer === "number" && Number.isFinite(answer))) {
                practicalTaskAnswers[task.id] = answer!;
            }
        }
        return {
            lastLessonId: typeof parsed.lastLessonId === "string" && lessonIds.has(parsed.lastLessonId) ? parsed.lastLessonId : null,
            completedLessonIds: Array.isArray(parsed.completedLessonIds)
                ? [...new Set(parsed.completedLessonIds.filter((id) => typeof id === "string" && lessonIds.has(id)))] : [],
            questionAnswers,
            practicalTaskAnswers,
            practicalCompleted: parsed.practicalCompleted === true && course.practicalActivity.tasks.every((task) => practicalTaskAnswers[task.id] === task.correctAnswer),
            activeLanguage: parsed.activeLanguage === "fr" ? "fr" : "en",
        };
    }

    // For personal study paths, validate types
    const questionAnswers: Record<string, string> = {};
    if (parsed.questionAnswers && typeof parsed.questionAnswers === "object") {
        for (const [k, v] of Object.entries(parsed.questionAnswers)) {
            if (typeof k === "string" && typeof v === "string") questionAnswers[k] = v;
        }
    }

    return {
        lastLessonId: typeof parsed.lastLessonId === "string" ? parsed.lastLessonId : null,
        completedLessonIds: Array.isArray(parsed.completedLessonIds)
            ? [...new Set(parsed.completedLessonIds.filter((id) => typeof id === "string"))]
            : [],
        questionAnswers,
        practicalTaskAnswers: {},
        practicalCompleted: false,
        activeLanguage: parsed.activeLanguage === "fr" ? "fr" : "en",
    };
}

export function loadLocalLearningProgress(courseId: string, userEmail?: string | null): LessonProgressState {
    try {
        if (typeof localStorage === "undefined") return emptyProgress();
        const raw = localStorage.getItem(getStorageKey(courseId, userEmail));
        return raw ? normalizeLearningProgress(JSON.parse(raw), courseId) : emptyProgress();
    } catch {
        return emptyProgress();
    }
}

export function mergeLearningProgress(current: LessonProgressState, updates: Partial<LessonProgressState>, courseId?: string): LessonProgressState {
    return normalizeLearningProgress({
        ...current,
        ...updates,
        questionAnswers: { ...current.questionAnswers, ...updates.questionAnswers },
        practicalTaskAnswers: { ...current.practicalTaskAnswers, ...updates.practicalTaskAnswers },
    }, courseId);
}

// Surface write failures to the UI. The caller retains its complete in-memory
// progress, so quota/security failures don't silently erase earlier answers.
export function saveLocalLearningProgress(
    courseId: string,
    updates: Partial<LessonProgressState>,
    userEmail?: string | null,
    current = loadLocalLearningProgress(courseId, userEmail)
): LessonProgressState {
    const updated = mergeLearningProgress(current, updates, courseId);
    if (typeof localStorage === "undefined") throw new Error("Device storage is unavailable");
    localStorage.setItem(getStorageKey(courseId, userEmail), JSON.stringify(updated));
    return updated;
}

export function clearLocalLearningProgress(courseId: string, userEmail?: string | null): void {
    if (typeof localStorage === "undefined") return;
    localStorage.removeItem(getStorageKey(courseId, userEmail));
}

export function isLessonUnlocked(lessonId: string, lessons: Array<{ id: string }>, completedIds: string[]): boolean {
    const idx = lessons.findIndex((l) => l.id === lessonId);
    if (idx <= 0) return true;
    if (completedIds.includes(lessonId)) return true;
    const prevLesson = lessons[idx - 1];
    return prevLesson ? completedIds.includes(prevLesson.id) : true;
}

