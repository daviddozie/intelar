"use client";

import { useMutation } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { BookOpen, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createExamRevision, revisionKeys } from "@/lib/queries/exam-revision";

export default function ExamRevisionCard({ examId, attemptId, missedCount }: {
    examId: string;
    attemptId: string;
    missedCount: number;
}) {
    const { data: session } = useSession();
    const router = useRouter();
    const revision = useMutation({
        mutationKey: revisionKeys.create(session?.user?.email ?? null, examId, attemptId),
        mutationFn: () => createExamRevision(examId, attemptId),
        onSuccess: (path) => {
            const params = new URLSearchParams({ path: path.id, lesson: path.lessons[0].id });
            router.push(`/learn?${params}`);
        },
    });

    if (!missedCount) return null;
    return (
        <section aria-labelledby="revision-title" className="mb-6 rounded-2xl border border-border bg-card p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                <div>
                    <h2 id="revision-title" className="text-base font-semibold text-foreground">Turn your mistakes into a study plan</h2>
                    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        Review {missedCount} missed or unanswered {missedCount === 1 ? "question" : "questions"} in up to five lessons, with checked source passages, exam explanations, and untimed retries.
                    </p>
                    <p className="mt-2 text-xs text-muted-foreground">Internet is needed to prepare the plan. Download it in Learn to study offline.</p>
                </div>
                <Button type="button" disabled={revision.isPending} onClick={() => revision.mutate()} className="shrink-0 rounded-full cursor-pointer" aria-describedby={revision.error ? "revision-error" : undefined}>
                    {revision.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
                    {revision.isPending ? "Preparing revision…" : "Help me revise"}
                </Button>
            </div>
            {revision.isPending && <p role="status" className="mt-3 text-sm text-muted-foreground">Checking your source materials and preparing your lessons…</p>}
            {revision.error && <p id="revision-error" role="alert" className="mt-3 text-sm text-destructive">{revision.error.message}</p>}
        </section>
    );
}
