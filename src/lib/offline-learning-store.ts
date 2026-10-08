import { randomUUID } from "node:crypto";
import type {
    OfflineStudyPack,
    OfflineAttemptEvent,
    LearningPath,
    LearningProgress,
} from "./learning-types";
import { SAMPLE_STATISTICS_COURSE } from "./sample-course";

const DB_NAME = "intelar_offline_learning_v1";
const DB_VERSION = 1;
const STORE_PACKS = "study_packs";
const STORE_ATTEMPTS = "attempt_queue";
const STORE_PROGRESS = "offline_progress";

export const MAX_PACK_SIZE_BYTES = 1024 * 1024; // 1 MB target per SPEC.md

// In-memory fallback for Node.js / SSR / testing environments
const memoryPacks = new Map<string, OfflineStudyPack>();
const memoryAttempts = new Map<string, OfflineAttemptEvent>();

function isBrowser(): boolean {
    return typeof window !== "undefined" && typeof window.indexedDB !== "undefined";
}

function getPackKey(id: string, userEmail?: string | null): string {
    const scope = userEmail ? `user_${userEmail.trim().toLowerCase()}` : "guest";
    return `${scope}::${id}`;
}

function normalizeEmail(email?: string | null): string | null {
    if (!email || !email.trim()) return null;
    return email.trim().toLowerCase();
}

function generateEventId(): string {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
        return crypto.randomUUID();
    }
    return randomUUID();
}

let dbInstancePromise: Promise<IDBDatabase> | null = null;

function openDB(): Promise<IDBDatabase> {
    if (!isBrowser()) {
        return Promise.reject(new Error("IndexedDB is not available in non-browser environments"));
    }
    if (dbInstancePromise) return dbInstancePromise;

    dbInstancePromise = new Promise((resolve, reject) => {
        const request = window.indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = (event.target as IDBOpenDBRequest).result;
            if (!db.objectStoreNames.contains(STORE_PACKS)) {
                const packStore = db.createObjectStore(STORE_PACKS, { keyPath: "packKey" });
                packStore.createIndex("by_user", "userEmail", { unique: false });
                packStore.createIndex("by_path", "pathId", { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_ATTEMPTS)) {
                const attemptStore = db.createObjectStore(STORE_ATTEMPTS, { keyPath: "eventId" });
                attemptStore.createIndex("by_user", "userEmail", { unique: false });
                attemptStore.createIndex("by_path", "pathId", { unique: false });
                attemptStore.createIndex("by_synced", "synced", { unique: false });
            }
            if (!db.objectStoreNames.contains(STORE_PROGRESS)) {
                db.createObjectStore(STORE_PROGRESS, { keyPath: "progressKey" });
            }
        };

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbInstancePromise = null;
            reject(request.error);
        };
    });

    return dbInstancePromise;
}

export function buildStudyPackFromCourse(
    course: typeof SAMPLE_STATISTICS_COURSE = SAMPLE_STATISTICS_COURSE,
    userEmail?: string | null
): OfflineStudyPack {
    const raw = JSON.stringify({
        id: course.id,
        title: course.title,
        goal: course.subject,
        language: "en",
        status: "ready",
        lessons: course.lessons,
        practicalActivity: course.practicalActivity,
        nextStepCard: course.nextStepCard,
    });
    const sizeBytes = new TextEncoder().encode(raw).length;

    return {
        id: course.id,
        userEmail: normalizeEmail(userEmail),
        version: 1,
        title: course.title,
        goal: course.subject,
        language: "en",
        status: "ready",
        lessons: course.lessons,
        practicalActivity: course.practicalActivity,
        nextStepCard: course.nextStepCard,
        downloadedAt: new Date().toISOString(),
        sizeBytes,
    };
}

