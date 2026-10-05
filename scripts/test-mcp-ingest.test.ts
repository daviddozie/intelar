import assert from "node:assert/strict";
import { test, after } from "node:test";
import Module, { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

// Use in-memory SQLite
process.env.TURSO_DATABASE_URL = "file::memory:";
delete process.env.TURSO_AUTH_TOKEN;

const requireFromProject = createRequire(resolve("package.json"));
let session: { user: { email: string } } | null = null;

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
                        upsert: async () => ({ upsertedCount: 1 }),
                        query: async () => ({ matches: [] }),
                    };
                }
            },
        };
    }
    if (request === "./embeddings" && (parent as { filename?: string })?.filename?.endsWith("vector-store.ts")) {
        return {
            embedText: async () => [0.1, 0.2],
            embedBatch: async (texts: string[]) => texts.map(() => [0.1, 0.2]),
        };
    }
    return originalLoad.call(this, request, parent, isMain);
};

const db = requireFromProject(resolve("src/lib/db.ts")) as typeof import("../src/lib/db");
const mcp = requireFromProject(resolve("src/lib/mcp/mcp-client-service.ts")) as typeof import("../src/lib/mcp/mcp-client-service");
const docProcessor = requireFromProject(resolve("src/lib/document-processor.ts")) as typeof import("../src/lib/document-processor");

type Route = Record<string, (request: Request, context?: { params: Promise<Record<string, string>> }) => Promise<Response>>;

function loadRoute(relativePath: string): Route {
    const source = readFileSync(resolve(relativePath), "utf8");
    const compiled = transpileModule(source, {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022, esModuleInterop: true },
    });
    const routeModule = { exports: {} };
    const routeRequire = (specifier: string): unknown => {
        if (specifier === "next-auth") return { getServerSession: async () => session };
        if (specifier === "@/lib/auth") return { authOptions: {} };
        if (specifier === "@/lib/mcp/mcp-client-service") return mcp;
        if (specifier.startsWith("@/")) {
            return requireFromProject(resolve("src", specifier.slice(2)));
        }
        return requireFromProject(specifier);
    };

    const runner = new Function("exports", "require", "module", "__filename", "__dirname", compiled.outputText);
    runner(routeModule.exports, routeRequire, routeModule, resolve(relativePath), resolve("src/app"));
    return routeModule.exports as Route;
}

const browseRoute = loadRoute("src/app/api/mcp/browse/route.ts");
const ingestRoute = loadRoute("src/app/api/mcp/ingest/route.ts");

after(() => {
    loader._load = originalLoad;
});

test("MCP browse: Google Drive provider returns list of campus documents", async () => {
    const result = await mcp.browseMcpSource({
        provider: "google-drive",
        driveFolderId: "campus-eco",
    });

    assert.equal(result.success, true);
    assert.equal(result.provider, "google-drive");
    assert.ok(result.items.length >= 3);
    assert.ok(result.items.some((item) => item.name.includes("Macroeconomics")));
});

test("MCP browse & fetch: direct public Google Doc URL parses and downloads real content", async () => {
    const docUrl = "https://docs.google.com/document/d/1U7b0_Jx5Gam48fcJ1AtH77einAwP0y1cqhJQuCk9WVw/edit?usp=sharing";
    const result = await mcp.browseMcpSource({
        provider: "google-drive",
        driveFolderId: docUrl,
    });

    assert.equal(result.success, true);
    assert.equal(result.items.length, 1);
    assert.match(result.items[0].name, /CSC\s*106/i);
    assert.match(result.items[0].description ?? "", /David Mgbede/i);

    const fetched = await mcp.fetchMcpResourceContent(result.items[0]);
    assert.match(fetched.text, /CSC 106 Lab Assessment/i);
    assert.match(fetched.text, /d\.mgbede0070@miva\.edu\.ng/i);
});

test("MCP browse: Notion provider returns structured workspace pages", async () => {
    const result = await mcp.browseMcpSource({
        provider: "notion",
        notionPageId: "engineering-wiki",
    });

    assert.equal(result.success, true);
    assert.equal(result.provider, "notion");
    assert.ok(result.items.length >= 2);
    assert.ok(result.items.some((item) => item.name.includes("System_Design")));
});

