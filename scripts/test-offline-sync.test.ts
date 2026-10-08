import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { SAMPLE_STATISTICS_COURSE } from "../src/lib/sample-course";
import {
    buildStudyPackFromCourse,
    buildStudyPackFromPath,
    saveStudyPack,
    getStudyPack,
    listStudyPacks,
    deleteStudyPack,
    queueAttempt,
    getPendingAttempts,
    markAttemptsSynced,
    clearPrivateOfflineData,
    MAX_PACK_SIZE_BYTES,
} from "../src/lib/offline-learning-store";
import {
    initLearningDB,
    createLearningPath,
    syncLearningEvents,
    getLearningEvents,
    LearningNotFoundError,
} from "../src/lib/learning-db";
import { saveUserResources } from "../src/lib/db";
import type { SyncAttemptInput } from "../src/lib/learning-types";

const studentEmail = "offlinestudent@nigeria.edu.ng";
const secondStudentEmail = "otherstudent@nigeria.edu.ng";

test.before(async () => {
    process.env.TURSO_DATABASE_URL = process.env.TURSO_DATABASE_URL || "file::memory:?cache=shared";
    await initLearningDB();
});

test("demonstration study pack is built, sized below 1 MB target, and stored in offline pack store", async () => {
    const pack = buildStudyPackFromCourse(SAMPLE_STATISTICS_COURSE, studentEmail);

    assert.equal(pack.id, SAMPLE_STATISTICS_COURSE.id);
    assert.equal(pack.version, 1);
    assert.equal(pack.lessons.length, 5);
    assert.ok(pack.sizeBytes > 0, "Pack must have a non-zero size in bytes");
    assert.ok(
        pack.sizeBytes < MAX_PACK_SIZE_BYTES,
        `Pack size (${pack.sizeBytes} bytes) must be well below 1 MB (${MAX_PACK_SIZE_BYTES} bytes)`
    );

    await saveStudyPack(pack);

    const retrieved = await getStudyPack(SAMPLE_STATISTICS_COURSE.id, studentEmail);
    assert.ok(retrieved);
    assert.equal(retrieved.id, SAMPLE_STATISTICS_COURSE.id);
    assert.equal(retrieved.title, SAMPLE_STATISTICS_COURSE.title);
    assert.equal(retrieved.lessons.length, 5);
});

test("downloaded study packs contain complete lessons, traceable citations, and practice for offline use", async () => {
    const pack = await getStudyPack(SAMPLE_STATISTICS_COURSE.id, studentEmail);
    assert.ok(pack);

    for (const lesson of pack.lessons) {
        assert.ok(lesson.id);
        assert.ok(lesson.title);
        assert.ok(lesson.content && lesson.content.length > 50, "Lesson must have offline readable text");

        // Citations
        assert.ok(Array.isArray(lesson.sources) && lesson.sources.length >= 1, "Lesson must have supporting citations");
        for (const source of lesson.sources!) {
            assert.ok(source.title);
            assert.ok(source.excerpt);
            assert.ok(source.license);
        }

        // Practice questions with options, hints, and explanations
        assert.ok(Array.isArray(lesson.questions) && lesson.questions.length === 3, "Lesson must have 3 practice questions");
        for (const q of lesson.questions!) {
            assert.ok(q.id);
            assert.ok(q.prompt);
            assert.ok(Array.isArray(q.options) && q.options.length >= 3);
            assert.ok(q.correctOptionId);
            assert.ok(q.hint && q.hint.length > 5);
            assert.ok(q.explanation && q.explanation.length > 5);
        }
    }
});

test("practice attempts are queued offline with unique event IDs", async () => {
    const lesson = SAMPLE_STATISTICS_COURSE.lessons[0];
    const question = lesson.questions![0];

    const event1 = await queueAttempt({
        userEmail: studentEmail,
        pathId: SAMPLE_STATISTICS_COURSE.id,
        lessonId: lesson.id,
        questionId: question.id,
        selectedOptionId: question.correctOptionId,
        isCorrect: true,
        timestamp: new Date().toISOString(),
    });

    const event2 = await queueAttempt({
        userEmail: studentEmail,
        pathId: SAMPLE_STATISTICS_COURSE.id,
        lessonId: lesson.id,
        questionId: question.id,
        selectedOptionId: question.options[1].id,
        isCorrect: false,
        timestamp: new Date().toISOString(),
    });

    assert.ok(event1.eventId, "Event 1 must have an auto-generated unique event ID");
    assert.ok(event2.eventId, "Event 2 must have an auto-generated unique event ID");
    assert.notEqual(event1.eventId, event2.eventId, "Event IDs must be unique");

    const pending = await getPendingAttempts(studentEmail, SAMPLE_STATISTICS_COURSE.id);
    assert.ok(pending.length >= 2, "Pending attempts must be recorded in offline queue");
    const found1 = pending.find((p) => p.eventId === event1.eventId);
    const found2 = pending.find((p) => p.eventId === event2.eventId);
    assert.ok(found1 && found1.synced === false);
    assert.ok(found2 && found2.synced === false);
});

