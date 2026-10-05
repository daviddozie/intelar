import assert from "node:assert/strict";
import { test, before } from "node:test";
import { resolve } from "node:path";
import { createRequire } from "node:module";

// Ensure in-memory database is used for isolation
process.env.TURSO_DATABASE_URL = "file::memory:";
delete process.env.TURSO_AUTH_TOKEN;

const requireFromProject = createRequire(resolve("package.json"));
const { initDB, saveUserResources, getUserResourceForChat } = requireFromProject(resolve("src/lib/db.ts")) as typeof import("../src/lib/db");
const {
    initLearningDB,
    createLearningPath,
    getLearningPath,
    updateLearningPathOutline,
    updateLearningPathLessons,
    deleteLearningPath,
    LearningNotFoundError,
} = requireFromProject(resolve("src/lib/learning-db.ts")) as typeof import("../src/lib/learning-db");

const {
    InsufficientMaterialError,
    InvalidSourceReferenceError,
    OutlineStructureError,
    learningErrorResponse,
} = requireFromProject(resolve("src/lib/learning-errors.ts")) as typeof import("../src/lib/learning-errors");

const {
    checkSourceSufficiency,
    verifyExcerptInResources,
    validateGeneratedLessons,
    generateStudyOutline,
    generateStudyLessons,
} = requireFromProject(resolve("src/lib/learning-generator.ts")) as typeof import("../src/lib/learning-generator");

const { buildLessonTutorSystemPrompt } = requireFromProject(resolve("src/app/api/learning/tutor/route.ts")) as typeof import("../src/app/api/learning/tutor/route");

import type { LearningLesson, LearningPath, ResourceDocumentText } from "../src/lib/learning-types";

const studentEmail = "student@unilag.edu.ng";
const foreignEmail = "other@ui.edu.ng";

const sampleResourceUrl1 = "https://res.cloudinary.com/demo/image/upload/v1/lecture1.pdf";
const sampleResourceUrl2 = "https://res.cloudinary.com/demo/image/upload/v1/lecture2.pdf";
const sampleResourceUrl3 = "https://res.cloudinary.com/demo/image/upload/v1/lecture3.pdf";
const foreignResourceUrl = "https://res.cloudinary.com/demo/image/upload/v1/foreign.pdf";

const substantiveText1 = `
Introduction to Statistical Estimation and Hypothesis Testing.
In university research, parameter estimation allows students to deduce population parameters from sample statistics.
The sample mean provides an unbiased point estimate of the true population mean when observational units are sampled at random.
A confidence interval gives an estimated range of values which is likely to include an unknown population parameter.
Null hypothesis significance testing (NHST) evaluates the probability of observing sample outcomes assuming the null effect holds.
Type I error occurs when researchers reject a true null hypothesis, while Type II error fails to reject a false null hypothesis.
`;

const substantiveText2 = `
Applied Linear Regression and Variance Analysis.
Regression modeling measures the quantitative relationship between a dependent variable and one or more independent predictor variables.
The coefficient of determination, denoted as R-squared, explains the proportion of total variation in the outcome explained by the regression line.
Residual diagnostics verify the homoscedasticity assumption, ensuring error terms exhibit uniform spread across fitted prediction levels.
In campus transportation studies, commuter costs and travel durations can be modeled to predict campus transit efficiency.
`;

before(async () => {
    await initDB();
    await initLearningDB();

    // Seed resources for student
    await saveUserResources(studentEmail, [
        {
            name: "Lecture 1: Estimation & Hypothesis Testing.pdf",
            type: "application/pdf",
            url: sampleResourceUrl1,
            uploadedAt: new Date().toISOString(),
            conversationId: undefined,
            storage: "cloudinary",
            publicId: "lecture1",
            resourceType: "raw",
        },
        {
            name: "Lecture 2: Linear Regression.pdf",
            type: "application/pdf",
            url: sampleResourceUrl2,
            uploadedAt: new Date().toISOString(),
            conversationId: undefined,
            storage: "cloudinary",
            publicId: "lecture2",
            resourceType: "raw",
        },
        {
            name: "Lecture 3: Variance Analysis.pdf",
            type: "application/pdf",
            url: sampleResourceUrl3,
            uploadedAt: new Date().toISOString(),
            conversationId: undefined,
            storage: "cloudinary",
            publicId: "lecture3",
            resourceType: "raw",
        },
    ]);

    // Seed resource for foreign user
    await saveUserResources(foreignEmail, [
        {
            name: "Private Foreign Doc.pdf",
            type: "application/pdf",
            url: foreignResourceUrl,
            uploadedAt: new Date().toISOString(),
            conversationId: undefined,
            storage: "cloudinary",
            publicId: "foreign",
            resourceType: "raw",
        },
    ]);
});

