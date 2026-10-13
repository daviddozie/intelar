import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { ExamNotFoundError } from "@/lib/exam-db";
import { createExamRevisionPath } from "@/lib/exam-revision";
import { learningErrorResponse } from "@/lib/learning-errors";

const revisionRequestSchema = z.object({ attemptId: z.string().uuid() }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const { id } = await params;
        const { attemptId } = revisionRequestSchema.parse(await request.json());
        const path = await createExamRevisionPath(session.user.email, id, attemptId);
        return Response.json({ path });
    } catch (error) {
        if (error instanceof ExamNotFoundError) return Response.json({ error: "Exam or attempt not found" }, { status: 404 });
        return learningErrorResponse(error);
    }
}
