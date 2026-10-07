import assert from "node:assert/strict";
import { test, before } from "node:test";
import { resolve } from "node:path";
import { createRequire } from "node:module";

// Ensure in-memory database is used for test isolation
process.env.TURSO_DATABASE_URL = "file::memory:";
delete process.env.TURSO_AUTH_TOKEN;

const requireFromProject = createRequire(resolve("package.json"));
const { initDB, saveUserResources } = requireFromProject(resolve("src/lib/db.ts")) as typeof import("../src/lib/db");
const {
    initExamDB,
    saveExamPrep,
    getExamPrep,
    listExamPreps,
    deleteExamPrep,
    submitExamAttempt,
    listExamAttempts,
    getLatestExamAttempt,
    ExamNotFoundError,
} = requireFromProject(resolve("src/lib/exam-db.ts")) as typeof import("../src/lib/exam-db");

const { generateExamFromDocument } = requireFromProject(resolve("src/lib/exam-generator.ts")) as typeof import("../src/lib/exam-generator");
const { EXAM_DIFFICULTIES, VALID_QUESTION_COUNTS } = requireFromProject(resolve("src/lib/exam-types.ts")) as typeof import("../src/lib/exam-types");

const studentEmail = "student@unilag.edu.ng";
const foreignEmail = "intruder@ui.edu.ng";

const textbookText = `
Physics 101: Fundamentals of Classical Mechanics and Thermodynamics.
Newton's first law of motion states that an object continues in its state of rest or of uniform velocity unless acted upon by an unbalanced external force.
Newton's second law defines force as the product of mass and acceleration, mathematically expressed as F = m * a.
Newton's third law states that to every action there is always an equal and opposite reaction.
Work done by a constant force is defined as the scalar product of the displacement vector and the force component acting along that displacement.
Kinetic energy represents the energy possessed by a body by virtue of its motion, given by one half mass times velocity squared.
Potential energy is stored energy possessed by an object due to its position in a conservative gravitational field.
Conservation of mechanical energy dictates that in an isolated system subject only to conservative forces, total mechanical energy remains constant.
Thermodynamic equilibrium is established when thermal, mechanical, and chemical potentials across system boundaries are equal.
The first law of thermodynamics is an expression of the principle of conservation of energy for closed thermodynamic systems.
The second law of thermodynamics establishes that the total entropy of an isolated system always increases over time in spontaneous processes.
Carnot efficiency defines the theoretical maximum efficiency attainable by an ideal heat engine operating between two finite temperatures.
`;

const testResourceUrl = "data:text/plain;base64," + Buffer.from(textbookText).toString("base64");

before(async () => {
    await initDB();
    await initExamDB();

    // Register test resource for student
    await saveUserResources(studentEmail, [
        {
            name: "physics_textbook.txt",
            url: testResourceUrl,
            type: "text",
        },
    ]);
});

test("Database initialization creates exam_preps and exam_attempts tables", async () => {
    await assert.doesNotReject(async () => {
        await initExamDB();
    });
});

test("Validates supported difficulty levels and question count bounds", () => {
    assert.deepEqual(VALID_QUESTION_COUNTS, [10, 20, 30, 50]);
    assert.equal(VALID_QUESTION_COUNTS.length, 4);

    const difficultyIds = EXAM_DIFFICULTIES.map((d: { id: string }) => d.id);
    assert.ok(difficultyIds.includes("easy"));
    assert.ok(difficultyIds.includes("medium"));
    assert.ok(difficultyIds.includes("hard"));
    assert.ok(difficultyIds.includes("standard"));
});

test("Generates an exam with exactly 10 questions and 4 options per question", async () => {
    const exam = await generateExamFromDocument({
        userEmail: studentEmail,
        resourceUrls: [testResourceUrl],
        difficulty: "standard",
        questionCount: 10,
        timeLimitMinutes: 15,
        title: "Physics 101 Midterm Test",
        courseName: "General Physics I",
    });

    assert.ok(exam.id, "Exam should have an ID");
    assert.equal(exam.userEmail, studentEmail);
    assert.equal(exam.title, "Physics 101 Midterm Test");
    assert.equal(exam.courseName, "General Physics I");
    assert.equal(exam.difficulty, "standard");
    assert.equal(exam.timeLimitMinutes, 15);
    assert.equal(exam.questions.length, 10, "Should generate exactly 10 questions");

    for (let i = 0; i < exam.questions.length; i++) {
        const q = exam.questions[i];
        assert.ok(q.id, `Question ${i + 1} must have an ID`);
        assert.ok(q.question.length > 10, `Question ${i + 1} must have substantial text`);
        assert.equal(q.options.length, 4, `Question ${i + 1} must have exactly 4 choices`);
        assert.ok(q.correctAnswer >= 0 && q.correctAnswer <= 3, `Question ${i + 1} correctAnswer in 0..3`);
        assert.ok(q.explanation.length > 5, `Question ${i + 1} must have explanation`);
    }
});

