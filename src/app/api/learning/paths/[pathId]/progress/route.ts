import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { saveLearningProgress } from "@/lib/learning-db";
import { learningProgressSchema } from "@/lib/learning-types";
import { learningErrorResponse } from "@/lib/learning-errors";

export async function PUT(request: Request, { params }: { params: Promise<{ pathId: string }> }) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const { pathId } = await params;
        const input = learningProgressSchema.parse(await request.json());
        return Response.json({ progress: await saveLearningProgress(session.user.email, pathId, input) });
    } catch (error) {
        return learningErrorResponse(error);
    }
}
