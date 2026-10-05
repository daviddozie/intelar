import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { generateAndSaveStudyPath } from "@/lib/learning-generator";
import { learningErrorResponse } from "@/lib/learning-errors";

export async function POST(
    request: Request,
    { params }: { params: Promise<{ pathId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { pathId } = await params;
        const path = await generateAndSaveStudyPath(session.user.email, pathId);
        return Response.json({ path });
    } catch (error) {
        return learningErrorResponse(error);
    }
}
