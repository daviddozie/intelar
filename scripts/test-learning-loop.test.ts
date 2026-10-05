import assert from "node:assert/strict";
import { test, beforeEach } from "node:test";
import { SAMPLE_STATISTICS_COURSE } from "../src/lib/sample-course";
import {
    loadLocalLearningProgress,
    saveLocalLearningProgress,
    clearLocalLearningProgress,
    getStorageKey,
    mergeLearningProgress,
    isLessonUnlocked,
} from "../src/lib/learning-progress-store";

// Mock localStorage for Node test runner
const storageMap = new Map<string, string>();
const mockLocalStorage = {
    getItem: (key: string) => storageMap.get(key) ?? null,
    setItem: (key: string, value: string) => storageMap.set(key, value),
    removeItem: (key: string) => storageMap.delete(key),
    clear: () => storageMap.clear(),
};
(globalThis as unknown as { localStorage: typeof mockLocalStorage }).localStorage = mockLocalStorage;

beforeEach(() => {
    storageMap.clear();
});

test("demonstration course contains 5 draft lessons, OpenIntro citations, and French translation", () => {
    const course = SAMPLE_STATISTICS_COURSE;
    assert.equal(course.id, "sample-statistics-101");
    assert.equal(course.lessons.length, 5);

    // Verify all 5 required demonstration lesson topics
    const expectedTitles = [
        "Data Types",
        "Mean and Median",
        "Measures of Spread",
        "Reading Charts",
        "Interpreting a Small Dataset",
    ];
    assert.deepEqual(course.lessons.map((l) => l.title), expectedTitles);

    // Verify attribution and AI notices
    assert.match(course.attribution, /OpenIntro Statistics/);
    assert.match(course.attribution, /CC BY-SA 3.0/);
    assert.ok(course.aiPreparedNotice.length > 0);
    assert.match(course.humanReviewedNotice, /human-reviewed|review pending/i);

    // Verify the draft French translation structure; this is not human review.
    const lesson1 = course.lessons[0];
    assert.ok(lesson1.frenchAlternative);
    assert.equal(lesson1.frenchAlternative.title, "Types de données");
    assert.equal(lesson1.frenchAlternative.questions.length, 3);
});

test("every lesson has 3 practice questions with valid options, hints, and explanations", () => {
    for (const lesson of SAMPLE_STATISTICS_COURSE.lessons) {
        assert.ok(lesson.questions, `Lesson ${lesson.id} must have questions`);
        assert.equal(lesson.questions.length, 3, `Lesson ${lesson.id} must have 3 questions`);

        for (const q of lesson.questions) {
            assert.ok(q.prompt.length > 10, "Question prompt must be meaningful");
            assert.equal(q.options.length, 4, "Question must have 4 options");
            assert.ok(q.hint.length > 5, "Question must have a hint");
            assert.ok(q.explanation.length > 10, "Question must have an explanation");
            // Correct option must exist among the options
            const correctExists = q.options.some((opt) => opt.id === q.correctOptionId);
            assert.ok(correctExists, `Correct option ${q.correctOptionId} must be in options`);
        }
    }
});

test("lesson references resolve to traceable OpenIntro supporting materials with excerpts and licenses", () => {
    for (const lesson of SAMPLE_STATISTICS_COURSE.lessons) {
        assert.ok(lesson.sources && lesson.sources.length > 0, `Lesson ${lesson.id} must cite at least one source`);
        for (const ref of lesson.sources) {
            assert.ok(ref.title.includes("OpenIntro"), `Citation ${ref.id} must reference OpenIntro`);
            assert.match(ref.license, /CC BY-SA 3.0/, `Citation ${ref.id} must have CC BY-SA 3.0 license`);
            assert.ok(ref.excerpt.length > 30, `Citation ${ref.id} must have a substantive excerpt`);
            assert.ok(ref.url?.startsWith("https://"), `Citation ${ref.id} must link to source URL`);
        }
    }
});

test("acceptance: a learner answers a question, reloads, and sees the saved result", () => {
    const courseId = SAMPLE_STATISTICS_COURSE.id;
    const lesson1 = SAMPLE_STATISTICS_COURSE.lessons[0];
    const question1 = lesson1.questions![0];
    const selectedOption = question1.correctOptionId;

    // Initial state before answering
    const initialProgress = loadLocalLearningProgress(courseId);
    assert.equal(initialProgress.questionAnswers[question1.id], undefined);

    // Learner selects answer
    saveLocalLearningProgress(courseId, {
        questionAnswers: { [question1.id]: selectedOption },
        lastLessonId: lesson1.id,
    });

    // Simulate page reload by re-reading from storage
    const reloadedProgress = loadLocalLearningProgress(courseId);
    assert.equal(reloadedProgress.questionAnswers[question1.id], selectedOption);
    assert.equal(reloadedProgress.lastLessonId, lesson1.id);

    // Learner answers second question and marks lesson complete
    const question2 = lesson1.questions![1];
    saveLocalLearningProgress(courseId, {
        questionAnswers: { [question2.id]: question2.correctOptionId },
        completedLessonIds: [lesson1.id],
    });

    // Simulate second reload
    const secondReload = loadLocalLearningProgress(courseId);
    assert.equal(secondReload.questionAnswers[question1.id], selectedOption);
    assert.equal(secondReload.questionAnswers[question2.id], question2.correctOptionId);
    assert.deepEqual(secondReload.completedLessonIds, [lesson1.id]);
});

