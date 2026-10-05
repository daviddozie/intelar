import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getLearningPath } from "@/lib/learning-db";
import { learningErrorResponse } from "@/lib/learning-errors";

export async function GET(request: Request, { params }: { params: Promise<{ pathId: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const { pathId } = await params;
        const path = await getLearningPath(session.user.email, pathId);
        if (!path) return Response.json({ error: "Learning path not found" }, { status: 404 });
        return Response.json({ path });
    } catch (error) {
        return learningErrorResponse(error);
    }
}

export async function PUT(request: Request, { params }: { params: Promise<{ pathId: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const { pathId } = await params;
        const body = await request.json();
        const { updateLearningPathOutline } = await import("@/lib/learning-db");
        const path = await updateLearningPathOutline(session.user.email, pathId, body);
        return Response.json({ path });
    } catch (error) {
        return learningErrorResponse(error);
    }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ pathId: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const { pathId } = await params;
        const { deleteLearningPath } = await import("@/lib/learning-db");
        const deleted = await deleteLearningPath(session.user.email, pathId);
        if (!deleted) return Response.json({ error: "Learning path not found" }, { status: 404 });
        return Response.json({ success: true });
    } catch (error) {
        return learningErrorResponse(error);
    }
}

