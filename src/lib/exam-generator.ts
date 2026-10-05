import { randomUUID } from "node:crypto";
import { z } from "zod";
import { extractResourceTexts, checkSourceSufficiency } from "./learning-generator";
import { saveExamPrep } from "./exam-db";
import type {
    ExamDifficulty,
    ExamPrep,
    ExamQuestion,
} from "./exam-types";
import type { ResourceDocumentText } from "./learning-types";

interface GenerateExamParams {
    userEmail: string;
    resourceUrls: string[];
    difficulty: ExamDifficulty;
    questionCount: 10 | 20 | 30 | 50;
    timeLimitMinutes: number;
    title?: string;
    courseName?: string;
}

const examQuestionSchema = z.object({
    question: z.string().min(10),
    options: z.array(z.string().min(1)).length(4),
    correctAnswer: z.number().int().min(0).max(3),
    explanation: z.string().min(10),
    sourceExcerpt: z.string().optional(),
});

const generatedExamSchema = z.object({
    title: z.string().min(1).optional(),
    courseName: z.string().min(1).optional(),
    questions: z.array(examQuestionSchema),
});

async function generateAIBatch(
    agent: any,
    context: string,
    targetCount: number,
    difficulty: ExamDifficulty,
    difficultyGuide: string,
    title: string,
    course: string,
    batchNum = 1
): Promise<ExamQuestion[]> {
    const prompt = `You are a university examination board professor preparing a rigorous practice exam.
Generate an authentic university exam batch with exactly ${targetCount} multiple-choice questions based STRICTLY on the provided source document.

Target Difficulty: ${difficulty.toUpperCase()} (${difficultyGuide})
Number of Questions: ${targetCount}

Document Content:
${context}

Guidelines:
1. Every question must be concrete and directly testable from the document material.
2. Provide exactly 4 distinct and plausible options (A, B, C, D) for each question.
3. Indicate the zero-indexed correct answer (0 for A, 1 for B, 2 for C, 3 for D).
4. Provide a clear, educational explanation (keep concise: 1-2 sentences) citing the exact concept or excerpt from the manual.
5. Keep questions and options concise and avoid conversational filler.

Respond ONLY with a JSON object in this format (no markdown code blocks, no other text):
{
  "title": "${title}",
  "courseName": "${course}",
  "questions": [
    {
      "question": "What is the primary difference between...",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": 1,
      "explanation": "Option B is correct because...",
      "sourceExcerpt": "Short excerpt from text"
    }
  ]
}`;

    const timeoutMs = Math.max(50000, targetCount * 2400);
    const generatePromise = agent.generate(prompt);
    const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`AI exam batch generation timeout (${timeoutMs}ms)`)), timeoutMs)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);
    const text = response.text || "";
    const jsonMatch = text.match(/\{[\s\S]*\}/);

    if (!jsonMatch) return [];

    const parsed = JSON.parse(jsonMatch[0]);
    const validated = generatedExamSchema.safeParse(parsed);
    if (!validated.success || !validated.data.questions) return [];

    return validated.data.questions.map((q, idx) => ({
        id: `q_${randomUUID().slice(0, 8)}_${batchNum}_${idx + 1}`,
        question: q.question,
        options: [q.options[0], q.options[1], q.options[2], q.options[3]],
        correctAnswer: q.correctAnswer,
        explanation: q.explanation,
        sourceExcerpt: q.sourceExcerpt,
    }));
}

