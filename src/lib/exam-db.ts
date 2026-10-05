import { randomUUID } from "node:crypto";
import type { Row } from "@libsql/client";
import { getDB } from "./db";
import type {
    ExamAttempt,
    ExamDifficulty,
    ExamPrep,
    ExamQuestion,
    SubmitExamAttemptInput,
} from "./exam-types";

export class ExamNotFoundError extends Error {
    constructor(message = "Exam not found or you do not have permission to access it") {
        super(message);
        this.name = "ExamNotFoundError";
    }
}

let initialization: Promise<void> | null = null;

export async function initExamDB(): Promise<void> {
    if (!initialization) {
        initialization = (async () => {
            await getDB().batch([
                `CREATE TABLE IF NOT EXISTS exam_preps (
                    id TEXT PRIMARY KEY,
                    user_email TEXT NOT NULL,
                    title TEXT NOT NULL,
                    course_name TEXT,
                    difficulty TEXT NOT NULL CHECK(difficulty IN ('easy', 'medium', 'hard', 'standard')),
                    question_count INTEGER NOT NULL,
                    time_limit_minutes INTEGER NOT NULL,
                    resource_urls TEXT NOT NULL DEFAULT '[]',
                    resource_names TEXT NOT NULL DEFAULT '[]',
                    questions TEXT NOT NULL DEFAULT '[]',
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )`,
                `CREATE INDEX IF NOT EXISTS exam_preps_owner_updated
                    ON exam_preps(user_email, updated_at DESC)`,
                `CREATE TABLE IF NOT EXISTS exam_attempts (
                    id TEXT PRIMARY KEY,
                    exam_id TEXT NOT NULL,
                    user_email TEXT NOT NULL,
                    answers TEXT NOT NULL DEFAULT '{}',
                    flagged_questions TEXT NOT NULL DEFAULT '[]',
                    score INTEGER NOT NULL,
                    total_questions INTEGER NOT NULL,
                    percentage INTEGER NOT NULL,
                    time_spent_seconds INTEGER NOT NULL,
                    status TEXT NOT NULL DEFAULT 'completed' CHECK(status IN ('completed', 'timed-out')),
                    completed_at TEXT NOT NULL,
                    FOREIGN KEY(exam_id) REFERENCES exam_preps(id) ON DELETE CASCADE
                )`,
                `CREATE INDEX IF NOT EXISTS exam_attempts_owner
                    ON exam_attempts(user_email, exam_id, completed_at DESC)`,
            ], "write");
        })().catch((error) => {
            initialization = null;
            throw error;
        });
    }
    return initialization;
}

function examFromRow(row: Row): ExamPrep {
    let questions: ExamQuestion[] = [];
    try {
        questions = JSON.parse(String(row.questions || "[]"));
    } catch {
        questions = [];
    }

    let resourceUrls: string[] = [];
    try {
        resourceUrls = JSON.parse(String(row.resource_urls || "[]"));
    } catch {
        resourceUrls = [];
    }

    let resourceNames: string[] = [];
    try {
        resourceNames = JSON.parse(String(row.resource_names || "[]"));
    } catch {
        resourceNames = [];
    }

    return {
        id: String(row.id),
        userEmail: String(row.user_email),
        title: String(row.title),
        courseName: row.course_name ? String(row.course_name) : undefined,
        difficulty: String(row.difficulty) as ExamDifficulty,
        questionCount: Number(row.question_count),
        timeLimitMinutes: Number(row.time_limit_minutes),
        resourceUrls,
        resourceNames,
        questions,
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
    };
}

function attemptFromRow(row: Row): ExamAttempt {
    let answers: Record<string, number> = {};
    try {
        answers = JSON.parse(String(row.answers || "{}"));
    } catch {
        answers = {};
    }

    let flaggedQuestions: string[] = [];
    try {
        flaggedQuestions = JSON.parse(String(row.flagged_questions || "[]"));
    } catch {
        flaggedQuestions = [];
    }

    return {
        id: String(row.id),
        examId: String(row.exam_id),
        userEmail: String(row.user_email),
        answers,
        flaggedQuestions,
        score: Number(row.score),
        totalQuestions: Number(row.total_questions),
        percentage: Number(row.percentage),
        timeSpentSeconds: Number(row.time_spent_seconds),
        status: String(row.status) as "completed" | "timed-out",
        completedAt: String(row.completed_at),
    };
}

