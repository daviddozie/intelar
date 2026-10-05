import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listExamAttempts, submitExamAttempt, ExamNotFoundError } from "@/lib/exam-db";
import { submitExamAttemptSchema } from "@/lib/exam-types";

interface RouteParams {
    params: Promise<{ id: string }>;
}

export async function GET(_request: Request, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        const attempts = await listExamAttempts(session.user.email, id);
        return Response.json({ attempts });
    } catch (error) {
        if (error instanceof ExamNotFoundError) {
            return Response.json({ error: "Exam not found" }, { status: 404 });
        }
        return Response.json({ error: "Failed to list attempts" }, { status: 500 });
    }
}

export async function POST(request: Request, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        const body = await request.json();
        const input = submitExamAttemptSchema.parse(body);

        const attempt = await submitExamAttempt(session.user.email, id, input);
        return Response.json({ attempt }, { status: 201 });
    } catch (error) {
        console.error("Failed to submit exam attempt:", error);
        if (error instanceof ExamNotFoundError) {
            return Response.json({ error: "Exam not found" }, { status: 404 });
        }
        return Response.json(
            { error: error instanceof Error ? error.message : "Failed to record exam attempt" },
            { status: 400 }
        );
    }
}
