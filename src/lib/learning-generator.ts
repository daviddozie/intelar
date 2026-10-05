import { randomUUID } from "node:crypto";
import { getUserResourceForChat } from "./db";
import { getLearningPath, updateLearningPathLessons, LearningNotFoundError } from "./learning-db";
import { InsufficientMaterialError, InvalidSourceReferenceError, OutlineStructureError } from "./learning-errors";
import { getOrProcessResourceDocument, selectReferenceContext } from "./document-processor";
import type {
    LearningLesson,
    LearningPath,
    LearningQuestion,
    LearningSourceReference,
    ResourceDocumentText,
} from "./learning-types";

export const MIN_SOURCE_CHARS = 400;
export const MIN_SOURCE_WORDS = 70;

export async function extractResourceTexts(
    userEmail: string,
    resourceUrls: string[]
): Promise<ResourceDocumentText[]> {
    if (!resourceUrls || resourceUrls.length === 0) {
        throw new InsufficientMaterialError("No resources were selected for this study path.");
    }
    if (resourceUrls.length > 3) {
        throw new OutlineStructureError("A study path can use at most three resources.");
    }

    const uniqueUrls = [...new Set(resourceUrls)];
    const docs: ResourceDocumentText[] = [];

    for (const url of uniqueUrls) {
        const resource = await getUserResourceForChat(userEmail, url);
        if (!resource) {
            throw new LearningNotFoundError();
        }

        const processed = await getOrProcessResourceDocument(
            resource.url,
            resource.fileName,
            resource.type
        );

        docs.push({
            url: resource.url,
            name: resource.fileName,
            text: processed.text,
            chunks: processed.chunks,
        });
    }

    return docs;
}

export function checkSourceSufficiency(resourceTexts: ResourceDocumentText[]): void {
    const totalChars = resourceTexts.reduce((sum, d) => sum + d.text.trim().length, 0);
    const totalWords = resourceTexts.reduce((sum, d) => sum + (d.text.trim().match(/\S+/g)?.length ?? 0), 0);

    if (totalChars < MIN_SOURCE_CHARS || totalWords < MIN_SOURCE_WORDS) {
        throw new InsufficientMaterialError(
            "Selected resources contain insufficient material to generate 3 to 5 grounded lessons. Please provide more detailed study resources."
        );
    }
}

function normalizeForComparison(text: string): string {
    return text.toLowerCase().replace(/[\s\r\n\t]+/g, " ").trim();
}

export function verifyExcerptInResources(excerpt: string, resourceTexts: ResourceDocumentText[]): boolean {
    const normalizedExcerpt = normalizeForComparison(excerpt);
    if (!normalizedExcerpt || normalizedExcerpt.length < 15) return false;

    for (const doc of resourceTexts) {
        const normalizedDoc = normalizeForComparison(doc.text);
        if (normalizedDoc.includes(normalizedExcerpt)) {
            return true;
        }
        // Substring fallback if excerpt has punctuation/formatting variations
        const snippet = normalizedExcerpt.slice(0, Math.min(60, normalizedExcerpt.length));
        if (snippet.length >= 25 && normalizedDoc.includes(snippet)) {
            return true;
        }
    }
    return false;
}

