import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { test } from "node:test";
import { encode } from "next-auth/jwt";
import type { NextAuthOptions } from "next-auth";
import { NextRequest } from "next/server";
import { ModuleKind, ScriptTarget, transpileModule } from "typescript";

const requireFromProject = createRequire(resolve("package.json"));

function loadModule<T>(path: string, env: Record<string, string>, sharedSecret?: unknown): T {
    const compiled = transpileModule(readFileSync(resolve(path), "utf8"), {
        compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022, esModuleInterop: true },
    });
    const loaded = { exports: {} };
    const moduleRequire = (specifier: string) => specifier.endsWith("auth-secret")
        ? sharedSecret
        : requireFromProject(specifier);
    new Function("require", "module", "exports", "process", compiled.outputText)(
        moduleRequire, loaded, loaded.exports, { env }
    );
    return loaded.exports as T;
}

for (const [name, env] of [
    ["local fallback", {}],
    ["AUTH_SECRET", { AUTH_SECRET: "test-alternate-secret" }],
    ["NEXTAUTH_SECRET precedence", { NEXTAUTH_SECRET: "test-primary-secret", AUTH_SECRET: "test-alternate-secret" }],
] as const) {
    test(`saved conversation accepts a session signed with ${name}`, async () => {
        const shared = loadModule("src/lib/auth-secret.ts", env);
        const { authOptions } = loadModule<{ authOptions: NextAuthOptions }>("src/lib/auth.ts", env, shared);
        const { default: proxy } = loadModule<{ default: (request: NextRequest) => Promise<Response> }>("src/proxy.ts", env, shared);
        assert.ok(authOptions.secret);
        const token = await encode({ secret: authOptions.secret, token: { email: "student@example.com" } });
        const request = new NextRequest("http://localhost:3000/c/saved-chat", {
            headers: { cookie: `next-auth.session-token=${token}` },
        });
        // Specify HTTP cookie selection independently of the developer's host environment.
        const previousUrl = process.env.NEXTAUTH_URL;
        process.env.NEXTAUTH_URL = "http://localhost:3000";
        try {
            const response = await proxy(request);
            assert.equal(response.headers.get("location"), null);
            assert.equal(response.headers.get("x-middleware-next"), "1");
            const guestResponse = await proxy(new NextRequest(request.url));
            assert.equal(guestResponse.status, 307);
            assert.equal(guestResponse.headers.get("location"), "http://localhost:3000/");
            const invalidResponse = await proxy(new NextRequest(request.url, {
                headers: { cookie: "next-auth.session-token=invalid" },
            }));
            assert.equal(invalidResponse.status, 307);
        } finally {
            if (previousUrl === undefined) delete process.env.NEXTAUTH_URL;
            else process.env.NEXTAUTH_URL = previousUrl;
        }
    });
}