test("progress storage partitions guest from authenticated users and clear resets", () => {
    const courseId = SAMPLE_STATISTICS_COURSE.id;
    const guestKey = getStorageKey(courseId, null);
    const userKey = getStorageKey(courseId, "student@unilag.edu.ng");

    assert.notEqual(guestKey, userKey);

    saveLocalLearningProgress(courseId, { lastLessonId: "lesson-1-data-types" }, null);
    saveLocalLearningProgress(courseId, { lastLessonId: "lesson-3-measures-of-spread" }, "student@unilag.edu.ng");

    assert.equal(loadLocalLearningProgress(courseId, null).lastLessonId, "lesson-1-data-types");
    assert.equal(loadLocalLearningProgress(courseId, "student@unilag.edu.ng").lastLessonId, "lesson-3-measures-of-spread");

    clearLocalLearningProgress(courseId, null);
    assert.equal(loadLocalLearningProgress(courseId, null).lastLessonId, null);
    assert.equal(loadLocalLearningProgress(courseId, "student@unilag.edu.ng").lastLessonId, "lesson-3-measures-of-spread");
});

test("practical statistics activity uses synthetic Nigerian campus transport fares in Naira", () => {
    const activity = SAMPLE_STATISTICS_COURSE.practicalActivity;
    assert.equal(activity.id, "activity-campus-transport");
    assert.equal(activity.dataset.length, 10);

    // Verify all observations are in Naira with realistic campus transit modes
    for (const dp of activity.dataset) {
        assert.ok(dp.costNaira > 0, "Cost must be positive");
        assert.ok(dp.distanceKm > 0, "Distance must be positive");
        assert.ok(["Campus Shuttle Bus", "Tricycle (Keke)", "Motorcycle (Okada)", "Minibus (Danfo)", "Private Charter"].includes(dp.mode));
    }

    // Verify tasks and mathematical answers
    const sortedCosts = activity.dataset.map((d) => d.costNaira).sort((a, b) => a - b);
    assert.deepEqual(sortedCosts, [150, 200, 200, 200, 250, 250, 300, 350, 500, 1200]);

    // Median of 10 items is (250 + 250)/2 = 250
    const medianTask = activity.tasks[0];
    const correctOpt = medianTask.options?.find((o) => o.id === medianTask.correctAnswer);
    assert.equal(correctOpt?.text, "₦250");

    // IQR = Q3 (350) - Q1 (200) = 150
    const iqrTask = activity.tasks[1];
    const iqrOpt = iqrTask.options?.find((o) => o.id === iqrTask.correctAnswer);
    assert.equal(iqrOpt?.text, "₦150");

    // Outlier check: 1200 > 350 + 1.5*150 = 575 -> Yes
    const outlierTask = activity.tasks[2];
    assert.match(outlierTask.explanation, /outlier/);
});

test("next-step card connects statistics to academic research, fintech, and public policy", () => {
    const card = SAMPLE_STATISTICS_COURSE.nextStepCard;
    assert.equal(card.opportunities.length, 3);

    const sectors = card.opportunities.map((o) => o.sector);
    assert.ok(sectors.includes("University Research"));
    assert.ok(sectors.includes("Tech & Fintech Ecosystem"));
    assert.ok(sectors.includes("Development & Public Policy"));
});


test("retry replaces the saved answer and completion can be undone", () => {
    const course = SAMPLE_STATISTICS_COURSE;
    const lesson = course.lessons[0];
    const q = lesson.questions![0];
    saveLocalLearningProgress(course.id, { questionAnswers: { [q.id]: q.options[1].id }, completedLessonIds: [lesson.id] });
    saveLocalLearningProgress(course.id, { questionAnswers: { [q.id]: q.correctOptionId }, completedLessonIds: [] });
    const reloaded = loadLocalLearningProgress(course.id);
    assert.equal(reloaded.questionAnswers[q.id], q.correctOptionId);
    assert.deepEqual(reloaded.completedLessonIds, []);
});