export function buildStudyPackFromPath(
    path: LearningPath,
    userEmail: string
): OfflineStudyPack {
    const raw = JSON.stringify({
        id: path.id,
        title: path.title,
        goal: path.goal,
        language: path.language,
        status: path.status,
        lessons: path.lessons,
    });
    const sizeBytes = new TextEncoder().encode(raw).length;

    return {
        id: path.id,
        userEmail: normalizeEmail(userEmail),
        version: path.version,
        title: path.title,
        goal: path.goal,
        language: path.language,
        status: "ready",
        lessons: path.lessons,
        downloadedAt: new Date().toISOString(),
        sizeBytes,
    };
}

export async function saveStudyPack(pack: OfflineStudyPack): Promise<void> {
    if (pack.sizeBytes > MAX_PACK_SIZE_BYTES) {
        throw new Error(`Study pack size (${(pack.sizeBytes / 1024).toFixed(0)} KB) exceeds the 1 MB target`);
    }

    const packKey = getPackKey(pack.id, pack.userEmail);
    const record = { ...pack, packKey, pathId: pack.id };

    if (!isBrowser()) {
        memoryPacks.set(packKey, record);
        return;
    }

    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_PACKS, "readwrite");
            const store = tx.objectStore(STORE_PACKS);
            const req = store.put(record);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
    } catch {
        // Fallback to memory
        memoryPacks.set(packKey, record);
    }
}

export async function getStudyPack(
    pathId: string,
    userEmail?: string | null
): Promise<OfflineStudyPack | null> {
    const normEmail = normalizeEmail(userEmail);
    const key = getPackKey(pathId, normEmail);

    if (!isBrowser()) {
        let found = memoryPacks.get(key) || null;
        if (!found && pathId === SAMPLE_STATISTICS_COURSE.id) {
            found = memoryPacks.get(getPackKey(pathId, null)) || null;
        }
        if (!found) return null;
        if (found.userEmail && found.userEmail !== normEmail) return null;
        return found;
    }

    try {
        const db = await openDB();
        const pack = await new Promise<OfflineStudyPack | null>((resolve, reject) => {
            const tx = db.transaction(STORE_PACKS, "readonly");
            const store = tx.objectStore(STORE_PACKS);
            const req = store.get(key);
            req.onsuccess = () => resolve((req.result as OfflineStudyPack) || null);
            req.onerror = () => reject(req.error);
        });

        if (pack) {
            if (pack.userEmail && pack.userEmail !== normEmail) return null;
            return pack;
        }

        // Fallback for public course
        if (pathId === SAMPLE_STATISTICS_COURSE.id) {
            const guestKey = getPackKey(pathId, null);
            const guestPack = await new Promise<OfflineStudyPack | null>((resolve, reject) => {
                const tx = db.transaction(STORE_PACKS, "readonly");
                const store = tx.objectStore(STORE_PACKS);
                const req = store.get(guestKey);
                req.onsuccess = () => resolve((req.result as OfflineStudyPack) || null);
                req.onerror = () => reject(req.error);
            });
            return guestPack || null;
        }

        return null;
    } catch {
        const found = memoryPacks.get(key) || null;
        if (!found) return null;
        if (found.userEmail && found.userEmail !== normEmail) return null;
        return found;
    }
}

export async function listStudyPacks(userEmail?: string | null): Promise<OfflineStudyPack[]> {
    const normEmail = normalizeEmail(userEmail);

    if (!isBrowser()) {
        const packs: OfflineStudyPack[] = [];
        for (const pack of memoryPacks.values()) {
            if (pack.userEmail === null || pack.userEmail === normEmail) {
                packs.push(pack);
            }
        }
        return packs;
    }

    try {
        const db = await openDB();
        const records = await new Promise<OfflineStudyPack[]>((resolve, reject) => {
            const tx = db.transaction(STORE_PACKS, "readonly");
            const store = tx.objectStore(STORE_PACKS);
            const req = store.getAll();
            req.onsuccess = () => resolve((req.result as OfflineStudyPack[]) || []);
            req.onerror = () => reject(req.error);
        });

        return records.filter((pack) => pack.userEmail === null || pack.userEmail === normEmail);
    } catch {
        const packs: OfflineStudyPack[] = [];
        for (const pack of memoryPacks.values()) {
            if (pack.userEmail === null || pack.userEmail === normEmail) {
                packs.push(pack);
            }
        }
        return packs;
    }
}