test("MCP browse: GitHub validation rejects malformed repo paths", async () => {
    const result = await mcp.browseMcpSource({
        provider: "github",
        repo: "invalid-single-slug",
    });

    assert.equal(result.success, false);
    assert.match(result.error ?? "", /Invalid repository format/i);
});

test("MCP browse: Custom MCP server requires a server URL", async () => {
    const result = await mcp.browseMcpSource({
        provider: "custom",
    });

    assert.equal(result.success, false);
    assert.match(result.error ?? "", /Server URL is required/i);
});

test("MCP fetch: extracts text and buffer for documents", async () => {
    const content = await mcp.fetchMcpResourceContent({
        uri: "gdrive://campus-library/Principles_of_Macroeconomics_L2.md",
        name: "Principles_of_Macroeconomics_L2.md",
        mimeType: "text/markdown",
        provider: "google-drive",
    });

    assert.ok(content.text.length > 50);
    assert.ok(content.buffer.length > 50);
    assert.match(content.text, /Macroeconomics/i);
});

test("MCP ingestion: ingests selected documents into SQLite resources with data URI and mcp storage", async () => {
    const testEmail = "learner@example.com";
    const items = [
        {
            uri: "gdrive://campus-library/Principles_of_Macroeconomics_L2.md",
            name: "Principles_of_Macroeconomics_L2.md",
            mimeType: "text/markdown",
            provider: "google-drive" as const,
            size: 42000,
        },
        {
            uri: "notion://workspace/System_Design_Distributed_Caches.md",
            name: "System_Design_Distributed_Caches.md",
            mimeType: "text/markdown",
            provider: "notion" as const,
            size: 18200,
        },
    ];

    const ingestResult = await mcp.ingestMcpResources(testEmail, items);
    assert.equal(ingestResult.success, true);
    assert.equal(ingestResult.importedCount, 2);
    assert.equal(ingestResult.resources.length, 2);

    // Verify stored resources in database
    const userResources = await db.getUserResources(testEmail);
    assert.ok(userResources.length >= 2);

    const macroResource = userResources.find((r) => r.name === "Principles_of_Macroeconomics_L2.md");
    assert.ok(macroResource);
    assert.equal(macroResource?.storage, "mcp");
    assert.ok(macroResource?.url.startsWith("data:text/markdown;base64,"));

    // Verify that getOrProcessResourceDocument parses the base64 data URL correctly
    const processedDoc = await docProcessor.getOrProcessResourceDocument(
        macroResource.url,
        macroResource.name,
        macroResource.type
    );
    assert.ok(processedDoc.text.length > 50);
    assert.ok(processedDoc.chunks.length >= 1);
    assert.match(processedDoc.text, /Macroeconomic Equilibrium/i);
});

test("MCP API security: unauthenticated requests to browse and ingest are rejected with 401", async () => {
    session = null;

    const browseReq = new Request("http://localhost:3000/api/mcp/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "google-drive" }),
    });
    const browseRes = await browseRoute.POST(browseReq);
    assert.equal(browseRes.status, 401);

    const ingestReq = new Request("http://localhost:3000/api/mcp/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ items: [] }),
    });
    const ingestRes = await ingestRoute.POST(ingestReq);
    assert.equal(ingestRes.status, 401);
});

test("MCP API endpoints: authenticated requests browse and ingest successfully", async () => {
    session = { user: { email: "authed-learner@example.com" } };

    // 1. Browse
    const browseReq = new Request("http://localhost:3000/api/mcp/browse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "notion", notionPageId: "team-notes" }),
    });
    const browseRes = await browseRoute.POST(browseReq);
    assert.equal(browseRes.status, 200);
    const browseBody = await browseRes.json();
    assert.equal(browseBody.success, true);
    assert.ok(browseBody.items.length >= 1);

    // 2. Ingest
    const ingestReq = new Request("http://localhost:3000/api/mcp/ingest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            items: [browseBody.items[0]],
        }),
    });
    const ingestRes = await ingestRoute.POST(ingestReq);
    assert.equal(ingestRes.status, 200);
    const ingestBody = await ingestRes.json();
    assert.equal(ingestBody.success, true);
    assert.equal(ingestBody.importedCount, 1);
});
