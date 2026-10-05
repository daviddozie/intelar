import { z } from "zod";

const title = z.string().trim().min(1).max(200);

export const createLearningPathSchema = z.object({
    title,
    goal: z.string().trim().min(1).max(2000),
    language: z.enum(["en", "fr"]).default("en"),
    resourceUrls: z.array(z.string().url().max(2000)).max(3).default([]),
    lessons: z.array(z.object({ title })).max(5).default([])
        .refine((lessons) => lessons.length === 0 || lessons.length >= 3, "An outline needs three to five lessons"),
});

export const learningProgressSchema = z.object({
    lastLessonId: z.string().uuid().nullable().default(null),
    completedLessonIds: z.array(z.string().uuid()).max(5).default([]),
});

export type CreateLearningPathInput = z.input<typeof createLearningPathSchema>;
export type LearningProgress = z.infer<typeof learningProgressSchema>;

export interface LearningLesson {
    id: string;
    title: string;
    summary?: string;
    content?: string;
    sources?: LearningSourceReference[];
    questions?: LearningQuestion[];
    frenchAlternative?: {
        title: string;
        summary: string;
        content: string;
        questions: LearningQuestion[];
    };
}

export interface LearningSourceReference {
    id: string;
    title: string;
    author: string;
    license: string;
    section?: string;
    excerpt: string;
    url?: string;
}

export interface LearningQuestionOption {
    id: string;
    text: string;
}

export interface LearningQuestion {
    id: string;
    prompt: string;
    options: LearningQuestionOption[];
    correctOptionId: string;
    hint: string;
    explanation: string;
}

export interface TransportDataPoint {
    id: string;
    route: string;
    mode: string;
    costNaira: number;
    distanceKm: number;
    notes?: string;
}

export interface PracticalTask {
    id: string;
    prompt: string;
    type: "choice" | "numeric";
    options?: { id: string; text: string }[];
    correctAnswer: string | number;
    tolerance?: number;
    hint: string;
    explanation: string;
}

export interface PracticalActivity {
    id: string;
    title: string;
    scenario: string;
    datasetTitle: string;
    dataset: TransportDataPoint[];
    tasks: PracticalTask[];
}

export interface OpportunityItem {
    id: string;
    title: string;
    sector: string;
    description: string;
    relevantSkills: string[];
    actionPrompt: string;
}

export interface NextStepCardData {
    title: string;
    headline: string;
    description: string;
    opportunities: OpportunityItem[];
}

export interface ReviewedCourse {
    id: string;
    title: string;
    goal: string;
    subject: string;
    attribution: string;
    aiPreparedNotice: string;
    humanReviewedNotice: string;
    lessons: LearningLesson[];
    practicalActivity: PracticalActivity;
    nextStepCard: NextStepCardData;
}

export interface LessonProgressState {
    lastLessonId: string | null;
    completedLessonIds: string[];
    questionAnswers: Record<string, string>;
    practicalTaskAnswers: Record<string, string | number>;
    practicalCompleted: boolean;
    activeLanguage: "en" | "fr";
}

export interface LearningPath {
    id: string;
    title: string;
    goal: string;
    language: "en" | "fr";
    status: "draft" | "ready";
    resourceUrls: string[];
    lessons: LearningLesson[];
    version: number;
    progress: LearningProgress;
    createdAt: string;
    updatedAt: string;
}

export const updateOutlineSchema = z.object({
    title: title.optional(),
    goal: z.string().trim().min(1).max(2000).optional(),
    language: z.enum(["en", "fr"]).optional(),
    lessons: z.array(z.object({
        id: z.string().optional(),
        title,
        summary: z.string().trim().max(1000).optional(),
    })).min(3, "An outline needs three to five lessons").max(5, "An outline needs three to five lessons"),
});

export type UpdateOutlineInput = z.infer<typeof updateOutlineSchema>;

export interface ResourceDocumentText {
    url: string;
    name: string;
    text: string;
    chunks: string[];
}

export interface OfflineStudyPack {
    id: string;
    userEmail: string | null;
    version: number;
    title: string;
    goal: string;
    language: "en" | "fr";
    status: "ready";
    lessons: LearningLesson[];
    practicalActivity?: PracticalActivity;
    nextStepCard?: NextStepCardData;
    downloadedAt: string;
    sizeBytes: number;
}

export interface OfflineAttemptEvent {
    eventId: string;
    userEmail: string | null;
    pathId: string;
    lessonId: string;
    questionId: string;
    selectedOptionId: string;
    isCorrect: boolean;
    timestamp: string;
    synced: boolean;
    syncedAt?: string;
}

export const syncEventSchema = z.object({
    eventId: z.string().uuid(),
    pathId: z.string().min(1).max(200),
    lessonId: z.string().min(1).max(200),
    questionId: z.string().min(1).max(200),
    selectedOptionId: z.string().min(1).max(200),
    isCorrect: z.boolean(),
    timestamp: z.string().min(1).max(100),
});

export const syncRequestSchema = z.object({
    attempts: z.array(syncEventSchema).max(200),
});

export type SyncAttemptInput = z.infer<typeof syncEventSchema>;
export type SyncRequestInput = z.infer<typeof syncRequestSchema>;

export interface SyncResponse {
    syncedEventIds: string[];
    duplicatesCount: number;
    progress: LearningProgress;
}

