import { z } from "zod";

export type ExamDifficulty = "easy" | "medium" | "hard" | "standard";

export const EXAM_DIFFICULTIES: {
    id: ExamDifficulty;
    title: string;
    description: string;
    color: string;
}[] = [
    {
        id: "easy",
        title: "Easy",
        description: "Foundational definitions, formula recognition, and basic concept recall.",
        color: "emerald",
    },
    {
        id: "medium",
        title: "Medium",
        description: "Direct application of principles, multi-step calculations, and comprehension.",
        color: "amber",
    },
    {
        id: "hard",
        title: "Hard",
        description: "Advanced scenario analysis, error diagnosis, edge cases, and synthesis.",
        color: "rose",
    },
    {
        id: "standard",
        title: "Standard",
        description: "Balanced university exam distribution (30% foundational, 50% application, 20% complex).",
        color: "blue",
    },
];

export const VALID_QUESTION_COUNTS = [10, 20, 30, 50] as const;
export type ExamQuestionCount = (typeof VALID_QUESTION_COUNTS)[number];

export interface ExamQuestion {
    id: string;
    question: string;
    options: [string, string, string, string]; // exactly 4 choices: A, B, C, D
    correctAnswer: number; // 0, 1, 2, or 3
    explanation: string;
    sourceExcerpt?: string;
}

export interface ExamPrep {
    id: string;
    userEmail: string;
    title: string;
    courseName?: string;
    difficulty: ExamDifficulty;
    questionCount: number;
    timeLimitMinutes: number;
    resourceUrls: string[];
    resourceNames: string[];
    questions: ExamQuestion[];
    createdAt: string;
    updatedAt: string;
}

export interface ExamAttempt {
    id: string;
    examId: string;
    userEmail: string;
    answers: Record<string, number>; // questionId -> selectedOption (0..3)
    flaggedQuestions: string[];
    score: number;
    totalQuestions: number;
    percentage: number;
    timeSpentSeconds: number;
    status: "completed" | "timed-out";
    completedAt: string;
}

export const createExamInputSchema = z.object({
    title: z.string().min(1).max(120).optional(),
    courseName: z.string().max(80).optional(),
    resourceUrls: z.array(z.string().min(1)).min(1, "At least one resource or document is required").max(3),
    difficulty: z.enum(["easy", "medium", "hard", "standard"]).default("standard"),
    questionCount: z.union([z.literal(10), z.literal(20), z.literal(30), z.literal(50)]).default(10),
    timeLimitMinutes: z.number().int().min(5).max(180).default(15),
});

export type CreateExamInput = z.infer<typeof createExamInputSchema>;

export const submitExamAttemptSchema = z.object({
    answers: z.record(z.string(), z.number().int().min(0).max(3)),
    flaggedQuestions: z.array(z.string()).optional().default([]),
    timeSpentSeconds: z.number().int().min(0),
    status: z.enum(["completed", "timed-out"]).default("completed"),
});

export type SubmitExamAttemptInput = z.input<typeof submitExamAttemptSchema>;