export async function deleteStudyPack(pathId: string, userEmail?: string | null): Promise<boolean> {
    const normEmail = normalizeEmail(userEmail);
    const key = getPackKey(pathId, normEmail);

    if (!isBrowser()) {
        const had = memoryPacks.has(key);
        memoryPacks.delete(key);
        return had;
    }

    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_PACKS, "readwrite");
            const store = tx.objectStore(STORE_PACKS);
            const req = store.delete(key);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
        memoryPacks.delete(key);
        return true;
    } catch {
        const had = memoryPacks.has(key);
        memoryPacks.delete(key);
        return had;
    }
}

export async function queueAttempt(
    event: Omit<OfflineAttemptEvent, "synced" | "eventId"> & { eventId?: string }
): Promise<OfflineAttemptEvent> {
    const eventId = event.eventId || generateEventId();
    const normEmail = normalizeEmail(event.userEmail);
    const attempt: OfflineAttemptEvent = {
        ...event,
        eventId,
        userEmail: normEmail,
        synced: false,
    };

    if (!isBrowser()) {
        memoryAttempts.set(eventId, attempt);
        return attempt;
    }

    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_ATTEMPTS, "readwrite");
            const store = tx.objectStore(STORE_ATTEMPTS);
            const req = store.put(attempt);
            req.onsuccess = () => resolve();
            req.onerror = () => reject(req.error);
        });
        return attempt;
    } catch {
        memoryAttempts.set(eventId, attempt);
        return attempt;
    }
}

export async function getPendingAttempts(
    userEmail?: string | null,
    pathId?: string
): Promise<OfflineAttemptEvent[]> {
    const normEmail = normalizeEmail(userEmail);

    if (!isBrowser()) {
        const list: OfflineAttemptEvent[] = [];
        for (const a of memoryAttempts.values()) {
            if (!a.synced && a.userEmail === normEmail) {
                if (!pathId || a.pathId === pathId) list.push(a);
            }
        }
        return list;
    }

    try {
        const db = await openDB();
        const records = await new Promise<OfflineAttemptEvent[]>((resolve, reject) => {
            const tx = db.transaction(STORE_ATTEMPTS, "readonly");
            const store = tx.objectStore(STORE_ATTEMPTS);
            const req = store.getAll();
            req.onsuccess = () => resolve(req.result || []);
            req.onerror = () => reject(req.error);
        });

        return records.filter((a) => {
            if (a.synced) return false;
            if (a.userEmail !== normEmail) return false;
            if (pathId && a.pathId !== pathId) return false;
            return true;
        });
    } catch {
        const list: OfflineAttemptEvent[] = [];
        for (const a of memoryAttempts.values()) {
            if (!a.synced && a.userEmail === normEmail) {
                if (!pathId || a.pathId === pathId) list.push(a);
            }
        }
        return list;
    }
}

export async function markAttemptsSynced(eventIds: string[]): Promise<void> {
    if (eventIds.length === 0) return;
    const idSet = new Set(eventIds);
    const now = new Date().toISOString();

    if (!isBrowser()) {
        for (const id of eventIds) {
            const existing = memoryAttempts.get(id);
            if (existing) {
                memoryAttempts.set(id, { ...existing, synced: true, syncedAt: now });
            }
        }
        return;
    }

    try {
        const db = await openDB();
        await new Promise<void>((resolve, reject) => {
            const tx = db.transaction(STORE_ATTEMPTS, "readwrite");
            const store = tx.objectStore(STORE_ATTEMPTS);
            const req = store.getAll();
            req.onsuccess = () => {
                const items = (req.result || []) as OfflineAttemptEvent[];
                for (const item of items) {
                    if (idSet.has(item.eventId)) {
                        store.put({ ...item, synced: true, syncedAt: now });
                    }
                }
                resolve();
            };
            req.onerror = () => reject(req.error);
        });
    } catch {
        for (const id of eventIds) {
            const existing = memoryAttempts.get(id);
            if (existing) {
                memoryAttempts.set(id, { ...existing, synced: true, syncedAt: now });
            }
        }
    }
}