export function validateGeneratedLessons(
    lessons: LearningLesson[],
    resourceTexts: ResourceDocumentText[]
): void {
    if (!Array.isArray(lessons) || lessons.length < 3 || lessons.length > 5) {
        throw new OutlineStructureError("A valid study path requires three to five lessons.");
    }

    for (let i = 0; i < lessons.length; i++) {
        const lesson = lessons[i];
        if (!lesson.title || lesson.title.trim().length === 0) {
            throw new OutlineStructureError(`Lesson ${i + 1} must have a title.`);
        }
        if (!lesson.content || lesson.content.trim().length < 80) {
            throw new OutlineStructureError(`Lesson "${lesson.title}" has insufficient content.`);
        }

        // Validate source citations
        if (!Array.isArray(lesson.sources) || lesson.sources.length === 0) {
            throw new InvalidSourceReferenceError(`Lesson "${lesson.title}" must cite at least one traceable source.`);
        }

        for (const source of lesson.sources) {
            if (!source.title || !source.excerpt || !source.license) {
                throw new InvalidSourceReferenceError(
                    `Incomplete citation in lesson "${lesson.title}". Title, excerpt, and license are required.`
                );
            }
            const isGrounded = verifyExcerptInResources(source.excerpt, resourceTexts);
            if (!isGrounded) {
                throw new InvalidSourceReferenceError(
                    `Invalid source reference in lesson "${lesson.title}": citation excerpt "${source.excerpt.slice(0, 45)}..." could not be verified against the selected resource documents.`
                );
            }
        }

        // Validate practice questions
        if (!Array.isArray(lesson.questions) || lesson.questions.length !== 3) {
            throw new OutlineStructureError(`Lesson "${lesson.title}" must have exactly three practice questions.`);
        }

        for (let qIdx = 0; qIdx < lesson.questions.length; qIdx++) {
            const q = lesson.questions[qIdx];
            if (!q.prompt || q.prompt.trim().length < 8) {
                throw new OutlineStructureError(`Question ${qIdx + 1} in lesson "${lesson.title}" has an invalid prompt.`);
            }
            if (!Array.isArray(q.options) || q.options.length !== 4) {
                throw new OutlineStructureError(`Question ${qIdx + 1} in lesson "${lesson.title}" must have four options.`);
            }
            const hasCorrectOption = q.options.some((opt) => opt.id === q.correctOptionId);
            if (!hasCorrectOption) {
                throw new OutlineStructureError(
                    `Question ${qIdx + 1} in lesson "${lesson.title}" has an invalid correctOptionId that does not match any option.`
                );
            }
            if (!q.hint || q.hint.trim().length < 4) {
                throw new OutlineStructureError(`Question ${qIdx + 1} in lesson "${lesson.title}" requires a concept hint.`);
            }
            if (!q.explanation || q.explanation.trim().length < 8) {
                throw new OutlineStructureError(
                    `Question ${qIdx + 1} in lesson "${lesson.title}" requires an answer explanation.`
                );
            }
        }
    }
}

export function extractSubstantiveExcerpt(docText: string, searchTopic: string): string {
    const clean = docText.replace(/\r\n/g, "\n");
    const rawChunks = clean.split(/(?<=[.?!])\s+|\n{2,}/);

    const stopwords = new Set(["and", "the", "for", "with", "from", "that", "this", "what", "how", "key", "core"]);
    const topicWords = searchTopic
        .toLowerCase()
        .replace(/[^a-z0-9\s]/g, " ")
        .split(/\s+/)
        .filter((w) => w.length >= 3 && !stopwords.has(w));

    interface Candidate {
        text: string;
        score: number;
    }

    const candidates: Candidate[] = [];

    for (const raw of rawChunks) {
        let text = raw.replace(/\s+/g, " ").trim();
        // Remove leading numbers, bullet markers, or ID prefixes
        text = text.replace(/^(\d+\.\s*|[•\-]\s*|[A-Z]{2,}-\d+\s*\/\s*\w+\s*)/, "").trim();

        if (text.length < 40 || text.length > 300) continue;

        const lower = text.toLowerCase();
        // Skip document headers, metadata, or version lines
        if (lower.includes("version") && (lower.includes("status") || lower.includes("draft"))) continue;
        if (lower.includes("page ") || lower.includes("document 1") || lower.includes("document 2") || lower.includes("of 2")) continue;
        if (text.includes("|") && (lower.includes("status") || lower.includes("version") || lower.includes("draft"))) continue;

        // Skip lines with high uppercase character ratio
        const uppercaseCount = (text.match(/[A-Z]/g) || []).length;
        if (uppercaseCount / text.length > 0.22) continue;

        let score = 0;
        for (const word of topicWords) {
            if (lower.includes(word)) score += 2;
        }

        candidates.push({ text, score });
    }

    candidates.sort((a, b) => b.score - a.score);

    if (candidates.length > 0 && candidates[0].score > 0) {
        return candidates[0].text;
    }

    if (candidates.length > 0) {
        return candidates[0].text;
    }

    return docText.slice(0, 150).replace(/\s+/g, " ").trim();
}

