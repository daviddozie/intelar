import { randomUUID } from "node:crypto";
import type { Row } from "@libsql/client";
import { getDB, getUserResourceForChat } from "./db";
import {
    createLearningPathSchema,
    learningProgressSchema,
    type CreateLearningPathInput,
    type LearningPath,
    type LearningLesson,
    type LearningProgress,
    type SyncAttemptInput,
    type SyncResponse,
} from "./learning-types";
import { SAMPLE_STATISTICS_COURSE } from "./sample-course";

export class LearningNotFoundError extends Error {
    constructor() {
        super("Learning path or resource not found");
        this.name = "LearningNotFoundError";
    }
}

export class LearningProgressError extends Error {
    constructor() {
        super("Progress must reference lessons in this path");
        this.name = "LearningProgressError";
    }
}

let initialization: Promise<void> | null = null;

export async function initLearningDB(): Promise<void> {
    if (!initialization) {
        initialization = (async () => {
            await getDB().batch([
                `CREATE TABLE IF NOT EXISTS learning_paths (
                    id TEXT PRIMARY KEY,
                    user_email TEXT NOT NULL,
                    title TEXT NOT NULL,
                    goal TEXT NOT NULL,
                    language TEXT NOT NULL CHECK(language IN ('en', 'fr')),
                    status TEXT NOT NULL DEFAULT 'draft' CHECK(status IN ('draft', 'ready')),
                    resource_urls TEXT NOT NULL DEFAULT '[]',
                    lessons TEXT NOT NULL DEFAULT '[]',
                    version INTEGER NOT NULL DEFAULT 1,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL,
                    UNIQUE(id, user_email)
                )`,
                `CREATE INDEX IF NOT EXISTS learning_paths_owner_updated
                    ON learning_paths(user_email, updated_at DESC)`,
                `CREATE TABLE IF NOT EXISTS learning_progress (
                    path_id TEXT NOT NULL,
                    user_email TEXT NOT NULL,
                    last_lesson_id TEXT,
                    completed_lesson_ids TEXT NOT NULL DEFAULT '[]',
                    updated_at TEXT NOT NULL,
                    PRIMARY KEY(path_id, user_email),
                    FOREIGN KEY(path_id, user_email)
                        REFERENCES learning_paths(id, user_email) ON DELETE CASCADE
                )`,
                `CREATE TABLE IF NOT EXISTS learning_events (
                    event_id TEXT PRIMARY KEY,
                    user_email TEXT NOT NULL,
                    path_id TEXT NOT NULL,
                    lesson_id TEXT NOT NULL,
                    question_id TEXT NOT NULL,
                    selected_option_id TEXT NOT NULL,
                    is_correct INTEGER NOT NULL,
                    event_timestamp TEXT NOT NULL,
                    created_at TEXT NOT NULL
                )`,
                `CREATE INDEX IF NOT EXISTS learning_events_owner_created
                    ON learning_events(user_email, path_id, created_at DESC)`,
            ], "write");
        })().catch((error) => {
            initialization = null;
            throw error;
        });
    }
    return initialization;
}

function requireOwner(userEmail: string) {
    if (!userEmail.trim()) throw new LearningNotFoundError();
}

