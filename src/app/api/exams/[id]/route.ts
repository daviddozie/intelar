import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteExamPrep, getExamPrep, ExamNotFoundError } from "@/lib/exam-db";

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
        const exam = await getExamPrep(session.user.email, id);
        return Response.json({ exam });
    } catch (error) {
        if (error instanceof ExamNotFoundError) {
            return Response.json({ error: "Exam not found" }, { status: 404 });
        }
        return Response.json({ error: "Failed to retrieve exam" }, { status: 500 });
    }
}

export async function DELETE(_request: Request, { params }: RouteParams) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    try {
        await deleteExamPrep(session.user.email, id);
        return Response.json({ success: true });
    } catch (error) {
        if (error instanceof ExamNotFoundError) {
            return Response.json({ error: "Exam not found" }, { status: 404 });
        }
        return Response.json({ error: "Failed to delete exam" }, { status: 500 });
    }
}
