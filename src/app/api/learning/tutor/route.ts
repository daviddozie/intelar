import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { SAMPLE_STATISTICS_COURSE } from "@/lib/sample-course";
import { getLearningPath } from "@/lib/learning-db";
import { learningErrorResponse } from "@/lib/learning-errors";
import type { LearningLesson } from "@/lib/learning-types";

export const runtime = "nodejs";

const tutorRequestSchema = z.object({
    pathId: z.string().min(1),
    lessonId: z.string().min(1),
    message: z.string().trim().min(1).max(2000),
    history: z.array(z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
    })).max(20).default([]),
});

export function buildLessonTutorSystemPrompt(lesson: LearningLesson): string {
    const citations = (lesson.sources || [])
        .map((s) => `• ${s.title} (${s.section || "General"}): "${s.excerpt}"`)
        .join("\n");

    return `You are Intelar's Focused Lesson Tutor — an encouraging, clear, and academically rigorous personal tutor for university students in Nigeria.

ACTIVE LESSON SCOPE:
Title: ${lesson.title}
Summary: ${lesson.summary || "N/A"}

LESSON TEXT:
${lesson.content || "Lesson overview and materials."}

TRACEABLE SUPPORTING SOURCES:
${citations || "Course textbook and reference materials."}

TUTORING MANDATE:
1. STRICT LESSON SCOPE: You are exclusively assigned to tutor this specific lesson ("${lesson.title}"). If the student asks questions completely unrelated to this lesson or subject, politely redirect them: "Let's stay focused on ${lesson.title} for now. We can tackle other topics once you complete this lesson!"
2. SOURCE-GROUNDED EXPLANATIONS: Ground all definitions, calculations, and concepts in the lesson text and sources above.
3. SOCRATIC GUIDANCE: If the student asks for an answer to a practice question, provide progressive hints and guiding questions instead of immediately giving the final answer.
4. RELEVANT NIGERIAN CAMPUS ANALOGIES: Use relatable university campus examples (transport fares, course registration, CGPA calculations, hostel allocations) to demystify abstract math.
5. CONCISE & READABLE: Keep answers focused and well-structured with bullet points and bold highlights for easy reading on mobile screens.`;
}

export async function POST(request: Request) {
    let session = null;
    try {
        session = await getServerSession(authOptions);
    } catch {
        // Continue to check pathId
    }

    try {
        const body = tutorRequestSchema.parse(await request.json());
        let lesson: LearningLesson | undefined;

        if (body.pathId === SAMPLE_STATISTICS_COURSE.id) {
            lesson = SAMPLE_STATISTICS_COURSE.lessons.find((l) => l.id === body.lessonId);
            if (!lesson) {
                return Response.json({ error: "Lesson not found in demonstration course" }, { status: 404 });
            }
        } else {
            if (!session?.user?.email) {
                return Response.json({ error: "Unauthorized: Personal study paths require signing in" }, { status: 401 });
            }
            const path = await getLearningPath(session.user.email, body.pathId);
            if (!path) {
                return Response.json({ error: "Learning path not found" }, { status: 404 });
            }
            lesson = path.lessons.find((l) => l.id === body.lessonId);
            if (!lesson) {
                return Response.json({ error: "Lesson not found in this study path" }, { status: 404 });
            }
        }

        const systemPrompt = buildLessonTutorSystemPrompt(lesson);

        // If OpenRouter key is available, use streaming AI
        if (process.env.OPENROUTER_API_KEY) {
            const { lessonTutorAgent } = await import("@/mastra/agents/lesson-tutor-agent");

            const historyText = body.history.length > 0
                ? `\n\nCONVERSATION HISTORY:\n${body.history.map((h) => `${h.role === "user" ? "Student" : "Tutor"}: ${h.content}`).join("\n")}`
                : "";

            const prompt = `${systemPrompt}${historyText}\n\nSTUDENT QUESTION:\n${body.message}`;
            const response = await lessonTutorAgent.stream(prompt);

            const encoder = new TextEncoder();
            const readable = new ReadableStream({
                async start(controller) {
                    try {
                        for await (const chunk of response.textStream) {
                            controller.enqueue(encoder.encode(chunk));
                        }
                    } catch (streamErr) {
                        controller.error(streamErr);
                    } finally {
                        controller.close();
                    }
                },
            });

            return new Response(readable, {
                headers: {
                    "Content-Type": "text/plain; charset=utf-8",
                    "Cache-Control": "no-cache",
                },
            });
        }

        // Offline / testing fallback stream
        const encoder = new TextEncoder();
        const fallbackText = `I am your focused tutor for **${lesson.title}**.\n\nIn this lesson, we study foundational principles such as:\n> "${lesson.summary}"\n\nTo help you with your question ("*${body.message}*"), remember to check the cited sources and practice questions. Let me know if you would like a hint for a specific question!`;

        const readable = new ReadableStream({
            start(controller) {
                controller.enqueue(encoder.encode(fallbackText));
                controller.close();
            },
        });

        return new Response(readable, {
            headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
            },
        });
    } catch (error) {
        return learningErrorResponse(error);
    }
}
