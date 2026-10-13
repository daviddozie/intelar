import { createHash, randomUUID } from "node:crypto";
import { getDB } from "./db";
import { getExamAttempt, getExamPrep } from "./exam-db";
import { getLearningPath, initLearningDB, LearningNotFoundError } from "./learning-db";
import { extractResourceTexts } from "./learning-generator";
import { InvalidSourceReferenceError, OutlineStructureError } from "./learning-errors";
import type { ExamAttempt, ExamPrep } from "./exam-types";
import type { LearningLesson, LearningPath, ResourceDocumentText } from "./learning-types";

function normalize(text: string): string {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Use saved questions rather than inventing topics or new answers from a score. */
export function buildRevisionLessons(
    exam: ExamPrep,
    attempt: ExamAttempt,
    documents: ResourceDocumentText[]
): LearningLesson[] {
    const missed = exam.questions
        .map((question, index) => ({ question, number: index + 1 }))
        .filter(({ question }) => attempt.answers[question.id] !== question.correctAnswer);
    if (!missed.length) throw new OutlineStructureError("You answered every question correctly. There are no missed questions to revise.");

    const groupSize = Math.ceil(missed.length / 5);
    const lessons: LearningLesson[] = [];
    for (let start = 0; start < missed.length; start += groupSize) {
        const group = missed.slice(start, start + groupSize);
        const sources = group.map(({ question, number }) => {
            const excerpt = question.sourceExcerpt?.trim() || "";
            const document = excerpt.length >= 15
                ? documents.find((doc) => normalize(doc.text).includes(normalize(excerpt)))
                : undefined;
            if (!document) {
                throw new InvalidSourceReferenceError(`Question ${number} has no verifiable source excerpt. Review its explanation below or create a new exam from your materials.`);
            }
            return {
                id: randomUUID(),
                title: document.name,
                author: "Uploaded study material",
                license: "Original resource terms apply; no additional reuse rights granted",
                section: `Supporting passage for exam question ${number}`,
                excerpt,
                url: document.url,
            };
        });
        const questions = group.map(({ question, number }) => {
            if (question.options.length !== 4 || !question.options[question.correctAnswer] || question.explanation.trim().length < 8) {
                throw new OutlineStructureError(`Question ${number} does not contain a complete answer and explanation for revision.`);
            }
            return {
                id: randomUUID(),
                prompt: question.question,
                options: question.options.map((text, index) => ({ id: `option-${index}`, text })),
                correctOptionId: `option-${question.correctAnswer}`,
                hint: "Read the supporting source passage, then explain your reasoning before choosing an answer.",
                explanation: question.explanation,
            };
        });
        const content = [
            "This review uses the AI-prepared questions and explanations from your exam. Source passages have been checked against your original materials; this is not a new independent assessment.",
            "Read each passage and try the question yourself before comparing the explanation. For calculations, write out your steps and units. Then retry the questions in Practice without a timer.",
            ...group.map(({ question, number }, index) => {
                const choice = attempt.answers[question.id];
                const previous = choice === undefined ? "You left this question unanswered." : `Your previous answer: ${question.options[choice] ?? "No valid answer recorded"}`;
                return `### Exam question ${number}\n\n${question.question}\n\n${previous}\n\n**Supporting passage**\n\n${sources[index].excerpt}\n\n**Answer to compare with your reasoning:** ${question.options[question.correctAnswer]}\n\n**Explanation from your exam**\n\n${question.explanation}`;
            }),
        ].join("\n\n");
        lessons.push({
            id: randomUUID(),
            title: `Revision ${lessons.length + 1}: ${group.length === 1 ? `question ${group[0].number}` : `questions ${group.map((item) => item.number).join(", ")}`}`,
            summary: `Revisit ${group.length} missed or unanswered ${group.length === 1 ? "question" : "questions"}, compare the source explanations, and practise again at your own pace.`,
            content,
            sources,
            questions,
        });
    }
    return lessons;
}

export async function createExamRevisionPath(userEmail: string, examId: string, attemptId: string): Promise<LearningPath> {
    // Both reads are scoped to the session owner and the exact exam/attempt pair.
    const exam = await getExamPrep(userEmail, examId);
    const attempt = await getExamAttempt(userEmail, examId, attemptId);
    const digest = createHash("sha256").update(JSON.stringify(["exam-revision-v1", userEmail, examId, attemptId])).digest("hex");
    const pathId = `${digest.slice(0, 8)}-${digest.slice(8, 12)}-4${digest.slice(13, 16)}-a${digest.slice(17, 20)}-${digest.slice(20, 32)}`;
    // Recheck resource ownership even when reopening an existing revision.
    const documents = await extractResourceTexts(userEmail, exam.resourceUrls);
    const existing = await getLearningPath(userEmail, pathId);
    if (existing) return existing;

    const lessons = buildRevisionLessons(exam, attempt, documents);
    const missedCount = lessons.reduce((sum, lesson) => sum + (lesson.questions?.length ?? 0), 0);
    const now = new Date().toISOString();
    const title = `Revision: ${exam.title}`.slice(0, 200);
    const goal = `Review ${missedCount} missed or unanswered questions from ${exam.title.slice(0, 120)}. Read the supporting passages, work through the explanations, and retry at your own pace.`;
    await initLearningDB();
    // One atomic insert: failures cannot leave half-generated paths. Concurrent retries reuse the same ID.
    await getDB().execute({
        sql: `INSERT INTO learning_paths
            (id, user_email, title, goal, language, status, resource_urls, lessons, created_at, updated_at)
            VALUES (?, ?, ?, ?, 'en', 'ready', ?, ?, ?, ?) ON CONFLICT(id) DO NOTHING`,
        args: [pathId, userEmail, title, goal, JSON.stringify(exam.resourceUrls), JSON.stringify(lessons), now, now],
    });
    const saved = await getLearningPath(userEmail, pathId);
    if (!saved) throw new LearningNotFoundError();
    return saved;
}