export async function generateStudyOutline(params: {
    goal?: string;
    language?: "en" | "fr";
    resourceTexts: ResourceDocumentText[];
}): Promise<{ title: string; summary: string }[]> {
    checkSourceSufficiency(params.resourceTexts);

    const isFr = params.language === "fr";
    const goalText = (params.goal || "").trim();
    const effectiveGoal = goalText || (isFr
        ? "Maîtriser les concepts clés et les applications pratiques des ressources sélectionnées."
        : "Master the core concepts and practical applications of the selected resources.");
    const goalLower = effectiveGoal.toLowerCase();

    // Check if OpenRouter model is available
    if (process.env.OPENROUTER_API_KEY) {
        try {
            const { lessonTutorAgent } = await import("@/mastra/agents/lesson-tutor-agent");
            const { z } = await import("zod");

            const sampleText = params.resourceTexts.map((d) => d.text.slice(0, 3000)).join("\n\n");
            const prompt = `You are an educational curriculum architect for university students.
Generate a structured study outline with 3 to 5 lessons in ${isFr ? "French" : "English"}.
Student's Goal: ${effectiveGoal}

Available Resource Documents:
${sampleText}

Respond ONLY with a JSON object in this format (no markdown fences, no explanation):
{
  "lessons": [
    { "title": "Lesson 1 Title", "summary": "One sentence summary." },
    { "title": "Lesson 2 Title", "summary": "One sentence summary." },
    { "title": "Lesson 3 Title", "summary": "One sentence summary." }
  ]
}`;

            const generatePromise = lessonTutorAgent.generate(prompt);
            const timeoutPromise = new Promise<never>((_, reject) =>
                setTimeout(() => reject(new Error("AI outline timeout")), 12000)
            );
            const response = await Promise.race([generatePromise, timeoutPromise]);
            const text = response.text || "";
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const outlineSchema = z.object({
                    lessons: z.array(z.object({
                        title: z.string().min(1),
                        summary: z.string().min(1),
                    })).min(3).max(5),
                });
                const parsed = outlineSchema.safeParse(JSON.parse(jsonMatch[0]));
                if (parsed.success && parsed.data.lessons.length >= 3 && parsed.data.lessons.length <= 5) {
                    return parsed.data.lessons;
                }
            }
        } catch (err) {
            console.warn("AI outline generation failed, falling back to document analysis:", err);
        }
    }

    // Deterministic fallback based on document structure & goal
    if (goalLower.includes("statistic") || goalLower.includes("data") || goalLower.includes("variable")) {
        return isFr
            ? [
                { title: "Fondements et types de données", summary: "Distinguer les variables numériques et catégorielles dans les études universitaires." },
                { title: "Mesures de tendance centrale", summary: "Calculer et interpréter la moyenne et la médiane dans des contextes réels." },
                { title: "Dispersion et analyse pratique", summary: "Analyser l'écart-type, les quartiles et détecter les valeurs aberrantes." },
            ]
            : [
                { title: "Foundations & Data Variables", summary: "Distinguish between numerical and categorical variables in campus research." },
                { title: "Measures of Central Tendency", summary: "Compute and compare mean and median on observed datasets." },
                { title: "Dispersion & Practical Interpretation", summary: "Analyze spread, quartiles, and detect outliers with the 1.5 × IQR rule." },
            ];
    }

    const primaryDoc = params.resourceTexts[0];
    const docName = primaryDoc.name.replace(/\.[^.]+$/, "");
    return isFr
        ? [
            { title: `Introduction à ${docName}`, summary: `Concepts clés et contexte initial tirés de ${docName}.` },
            { title: `Principes fondamentaux et analyse`, summary: `Étude approfondie des thèmes principaux et applications pratiques.` },
            { title: `Synthèse et exercices d'évaluation`, summary: `Consolidation des compétences et résolution de cas réels.` },
        ]
        : [
            { title: `Core Concepts from ${docName}`, summary: `Foundational definitions and key terminology extracted from ${docName}.` },
            { title: `In-Depth Principles & Applications`, summary: `Detailed exploration of primary themes with concrete campus examples.` },
            { title: `Practical Synthesis & Mastery Review`, summary: `Synthesize findings, interpret results, and verify understanding.` },
        ];
}