export async function clearPrivateOfflineData(userEmail: string): Promise<void> {
    const normEmail = normalizeEmail(userEmail);
    if (!normEmail) return;

    // 1. Clear in-memory entries
    for (const [key, pack] of memoryPacks.entries()) {
        if (pack.userEmail === normEmail) {
            memoryPacks.delete(key);
        }
    }
    for (const [id, a] of memoryAttempts.entries()) {
        if (a.userEmail === normEmail) {
            memoryAttempts.delete(id);
        }
    }

    // 2. Clear browser IndexedDB entries
    if (isBrowser()) {
        try {
            const db = await openDB();
            // Clear packs
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE_PACKS, "readwrite");
                const store = tx.objectStore(STORE_PACKS);
                const req = store.getAll();
                req.onsuccess = () => {
                    const packs = (req.result || []) as (OfflineStudyPack & { packKey: string })[];
                    for (const p of packs) {
                        if (p.userEmail === normEmail) {
                            store.delete(p.packKey);
                        }
                    }
                    resolve();
                };
                req.onerror = () => reject(req.error);
            });

            // Clear attempts
            await new Promise<void>((resolve, reject) => {
                const tx = db.transaction(STORE_ATTEMPTS, "readwrite");
                const store = tx.objectStore(STORE_ATTEMPTS);
                const req = store.getAll();
                req.onsuccess = () => {
                    const attempts = req.result as OfflineAttemptEvent[];
                    for (const a of attempts) {
                        if (a.userEmail === normEmail) {
                            store.delete(a.eventId);
                        }
                    }
                    resolve();
                };
                req.onerror = () => reject(req.error);
            });
        } catch {
            // Ignore if DB access fails
        }

        // 3. Clear private localStorage progress
        try {
            if (typeof localStorage !== "undefined") {
                const prefix = `intelar_learning_progress_user_${normEmail}_`;
                const toRemove: string[] = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith(prefix)) {
                        toRemove.push(key);
                    }
                }
                for (const key of toRemove) {
                    localStorage.removeItem(key);
                }
            }
        } catch {
            // Storage quota / security restriction ignored
        }
    }
}

export async function syncPendingAttemptsWithServer(
    userEmail: string
): Promise<{ syncedCount: number; duplicatesCount: number; progress?: LearningProgress }> {
    const pending = await getPendingAttempts(userEmail);
    if (pending.length === 0) {
        return { syncedCount: 0, duplicatesCount: 0 };
    }

    const payload = {
        attempts: pending.map((p) => ({
            eventId: p.eventId,
            pathId: p.pathId,
            lessonId: p.lessonId,
            questionId: p.questionId,
            selectedOptionId: p.selectedOptionId,
            isCorrect: p.isCorrect,
            timestamp: p.timestamp,
        })),
    };

    const res = await fetch("/api/learning/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
    });

    if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson.error || "Failed to synchronize learning progress");
    }

    const data = await res.json();
    const syncedIds = (data.syncedEventIds || []) as string[];
    // Mark both newly synced and duplicates as synced locally so they won't re-queue
    const allProcessedIds = pending.map((p) => p.eventId);
    await markAttemptsSynced(allProcessedIds);

    return {
        syncedCount: data.syncedCount ?? syncedIds.length,
        duplicatesCount: data.duplicatesCount ?? 0,
        progress: data.progress,
    };
}
