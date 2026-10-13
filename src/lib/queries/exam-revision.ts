import type { LearningPath } from "@/lib/learning-types";

export const revisionKeys = {
    create: (userEmail: string | null, examId: string, attemptId: string) => ["exam-revision", userEmail, examId, attemptId] as const,
};

export async function createExamRevision(examId: string, attemptId: string): Promise<LearningPath> {
    let response: Response;
    try {
        response = await fetch(`/api/exams/${encodeURIComponent(examId)}/revision`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId }),
        });
    } catch {
        throw new Error("Could not connect to prepare your revision plan. Check your internet connection and try again.");
    }
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.path) throw new Error(data?.error || "Could not prepare your revision plan. Please try again.");
    return data.path;
}