export async function generateExamFromDocument(params: GenerateExamParams): Promise<ExamPrep> {
    const { userEmail, resourceUrls, difficulty, questionCount, timeLimitMinutes } = params;

    // 1. Extract and verify authorized resource text
    const resourceTexts = await extractResourceTexts(userEmail, resourceUrls);
    checkSourceSufficiency(resourceTexts);

    const primaryDoc = resourceTexts[0];
    const docCleanName = primaryDoc.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");

    const finalTitle = params.title?.trim() || `${docCleanName} Exam Simulation`;
    const finalCourse = params.courseName?.trim() || docCleanName;

    let generatedQuestions: ExamQuestion[] = [];

    // 2. Attempt AI Generation via OpenRouter if key is available
    if (process.env.OPENROUTER_API_KEY) {
        try {
            const { examExaminerAgent } = await import("@/mastra/agents/exam-examiner-agent");

            const contextText = resourceTexts
                .map((d) => `--- DOCUMENT: ${d.name} ---\n${d.text.slice(0, 14000)}`)
                .join("\n\n");

            const difficultyGuide = {
                easy: "Focus on foundational definitions, formula identification, and basic concept recall directly mentioned in the text.",
                medium: "Focus on applied scenarios, multi-step comprehension, interpreting tables/data, and practical problem solving.",
                hard: "Focus on complex edge cases, error diagnosis, synthesizing multi-chapter concepts, and challenging analytical deductions.",
                standard: "Provide a balanced university examination: ~30% foundational recall, ~50% applied problem-solving, and ~20% challenging analysis.",
            }[difficulty];

            if (questionCount > 20) {
                // Split large question counts into two parallel batches to avoid token limit and cut generation time in half
                const batch1Count = Math.floor(questionCount / 2);
                const batch2Count = questionCount - batch1Count;

                const halfLength = Math.floor(contextText.length / 2);
                const part1Context = contextText.slice(0, Math.min(contextText.length, halfLength + 2000));
                const part2Context = contextText.slice(Math.max(0, halfLength - 2000));

                const [b1, b2] = await Promise.allSettled([
                    generateAIBatch(examExaminerAgent, part1Context, batch1Count, difficulty, difficultyGuide, finalTitle, finalCourse, 1),
                    generateAIBatch(examExaminerAgent, part2Context, batch2Count, difficulty, difficultyGuide, finalTitle, finalCourse, 2),
                ]);

                const q1 = b1.status === "fulfilled" ? b1.value : [];
                const q2 = b2.status === "fulfilled" ? b2.value : [];

                generatedQuestions = [...q1, ...q2];
            } else {
                generatedQuestions = await generateAIBatch(
                    examExaminerAgent,
                    contextText,
                    questionCount,
                    difficulty,
                    difficultyGuide,
                    finalTitle,
                    finalCourse,
                    1
                );
            }
        } catch (err) {
            console.warn("AI exam generation failed, falling back to deterministic document analysis:", err);
        }
    }

    // 3. Fallback: Deterministic Document Synthesis if AI returned fewer questions or failed
    if (generatedQuestions.length < questionCount) {
        const fallbackQuestions = synthesizeQuestionsFromDocument(
            resourceTexts,
            difficulty,
            questionCount,
            generatedQuestions
        );
        generatedQuestions = fallbackQuestions;
    }

    // Trim or fill exactly to questionCount
    const finalQuestions = generatedQuestions.slice(0, questionCount);

    const examId = randomUUID();
    const now = new Date().toISOString();

    const exam: ExamPrep = {
        id: examId,
        userEmail,
        title: finalTitle,
        courseName: finalCourse,
        difficulty,
        questionCount,
        timeLimitMinutes,
        resourceUrls,
        resourceNames: resourceTexts.map((r) => r.name),
        questions: finalQuestions,
        createdAt: now,
        updatedAt: now,
    };

    await saveExamPrep(exam);
    return exam;
}

/**
 * Deterministic question synthesizer that extracts sentences, key terms,
 * concepts, and numerical facts from the document text to construct
 * realistic multiple choice questions.
 */
