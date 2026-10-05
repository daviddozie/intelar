import { test, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { SAMPLE_STATISTICS_COURSE } from "../src/lib/sample-course";
import {
    loadLocalLearningProgress,
    saveLocalLearningProgress,
    getStorageKey,
} from "../src/lib/learning-progress-store";
import {
    buildStudyPackFromCourse,
    saveStudyPack,
    getStudyPack,
    listStudyPacks,
    queueAttempt,
    getPendingAttempts,
    clearPrivateOfflineData,
} from "../src/lib/offline-learning-store";
import {
    checkSourceSufficiency,
    verifyExcerptInResources,
} from "../src/lib/learning-generator";
import {
    initLearningDB,
    createLearningPath,
    syncLearningEvents,
    getLearningEvents,
} from "../src/lib/learning-db";
import { OutlineStructureError } from "../src/lib/learning-errors";
import type { SyncAttemptInput } from "../src/lib/learning-types";

// Setup mock localStorage for Node.js test environment
const mockStorage: Record<string, string> = {};
const mockLocalStorage = {
    getItem: (key: string) => mockStorage[key] ?? null,
    setItem: (key: string, val: string) => { mockStorage[key] = String(val); },
    removeItem: (key: string) => { delete mockStorage[key]; },
    clear: () => { Object.keys(mockStorage).forEach((k) => delete mockStorage[k]); },
    get length() { return Object.keys(mockStorage).length; },
    key: (i: number) => Object.keys(mockStorage)[i] ?? null,
};
Object.defineProperty(globalThis, "localStorage", {
    value: mockLocalStorage,
    configurable: true,
    writable: true,
});

before(async () => {
    process.env.TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || "file::memory:?cache=shared";
    await initLearningDB();
});

test("Milestone 5: Demonstration Course Content & Human Review Verification", () => {
    const course = SAMPLE_STATISTICS_COURSE;

    // 1. Verification of Human Review & AI-preparation notices
    assert.equal(course.id, "sample-statistics-101");
    assert.match(course.attribution, /OpenIntro Statistics/i);
    assert.match(course.attribution, /CC BY-SA 3\.0/i);
    assert.match(course.attribution, /Nigerian university campus/i);
    assert.ok(course.aiPreparedNotice.length > 10);
    assert.match(course.humanReviewedNotice, /human-reviewed and verified/i);

    // 2. Exactly 5 core lessons
    assert.equal(course.lessons.length, 5);
    const expectedLessonIds = [
        "lesson-1-data-types",
        "lesson-2-mean-and-median",
        "lesson-3-measures-of-spread",
        "lesson-4-reading-charts",
        "lesson-5-interpreting-a-dataset",
    ];
    assert.deepEqual(course.lessons.map((l) => l.id), expectedLessonIds);

    // 3. Every lesson has content, traceable sources with licenses, and 3 practice questions
    for (const lesson of course.lessons) {
        assert.ok(lesson.content && lesson.content.length > 300, `Lesson ${lesson.id} content too short`);
        assert.ok(lesson.sources && lesson.sources.length >= 1, `Lesson ${lesson.id} missing sources`);
        assert.ok(lesson.questions && lesson.questions.length === 3, `Lesson ${lesson.id} should have 3 questions`);

        for (const source of lesson.sources) {
            assert.match(source.license, /CC BY-SA 3\.0/i);
            assert.ok(source.excerpt.length > 30);
            assert.ok(source.url?.startsWith("https://www.openintro.org"));
        }

        for (const q of (lesson.questions || [])) {
            assert.equal(q.options.length, 4, `Question ${q.id} should have 4 options`);
            const correctOpt = q.options.find((o) => o.id === q.correctOptionId);
            assert.ok(correctOpt, `Question ${q.id} has invalid correctOptionId`);
            assert.ok(q.hint.length > 10, `Question ${q.id} hint too short`);
            assert.ok(q.explanation.length > 10, `Question ${q.id} explanation too short`);
        }
    }
});

test("Milestone 5: French Lesson Alternative Verification", () => {
    const lesson1 = SAMPLE_STATISTICS_COURSE.lessons[0];
    assert.ok(lesson1.frenchAlternative, "Lesson 1 must include French alternative");

    const fr = lesson1.frenchAlternative;
    assert.equal(fr.title, "Types de données");
    assert.match(fr.summary, /variables numériques.*catégorielles/i);
    assert.match(fr.content, /unité d'observation/i);
    assert.match(fr.content, /OpenIntro Statistics/i);
    assert.equal(fr.questions.length, 3);

    // Verify French questions have valid options and explanations
    for (const q of fr.questions) {
        assert.equal(q.options.length, 4);
        const correctOpt = q.options.find((o) => o.id === q.correctOptionId);
        assert.ok(correctOpt);
        assert.ok(q.hint.length > 5);
        assert.ok(q.explanation.length > 5);
    }
});

test("Milestone 5: Practical Campus Transport Dataset & Outlier Mathematics", () => {
    const activity = SAMPLE_STATISTICS_COURSE.practicalActivity;
    assert.equal(activity.id, "activity-campus-transport");
    assert.match(activity.scenario, /University students in Nigeria.*commute shuttles/i);
    assert.equal(activity.dataset.length, 10);

    // Verify mathematical accuracy of synthetic transport fares
    const fares = activity.dataset.map((d) => d.costNaira).sort((a, b) => a - b);
    assert.deepEqual(fares, [150, 200, 200, 200, 250, 250, 300, 350, 500, 1200]);

    // Sum and arithmetic mean
    const sum = fares.reduce((acc, f) => acc + f, 0);
    assert.equal(sum, 3600);
    const mean = sum / fares.length;
    assert.equal(mean, 360);

    // Median (midpoint between 5th and 6th value: 250 and 250)
    const median = (fares[4] + fares[5]) / 2;
    assert.equal(median, 250);

    // Q1 (index 2: 200) and Q3 (index 7: 350)
    const q1 = 200;
    const q3 = 350;
    const iqr = q3 - q1;
    assert.equal(iqr, 150);

    // Outlier cutoff: Q3 + 1.5 * IQR = 350 + 225 = 575
    const upperCutoff = q3 + (1.5 * iqr);
    assert.equal(upperCutoff, 575);

    // Emergency charter (1,200) is an outlier
    assert.ok(1200 > upperCutoff);

    // Verify activity tasks test these exact mathematical milestones
    assert.equal(activity.tasks.length, 3);
    assert.equal(activity.tasks[0].correctAnswer, "opt-pt-1-a"); // ₦250
    assert.equal(activity.tasks[1].correctAnswer, "opt-pt-2-a"); // ₦150
    assert.equal(activity.tasks[2].correctAnswer, "opt-pt-3-a"); // Yes, ₦1,200 > ₦575
});

test("Milestone 5: Career and Research Next-Step Card Pathways", () => {
    const nextStep = SAMPLE_STATISTICS_COURSE.nextStepCard;
    assert.ok(nextStep.opportunities.length >= 3);

    const titles = nextStep.opportunities.map((o) => o.title);
    assert.ok(titles.some((t) => t.includes("Final Year Project")));
    assert.ok(titles.some((t) => t.includes("Data Analyst") || t.includes("Fintech")));
    assert.ok(titles.some((t) => t.includes("Public Health") || t.includes("NGO")));

    // Verify actionable prompts
    for (const opp of nextStep.opportunities) {
        assert.ok(opp.actionPrompt.length > 15);
        assert.ok(opp.relevantSkills.length >= 2);
    }
});

test("Milestone 5: Practice Question Answers Persist Across Reload with Account Isolation", () => {
    mockLocalStorage.clear();

    const guestKey = getStorageKey("sample-statistics-101", null);
    assert.equal(guestKey, "gluk_learning_progress_guest_sample-statistics-101");

    // Guest answers Question 1
    saveLocalLearningProgress(
        "sample-statistics-101",
        {
            lastLessonId: "lesson-1-data-types",
            completedLessonIds: [],
            questionAnswers: { "q-1-1": "opt-1-1-a" },
            practicalTaskAnswers: {},
            practicalCompleted: false,
        },
        null
    );

    // Simulate reload
    const guestLoaded = loadLocalLearningProgress("sample-statistics-101", null);
    assert.equal(guestLoaded.questionAnswers["q-1-1"], "opt-1-1-a");

    // Authenticated user on same device has completely separate progress
    const authUser = "adaobi@unilag.edu.ng";
    const authKey = getStorageKey("sample-statistics-101", authUser);
    assert.equal(authKey, "gluk_learning_progress_user_adaobi@unilag.edu.ng_sample-statistics-101");

    const authLoadedBefore = loadLocalLearningProgress("sample-statistics-101", authUser);
    assert.equal(Object.keys(authLoadedBefore.questionAnswers).length, 0);

    // Authenticated user answers Question 2
    saveLocalLearningProgress(
        "sample-statistics-101",
        {
            lastLessonId: "lesson-2-mean-and-median",
            completedLessonIds: ["lesson-1-data-types"],
            questionAnswers: { "q-2-1": "opt-2-1-b" },
            practicalTaskAnswers: {},
            practicalCompleted: false,
        },
        authUser
    );

    // Guest progress is untouched
    const guestLoadedAgain = loadLocalLearningProgress("sample-statistics-101", null);
    assert.equal(guestLoadedAgain.questionAnswers["q-1-1"], "opt-1-1-a");
    assert.equal(guestLoadedAgain.questionAnswers["q-2-1"], undefined);

    // Auth progress persisted
    const authLoadedAfter = loadLocalLearningProgress("sample-statistics-101", authUser);
    assert.equal(authLoadedAfter.questionAnswers["q-2-1"], "opt-2-1-b");
    assert.deepEqual(authLoadedAfter.completedLessonIds, ["lesson-1-data-types"]);
});

test("Milestone 5: Offline Study Pack Generation, Size Limit (<1 MB), and Offline Availability", async () => {
    const course = SAMPLE_STATISTICS_COURSE;
    const pack = buildStudyPackFromCourse(course);

    assert.equal(pack.id, course.id);
    assert.equal(pack.lessons.length, 5);
    assert.ok(pack.practicalActivity);
    assert.ok(pack.nextStepCard);

    // Size limit check (< 1 MB)
    assert.ok(pack.sizeBytes < 1024 * 1024, `Pack size (${pack.sizeBytes} bytes) exceeds 1 MB`);
    assert.ok(pack.sizeBytes > 5000, "Pack size should contain substantial content");

    // Save pack into offline store
    await saveStudyPack(pack);

    // Retrieve pack offline
    const retrieved = await getStudyPack(course.id, null);
    assert.ok(retrieved);
    assert.equal(retrieved.title, course.title);
    assert.equal(retrieved.lessons.length, 5);
});

test("Milestone 5: Offline Attempt Queueing and Deduplicating Synchronization", async () => {
    const userEmail = "ibrahim@abu.edu.ng";

    // Learner creates a personal path on server
    const path = await createLearningPath(userEmail, {
        title: "Introduction to Hypothesis Testing",
        goal: "Master p-values and confidence intervals",
        language: "en",
        resourceUrls: [],
        lessons: [
            { title: "Null vs Alternative Hypotheses" },
            { title: "Type I and Type II Errors" },
            { title: "Interpreting P-Values" },
        ],
    });

    const targetLessonId = path.lessons[0].id;
    const testEventId1 = randomUUID();
    const testEventId2 = randomUUID();

    const attemptsToSync: SyncAttemptInput[] = [
        {
            eventId: testEventId1,
            pathId: path.id,
            lessonId: targetLessonId,
            questionId: "q1",
            selectedOptionId: "opt-a",
            isCorrect: true,
            timestamp: new Date().toISOString(),
        },
        {
            eventId: testEventId2,
            pathId: path.id,
            lessonId: targetLessonId,
            questionId: "q2",
            selectedOptionId: "opt-b",
            isCorrect: true,
            timestamp: new Date().toISOString(),
        },
    ];

    // First synchronization
    const result1 = await syncLearningEvents(userEmail, attemptsToSync);
    assert.equal(result1.syncedEventIds.length, 2, "First sync should record 2 events");
    assert.equal(result1.duplicatesCount, 0, "First sync should have 0 duplicates");

    // Check DB rows
    const storedEvents1 = await getLearningEvents(userEmail, path.id);
    assert.equal(storedEvents1.length, 2, "Database must contain exactly 2 events");

    // Second synchronization with the exact same attempts
    const result2 = await syncLearningEvents(userEmail, attemptsToSync);
    assert.equal(result2.syncedEventIds.length, 0, "Second sync should not re-insert duplicate events");
    assert.equal(result2.duplicatesCount, 2, "Second sync should detect 2 duplicates");

    // Check DB rows did NOT duplicate
    const storedEvents2 = await getLearningEvents(userEmail, path.id);
    assert.equal(storedEvents2.length, 2, "Repeated synchronization must NEVER duplicate an attempt");
});

test("Milestone 5: Personal Study Path Generation and Citation Grounding", () => {
    // 1. Outline bounds: 3 to 5 lessons
    function checkOutlineBounds(lessons: Array<{ title: string }>) {
        if (lessons.length < 3 || lessons.length > 5) {
            throw new OutlineStructureError(
                `An outline must contain between 3 and 5 lessons, but ${lessons.length} were provided.`
            );
        }
    }

    const validOutline = [
        { title: "Probability Basics" },
        { title: "Conditional Probability" },
        { title: "Bayes Theorem" },
    ];
    assert.doesNotThrow(() => checkOutlineBounds(validOutline));

    const tooFew = [{ title: "Topic 1" }, { title: "Topic 2" }];
    assert.throws(() => checkOutlineBounds(tooFew), /between 3 and 5 lessons/i);

    const tooMany = [
        { title: "L1" }, { title: "L2" }, { title: "L3" }, { title: "L4" }, { title: "L5" }, { title: "L6" },
    ];
    assert.throws(() => checkOutlineBounds(tooMany), /between 3 and 5 lessons/i);

    // 2. Resource sufficiency check
    const docs = [
        {
            url: "https://example.com/biomed.pdf",
            name: "Biomedical Stats",
            text: "In biomedical research and clinical epidemiology, sensitivity measures true positive rates while specificity measures true negative rates. Positive predictive value depends substantially on the underlying population prevalence of the condition being examined. When conducting diagnostic trials or screening programs across university campuses, researchers must calculate false positive and false negative rates carefully to avoid misclassifying healthy students. Standard receiver operating characteristic (ROC) curves illustrate the trade-off between sensitivity and specificity across various decision cutoffs.",
            chunks: [
                "In biomedical research and clinical epidemiology, sensitivity measures true positive rates while specificity measures true negative rates.",
                "Positive predictive value depends substantially on the underlying population prevalence of the condition being examined.",
            ],
        },
    ];
    assert.doesNotThrow(() => checkSourceSufficiency(docs));

    const insufficientDocs = [
        {
            url: "https://example.com/short.txt",
            name: "Short Notes",
            text: "Too short summary.",
            chunks: ["Too short summary."],
        },
    ];
    assert.throws(() => checkSourceSufficiency(insufficientDocs));

    // 3. Excerpt grounding verification
    const goodExcerpt = "sensitivity measures true positive rates";
    assert.ok(verifyExcerptInResources(goodExcerpt, docs));

    const fabricatedExcerpt = "Quantum entanglement governs algorithmic cryptocurrency arbitrage.";
    assert.equal(verifyExcerptInResources(fabricatedExcerpt, docs), false);
});

test("Milestone 5: Account Isolation and Sign-Out Private Data Purge", async () => {
    const userEmail = "fatima@ui.edu.ng";

    // User downloads a private study pack
    const privatePack = buildStudyPackFromCourse(SAMPLE_STATISTICS_COURSE, userEmail);
    privatePack.id = "path-priv-fatima-99";
    privatePack.title = "Agricultural Statistics";
    await saveStudyPack(privatePack);

    // User queues an attempt
    await queueAttempt({
        userEmail,
        pathId: "path-priv-fatima-99",
        lessonId: "les-1",
        questionId: "q-1",
        selectedOptionId: "opt-a",
        isCorrect: true,
        timestamp: new Date().toISOString(),
    });

    const userPacks = await listStudyPacks(userEmail);
    assert.ok(userPacks.some((p) => p.id === "path-priv-fatima-99"));

    const pendingBefore = await getPendingAttempts(userEmail, "path-priv-fatima-99");
    assert.equal(pendingBefore.length, 1);

    // Sign out: clearPrivateOfflineData
    await clearPrivateOfflineData(userEmail);

    // Private pack is gone
    const packsAfterSignOut = await listStudyPacks(userEmail);
    assert.equal(packsAfterSignOut.some((p) => p.id === "path-priv-fatima-99"), false);

    // Queued attempts are purged
    const pendingAfterSignOut = await getPendingAttempts(userEmail, "path-priv-fatima-99");
    assert.equal(pendingAfterSignOut.length, 0);

    // Public demonstration pack remains available
    const publicCourse = await getStudyPack(SAMPLE_STATISTICS_COURSE.id, null);
    assert.ok(publicCourse, "Public demonstration course must remain available after user signs out");
});
