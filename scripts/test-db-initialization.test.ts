import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";
import { createClient, type InStatement } from "@libsql/client";

const requireProject = createRequire(resolve("package.json"));

function loadDatabase(client: ReturnType<typeof createClient>, queries: string[], fail?: (sql: string) => boolean) {
    const compiled = transpileModule(readFileSync(resolve("src/lib/db.ts"), "utf8"), {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022, esModuleInterop: true },
    });
    const routeModule = { exports: {} };
    const routeRequire = (specifier: string) => {
        if (specifier === "@libsql/client") return { createClient: () => ({
            execute: async (statement: InStatement) => {
                const sql = typeof statement === "string" ? statement : statement.sql;
                queries.push(sql);
                if (fail?.(sql)) throw Object.assign(new Error("Test connection timeout"), { code: "ETIMEDOUT" });
                return client.execute(statement);
            },
        }) };
        return requireProject(specifier);
    };
    new Function("require", "module", "exports", compiled.outputText)(routeRequire, routeModule, routeModule.exports);
    return routeModule.exports as typeof import("../src/lib/db");
}

test("concurrent initialization is shared; repeated ownership reads do not rerun migrations", async () => {
    const client = createClient({ url: "file::memory:" });
    const originalUrl = process.env.TURSO_DATABASE_URL;
    process.env.TURSO_DATABASE_URL = "file::memory:";
    try {
        const queries: string[] = [];
        const db = loadDatabase(client, queries);
        await Promise.all(Array.from({ length: 5 }, () => db.initDB()));
        const initializedCount = queries.length;
        assert.equal(queries.filter((sql) => sql.includes("CREATE TABLE IF NOT EXISTS conversations")).length, 1);
        await Promise.all(Array.from({ length: 5 }, () => db.getUserResourceForChat("owner@example.test", "https://example.test/notes")));
        assert.equal(queries.length, initializedCount + 5);
        assert.ok(queries.slice(initializedCount).every((sql) => sql.trim().startsWith("SELECT")));
    } finally {
        client.close();
        if (originalUrl === undefined) delete process.env.TURSO_DATABASE_URL;
        else process.env.TURSO_DATABASE_URL = originalUrl;
    }
});

test("migration timeouts are not swallowed and failed initialization can be retried", async () => {
    const client = createClient({ url: "file::memory:" });
    const originalUrl = process.env.TURSO_DATABASE_URL;
    process.env.TURSO_DATABASE_URL = "file::memory:";
    try {
        let failOnce = true;
        const queries: string[] = [];
        const db = loadDatabase(client, queries, (sql) => {
            if (failOnce && sql.includes("ALTER TABLE resources ADD COLUMN favorite")) {
                failOnce = false;
                return true;
            }
            return false;
        });
        await assert.rejects(db.initDB(), { code: "ETIMEDOUT" });
        await db.initDB();
        assert.equal(queries.filter((sql) => sql.includes("CREATE TABLE IF NOT EXISTS conversations")).length, 2);
        const count = queries.length;
        await db.initDB();
        assert.equal(queries.length, count);
        await client.execute("SELECT * FROM shared_conversations LIMIT 1");
    } finally {
        client.close();
        if (originalUrl === undefined) delete process.env.TURSO_DATABASE_URL;
        else process.env.TURSO_DATABASE_URL = originalUrl;
    }
});

test("legacy tables gain columns without losing existing learner data", async () => {
    const client = createClient({ url: "file::memory:" });
    const originalUrl = process.env.TURSO_DATABASE_URL;
    process.env.TURSO_DATABASE_URL = "file::memory:";
    try {
        await client.execute("CREATE TABLE resources (id TEXT PRIMARY KEY, user_email TEXT, name TEXT, type TEXT, url TEXT, uploaded_at TEXT)");
        await client.execute("INSERT INTO resources VALUES ('old-resource', 'owner@example.test', 'Notes', 'text/plain', 'https://example.test/notes', '2026-10-13')");
        await client.execute("CREATE TABLE conversations (id TEXT PRIMARY KEY, user_email TEXT, title TEXT, messages TEXT, created_at TEXT, updated_at TEXT)");
        await client.execute("INSERT INTO conversations VALUES ('old-chat', 'owner@example.test', 'Original title', '[]', '2026-10-13', '2026-10-13')");
        const db = loadDatabase(client, []);
        await db.initDB();
        const resource = await db.getUserResourceForChat("owner@example.test", "https://example.test/notes");
        assert.equal(resource?.name, "Notes");
        assert.equal(resource?.fileName, "Notes");
        const conversation = await client.execute("SELECT title, pinned FROM conversations WHERE id = 'old-chat'");
        assert.equal(conversation.rows[0].title, "Original title");
        assert.equal(conversation.rows[0].pinned, 0);
    } finally {
        client.close();
        if (originalUrl === undefined) delete process.env.TURSO_DATABASE_URL;
        else process.env.TURSO_DATABASE_URL = originalUrl;
    }
});