test("a learner creates a study path outline from up to three authorized resources", async () => {
    const created = await createLearningPath(studentEmail, {
        title: "Advanced Estimation and Modeling",
        goal: "Master hypothesis testing and linear regression models for undergraduate thesis research.",
        language: "en",
        resourceUrls: [sampleResourceUrl1, sampleResourceUrl2],
        lessons: [
            { title: "Point Estimation & Confidence Intervals" },
            { title: "Hypothesis Testing & Error Types" },
            { title: "Linear Regression & Variance" },
        ],
    });

    assert.ok(created.id);
    assert.equal(created.status, "draft");
    assert.equal(created.resourceUrls.length, 2);
    assert.equal(created.lessons.length, 3);
    assert.equal(created.version, 1);

    const fetched = await getLearningPath(studentEmail, created.id);
    assert.ok(fetched);
    assert.equal(fetched.title, "Advanced Estimation and Modeling");
    assert.equal(fetched.lessons.length, 3);
});

test("selecting unauthorized or foreign resources is rejected with clear error", async () => {
    await assert.rejects(
        async () => {
            await createLearningPath(studentEmail, {
                title: "Invalid Path",
                goal: "Attempting to use another student's document.",
                language: "en",
                resourceUrls: [foreignResourceUrl],
                lessons: [
                    { title: "Lesson 1" },
                    { title: "Lesson 2" },
                    { title: "Lesson 3" },
                ],
            });
        },
        (err) => err instanceof LearningNotFoundError
    );
});

test("outline must contain three to five lessons; learner can review and edit outline", async () => {
    const path = await createLearningPath(studentEmail, {
        title: "Outline Review Test",
        goal: "Test outline editing limits.",
        language: "en",
        resourceUrls: [sampleResourceUrl1],
        lessons: [
            { title: "Initial Topic 1" },
            { title: "Initial Topic 2" },
            { title: "Initial Topic 3" },
        ],
    });

    // Less than 3 lessons must fail
    await assert.rejects(
        async () => {
            await updateLearningPathOutline(studentEmail, path.id, {
                lessons: [{ title: "Only One Lesson" }],
            });
        },
        /three to five lessons/
    );

    // More than 5 lessons must fail
    await assert.rejects(
        async () => {
            await updateLearningPathOutline(studentEmail, path.id, {
                lessons: [
                    { title: "1" }, { title: "2" }, { title: "3" },
                    { title: "4" }, { title: "5" }, { title: "6" },
                ],
            });
        },
        /three to five lessons/
    );

    // Valid update to 4 lessons succeeds
    const updated = await updateLearningPathOutline(studentEmail, path.id, {
        title: "Revised Study Plan",
        lessons: [
            { title: "Revised Topic 1: Sampling & Point Estimates" },
            { title: "Revised Topic 2: Confidence Intervals" },
            { title: "Revised Topic 3: Testing Hypotheses" },
            { title: "Revised Topic 4: Interpreting p-values" },
        ],
    });

    assert.equal(updated.title, "Revised Study Plan");
    assert.equal(updated.lessons.length, 4);
    assert.equal(updated.lessons[0].title, "Revised Topic 1: Sampling & Point Estimates");
});

test("insufficient material in selected resources produces clear error", async () => {
    const tinyResource: ResourceDocumentText = {
        url: "https://res.cloudinary.com/demo/image/upload/v1/tiny.txt",
        name: "tiny.txt",
        text: "Too short. Just a couple of words.",
        chunks: ["Too short. Just a couple of words."],
    };

    assert.throws(
        () => {
            checkSourceSufficiency([tinyResource]);
        },
        (err) => {
            assert.ok(err instanceof InsufficientMaterialError);
            assert.match(err.message, /insufficient material/i);
            return true;
        }
    );

    // Verify HTTP response mapping returns 422 with clear error
    const httpRes = learningErrorResponse(new InsufficientMaterialError());
    assert.equal(httpRes.status, 422);
});

test("outline proposal generates 3 to 5 coherent lesson topics grounded in resource documents", async () => {
    const resourceDocs: ResourceDocumentText[] = [
        {
            url: sampleResourceUrl1,
            name: "Lecture 1: Estimation & Hypothesis Testing.pdf",
            text: substantiveText1,
            chunks: [substantiveText1],
        },
    ];

    const proposed = await generateStudyOutline({
        goal: "Understand statistical estimation and error types",
        language: "en",
        resourceTexts: resourceDocs,
    });

    assert.ok(Array.isArray(proposed));
    assert.ok(proposed.length >= 3 && proposed.length <= 5);
    for (const item of proposed) {
        assert.ok(item.title.length > 5);
        assert.ok(item.summary.length > 10);
    }
});