function synthesizeQuestionsFromDocument(
    docs: ResourceDocumentText[],
    difficulty: ExamDifficulty,
    targetCount: number,
    existingQuestions: ExamQuestion[] = []
): ExamQuestion[] {
    const questions: ExamQuestion[] = [...existingQuestions];
    const combinedText = docs.map((d) => d.text).join("\n\n");
    const docName = docs[0]?.name.replace(/\.[^.]+$/, "") || "Course Material";

    // Extract sentences with substantial information
    const sentences = combinedText
        .split(/(?<=[.?!])\s+/)
        .map((s) => s.trim())
        .filter((s) => s.length >= 40 && s.length <= 250 && !s.startsWith("#") && !s.includes("|"));

    // Extract paragraphs/headings
    const paragraphs = combinedText
        .split(/\n\s*\n/)
        .map((p) => p.trim())
        .filter((p) => p.length >= 80);

    let sentenceIndex = 0;
    let counter = questions.length + 1;

    while (questions.length < targetCount && sentenceIndex < sentences.length) {
        const sentence = sentences[sentenceIndex++];
        const words = sentence.split(/\s+/);

        if (words.length < 8) continue;

        // Extract key terms or nouns from the sentence
        const significantWords = words
            .filter((w) => w.length > 5 && !/^(the|this|that|these|those|which|where|when|their|about)$/i.test(w))
            .map((w) => w.replace(/[^\w-]/g, ""));

        if (significantWords.length === 0) continue;

        const keyTerm = significantWords[Math.floor(significantWords.length / 2)];
        const promptTemplate = sentence.replace(new RegExp(`\\b${keyTerm}\\b`, "i"), "_______");

        // Plausible distractors
        const otherTerms = significantWords.filter((w) => w.toLowerCase() !== keyTerm.toLowerCase());
        const distractor1 = otherTerms[0] || (difficulty === "easy" ? "Uniform variation" : "Linear variance");
        const distractor2 = otherTerms[1] || (difficulty === "hard" ? "Systemic stochastic error" : "Arbitrary constant");
        const distractor3 = otherTerms[2] || "Null deviation";

        const optionsList = [keyTerm, distractor1, distractor2, distractor3];
        // Shuffle options deterministically
        const correctIndex = (counter * 7) % 4;
        const temp = optionsList[0];
        optionsList[0] = optionsList[correctIndex];
        optionsList[correctIndex] = temp;

        const difficultyPrefix = {
            easy: "Identify the concept",
            medium: "Based on the manual's analysis",
            hard: "Evaluate the theoretical condition",
            standard: "According to the course principles",
        }[difficulty];

        questions.push({
            id: `q_${counter}`,
            question: `${difficultyPrefix}: In the context of ${docName}, complete the following principle: "${promptTemplate}"`,
            options: [optionsList[0], optionsList[1], optionsList[2], optionsList[3]],
            correctAnswer: correctIndex,
            explanation: `The correct answer is "${keyTerm}". As stated in ${docName}: "${sentence}"`,
            sourceExcerpt: sentence,
        });

        counter++;
    }

    // If still need more questions, generate conceptual synthesis questions
    while (questions.length < targetCount) {
        const p = paragraphs[counter % paragraphs.length] || combinedText.slice(0, 200);
        const snippet = p.slice(0, 140).replace(/\s+/g, " ");

        const correct = `Directly reflects the core definition: "${snippet}..."`;
        const optB = "Opposes the documented principle by assuming independence without verification.";
        const optC = "Only applies to qualitative samples with small sample sizes.";
        const optD = "Is considered obsolete and rejected under standard testing conditions.";

        const correctIndex = counter % 4;
        const opts = [correct, optB, optC, optD];
        const swap = opts[0];
        opts[0] = opts[correctIndex];
        opts[correctIndex] = swap;

        questions.push({
            id: `q_${counter}`,
            question: `Which of the following statements accurately summarizes the principles detailed in ${docName} regarding this topic?`,
            options: [opts[0], opts[1], opts[2], opts[3]],
            correctAnswer: correctIndex,
            explanation: `As detailed in the source document: "${snippet}..." This provides the empirical basis for the correct choice.`,
            sourceExcerpt: snippet,
        });

        counter++;
    }

    return questions;
}