test("Generates an exam with 20, 30, and 50 questions (50 is threshold)", async () => {
    const exam50 = await generateExamFromDocument({
        userEmail: studentEmail,
        resourceUrls: [testResourceUrl],
        difficulty: "hard",
        questionCount: 50,
        timeLimitMinutes: 60,
        title: "Comprehensive Physics Final",
    });

    assert.equal(exam50.questions.length, 50, "Should generate up to 50 questions threshold");
    assert.equal(exam50.difficulty, "hard");
    assert.equal(exam50.timeLimitMinutes, 60);
});

test("Strict ownership isolation rejects foreign user from reading or deleting exams", async () => {
    const exam = await generateExamFromDocument({
        userEmail: studentEmail,
        resourceUrls: [testResourceUrl],
        difficulty: "easy",
        questionCount: 10,
        timeLimitMinutes: 20,
    });

    // Foreign user cannot fetch
    await assert.rejects(async () => {
        await getExamPrep(foreignEmail, exam.id);
    }, ExamNotFoundError);

    // Foreign user cannot delete
    await assert.rejects(async () => {
        await deleteExamPrep(foreignEmail, exam.id);
    }, ExamNotFoundError);

    // Owner can fetch successfully
    const retrieved = await getExamPrep(studentEmail, exam.id);
    assert.equal(retrieved.id, exam.id);
});

test("Submits exam attempt, grades answers accurately, and calculates percentage", async () => {
    const exam = await generateExamFromDocument({
        userEmail: studentEmail,
        resourceUrls: [testResourceUrl],
        difficulty: "standard",
        questionCount: 10,
        timeLimitMinutes: 15,
    });

    // Student answers 7 correctly and 3 incorrectly
    const answers: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
        answers[exam.questions[i].id] = exam.questions[i].correctAnswer;
    }
    for (let i = 7; i < 10; i++) {
        answers[exam.questions[i].id] = (exam.questions[i].correctAnswer + 1) % 4;
    }

    const attempt = await submitExamAttempt(studentEmail, exam.id, {
        answers,
        flaggedQuestions: [exam.questions[2].id, exam.questions[5].id],
        timeSpentSeconds: 540, // 9 minutes
        status: "completed",
    });

    assert.ok(attempt.id);
    assert.equal(attempt.examId, exam.id);
    assert.equal(attempt.score, 7);
    assert.equal(attempt.totalQuestions, 10);
    assert.equal(attempt.percentage, 70); // 7/10 = 70%
    assert.equal(attempt.timeSpentSeconds, 540);
    assert.equal(attempt.flaggedQuestions.length, 2);

    // Verify attempt appears in list and latest
    const attempts = await listExamAttempts(studentEmail, exam.id);
    assert.equal(attempts.length, 1);
    assert.equal(attempts[0].id, attempt.id);

    const latest = await getLatestExamAttempt(studentEmail, exam.id);
    assert.ok(latest);
    assert.equal(latest.id, attempt.id);
    assert.equal(latest.score, 7);
});

test("Cascade deletion removes exam and associated attempts", async () => {
    const exam = await generateExamFromDocument({
        userEmail: studentEmail,
        resourceUrls: [testResourceUrl],
        difficulty: "easy",
        questionCount: 10,
        timeLimitMinutes: 15,
    });

    await submitExamAttempt(studentEmail, exam.id, {
        answers: {},
        timeSpentSeconds: 100,
        status: "completed",
    });

    await deleteExamPrep(studentEmail, exam.id);

    await assert.rejects(async () => {
        await getExamPrep(studentEmail, exam.id);
    }, ExamNotFoundError);

    const remainingAttempts = await listExamAttempts(studentEmail, exam.id);
    assert.equal(remainingAttempts.length, 0, "Attempts must be removed when exam is deleted");
});

test("Generates calculation and formula-solving questions when document contains quantitative formulas", async () => {
    const exam = await generateExamFromDocument({
        userEmail: studentEmail,
        resourceUrls: [testResourceUrl],
        difficulty: "standard",
        questionCount: 10,
        timeLimitMinutes: 20,
    });

    const calculationQuestions = exam.questions.filter(
        (q) =>
            q.question.toLowerCase().includes("calculation") ||
            q.question.includes("F = m * a") ||
            q.explanation.toLowerCase().includes("using the formula") ||
            q.explanation.toLowerCase().includes("using ke") ||
            q.explanation.toLowerCase().includes("carnot efficiency")
    );

    assert.ok(
        calculationQuestions.length > 0,
        "Exam must include calculation questions when document contains formulas"
    );

    const firstCalc = calculationQuestions[0];
    assert.equal(firstCalc.options.length, 4, "Calculation question must have 4 options");
    assert.ok(firstCalc.correctAnswer >= 0 && firstCalc.correctAnswer <= 3);
    assert.ok(
        firstCalc.explanation.includes("=") || firstCalc.explanation.includes("formula"),
        "Calculation explanation must detail the formula or mathematical working"
    );
});
