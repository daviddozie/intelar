import assert from "node:assert/strict";
import { test, before } from "node:test";
import { randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { readFileSync } from "node:fs";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import type { ExamPrep } from "../src/lib/exam-types";

process.env.TURSO_DATABASE_URL = "file::memory:";
delete process.env.TURSO_AUTH_TOKEN;
const requireProject = createRequire(resolve("package.json"));
const db = requireProject(resolve("src/lib/db.ts")) as typeof import("../src/lib/db");
const exams = requireProject(resolve("src/lib/exam-db.ts")) as typeof import("../src/lib/exam-db");
const learning = requireProject(resolve("src/lib/learning-db.ts")) as typeof import("../src/lib/learning-db");
const revision = requireProject(resolve("src/lib/exam-revision.ts")) as typeof import("../src/lib/exam-revision");
const offline = requireProject(resolve("src/lib/offline-learning-store.ts")) as typeof import("../src/lib/offline-learning-store");

const owner = "revision@example.test";
const foreign = "other@example.test";
const excerpt = "Force equals mass multiplied by acceleration, so a mass of 2 kg accelerating at 3 metres per second squared requires a force of 6 N.";
const text = `${excerpt}\n\nNewton's laws describe the relationship between motion and forces.`;
const url = `data:text/plain;base64,${Buffer.from(text).toString("base64")}`;
const secondExcerpt = "Work equals force multiplied by displacement in the direction of the force.";
const secondUrl = `data:text/plain;base64,${Buffer.from(secondExcerpt).toString("base64")}`;

function makeExam(count = 10): ExamPrep {
    return {
        id: randomUUID(), userEmail: owner, title: "Mechanics practice", difficulty: "medium",
        questionCount: count, timeLimitMinutes: 15, resourceUrls: [url, secondUrl], resourceNames: ["Mechanics.txt", "Work.txt"],
        questions: Array.from({ length: count }, (_, index) => ({
            id: randomUUID(), question: `Question ${index + 1}: what force accelerates a 2 kg mass at 3 m/s²?`,
            options: ["6 N", "5 N", "1.5 N", "9 N"], correctAnswer: 0,
            explanation: "Use F = ma. Substituting the mass and acceleration gives 2 × 3 = 6 N.", sourceExcerpt: excerpt,
        })),
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    };
}

async function saveAttempt(exam: ExamPrep, answers: Record<string, number> = {}) {
    await exams.saveExamPrep(exam);
    return exams.submitExamAttempt(owner, exam.id, { answers, timeSpentSeconds: 60, status: "completed" });
}

before(async () => {
    await db.initDB();
    await db.saveUserResources(owner, [url, secondUrl].map((resourceUrl, index) => ({
        name: index ? "Work.txt" : "Mechanics.txt", type: "text/plain", url: resourceUrl, uploadedAt: new Date().toISOString(),
    })));
});

test("missed and unanswered questions become grounded lessons; correct answers are excluded", async () => {
    const exam = makeExam();
    exam.questions[2].sourceExcerpt = secondExcerpt;
    const attempt = await saveAttempt(exam, { [exam.questions[0].id]: 0, [exam.questions[1].id]: 1 });
    const path = await revision.createExamRevisionPath(owner, exam.id, attempt.id);
    assert.equal(path.status, "ready");
    assert.ok(path.lessons.length >= 1 && path.lessons.length <= 5);
    const questions = path.lessons.flatMap((lesson) => lesson.questions ?? []);
    assert.equal(questions.length, 9);
    assert.ok(!questions.some((question) => question.prompt === exam.questions[0].question));
    assert.equal(questions[0].prompt, exam.questions[1].question);
    assert.equal(questions[0].explanation, exam.questions[1].explanation);
    assert.equal(questions[0].correctOptionId, "option-0");
    const sources = path.lessons.flatMap((lesson) => lesson.sources ?? []);
    assert.equal(sources.find((source) => source.excerpt === secondExcerpt)?.url, secondUrl);
    assert.ok(path.lessons[0].content?.includes("Your previous answer: 5 N"));
    assert.ok(path.lessons.some((lesson) => lesson.content?.includes("left this question unanswered")));
    assert.ok(sources.every((source) => !source.license.includes("CC BY")));
    const pack = offline.buildStudyPackFromPath(path, owner);
    assert.deepEqual(pack.lessons, path.lessons);
    assert.ok(pack.sizeBytes < 1_000_000);
    const progress = await learning.saveLearningProgress(owner, path.id, {
        lastLessonId: path.lessons[0].id, completedLessonIds: [path.lessons[0].id],
    });
    assert.deepEqual((await learning.getLearningPath(owner, path.id))?.progress, progress);
});

test("one mistake needs only one lesson; 50 misses are all covered in at most five", async () => {
    for (const count of [1, 50]) {
        const exam = makeExam(count);
        const attempt = await saveAttempt(exam);
        const path = await revision.createExamRevisionPath(owner, exam.id, attempt.id);
        assert.equal(path.lessons.length, Math.min(count, 5));
        assert.equal(path.lessons.flatMap((lesson) => lesson.questions ?? []).length, count);
    }
});

test("abbreviated quotes expand to the complete owned passage without changing saved questions", async () => {
    for (const ellipsis of ["…", "..."]) {
        const exam = makeExam(1);
        const abbreviated = `Force equals mass multiplied by acceleration${ellipsis}requires a force of 6 N.`;
        exam.questions[0].sourceExcerpt = abbreviated;
        const attempt = await saveAttempt(exam);
        const path = await revision.createExamRevisionPath(owner, exam.id, attempt.id);
        assert.equal(path.lessons[0].sources?.[0].excerpt, excerpt);
        assert.equal(path.lessons[0].questions?.[0].explanation, exam.questions[0].explanation);
        assert.equal((await exams.getExamPrep(owner, exam.id)).questions[0].sourceExcerpt, abbreviated);
        assert.equal((await revision.createExamRevisionPath(owner, exam.id, attempt.id)).id, path.id);
    }
});

test("abbreviated quotes cannot hide fabricated, reversed, foreign, or distant fragments", async () => {
    const { resolveExamSource } = requireProject(resolve("src/lib/exam-sources.ts")) as typeof import("../src/lib/exam-sources");
    const docs = [{ url, name: "Mechanics.txt", text, chunks: [] }];
    for (const quote of [
        "Force equals mass multiplied by acceleration…an invented ending that is unsupported.",
        "requires a force of 6 N.…Force equals mass multiplied by acceleration",
        `Force equals mass multiplied by acceleration…${secondExcerpt}`,
        "Force equals mass multiplied by acceleration…6 N.",
    ]) assert.equal(resolveExamSource(quote, docs), undefined);
    assert.equal(resolveExamSource(`Force equals mass multiplied by acceleration…${secondExcerpt}`, [
        ...docs, { url: secondUrl, name: "Work.txt", text: secondExcerpt, chunks: [] },
    ]), undefined, "Fragments from different documents must not be combined");
    assert.equal(resolveExamSource("Force equals mass multiplied by acceleration…requires a force of 6 N.", [
        { ...docs[0], text: `Force equals mass multiplied by acceleration${" ".padEnd(12100, "x")}requires a force of 6 N.` },
    ]), undefined);

    const exam = makeExam(1);
    exam.questions[0].sourceExcerpt = "Force equals mass multiplied by acceleration…an invented ending that is unsupported.";
    const attempt = await saveAttempt(exam);
    const initial = await learning.getUserLearningPaths(owner);
    await assert.rejects(revision.createExamRevisionPath(owner, exam.id, attempt.id), /verifiable source excerpt/);
    assert.equal((await learning.getUserLearningPaths(owner)).length, initial.length);
});

test("concurrent retries reuse one ready path and preserve progress", async () => {
    const exam = makeExam();
    const attempt = await saveAttempt(exam);
    const paths = await Promise.all(Array.from({ length: 3 }, () => revision.createExamRevisionPath(owner, exam.id, attempt.id)));
    assert.ok(paths.every((path) => path.id === paths[0].id));
    assert.ok(paths.every((path) => path.lessons[0].id === paths[0].lessons[0].id));
    await learning.saveLearningProgress(owner, paths[0].id, { lastLessonId: paths[0].lessons[0].id, completedLessonIds: [paths[0].lessons[0].id] });
    const reopened = await revision.createExamRevisionPath(owner, exam.id, attempt.id);
    assert.deepEqual(reopened.progress.completedLessonIds, [paths[0].lessons[0].id]);
});

test("invalid citations and perfect scores create no paths and preserve existing paths", async () => {
    const initial = await learning.getUserLearningPaths(owner);
    for (const sourceExcerpt of [undefined, "A fabricated source excerpt that does not appear in either document.", excerpt.slice(0, 60) + " with a fabricated ending."]) {
        const exam = makeExam();
        exam.questions[0].sourceExcerpt = sourceExcerpt;
        const attempt = await saveAttempt(exam);
        await assert.rejects(revision.createExamRevisionPath(owner, exam.id, attempt.id), /verifiable source excerpt/);
    }
    const exam = makeExam();
    const attempt = await saveAttempt(exam, Object.fromEntries(exam.questions.map((question) => [question.id, 0])));
    await assert.rejects(revision.createExamRevisionPath(owner, exam.id, attempt.id), /every question correctly/);
    assert.deepEqual(await learning.getUserLearningPaths(owner), initial);
});

test("foreign exams, mismatched attempts, and foreign resources are rejected", async () => {
    const exam = makeExam();
    const attempt = await saveAttempt(exam);
    await assert.rejects(revision.createExamRevisionPath(foreign, exam.id, attempt.id), exams.ExamNotFoundError);
    const otherExam = makeExam();
    await exams.saveExamPrep(otherExam);
    await assert.rejects(revision.createExamRevisionPath(owner, otherExam.id, attempt.id), exams.ExamNotFoundError);
    const foreignUrl = "data:text/plain;base64,Zm9yZWlnbiByZXNvdXJjZQ==";
    await db.saveUserResources(foreign, [{ name: "Private.txt", type: "text/plain", url: foreignUrl, uploadedAt: new Date().toISOString() }]);
    const invalidExam = makeExam();
    invalidExam.resourceUrls = [foreignUrl];
    const invalidAttempt = await saveAttempt(invalidExam);
    await assert.rejects(revision.createExamRevisionPath(owner, invalidExam.id, invalidAttempt.id), learning.LearningNotFoundError);
    assert.equal((await learning.getUserLearningPaths(foreign)).length, 0);
});

test("HTTP boundary authenticates, validates input, and maps ownership and citation failures", async () => {
    let session: { user: { email: string } } | null = null;
    const compiled = transpileModule(readFileSync(resolve("src/app/api/exams/[id]/revision/route.ts"), "utf8"), {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
    });
    const routeModule = { exports: {} };
    const routeRequire = (specifier: string) => {
        if (specifier === "next-auth") return { getServerSession: async () => session };
        if (specifier === "@/lib/auth") return { authOptions: {} };
        return requireProject(specifier.startsWith("@/") ? resolve("src", specifier.slice(2)) : specifier);
    };
    new Function("require", "module", "exports", compiled.outputText)(routeRequire, routeModule, routeModule.exports);
    const route = routeModule.exports as { POST: (request: Request, context: { params: Promise<{ id: string }> }) => Promise<Response> };
    const exam = makeExam();
    const attempt = await saveAttempt(exam);
    const post = (body: unknown, id = exam.id) => route.POST(new Request("http://localhost/api/exams/revision", {
        method: "POST", body: JSON.stringify(body),
    }), { params: Promise.resolve({ id }) });
    assert.equal((await post({ attemptId: attempt.id })).status, 401);
    session = { user: { email: owner } };
    for (const body of [{}, { attemptId: "invalid" }, { attemptId: attempt.id, userEmail: foreign }, null]) {
        assert.equal((await post(body)).status, 400);
    }
    assert.equal((await post({ attemptId: attempt.id }, randomUUID())).status, 404);
    assert.equal((await post({ attemptId: randomUUID() })).status, 404);
    assert.equal((await post({ attemptId: attempt.id })).status, 200);
    session = { user: { email: foreign } };
    assert.equal((await post({ attemptId: attempt.id })).status, 404);
    session = { user: { email: owner } };
    const invalid = makeExam();
    invalid.questions[0].sourceExcerpt = undefined;
    const invalidAttempt = await saveAttempt(invalid);
    assert.equal((await post({ attemptId: invalidAttempt.id }, invalid.id)).status, 422);
});

test("source retrieval failures have a specific retryable error without leaking underlying details", async () => {
    const compiled = transpileModule(readFileSync(resolve("src/lib/learning-generator.ts"), "utf8"), {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
    });
    const generatorModule = { exports: {} };
    const localRequire = (specifier: string) => {
        if (specifier === "./document-processor") return {
            getOrProcessResourceDocument: async () => { throw Object.assign(new Error("Private host or signed URL must not reach the client"), { code: "ETIMEDOUT" }); },
        };
        return requireProject(specifier.startsWith("./") ? resolve("src/lib", specifier.slice(2)) : specifier);
    };
    new Function("require", "module", "exports", compiled.outputText)(localRequire, generatorModule, generatorModule.exports);
    const generator = generatorModule.exports as typeof import("../src/lib/learning-generator");
    const errors = requireProject(resolve("src/lib/learning-errors.ts")) as typeof import("../src/lib/learning-errors");
    await assert.rejects(generator.extractResourceTexts(owner, [url]), (error: unknown) => {
        assert.ok(error instanceof errors.LearningSourceUnavailableError);
        const response = errors.learningErrorResponse(error);
        assert.equal(response.status, 503);
        assert.equal(response.headers.get("Retry-After"), "5");
        assert.match(error.message, /original study materials/);
        assert.ok(!error.message.includes("Private host"));
        assert.ok(!error.message.includes("Saved data"));
        return true;
    });
});
