import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listExamPreps } from "@/lib/exam-db";
import { generateExamFromDocument } from "@/lib/exam-generator";
import { createExamInputSchema } from "@/lib/exam-types";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const exams = await listExamPreps(session.user.email);
        return Response.json({ exams });
    } catch (error) {
        console.error("Failed to list exams:", error);
        return Response.json(
            { error: error instanceof Error ? error.message : "Failed to load exams" },
            { status: 500 }
        );
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = await request.json();
        const input = createExamInputSchema.parse(body);

        const exam = await generateExamFromDocument({
            userEmail: session.user.email,
            resourceUrls: input.resourceUrls,
            difficulty: input.difficulty,
            questionCount: input.questionCount,
            timeLimitMinutes: input.timeLimitMinutes,
            title: input.title,
            courseName: input.courseName,
        });

        return Response.json({ exam }, { status: 201 });
    } catch (error) {
        console.error("Failed to generate exam:", error);
        return Response.json(
            { error: error instanceof Error ? error.message : "Failed to generate exam" },
            { status: 400 }
        );
    }
}