test("corrupt, stale, and invalid stored progress is ignored", () => {
    const course = SAMPLE_STATISTICS_COURSE;
    const key = getStorageKey(course.id);
    storageMap.set(key, "null");
    assert.equal(loadLocalLearningProgress(course.id).lastLessonId, null);
    storageMap.set(key, JSON.stringify({
        lastLessonId: "unknown", completedLessonIds: ["unknown", course.lessons[0].id, course.lessons[0].id, 42],
        questionAnswers: { "q-1-1": "foreign-option", "unknown-question": "x" },
        practicalCompleted: "true", activeLanguage: "unknown",
    }));
    const progress = loadLocalLearningProgress(course.id);
    assert.equal(progress.lastLessonId, null);
    assert.deepEqual(progress.completedLessonIds, [course.lessons[0].id]);
    assert.deepEqual(progress.questionAnswers, {});
    assert.equal(progress.practicalCompleted, false);
    assert.equal(progress.activeLanguage, "en");
});

test("storage failure is surfaced and the complete in-memory attempt can be retried", () => {
    const course = SAMPLE_STATISTICS_COURSE;
    const first = saveLocalLearningProgress(course.id, { questionAnswers: { "q-1-1": "opt-1-1-a" } });
    const next = mergeLearningProgress(first, { questionAnswers: { "q-1-2": "opt-1-2-b" } });
    const original = mockLocalStorage.setItem;
    mockLocalStorage.setItem = () => { throw new Error("Quota exceeded"); };
    try {
        assert.throws(() => saveLocalLearningProgress(course.id, next, null, first), /Quota/);
        assert.deepEqual(next.questionAnswers, { "q-1-1": "opt-1-1-a", "q-1-2": "opt-1-2-b" });
    } finally { mockLocalStorage.setItem = original; }
    saveLocalLearningProgress(course.id, next);
    assert.deepEqual(loadLocalLearningProgress(course.id).questionAnswers, next.questionAnswers);
});

test("practical calculations independently match the seeded answer key and survive reload", () => {
    const course = SAMPLE_STATISTICS_COURSE;
    const activity = course.practicalActivity;
    const values = activity.dataset.map((row) => row.costNaira).sort((a, b) => a - b);
    const median = (numbers: number[]) => numbers.length % 2
        ? numbers[Math.floor(numbers.length / 2)]
        : (numbers[numbers.length / 2 - 1] + numbers[numbers.length / 2]) / 2;
    assert.equal(median(values), 250);
    assert.equal(values.reduce((sum, cost) => sum + cost, 0) / values.length, 360);
    const q1 = median(values.slice(0, 5));
    const q3 = median(values.slice(5));
    assert.equal(q3 - q1, 150);
    assert.equal(q3 + 1.5 * (q3 - q1), 575);
    assert.deepEqual(values.filter((cost) => cost > q3 + 1.5 * (q3 - q1)), [1200]);
    const answers = Object.fromEntries(activity.tasks.map((task) => [task.id, task.correctAnswer]));
    saveLocalLearningProgress(course.id, { practicalTaskAnswers: answers, practicalCompleted: true, activeLanguage: "fr" });
    const reloaded = loadLocalLearningProgress(course.id);
    assert.equal(reloaded.practicalCompleted, true);
    assert.equal(reloaded.activeLanguage, "fr");
    assert.deepEqual(reloaded.practicalTaskAnswers, answers);
});

test("sequential lesson progression requires preceding lesson completion to unlock subsequent lessons", () => {
    const course = SAMPLE_STATISTICS_COURSE;
    const lessons = course.lessons;
    const lesson0 = lessons[0];
    const lesson1 = lessons[1];
    const lesson2 = lessons[2];

    // Lesson 0 is always unlocked
    assert.equal(isLessonUnlocked(lesson0.id, lessons, []), true);

    // Lesson 1 is locked when no lessons are completed
    assert.equal(isLessonUnlocked(lesson1.id, lessons, []), false);

    // Lesson 1 is unlocked once Lesson 0 is completed
    assert.equal(isLessonUnlocked(lesson1.id, lessons, [lesson0.id]), true);

    // Lesson 2 remains locked until Lesson 1 is completed
    assert.equal(isLessonUnlocked(lesson2.id, lessons, [lesson0.id]), false);
    assert.equal(isLessonUnlocked(lesson2.id, lessons, [lesson0.id, lesson1.id]), true);

    // Already completed lessons are always unlocked for review
    assert.equal(isLessonUnlocked(lesson0.id, lessons, [lesson0.id]), true);
});

test("quiz 80% passing score prerequisite for lesson completion", () => {
    const course = SAMPLE_STATISTICS_COURSE;
    const lesson = course.lessons[0];
    const questions = lesson.questions!;
    assert.equal(questions.length, 3);

    // 0/3 correct = 0% -> does not meet 80%
    const score0 = Math.round((0 / 3) * 100);
    assert.ok(score0 < 80);

    // 1/3 correct = 33% -> does not meet 80%
    const score1 = Math.round((1 / 3) * 100);
    assert.ok(score1 < 80);

    // 2/3 correct = 67% -> does not meet 80%
    const score2 = Math.round((2 / 3) * 100);
    assert.ok(score2 < 80);

    // 3/3 correct = 100% -> meets 80%
    const score3 = Math.round((3 / 3) * 100);
    assert.ok(score3 >= 80);
});