function sanitizeLegacyLesson(lesson: LearningLesson): LearningLesson {
    if (!lesson.content) {
        return lesson;
    }
    let content = lesson.content;
    if (
        content.includes("Traceable Grounding") ||
        content.includes("Overview & Conceptual Foundations") ||
        content.includes("university transport") ||
        content.includes("Draft 1.")
    ) {
        content = content
            .replace(/#{3,4}\s*Overview & Conceptual Foundations/g, "### What this lesson covers")
            .replace(/#{3,4}\s*Core Principles & Practical Application/g, "### Core ideas explained simply")
            .replace(/#{3,4}\s*Key Takeaways/g, "### Key takeaways")
            .replace(
                /LMS\s*\|\s*Product Requirements Document[^"]*Draft\s*1\./g,
                "Build a responsive web-based LMS where administrators manage learning operations, instructors create and deliver courses, and learners discover content, complete lessons, take assessments, and track progress."
            )
            .replace(
                /When working with these concepts in academic research and practical campus projects, remember:\s*1\.\s*\*\*Traceable Grounding\*\*:[^\n]*\s*2\.\s*\*\*Contextual Awareness\*\*:[^\n]*\s*3\.\s*\*\*Analytical Precision\*\*:[^\n]*/g,
                "When working with this topic, keep these essential principles in mind:\n- **Focus on the core purpose**: Pay attention to why this concept exists and what practical role it plays in your projects or coursework.\n- **Learn the key terms**: Make note of specific definitions and requirements so you can communicate and apply them accurately.\n- **Connect concepts together**: Notice how this topic links to the broader picture and prepares you for subsequent lessons."
            )
            .replace(
                /Mastery of \*\*[^*]+\*\* provides essential preparation for complex analysis\./g,
                `Getting comfortable with **${lesson.title}** gives you the confidence to handle more advanced topics with ease.`
            );
    }

    const questions = (lesson.questions || []).map((q) => {
        let prompt = q.prompt;
        if (prompt.includes("Nigerian university coursework and research projects")) {
            prompt = `Why is understanding "${lesson.title}" important for real-world projects?`;
        } else if (prompt.includes("when analyzing observational data")) {
            prompt = `When applying what you learned about "${lesson.title}", which approach is most effective?`;
        } else if (prompt.includes("which of the following statements is conceptually correct")) {
            prompt = `What is the primary takeaway from studying "${lesson.title}"?`;
        }
        return {
            ...q,
            prompt,
        };
    });

    return {
        ...lesson,
        content,
        questions,
    };
}

function pathFromRow(row: Row): LearningPath {
    const rawLessons: LearningLesson[] = JSON.parse(row.lessons as string);
    const sanitizedLessons = rawLessons.map(sanitizeLegacyLesson);

    return {
        id: row.id as string,
        title: row.title as string,
        goal: row.goal as string,
        language: row.language as LearningPath["language"],
        status: row.status as LearningPath["status"],
        resourceUrls: JSON.parse(row.resource_urls as string),
        lessons: sanitizedLessons,
        version: Number(row.version),
        progress: {
            lastLessonId: (row.last_lesson_id as string | null) ?? null,
            completedLessonIds: JSON.parse((row.completed_lesson_ids as string | null) ?? "[]"),
        },
        createdAt: row.created_at as string,
        updatedAt: row.updated_at as string,
    };
}

const pathSelect = `SELECT p.*, r.last_lesson_id, r.completed_lesson_ids
    FROM learning_paths p LEFT JOIN learning_progress r
    ON p.id = r.path_id AND p.user_email = r.user_email`;

export async function getUserLearningPaths(userEmail: string): Promise<LearningPath[]> {
    requireOwner(userEmail);
    await initLearningDB();
    const result = await getDB().execute({
        sql: `${pathSelect} WHERE p.user_email = ? ORDER BY p.updated_at DESC, p.id`,
        args: [userEmail],
    });
    return result.rows.map(pathFromRow);
}

export async function getLearningPath(userEmail: string, id: string): Promise<LearningPath | null> {
    requireOwner(userEmail);
    await initLearningDB();
    const result = await getDB().execute({
        sql: `${pathSelect} WHERE p.id = ? AND p.user_email = ? LIMIT 1`,
        args: [id, userEmail],
    });
    return result.rows[0] ? pathFromRow(result.rows[0]) : null;
}

export async function createLearningPath(userEmail: string, input: CreateLearningPathInput): Promise<LearningPath> {
    requireOwner(userEmail);
    const data = createLearningPathSchema.parse(input);
    const resourceUrls = [...new Set(data.resourceUrls)];
    for (const url of resourceUrls) {
        if (!await getUserResourceForChat(userEmail, url)) throw new LearningNotFoundError();
    }
    await initLearningDB();
    const now = new Date().toISOString();
    const path: LearningPath = {
        ...data,
        id: randomUUID(),
        resourceUrls,
        lessons: data.lessons.map((lesson) => ({ id: randomUUID(), title: lesson.title })),
        status: "draft",
        version: 1,
        progress: { lastLessonId: null, completedLessonIds: [] },
        createdAt: now,
        updatedAt: now,
    };
    await getDB().execute({
        sql: `INSERT INTO learning_paths
            (id, user_email, title, goal, language, resource_urls, lessons, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [path.id, userEmail, path.title, path.goal, path.language,
        JSON.stringify(path.resourceUrls), JSON.stringify(path.lessons), now, now],
    });
    return path;
}

export async function saveLearningProgress(userEmail: string, pathId: string, input: LearningProgress): Promise<LearningProgress> {
    const progress = learningProgressSchema.parse(input);
    const path = await getLearningPath(userEmail, pathId);
    if (!path) throw new LearningNotFoundError();
    const lessonIds = new Set(path.lessons.map((lesson) => lesson.id));
    if ((progress.lastLessonId && !lessonIds.has(progress.lastLessonId)) ||
        progress.completedLessonIds.some((id) => !lessonIds.has(id))) {
        throw new LearningProgressError();
    }
    progress.completedLessonIds = [...new Set(progress.completedLessonIds)];
    const now = new Date().toISOString();
    const result = await getDB().batch([
        {
            sql: `INSERT INTO learning_progress
                (path_id, user_email, last_lesson_id, completed_lesson_ids, updated_at)
                SELECT id, user_email, ?, ?, ? FROM learning_paths WHERE id = ? AND user_email = ?
                ON CONFLICT(path_id, user_email) DO UPDATE SET
                    last_lesson_id = excluded.last_lesson_id,
                    completed_lesson_ids = excluded.completed_lesson_ids,
                    updated_at = excluded.updated_at`,
            args: [progress.lastLessonId, JSON.stringify(progress.completedLessonIds), now, pathId, userEmail],
        },
        {
            sql: "UPDATE learning_paths SET updated_at = ? WHERE id = ? AND user_email = ?",
            args: [now, pathId, userEmail],
        },
    ], "write");
    if (result[0].rowsAffected === 0) throw new LearningNotFoundError();
    return progress;
}

export async function updateLearningPathOutline(
    userEmail: string,
    pathId: string,
    input: { title?: string; goal?: string; language?: "en" | "fr"; lessons: { id?: string; title: string; summary?: string }[] }
): Promise<LearningPath> {
    requireOwner(userEmail);
    const existing = await getLearningPath(userEmail, pathId);
    if (!existing) throw new LearningNotFoundError();

    if (input.lessons.length < 3 || input.lessons.length > 5) {
        throw new Error("An outline needs three to five lessons");
    }

    const updatedLessons: LearningLesson[] = input.lessons.map((lesson) => {
        const matched = existing.lessons.find((l) => l.id === lesson.id);
        if (matched) {
            return { ...matched, title: lesson.title, summary: lesson.summary ?? matched.summary };
        }
        return {
            id: randomUUID(),
            title: lesson.title,
            summary: lesson.summary,
        };
    });

    const now = new Date().toISOString();
    const newTitle = input.title?.trim() || existing.title;
    const newGoal = input.goal?.trim() || existing.goal;
    const newLanguage = input.language || existing.language;

    await getDB().execute({
        sql: `UPDATE learning_paths
            SET title = ?, goal = ?, language = ?, lessons = ?, updated_at = ?
            WHERE id = ? AND user_email = ?`,
        args: [newTitle, newGoal, newLanguage, JSON.stringify(updatedLessons), now, pathId, userEmail],
    });

    return {
        ...existing,
        title: newTitle,
        goal: newGoal,
        language: newLanguage,
        lessons: updatedLessons,
        updatedAt: now,
    };
}

export async function updateLearningPathLessons(
    userEmail: string,
    pathId: string,
    lessons: LearningLesson[]
): Promise<LearningPath> {
    requireOwner(userEmail);
    const existing = await getLearningPath(userEmail, pathId);
    if (!existing) throw new LearningNotFoundError();

    const now = new Date().toISOString();
    await getDB().execute({
        sql: `UPDATE learning_paths
            SET lessons = ?, status = 'ready', version = version + 1, updated_at = ?
            WHERE id = ? AND user_email = ?`,
        args: [JSON.stringify(lessons), now, pathId, userEmail],
    });

    return {
        ...existing,
        lessons,
        status: "ready",
        version: existing.version + 1,
        updatedAt: now,
    };
}

export async function deleteLearningPath(userEmail: string, pathId: string): Promise<boolean> {
    requireOwner(userEmail);
    await initLearningDB();
    const result = await getDB().execute({
        sql: `DELETE FROM learning_paths WHERE id = ? AND user_email = ?`,
        args: [pathId, userEmail],
    });
    return (result.rowsAffected ?? 0) > 0;
}

export async function syncLearningEvents(
    userEmail: string,
    attempts: SyncAttemptInput[]
): Promise<SyncResponse> {
    requireOwner(userEmail);
    await initLearningDB();

    if (attempts.length === 0) {
        return {
            syncedEventIds: [],
            duplicatesCount: 0,
            progress: { lastLessonId: null, completedLessonIds: [] },
        };
    }

    const now = new Date().toISOString();
    const syncedEventIds: string[] = [];
    let duplicatesCount = 0;

    for (const attempt of attempts) {
        // If it's a personal path, verify ownership
        if (attempt.pathId !== SAMPLE_STATISTICS_COURSE.id) {
            const path = await getLearningPath(userEmail, attempt.pathId);
            if (!path) {
                throw new LearningNotFoundError();
            }
        }

        const res = await getDB().execute({
            sql: `INSERT OR IGNORE INTO learning_events
                (event_id, user_email, path_id, lesson_id, question_id, selected_option_id, is_correct, event_timestamp, created_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                attempt.eventId,
                userEmail,
                attempt.pathId,
                attempt.lessonId,
                attempt.questionId,
                attempt.selectedOptionId,
                attempt.isCorrect ? 1 : 0,
                attempt.timestamp,
                now,
            ],
        });

        if ((res.rowsAffected ?? 0) > 0) {
            syncedEventIds.push(attempt.eventId);
        } else {
            duplicatesCount++;
        }
    }

    // Update progress for the path involved
    const primaryPathId = attempts[0].pathId;
    let latestProgress: LearningProgress = { lastLessonId: null, completedLessonIds: [] };

    if (primaryPathId !== SAMPLE_STATISTICS_COURSE.id) {
        const path = await getLearningPath(userEmail, primaryPathId);
        if (path) {
            const currentProgress = path.progress || { lastLessonId: null, completedLessonIds: [] };
            const completedLessonSet = new Set(currentProgress.completedLessonIds);
            const lessonAttempts = attempts.filter((a) => a.pathId === primaryPathId);
            let lastAttemptedLessonId = currentProgress.lastLessonId;

            for (const la of lessonAttempts) {
                lastAttemptedLessonId = la.lessonId;
                const targetLesson = path.lessons.find((l) => l.id === la.lessonId);
                if (targetLesson && targetLesson.questions && targetLesson.questions.length > 0) {
                    const qIds = targetLesson.questions.map((q) => q.id);
                    const correctEvents = await getDB().execute({
                        sql: `SELECT DISTINCT question_id FROM learning_events
                            WHERE user_email = ? AND path_id = ? AND lesson_id = ? AND is_correct = 1`,
                        args: [userEmail, primaryPathId, la.lessonId],
                    });
                    const answeredQIds = new Set(correctEvents.rows.map((r) => r.question_id as string));
                    if (qIds.every((qid) => answeredQIds.has(qid))) {
                        completedLessonSet.add(la.lessonId);
                    }
                } else if (la.isCorrect) {
                    completedLessonSet.add(la.lessonId);
                }
            }

            latestProgress = {
                lastLessonId: lastAttemptedLessonId,
                completedLessonIds: Array.from(completedLessonSet),
            };

            await saveLearningProgress(userEmail, primaryPathId, latestProgress);
        }
    } else {
        const completedLessonSet = new Set<string>();
        for (const la of attempts) {
            if (la.isCorrect) {
                const correctEvents = await getDB().execute({
                    sql: `SELECT DISTINCT question_id FROM learning_events
                        WHERE user_email = ? AND path_id = ? AND lesson_id = ? AND is_correct = 1`,
                    args: [userEmail, SAMPLE_STATISTICS_COURSE.id, la.lessonId],
                });
                const lesson = SAMPLE_STATISTICS_COURSE.lessons.find((l) => l.id === la.lessonId);
                const qCount = lesson?.questions?.length || 3;
                if (correctEvents.rows.length >= qCount) {
                    completedLessonSet.add(la.lessonId);
                }
            }
        }
        latestProgress = {
            lastLessonId: attempts[attempts.length - 1].lessonId,
            completedLessonIds: Array.from(completedLessonSet),
        };
    }

    return {
        syncedEventIds,
        duplicatesCount,
        progress: latestProgress,
    };
}

export async function getLearningEvents(userEmail: string, pathId?: string): Promise<Row[]> {
    requireOwner(userEmail);
    await initLearningDB();
    if (pathId) {
        const res = await getDB().execute({
            sql: "SELECT * FROM learning_events WHERE user_email = ? AND path_id = ? ORDER BY created_at ASC",
            args: [userEmail, pathId],
        });
        return res.rows;
    }
    const res = await getDB().execute({
        sql: "SELECT * FROM learning_events WHERE user_email = ? ORDER BY created_at ASC",
        args: [userEmail],
    });
    return res.rows;
}

