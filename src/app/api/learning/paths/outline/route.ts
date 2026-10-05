import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { extractResourceTexts, generateStudyOutline } from "@/lib/learning-generator";
import { learningErrorResponse } from "@/lib/learning-errors";

const outlineRequestSchema = z.object({
    goal: z.string().trim().max(2000).optional().default(""),
    language: z.enum(["en", "fr"]).default("en"),
    resourceUrls: z.array(z.string().url()).min(1).max(3),
});

export async function POST(request: Request) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = outlineRequestSchema.parse(await request.json());
        const resourceTexts = await extractResourceTexts(session.user.email, body.resourceUrls);
        const lessons = await generateStudyOutline({
            goal: body.goal || "Master the key concepts and practical applications covered in the materials.",
            language: body.language,
            resourceTexts,
        });

        const primaryDoc = resourceTexts[0];
        const docBaseName = primaryDoc ? primaryDoc.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ") : "Study Path";
        const suggestedTitle = docBaseName.length > 3 ? docBaseName : (lessons[0]?.title || "Personal Study Path");
        const suggestedGoal = body.language === "fr"
            ? `Maîtriser les concepts fondamentaux et les applications pratiques tirés de ${suggestedTitle}.`
            : `Master core concepts and practical applications from ${suggestedTitle}.`;

        return Response.json({
            lessons,
            suggestedTitle,
            suggestedGoal,
        });
    } catch (error) {
        return learningErrorResponse(error);
    }
}
