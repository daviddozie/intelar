import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { createLearningPath, getUserLearningPaths } from "@/lib/learning-db";
import { createLearningPathSchema } from "@/lib/learning-types";
import { learningErrorResponse } from "@/lib/learning-errors";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
        return Response.json({ paths: await getUserLearningPaths(session.user.email) });
    } catch (error) {
        return learningErrorResponse(error);
    }
}

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) return Response.json({ error: "Unauthorized" }, { status: 401 });
    try {
        const input = createLearningPathSchema.parse(await request.json());
        const path = await createLearningPath(session.user.email, input);
        return Response.json({ path }, { status: 201 });
    } catch (error) {
        return learningErrorResponse(error);
    }
}
