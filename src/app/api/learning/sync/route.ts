import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { syncLearningEvents } from "@/lib/learning-db";
import { learningErrorResponse } from "@/lib/learning-errors";
import { syncRequestSchema } from "@/lib/learning-types";

export const runtime = "nodejs";

export async function POST(request: Request) {
    try {
        const session = await getServerSession(authOptions);
        if (!session?.user?.email) {
            return Response.json(
                { error: "Authentication required to synchronize offline learning progress" },
                { status: 401 }
            );
        }

        const json = await request.json();
        const { attempts } = syncRequestSchema.parse(json);

        const result = await syncLearningEvents(session.user.email, attempts);

        return Response.json({
            success: true,
            ...result,
        });
    } catch (error) {
        return learningErrorResponse(error);
    }
}