export async function saveExamPrep(exam: ExamPrep): Promise<ExamPrep> {
    await initExamDB();
    const db = getDB();

    await db.execute({
        sql: `INSERT INTO exam_preps (
            id, user_email, title, course_name, difficulty,
            question_count, time_limit_minutes, resource_urls,
            resource_names, questions, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
            title = excluded.title,
            course_name = excluded.course_name,
            difficulty = excluded.difficulty,
            question_count = excluded.question_count,
            time_limit_minutes = excluded.time_limit_minutes,
            resource_urls = excluded.resource_urls,
            resource_names = excluded.resource_names,
            questions = excluded.questions,
            updated_at = excluded.updated_at`,
        args: [
            exam.id,
            exam.userEmail,
            exam.title,
            exam.courseName || null,
            exam.difficulty,
            exam.questionCount,
            exam.timeLimitMinutes,
            JSON.stringify(exam.resourceUrls),
            JSON.stringify(exam.resourceNames),
            JSON.stringify(exam.questions),
            exam.createdAt,
            exam.updatedAt,
        ],
    });

    return exam;
}

export async function getExamPrep(userEmail: string, examId: string): Promise<ExamPrep> {
    await initExamDB();
    const db = getDB();
    const result = await db.execute({
        sql: `SELECT * FROM exam_preps WHERE id = ? AND user_email = ? LIMIT 1`,
        args: [examId, userEmail],
    });

    if (result.rows.length === 0) {
        throw new ExamNotFoundError();
    }

    return examFromRow(result.rows[0]);
}

export async function listExamPreps(userEmail: string): Promise<ExamPrep[]> {
    await initExamDB();
    const db = getDB();
    const result = await db.execute({
        sql: `SELECT * FROM exam_preps WHERE user_email = ? ORDER BY updated_at DESC`,
        args: [userEmail],
    });

    return result.rows.map(examFromRow);
}

export async function deleteExamPrep(userEmail: string, examId: string): Promise<void> {
    await initExamDB();
    const db = getDB();

    // Verify ownership before deleting
    await getExamPrep(userEmail, examId);

    await db.batch([
        {
            sql: `DELETE FROM exam_attempts WHERE exam_id = ? AND user_email = ?`,
            args: [examId, userEmail],
        },
        {
            sql: `DELETE FROM exam_preps WHERE id = ? AND user_email = ?`,
            args: [examId, userEmail],
        },
    ], "write");
}

export async function submitExamAttempt(
    userEmail: string,
    examId: string,
    input: SubmitExamAttemptInput
): Promise<ExamAttempt> {
    await initExamDB();
    const exam = await getExamPrep(userEmail, examId);

    // Grade answers against correct answers
    let score = 0;
    const totalQuestions = exam.questions.length;

    for (const q of exam.questions) {
        const studentChoice = input.answers[q.id];
        if (studentChoice !== undefined && studentChoice === q.correctAnswer) {
            score++;
        }
    }

    const percentage = totalQuestions > 0 ? Math.round((score / totalQuestions) * 100) : 0;
    const attemptId = randomUUID();
    const now = new Date().toISOString();

    const attempt: ExamAttempt = {
        id: attemptId,
        examId,
        userEmail,
        answers: input.answers,
        flaggedQuestions: input.flaggedQuestions || [],
        score,
        totalQuestions,
        percentage,
        timeSpentSeconds: input.timeSpentSeconds,
        status: input.status || "completed",
        completedAt: now,
    };

    const db = getDB();
    await db.execute({
        sql: `INSERT INTO exam_attempts (
            id, exam_id, user_email, answers, flagged_questions,
            score, total_questions, percentage, time_spent_seconds,
            status, completed_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [
            attempt.id,
            attempt.examId,
            attempt.userEmail,
            JSON.stringify(attempt.answers),
            JSON.stringify(attempt.flaggedQuestions),
            attempt.score,
            attempt.totalQuestions,
            attempt.percentage,
            attempt.timeSpentSeconds,
            attempt.status,
            attempt.completedAt,
        ],
    });

    return attempt;
}

export async function listExamAttempts(userEmail: string, examId: string): Promise<ExamAttempt[]> {
    await initExamDB();
    const db = getDB();
    const result = await db.execute({
        sql: `SELECT * FROM exam_attempts WHERE user_email = ? AND exam_id = ? ORDER BY completed_at DESC`,
        args: [userEmail, examId],
    });

    return result.rows.map(attemptFromRow);
}

export async function getLatestExamAttempt(
    userEmail: string,
    examId: string
): Promise<ExamAttempt | null> {
    await initExamDB();
    const db = getDB();
    const result = await db.execute({
        sql: `SELECT * FROM exam_attempts WHERE user_email = ? AND exam_id = ? ORDER BY completed_at DESC LIMIT 1`,
        args: [userEmail, examId],
    });

    if (result.rows.length === 0) return null;
    return attemptFromRow(result.rows[0]);
}
