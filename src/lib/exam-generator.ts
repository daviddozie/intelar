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
1. Grounding: Every question must be concrete and directly testable from the document material.
2. Calculation & Quantitative Problem Solving (CRITICAL):
   - If the source document contains formulas, physical laws, equations, quantitative principles, or numerical relationships (e.g., Physics, Engineering, Chemistry, Statistics, Mathematics, Economics):
     * Do NOT generate only theoretical or definitional questions.
     * You MUST include calculation and formula-application questions where students are given realistic numerical values and must solve a problem using the formulas given in the text.
     * Specify all numerical parameters and units clearly in the question stem.
     * Design distractors representing common calculation pitfalls (e.g. inverted formula, sign error, missing factor of 1/2 or square power, unit conversion error).
     * In the explanation, include the explicit formula, the step-by-step numerical substitution, and the final calculated answer with units.
3. Provide exactly 4 distinct and plausible options (A, B, C, D) for each question.
4. Indicate the zero-indexed correct answer (0 for A, 1 for B, 2 for C, 3 for D).
5. Provide a clear, educational explanation (1-3 sentences) citing the exact concept or excerpt from the manual, and detailing the step-by-step mathematical working for calculation questions.
6. Keep questions and options concise and avoid conversational filler.

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
            const { examAgent } = await import("@/mastra/agents/exam-agent");

            const contextText = resourceTexts
                .map((d) => `--- DOCUMENT: ${d.name} ---\n${d.text.slice(0, 14000)}`)
                .join("\n\n");

            const difficultyGuide = {
                easy: "Focus on foundational definitions, formula identification, direct single-step calculations with clean numbers, and basic concept recall directly mentioned in the text.",
                medium: "Focus on applied scenarios, multi-step problem solving, formula rearrangement to calculate unknown values, interpreting tables/data, and practical calculations.",
                hard: "Focus on complex edge cases, multi-step formula calculations, error diagnosis, synthesizing multi-chapter concepts, and challenging analytical deductions.",
                standard: "Provide a balanced university examination: ~30% foundational recall & basic formulas, ~50% applied problem-solving and calculations, and ~20% challenging analysis.",
            }[difficulty];

            if (questionCount > 20) {
                // Split large question counts into two parallel batches to avoid token limit and cut generation time in half
                const batch1Count = Math.floor(questionCount / 2);
                const batch2Count = questionCount - batch1Count;

                const halfLength = Math.floor(contextText.length / 2);
                const part1Context = contextText.slice(0, Math.min(contextText.length, halfLength + 2000));
                const part2Context = contextText.slice(Math.max(0, halfLength - 2000));

                const [b1, b2] = await Promise.allSettled([
                    generateAIBatch(examAgent, part1Context, batch1Count, difficulty, difficultyGuide, finalTitle, finalCourse, 1),
                    generateAIBatch(examAgent, part2Context, batch2Count, difficulty, difficultyGuide, finalTitle, finalCourse, 2),
                ]);

                const q1 = b1.status === "fulfilled" ? b1.value : [];
                const q2 = b2.status === "fulfilled" ? b2.value : [];

                generatedQuestions = [...q1, ...q2];
            } else {
                generatedQuestions = await generateAIBatch(
                    examAgent,
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

interface FormulaQuestionTemplate {
    question: string;
    options: [string, string, string, string]; // First option is correct before shuffling
    explanation: string;
    sourceExcerpt: string;
}

/**
 * Scans document sentences for formulas, physical laws, equations, or quantitative
 * relationships and synthesizes realistic calculation problems with authentic distractors
 * and step-by-step explanations.
 */
function detectCalculationQuestions(
    sentences: string[],
    docName: string,
    difficulty: ExamDifficulty
): FormulaQuestionTemplate[] {
    const calcQuestions: FormulaQuestionTemplate[] = [];

    for (const sentence of sentences) {
        // 1. Newton's second law or general multiplication: Target = Var1 * Var2
        const mulMatch = sentence.match(/\b([A-Z][a-zA-Z0-9_]*)\s*=\s*([a-zA-Z0-9_]+)\s*[*·x]\s*([a-zA-Z0-9_]+)\b/);
        if (mulMatch) {
            const [, target, v1, v2] = mulMatch;
            const isForce = /force|newton/i.test(sentence) || (target === "F" && v1 === "m" && v2 === "a");
            const isWork = /work/i.test(sentence) || (target === "W" && v1 === "F" && v2 === "d");
            const isVoltage = /voltage|ohm|resistance|current/i.test(sentence) || (target === "V" && v1 === "I" && v2 === "R");
            const isPower = /power/i.test(sentence) || (target === "P" && v1 === "I" && v2 === "V");

            if (isForce) {
                // Forward problem: F = m * a
                const m = difficulty === "hard" ? 12 : 5;
                const a = difficulty === "hard" ? 6 : 4;
                const correct = m * a;
                calcQuestions.push({
                    question: `Calculation Problem: Based on ${mulMatch[0]} from the text, if a body has a mass of ${m} kg and experiences an acceleration of ${a} m/s², what is the net force F acting on the body?`,
                    options: [`${correct} N`, `${m + a} N`, `${Math.abs(m - a)} N`, `${(m / a).toFixed(2)} N`],
                    explanation: `Using the formula ${mulMatch[0]}: F = (${m} kg) * (${a} m/s²) = ${correct} N. Options with ${m + a} N, ${Math.abs(m - a)} N, and ${(m / a).toFixed(2)} N represent common addition, subtraction, and ratio inversion calculation pitfalls.`,
                    sourceExcerpt: sentence,
                });

                // Inverse problem: solving for acceleration a = F / m
                const F_val = difficulty === "hard" ? 72 : 36;
                const m_val = difficulty === "hard" ? 8 : 6;
                const a_correct = F_val / m_val;
                calcQuestions.push({
                    question: `Calculation Problem: A constant net force of ${F_val} N acts on an object with a mass of ${m_val} kg. Using ${mulMatch[0]}, calculate the resulting acceleration a.`,
                    options: [`${a_correct} m/s²`, `${F_val * m_val} m/s²`, `${F_val - m_val} m/s²`, `${F_val + m_val} m/s²`],
                    explanation: `Rearranging ${mulMatch[0]} to solve for acceleration yields a = F / m = ${F_val} N / ${m_val} kg = ${a_correct} m/s². The other choices reflect multiplication (${F_val * m_val}) and arithmetic errors.`,
                    sourceExcerpt: sentence,
                });
            } else if (isWork) {
                const F = 15;
                const d = 6;
                const W = F * d;
                calcQuestions.push({
                    question: `Calculation Problem: According to the principle of work (${mulMatch[0]}), if a constant force of ${F} N moves an object through a displacement of ${d} m in its direction, what is the work done?`,
                    options: [`${W} J`, `${F + d} J`, `${F - d} J`, `${(F / d).toFixed(1)} J`],
                    explanation: `Using W = F * d: W = ${F} N * ${d} m = ${W} J. Distractors represent addition (${F + d} J), subtraction, and division.`,
                    sourceExcerpt: sentence,
                });
            } else if (isVoltage) {
                const I = 3;
                const R = 8;
                const V = I * R;
                calcQuestions.push({
                    question: `Calculation Problem: Using the relationship ${mulMatch[0]}, what is the voltage drop across a resistor of ${R} Ω carrying an electric current of ${I} A?`,
                    options: [`${V} V`, `${I + R} V`, `${(R / I).toFixed(1)} V`, `${R - I} V`],
                    explanation: `Using V = I * R: V = ${I} A * ${R} Ω = ${V} V. Other options reflect addition, subtraction, or inverted ratios.`,
                    sourceExcerpt: sentence,
                });
            } else {
                // Generic multiplication formula
                const val1 = difficulty === "hard" ? 14 : 7;
                const val2 = difficulty === "hard" ? 5 : 3;
                const result = val1 * val2;
                calcQuestions.push({
                    question: `Calculation Problem: Based on the formula ${mulMatch[0]} documented in ${docName}, if ${v1} = ${val1} and ${v2} = ${val2}, calculate the value of ${target}.`,
                    options: [`${result} units`, `${val1 + val2} units`, `${val1 - val2} units`, `${(val1 / val2).toFixed(2)} units`],
                    explanation: `Applying the formula ${mulMatch[0]}: ${target} = ${val1} * ${val2} = ${result}. Distractors represent common computational slip-ups (addition, subtraction, division).`,
                    sourceExcerpt: sentence,
                });
            }
        }

        // 2. Division formula: Target = Var1 / Var2
        const divMatch = sentence.match(/\b([A-Z][a-zA-Z0-9_]*)\s*=\s*([a-zA-Z0-9_]+)\s*\/\s*([a-zA-Z0-9_]+)\b/);
        if (divMatch) {
            const [, target, v1, v2] = divMatch;
            const val1 = 60;
            const val2 = 12;
            const result = val1 / val2;
            calcQuestions.push({
                question: `Calculation Problem: Using the relationship ${divMatch[0]} given in ${docName}, calculate ${target} when ${v1} = ${val1} and ${v2} = ${val2}.`,
                options: [`${result} units`, `${val1 * val2} units`, `${val1 - val2} units`, `${(val2 / val1).toFixed(2)} units`],
                explanation: `Applying ${divMatch[0]}: ${target} = ${val1} / ${val2} = ${result}. Distractors include multiplying (${val1 * val2}) and inverting the quotient (${(val2 / val1).toFixed(2)}).`,
                sourceExcerpt: sentence,
            });
        }

        // 3. Kinetic energy (KE = 1/2 m v^2)
        if (/kinetic\s+energy/i.test(sentence) && (/mass/i.test(sentence) || /velocity/i.test(sentence))) {
            const m = 4;
            const v = 3;
            const correctKE = 0.5 * m * (v * v); // 18 J
            calcQuestions.push({
                question: `Calculation Problem: An object with a mass of ${m} kg is travelling at a velocity of ${v} m/s. According to the formula for kinetic energy (KE = 1/2 * m * v²), what is its kinetic energy?`,
                options: [`${correctKE} J`, `${m * (v * v)} J`, `${m * v} J`, `${0.5 * m * v} J`],
                explanation: `Using KE = 1/2 * m * v²: KE = 0.5 * (${m} kg) * (${v} m/s)² = 0.5 * ${m} * ${v * v} = ${correctKE} J. ${m * (v * v)} J omits the 1/2 factor, while ${m * v} J and ${0.5 * m * v} J fail to square the velocity.`,
                sourceExcerpt: sentence,
            });
        }

        // 4. Carnot efficiency (eta = 1 - Tc / Th)
        if (/carnot\s+efficiency/i.test(sentence) || (/heat\s+engine/i.test(sentence) && /temperature/i.test(sentence))) {
            const Th = 500;
            const Tc = 300;
            const eff = ((1 - Tc / Th) * 100).toFixed(0);
            const wrong1 = ((Tc / Th) * 100).toFixed(0);
            calcQuestions.push({
                question: `Calculation Problem: A theoretical ideal Carnot heat engine operates between a high-temperature reservoir at ${Th} K and a low-temperature sink at ${Tc} K. What is its maximum thermal efficiency?`,
                options: [`${eff}%`, `${wrong1}%`, "25%", "15%"],
                explanation: `Carnot efficiency is η = 1 - (T_cold / T_hot) = 1 - (${Tc} / ${Th}) = 1 - 0.60 = 0.40 or ${eff}%. The ${wrong1}% distractor represents calculating T_cold / T_hot without subtracting from 1.`,
                sourceExcerpt: sentence,
            });
        }
    }

    return calcQuestions;
}

/**
 * Deterministic question synthesizer that extracts formulas, calculations,
 * sentences, key terms, and concepts from the document text to construct
 * realistic multiple choice examination questions.
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

    let counter = questions.length + 1;

    // 1. Detect and integrate quantitative calculation questions if formulas exist
    const formulaTemplates = detectCalculationQuestions(sentences, docName, difficulty);
    const maxCalcQuestions = Math.min(
        formulaTemplates.length,
        Math.max(1, Math.floor(targetCount * 0.4))
    );

    for (let i = 0; i < maxCalcQuestions && questions.length < targetCount; i++) {
        const tmpl = formulaTemplates[i];
        // Shuffle options deterministically
        const correctIndex = (counter * 5) % 4;
        const shuffled: [string, string, string, string] = [...tmpl.options];
        const temp = shuffled[0];
        shuffled[0] = shuffled[correctIndex];
        shuffled[correctIndex] = temp;

        questions.push({
            id: `q_${counter}`,
            question: tmpl.question,
            options: shuffled,
            correctAnswer: correctIndex,
            explanation: tmpl.explanation,
            sourceExcerpt: tmpl.sourceExcerpt,
        });

        counter++;
    }

    // 2. Synthesize conceptual and definitional questions from document sentences
    let sentenceIndex = 0;
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

    // 3. If still need more questions, generate conceptual synthesis questions
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