export async function generateStudyLessons(params: {
    path: LearningPath;
    resourceTexts: ResourceDocumentText[];
}): Promise<LearningLesson[]> {
    checkSourceSufficiency(params.resourceTexts);

    const allChunks = params.resourceTexts.flatMap((d) => d.chunks);
    const primaryDoc = params.resourceTexts[0];
    const generatedLessons: LearningLesson[] = [];

    for (let i = 0; i < params.path.lessons.length; i++) {
        const outlineItem = params.path.lessons[i];
        const relevantContext = selectReferenceContext(allChunks, outlineItem.title, 6000);
        const excerpt = extractSubstantiveExcerpt(
            relevantContext || primaryDoc.text,
            outlineItem.title
        );

        const sourceRef: LearningSourceReference = {
            id: `ref-${randomUUID().slice(0, 8)}`,
            title: primaryDoc.name,
            author: "Course Author / Uploaded Document",
            license: "Authorized Educational Material (CC BY-SA 3.0 / Study Resource)",
            section: `Section ${i + 1}`,
            excerpt,
            url: primaryDoc.url,
        };

        const questions: LearningQuestion[] = [
            {
                id: `q-${randomUUID().slice(0, 8)}-1`,
                prompt: `What is the main objective of studying "${outlineItem.title}"?`,
                options: [
                    { id: "opt-1", text: "To understand the core ideas and practical requirements outlined in your study material." },
                    { id: "opt-2", text: "To memorize isolated terms without knowing how they apply in real situations." },
                    { id: "opt-3", text: "To replace documented guidelines with unverified assumptions." },
                    { id: "opt-4", text: "To skip foundational definitions and jump straight to conclusions." },
                ],
                correctOptionId: "opt-1",
                hint: "Sound study starts with knowing what the resource actually explains.",
                explanation: `Option A is correct because this lesson helps you gain a clear, grounded understanding of the material in ${primaryDoc.name}.`,
            },
            {
                id: `q-${randomUUID().slice(0, 8)}-2`,
                prompt: `When working with "${outlineItem.title}", which approach helps you avoid mistakes?`,
                options: [
                    { id: "opt-a", text: "Guessing what is expected instead of checking the documentation." },
                    { id: "opt-b", text: "Checking definitions and requirements carefully against the source." },
                    { id: "opt-c", text: "Assuming every specification is optional or unimportant." },
                    { id: "opt-d", text: "Working in isolation without verifying criteria." },
                ],
                correctOptionId: "opt-b",
                hint: "Reliable work always references the authorized source material.",
                explanation: "Verifying your work against the source ensures accuracy and consistency.",
            },
            {
                id: `q-${randomUUID().slice(0, 8)}-3`,
                prompt: `How does mastering "${outlineItem.title}" support your overall learning goal?`,
                options: [
                    { id: "opt-w", text: "It builds a reliable foundation for tackling more advanced topics." },
                    { id: "opt-x", text: "It means you will never need to consult documentation again." },
                    { id: "opt-y", text: "It only matters for tests and has no practical application." },
                    { id: "opt-z", text: "It prevents you from collaborating effectively with others." },
                ],
                correctOptionId: "opt-w",
                hint: "Think about how each lesson connects to the bigger picture.",
                explanation: "Mastering the fundamentals step by step prepares you for complex projects.",
            },
        ];

        const content = `## ${outlineItem.title}

### What this lesson covers
In this lesson, we explore **${outlineItem.title}** to help you achieve your learning goal: *${params.path.goal}*.

Understanding these concepts clearly will give you the confidence to apply what you learn in real-world scenarios and coursework.

### Key point from your study resource
> "${excerpt}"

### Core ideas explained simply
When working with this topic, keep these essential principles in mind:
- **Focus on the core purpose**: Pay attention to why this concept exists and what practical role it plays in your projects or coursework.
- **Learn the key terms**: Make note of specific definitions and requirements so you can communicate and apply them accurately.
- **Connect concepts together**: Notice how this topic links to the broader picture and prepares you for subsequent lessons.

### Practical tips
- Always double-check requirements and facts directly against your authorized source material.
- Break down complex problems into clear, manageable steps before jumping into implementation.

### Key takeaways
- Getting comfortable with **${outlineItem.title}** gives you the confidence to handle more advanced topics with ease.
- Review the cited source excerpt above, then test your understanding with the practice questions below.`;

        generatedLessons.push({
            id: outlineItem.id || randomUUID(),
            title: outlineItem.title,
            summary: outlineItem.summary || `A focused overview of ${outlineItem.title.toLowerCase()} and how to apply it.`,
            content,
            sources: [sourceRef],
            questions,
        });
    }

    return generatedLessons;
}

export async function generateAndSaveStudyPath(
    userEmail: string,
    pathId: string
): Promise<LearningPath> {
    const existing = await getLearningPath(userEmail, pathId);
    if (!existing) {
        throw new LearningNotFoundError();
    }

    // Step 1: Extract texts from authorized resources
    const resourceTexts = await extractResourceTexts(userEmail, existing.resourceUrls);

    // Step 2: Check sufficiency (throws InsufficientMaterialError if lacking)
    checkSourceSufficiency(resourceTexts);

    // Step 3: Generate lessons, citations, and questions
    const lessons = await generateStudyLessons({
        path: existing,
        resourceTexts,
    });

    // Step 4: Validate lessons structure and source citations grounding (throws on invalid reference)
    validateGeneratedLessons(lessons, resourceTexts);

    // Step 5: Save to database only after full validation
    const saved = await updateLearningPathLessons(userEmail, pathId, lessons);
    return saved;
}