test("generating source-grounded lessons produces content, valid citations, and 3 questions per lesson", async () => {
    const path: LearningPath = {
        id: "test-path-gen",
        title: "Applied Estimation",
        goal: "Master point estimation and hypothesis testing",
        language: "en",
        status: "draft",
        resourceUrls: [sampleResourceUrl1],
        version: 1,
        progress: { lastLessonId: null, completedLessonIds: [] },
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        lessons: [
            { id: "l1", title: "Point Estimation & Sample Means" },
            { id: "l2", title: "Hypothesis Testing & Significance" },
            { id: "l3", title: "Type I and Type II Errors" },
        ],
    };

    const resourceDocs: ResourceDocumentText[] = [
        {
            url: sampleResourceUrl1,
            name: "Lecture 1: Estimation & Hypothesis Testing.pdf",
            text: substantiveText1,
            chunks: [substantiveText1],
        },
    ];

    const lessons = await generateStudyLessons({
        path,
        resourceTexts: resourceDocs,
    });

    assert.equal(lessons.length, 3);
    for (const lesson of lessons) {
        assert.ok(lesson.content && lesson.content.length > 100);
        assert.ok(lesson.sources && lesson.sources.length >= 1);

        // Verify citations are traceable
        for (const src of lesson.sources) {
            assert.ok(src.title.includes("Lecture 1"));
            assert.ok(src.excerpt.length > 20);
            // Verify citation excerpt is actually in the source document text!
            const verified = verifyExcerptInResources(src.excerpt, resourceDocs);
            assert.ok(verified, `Excerpt "${src.excerpt}" must exist in resource text`);
        }

        // Verify exactly 3 practice questions
        assert.equal(lesson.questions?.length, 3);
        for (const q of lesson.questions || []) {
            assert.ok(q.prompt.length > 10);
            assert.equal(q.options.length, 4);
            assert.ok(q.options.some((o) => o.id === q.correctOptionId));
            assert.ok(q.hint.length > 5);
            assert.ok(q.explanation.length > 10);
        }
    }

    // Validate that the generated lessons pass strict structural and grounding validation
    assert.doesNotThrow(() => {
        validateGeneratedLessons(lessons, resourceDocs);
    });
});

test("invalid or fabricated source reference produces clear error", async () => {
    const resourceDocs: ResourceDocumentText[] = [
        {
            url: sampleResourceUrl1,
            name: "Lecture 1: Estimation & Hypothesis Testing.pdf",
            text: substantiveText1,
            chunks: [substantiveText1],
        },
    ];

    const fabricatedLesson: LearningLesson = {
        id: "l-fake",
        title: "Fabricated Citations Lesson",
        summary: "Summary",
        content: "Here is substantive lesson content explaining statistical methods in detail with campus examples.",
        sources: [
            {
                id: "fake-ref",
                title: "Fake Textbook",
                author: "Unknown Author",
                license: "CC BY-SA 3.0",
                section: "Fabricated Section",
                excerpt: "This completely imaginary sentence does not exist anywhere inside the source document.",
                url: sampleResourceUrl1,
            },
        ],
        questions: [
            { id: "q1", prompt: "Question 1 prompt text?", options: [{ id: "1", text: "A" }, { id: "2", text: "B" }, { id: "3", text: "C" }, { id: "4", text: "D" }], correctOptionId: "1", hint: "Hint", explanation: "Explanation" },
            { id: "q2", prompt: "Question 2 prompt text?", options: [{ id: "1", text: "A" }, { id: "2", text: "B" }, { id: "3", text: "C" }, { id: "4", text: "D" }], correctOptionId: "2", hint: "Hint", explanation: "Explanation" },
            { id: "q3", prompt: "Question 3 prompt text?", options: [{ id: "1", text: "A" }, { id: "2", text: "B" }, { id: "3", text: "C" }, { id: "4", text: "D" }], correctOptionId: "3", hint: "Hint", explanation: "Explanation" },
        ],
    };

    assert.throws(
        () => {
            validateGeneratedLessons([fabricatedLesson, fabricatedLesson, fabricatedLesson], resourceDocs);
        },
        (err) => {
            assert.ok(err instanceof InvalidSourceReferenceError);
            assert.match(err.message, /could not be verified against the selected resource documents/i);
            return true;
        }
    );

    // Verify HTTP response mapping returns 422 with clear error message
    const httpRes = learningErrorResponse(new InvalidSourceReferenceError());
    assert.equal(httpRes.status, 422);
});

