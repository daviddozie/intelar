import assert from "node:assert/strict";
import { after, test } from "node:test";
import Module, { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import type { LearningPath } from "../src/lib/learning-types";

// No real credentials, remote database writes, embeddings, or model calls.
process.env.TURSO_DATABASE_URL = "file::memory:";
delete process.env.TURSO_AUTH_TOKEN;

const requireFromProject = createRequire(resolve("package.json"));
let session: { user: { email: string } } | null = null;
const queries: { filter: { $and: Record<string, { $eq: string }>[] } }[] = [];
const agentCalls: { message: string; options: Record<string, unknown> }[] = [];
const loader = Module as unknown as {
    _load: (request: string, parent: unknown, isMain: boolean) => unknown;
};
const originalLoad = loader._load;

loader._load = function (request, parent, isMain) {
    if (request === "@pinecone-database/pinecone") {
        return {
            Pinecone: class {
                index() {
                    return {
                        query: async (input: typeof queries[number]) => {
                            queries.push(input);
                            return { matches: [{ score: 0.9, metadata: { text: "An authorized statistics excerpt", fileName: "notes.txt" } }] };
                        },
                    };
                }
            },
        };
    }
    if (request === "./embeddings" && (parent as { filename?: string })?.filename?.endsWith("vector-store.ts")) {
        return { embedText: async () => [1, 0], embedBatch: async () => [[1, 0]] };
    }
    return originalLoad.call(this, request, parent, isMain);
};

const db = requireFromProject(resolve("src/lib/db.ts")) as typeof import("../src/lib/db");
const learning = requireFromProject(resolve("src/lib/learning-db.ts")) as typeof import("../src/lib/learning-db");
const vectors = requireFromProject(resolve("src/lib/vector-store.ts")) as typeof import("../src/lib/vector-store");
const { documentChunkId } = requireFromProject(resolve("src/lib/document-scope.ts")) as typeof import("../src/lib/document-scope");

type Route = Record<string, (request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<Response>>;

// Transpile the actual route without changing its behavior. Stub only external
// authentication/model services; persistence and authorization use real SQLite.
function loadRoute(relativePath: string): Route {
    const source = readFileSync(resolve(relativePath), "utf8");
    const compiled = transpileModule(source, {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022, esModuleInterop: true },
    });
    const routeModule = { exports: {} };
    const routeRequire = (specifier: string): unknown => {
        if (specifier === "next-auth") return { getServerSession: async () => session };
        if (specifier === "@/lib/auth") return { authOptions: {} };
        if (specifier === "@/mastra") {
            return {
                mastra: {
                    getAgent: () => ({
                        stream: async (message: string, options: Record<string, unknown>) => {
                            agentCalls.push({ message, options });
                            return { textStream: (async function* () { yield "Test reply"; })() };
                        },
                    }),
                },
            };
        }
        if (specifier.startsWith("@/")) return requireFromProject(resolve("src", specifier.slice(2)));
        return requireFromProject(specifier);
    };
    new Function("require", "module", "exports", compiled.outputText)(routeRequire, routeModule, routeModule.exports);
    return routeModule.exports as Route;
}

const pathsRoute = loadRoute("src/app/api/learning/paths/route.ts");
const pathRoute = loadRoute("src/app/api/learning/paths/[pathId]/route.ts");
const progressRoute = loadRoute("src/app/api/learning/paths/[pathId]/progress/route.ts");
const conversationsRoute = loadRoute("src/app/api/conversations/route.ts");
const conversationRoute = loadRoute("src/app/api/conversations/[id]/route.ts");
const chatRoute = loadRoute("src/app/api/chat/route.ts");
const resourcesRoute = loadRoute("src/app/api/resources/route.ts");
const ingestRoute = loadRoute("src/app/api/ingest/route.ts");

function request(body: unknown, method = "POST") {
    return new Request("http://localhost/api", {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
    });
}

const alice = "alice@example.test";
const bob = "bob@example.test";
const outline = {
    title: "Statistics", goal: "Understand averages",
    lessons: [{ title: "Data types" }, { title: "Mean" }, { title: "Median" }],
};
let path: LearningPath;

test("additive initialization preserves existing conversations and resources", async () => {
    await db.initDB();
    await db.saveConversation(alice, "alice-thread", "Original", [{ role: "user", content: "Hello" }]);
    await db.saveUserResources(alice, [{ name: "notes.txt", type: "text/plain", url: "https://example.test/notes.txt" }]);
    await learning.initLearningDB();
    await learning.initLearningDB();
    assert.equal((await db.getConversation(alice, "alice-thread"))?.title, "Original");
    assert.equal((await db.getUserResources(alice)).length, 1);
});

test("conversation upserts reject another owner and preserve the original messages", async () => {
    await assert.rejects(db.saveConversation(bob, "alice-thread", "Attack", []), db.ConversationAccessError);
    assert.equal((await db.getConversation(alice, "alice-thread"))?.title, "Original");
    assert.equal(await db.getConversation(bob, "alice-thread"), null);
    await db.saveConversation(alice, "alice-thread", "Updated", [{ role: "user", content: "Still mine" }]);
    assert.equal((await db.getConversation(alice, "alice-thread"))?.messages[0].content, "Still mine");
    await assert.rejects(db.assertConversationAccess(bob, "alice-thread"), db.ConversationAccessError);
    await db.assertConversationAccess(bob, "new-bob-thread");
});

test("conversation POST returns 404 for a foreign ID and 400 for invalid input", async () => {
    session = { user: { email: bob } };
    assert.equal((await conversationsRoute.POST(request({ id: "alice-thread", title: "Attack", messages: [] }))).status, 404);
    assert.equal((await conversationsRoute.POST(request({ id: "", title: "Invalid", messages: [] }))).status, 400);
});

test("conversation [id] GET and DELETE reject unauthorized and foreign requests", async () => {
    session = null;
    const context = { params: Promise.resolve({ id: "alice-thread" }) };
    assert.equal((await conversationRoute.GET(new Request("http://localhost/api"), context)).status, 401);
    assert.equal((await conversationRoute.DELETE(new Request("http://localhost/api", { method: "DELETE" }), context)).status, 401);
    session = { user: { email: bob } };
    assert.equal((await conversationRoute.GET(new Request("http://localhost/api"), context)).status, 404);
    session = { user: { email: alice } };
    assert.equal((await conversationRoute.GET(new Request("http://localhost/api"), context)).status, 200);
});

test("owners can create and retrieve learning outlines; other accounts cannot read or list them", async () => {
    path = await learning.createLearningPath(alice, { ...outline, resourceUrls: ["https://example.test/notes.txt"] });
    assert.equal(path.status, "draft");
    assert.equal(path.lessons.length, 3);
    assert.deepEqual(await learning.getLearningPath(alice, path.id), path);
    assert.equal(await learning.getLearningPath(bob, path.id), null);
    assert.equal((await learning.getUserLearningPaths(bob)).length, 0);
    await assert.rejects(learning.createLearningPath(bob, { ...outline, resourceUrls: ["https://example.test/notes.txt"] }), learning.LearningNotFoundError);
    await assert.rejects(learning.getUserLearningPaths(""), learning.LearningNotFoundError);
});

test("progress persists, rejects foreign paths/lessons, and does not duplicate completed IDs", async () => {
    const progress = { lastLessonId: path.lessons[0].id, completedLessonIds: [path.lessons[0].id, path.lessons[0].id] };
    await learning.saveLearningProgress(alice, path.id, progress);
    assert.deepEqual((await learning.getLearningPath(alice, path.id))?.progress, {
        lastLessonId: path.lessons[0].id, completedLessonIds: [path.lessons[0].id],
    });
    await assert.rejects(learning.saveLearningProgress(bob, path.id, progress), learning.LearningNotFoundError);
    const another = await learning.createLearningPath(alice, outline);
    await assert.rejects(learning.saveLearningProgress(alice, path.id, { lastLessonId: another.lessons[0].id, completedLessonIds: [] }), learning.LearningProgressError);
});

test("learning HTTP routes enforce authentication, ownership, and validation", async () => {
    session = null;
    assert.equal((await pathsRoute.GET(new Request("http://localhost/api"))).status, 401);
    assert.equal((await pathsRoute.POST(request(outline))).status, 401);
    const context = { params: Promise.resolve({ pathId: path.id }) };
    assert.equal((await pathRoute.GET(new Request("http://localhost/api"), context)).status, 401);
    assert.equal((await progressRoute.PUT(request({}, "PUT"), context)).status, 401);
    session = { user: { email: bob } };
    assert.equal((await pathRoute.GET(new Request("http://localhost/api"), context)).status, 404);
    assert.equal((await progressRoute.PUT(request({ completedLessonIds: [] }, "PUT"), context)).status, 404);
    session = { user: { email: alice } };
    assert.equal((await pathsRoute.POST(request({ ...outline, lessons: [{ title: "Only one" }] }))).status, 400);
    assert.equal((await pathsRoute.POST(new Request("http://localhost/api", { method: "POST", body: "{" }))).status, 400);
    const response = await pathsRoute.POST(request({ ...outline, userEmail: bob, status: "reviewed" }));
    assert.equal(response.status, 201);
    const created = (await response.json()).path as LearningPath;
    assert.equal(created.status, "draft");
    assert.equal(await learning.getLearningPath(bob, created.id), null);
    assert.equal((await progressRoute.PUT(request({ lastLessonId: path.lessons[1].id, completedLessonIds: [path.lessons[0].id] }, "PUT"), context)).status, 200);
    assert.equal((await pathRoute.GET(new Request("http://localhost/api"), context)).status, 200);
});

test("document searches always filter by owner and vector IDs cannot collide across accounts", async () => {
    queries.length = 0;
    await vectors.searchSimilarChunks("statistics", "alice-thread", alice);
    assert.ok(queries[0].filter.$and.some((filter) => filter.userEmail?.$eq === alice));
    await assert.rejects(vectors.searchSimilarChunks("statistics", "alice-thread", ""));
    const id = documentChunkId(alice, "same-thread", "notes.txt", 0);
    assert.equal(id, documentChunkId(alice, "same-thread", "notes.txt", 0));
    assert.notEqual(id, documentChunkId(bob, "same-thread", "notes.txt", 0));
});

test("guest chat keeps streaming framing without retrieving documents or using a supplied memory thread", async () => {
    session = null;
    queries.length = 0;
    agentCalls.length = 0;
    const response = await chatRoute.POST(request({ message: "Summarize the file", threadId: "alice-thread", useResearch: false }));
    assert.equal(response.status, 200);
    const text = await response.text();
    assert.match(text, /<think>[\s\S]*<\/think>/);
    assert.match(text, /Test reply/);
    assert.equal(queries.length, 0);
    assert.equal(agentCalls[0].options.memory, undefined);
    assert.equal(agentCalls[0].message, "Summarize the file");
});

test("signed-in chat rejects foreign conversations and keeps owned document context and memory", async () => {
    session = { user: { email: bob } };
    assert.equal((await chatRoute.POST(request({ message: "Hello", threadId: "alice-thread" }))).status, 404);
    session = { user: { email: alice } };
    queries.length = 0;
    agentCalls.length = 0;
    const response = await chatRoute.POST(request({ message: "Summarize the file", threadId: "alice-thread", useResearch: false }));
    assert.match(await response.text(), /Test reply/);
    assert.ok(queries[0].filter.$and.some((filter) => filter.userEmail?.$eq === alice));
    assert.match(agentCalls[0].message, /authorized statistics excerpt/);
    assert.deepEqual(agentCalls[0].options.memory, { thread: "alice-thread", resource: alice });
});

test("resource API and referenced-document chat preserve owner isolation", async () => {
    session = null;
    assert.equal((await resourcesRoute.GET(new Request("http://localhost/api"))).status, 401);
    assert.equal((await chatRoute.POST(request({ message: "Read this", referenceResource: { url: "https://example.test/notes.txt" } }))).status, 401);
    session = { user: { email: bob } };
    assert.deepEqual((await (await resourcesRoute.GET(new Request("http://localhost/api"))).json()).resources, []);
    assert.equal((await chatRoute.POST(request({ message: "Read this", referenceResource: { url: "https://example.test/notes.txt" } }))).status, 404);
    session = { user: { email: alice } };
    const response = await resourcesRoute.GET(new Request("http://localhost/api"));
    assert.equal(response.status, 200);
    assert.equal((await response.json()).resources[0].name, "notes.txt");
});

test("ingestion rejects foreign conversation IDs before processing files", async () => {
    session = { user: { email: bob } };
    const form = new FormData();
    form.append("conversationId", "alice-thread");
    form.append("files", new File(["Do not index"], "notes.txt", { type: "text/plain" }));
    const response = await ingestRoute.POST(new Request("http://localhost/api", { method: "POST", body: form }));
    assert.equal(response.status, 404);
});

test("learning routes return a retryable 503 without leaking provider errors", async () => {
    session = { user: { email: alice } };
    const client = db.getDB();
    const execute = client.execute;
    client.execute = async () => {
        throw new Error("private provider details", { cause: Object.assign(new Error("private host"), { code: "ECONNREFUSED" }) });
    };
    try {
        const response = await pathsRoute.GET(new Request("http://localhost/api"));
        assert.equal(response.status, 503);
        assert.equal(response.headers.get("Retry-After"), "5");
        assert.doesNotMatch(await response.text(), /private/);
    } finally {
        client.execute = execute;
    }
    assert.ok(await learning.getLearningPath(alice, path.id));
});

after(() => {
    loader._load = originalLoad;
    db.getDB().close();
});