test("repeated synchronization never duplicates an attempt (idempotent sync)", async () => {
    // Seed resource and create a personal path to test sync on server
    const resourceUrl = `https://cloudinary.com/docs/sync-test-${Date.now()}.pdf`;
    await saveUserResources(studentEmail, [
        {
            name: "Probability and Estimation.pdf",
            type: "application/pdf",
            url: resourceUrl,
            uploadedAt: new Date().toISOString(),
            conversationId: undefined,
            storage: "cloudinary",
            publicId: "sync-doc",
            resourceType: "raw",
        },
    ]);

    const path = await createLearningPath(studentEmail, {
        title: "Probability and Estimation Path",
        goal: "Master probability distributions and hypothesis testing",
        language: "en",
        resourceUrls: [resourceUrl],
        lessons: [
            { title: "Lesson 1: Foundations" },
            { title: "Lesson 2: Estimation" },
            { title: "Lesson 3: Testing" },
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
    const result1 = await syncLearningEvents(studentEmail, attemptsToSync);
    assert.equal(result1.syncedEventIds.length, 2, "First sync should record 2 events");
    assert.equal(result1.duplicatesCount, 0, "First sync should have 0 duplicates");

    // Check DB rows
    const storedEvents1 = await getLearningEvents(studentEmail, path.id);
    assert.equal(storedEvents1.length, 2, "Database must contain exactly 2 events");

    // Second synchronization with the exact same attempts
    const result2 = await syncLearningEvents(studentEmail, attemptsToSync);
    assert.equal(result2.syncedEventIds.length, 0, "Second sync should not re-insert duplicate events");
    assert.equal(result2.duplicatesCount, 2, "Second sync should detect 2 duplicates");

    // Check DB rows did NOT duplicate
    const storedEvents2 = await getLearningEvents(studentEmail, path.id);
    assert.equal(storedEvents2.length, 2, "Repeated synchronization must NEVER duplicate an attempt");

    // Mark synced locally
    await markAttemptsSynced([testEventId1, testEventId2]);
    const pendingAfter = await getPendingAttempts(studentEmail, path.id);
    assert.equal(pendingAfter.length, 0, "Pending attempts must be cleared after sync");
});

test("foreign accounts cannot access or sync to private personal study paths", async () => {
    // Student creates private path
    const resourceUrl = `https://cloudinary.com/docs/private-${Date.now()}.pdf`;
    await saveUserResources(studentEmail, [
        {
            name: "Private Research Notes.pdf",
            type: "application/pdf",
            url: resourceUrl,
            uploadedAt: new Date().toISOString(),
            conversationId: undefined,
            storage: "cloudinary",
            publicId: "priv-doc",
            resourceType: "raw",
        },
    ]);

    const privatePath = await createLearningPath(studentEmail, {
        title: "Confidential Student Research",
        goal: "Analyze private research findings",
        language: "en",
        resourceUrls: [resourceUrl],
        lessons: [
            { title: "Private Lesson A" },
            { title: "Private Lesson B" },
            { title: "Private Lesson C" },
        ],
    });

    // Foreign student tries to sync attempt to studentEmail's private path
    const foreignAttempt: SyncAttemptInput = {
        eventId: randomUUID(),
        pathId: privatePath.id,
        lessonId: privatePath.lessons[0].id,
        questionId: "q1",
        selectedOptionId: "opt-1",
        isCorrect: true,
        timestamp: new Date().toISOString(),
    };

    await assert.rejects(
        async () => {
            await syncLearningEvents(secondStudentEmail, [foreignAttempt]);
        },
        LearningNotFoundError,
        "A foreign account must be rejected when attempting to sync progress to another learner's path"
    );
});

test("account isolation in offline store prevents reading other users' private study packs", async () => {
    // User A downloads private study pack
    const userAPack = buildStudyPackFromCourse(SAMPLE_STATISTICS_COURSE, studentEmail);
    userAPack.id = "private-path-user-a";
    userAPack.title = "User A Private Study Path";
    await saveStudyPack(userAPack);

    // User B lists study packs
    const userBPacks = await listStudyPacks(secondStudentEmail);
    const hasUserAPack = userBPacks.some((p) => p.id === "private-path-user-a");
    assert.equal(hasUserAPack, false, "User B must not be able to list User A's private study pack");

    // User B tries to retrieve User A's pack directly
    const directGet = await getStudyPack("private-path-user-a", secondStudentEmail);
    assert.equal(directGet, null, "User B must receive null when requesting User A's private study pack");
});

test("download removal clears the study pack from offline storage", async () => {
    const removablePack = buildStudyPackFromCourse(SAMPLE_STATISTICS_COURSE, studentEmail);
    removablePack.id = "removable-course-pack";
    await saveStudyPack(removablePack);

    const existsBefore = await getStudyPack("removable-course-pack", studentEmail);
    assert.ok(existsBefore);

    // User removes the downloaded pack
    const removed = await deleteStudyPack("removable-course-pack", studentEmail);
    assert.equal(removed, true);

    const existsAfter = await getStudyPack("removable-course-pack", studentEmail);
    assert.equal(existsAfter, null, "Deleted study pack must no longer exist in storage");
});

test("sign-out clears private offline content while preserving public demonstration content", async () => {
    // Save a private study pack for Student
    const privatePack = buildStudyPackFromCourse(SAMPLE_STATISTICS_COURSE, studentEmail);
    privatePack.id = "student-private-pack-to-clear";
    await saveStudyPack(privatePack);

    // Queue private attempt for Student
    await queueAttempt({
        userEmail: studentEmail,
        pathId: "student-private-pack-to-clear",
        lessonId: "l1",
        questionId: "q1",
        selectedOptionId: "opt1",
        isCorrect: true,
        timestamp: new Date().toISOString(),
    });

    // Save public sample course pack
    const publicPack = buildStudyPackFromCourse(SAMPLE_STATISTICS_COURSE, null);
    await saveStudyPack(publicPack);

    // Verify before sign-out
    const privateBefore = await getStudyPack("student-private-pack-to-clear", studentEmail);
    assert.ok(privateBefore);
    const pendingBefore = await getPendingAttempts(studentEmail, "student-private-pack-to-clear");
    assert.ok(pendingBefore.length > 0);

    // User signs out: clear private data
    await clearPrivateOfflineData(studentEmail);

    // Private pack and queued attempts must be wiped
    const privateAfter = await getStudyPack("student-private-pack-to-clear", studentEmail);
    assert.equal(privateAfter, null, "Sign-out must clear private offline study packs");

    const pendingAfter = await getPendingAttempts(studentEmail, "student-private-pack-to-clear");
    assert.equal(pendingAfter.length, 0, "Sign-out must clear private offline queued attempts");

    // Public demonstration pack remains available
    const publicAfter = await getStudyPack(SAMPLE_STATISTICS_COURSE.id, null);
    assert.ok(publicAfter, "Public demonstration course must remain available after user signs out");
});

test("application shell service worker and web manifest exist with correct offline configurations", () => {
    const swPath = join(process.cwd(), "public", "sw.js");
    const manifestPath = join(process.cwd(), "public", "manifest.json");

    assert.ok(existsSync(swPath), "public/sw.js must exist");
    assert.ok(existsSync(manifestPath), "public/manifest.json must exist");

    const swContent = readFileSync(swPath, "utf-8");
    assert.ok(swContent.includes("/learn"), "Service worker must precache or cache /learn");
    assert.ok(swContent.includes("intelar-app-shell"), "Service worker must manage intelar-app-shell cache");
    assert.ok(swContent.includes("navigate"), "Service worker must handle navigate requests for offline fallback");

    const manifestContent = JSON.parse(readFileSync(manifestPath, "utf-8"));
    assert.equal(manifestContent.start_url, "/learn");
    assert.equal(manifestContent.display, "standalone");
});