test("failed generation does not damage saved paths", async () => {
    // 1. Create a valid draft path outline
    const path = await createLearningPath(studentEmail, {
        title: "Resilient Draft Path",
        goal: "Ensure failed generation never corrupts or alters saved draft paths.",
        language: "en",
        resourceUrls: [sampleResourceUrl1],
        lessons: [
            { title: "Safe Topic 1" },
            { title: "Safe Topic 2" },
            { title: "Safe Topic 3" },
        ],
    });

    const initialFetch = await getLearningPath(studentEmail, path.id);
    assert.ok(initialFetch);
    assert.equal(initialFetch.status, "draft");
    assert.equal(initialFetch.version, 1);
    assert.equal(initialFetch.lessons[0].title, "Safe Topic 1");

    // 2. Simulate an invalid generation attempt that throws InvalidSourceReferenceError
    const invalidLessons: LearningLesson[] = [
        {
            id: initialFetch.lessons[0].id,
            title: "Corrupted Title",
            content: "This is valid and sufficiently long lesson content that exceeds eighty characters in total length for this test.",
            sources: [
                {
                    id: "bad",
                    title: "Bad Citation",
                    author: "Bad",
                    license: "Bad",
                    excerpt: "Fabricated excerpt that cannot be found anywhere.",
                },
            ],
            questions: [],
        },
        initialFetch.lessons[1],
        initialFetch.lessons[2],
    ];

    const resourceDocs: ResourceDocumentText[] = [
        { url: sampleResourceUrl1, name: "Lecture 1.pdf", text: substantiveText1, chunks: [substantiveText1] },
    ];

    // Attempting to validate should fail BEFORE touching the database
    let caughtError: unknown = null;
    try {
        validateGeneratedLessons(invalidLessons, resourceDocs);
        // If validation passed (which it shouldn't), update would happen here
        await updateLearningPathLessons(studentEmail, path.id, invalidLessons);
    } catch (err) {
        caughtError = err;
    }

    assert.ok(caughtError instanceof InvalidSourceReferenceError);

    // 3. Confirm the saved path in the database is completely undamaged!
    const postFailureFetch = await getLearningPath(studentEmail, path.id);
    assert.ok(postFailureFetch);
    assert.equal(postFailureFetch.status, "draft"); // Still draft
    assert.equal(postFailureFetch.version, 1); // Version unchanged
    assert.equal(postFailureFetch.title, "Resilient Draft Path"); // Title unchanged
    assert.equal(postFailureFetch.lessons[0].title, "Safe Topic 1"); // Original lessons preserved
    assert.equal(postFailureFetch.lessons[0].content, undefined); // Not overwritten with corrupted content
});

test("focused lesson tutor system prompt scopes context strictly to the active lesson and its sources", () => {
    const lesson: LearningLesson = {
        id: "lesson-hypothesis",
        title: "Hypothesis Testing & Significance",
        summary: "Understand null and alternative hypotheses, p-values, and significance thresholds.",
        content: "Hypothesis testing evaluates empirical evidence against a null hypothesis H0. If p < alpha (commonly 0.05), we reject the null hypothesis.",
        sources: [
            {
                id: "ref-1",
                title: "OpenIntro Statistics §5.3",
                author: "Diez et al.",
                license: "CC BY-SA 3.0",
                section: "Section 5.3",
                excerpt: "The p-value is the probability of observing data at least as favorable to the alternative hypothesis as our current data set, if the null hypothesis is true.",
            },
        ],
    };

    const prompt = buildLessonTutorSystemPrompt(lesson);

    // Verify prompt contains lesson scope and boundaries
    assert.match(prompt, /ACTIVE LESSON SCOPE:/);
    assert.match(prompt, /Hypothesis Testing & Significance/);
    assert.match(prompt, /The p-value is the probability/);
    assert.match(prompt, /STRICT LESSON SCOPE/);
    assert.match(prompt, /SOCRATIC GUIDANCE/);
    assert.match(prompt, /Nigerian/i);
});

test("learner can delete their personal study path", async () => {
    const path = await createLearningPath(studentEmail, {
        title: "Temporary Study Path",
        goal: "To be deleted.",
        language: "en",
        resourceUrls: [sampleResourceUrl1],
        lessons: [
            { title: "Topic 1" },
            { title: "Topic 2" },
            { title: "Topic 3" },
        ],
    });

    assert.ok(await getLearningPath(studentEmail, path.id));
    const deleted = await deleteLearningPath(studentEmail, path.id);
    assert.equal(deleted, true);

    const postDelete = await getLearningPath(studentEmail, path.id);
    assert.equal(postDelete, null);
});
