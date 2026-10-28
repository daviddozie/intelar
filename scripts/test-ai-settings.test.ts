import assert from "node:assert/strict";
import { after, test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

process.env.TURSO_DATABASE_URL = "file::memory:";
process.env.AI_KEY_ENCRYPTION_SECRET =
  "test-encryption-secret-32-characters-minimum";
delete process.env.TURSO_AUTH_TOKEN;
const requireProject = createRequire(resolve("package.json"));
const store = requireProject(
  resolve("src/lib/ai-settings-db.ts"),
) as typeof import("../src/lib/ai-settings-db");
const db = requireProject(
  resolve("src/lib/db.ts"),
) as typeof import("../src/lib/db");
const { runWithAIModel, resolveAIModel } = requireProject(
  resolve("src/lib/ai-model.ts"),
) as typeof import("../src/lib/ai-model");
const { aiProviders } = requireProject(
  resolve("src/lib/ai-providers.ts"),
) as typeof import("../src/lib/ai-providers");
let session: { user: { email: string } } | null = null;
const compiled = transpileModule(
  readFileSync(resolve("src/app/api/ai-settings/route.ts"), "utf8"),
  {
    compilerOptions: {
      module: ModuleKind.CommonJS,
      target: ScriptTarget.ES2022,
    },
  },
);
const routeModule = { exports: {} };
const routeRequire = (specifier: string) => {
  if (specifier === "next-auth")
    return { getServerSession: async () => session };
  if (specifier === "@/lib/auth") return { authOptions: {} };
  if (specifier === "@/lib/ai-access")
    return {
      getAISubject: async (owner?: string) =>
        owner ? `user:${owner}` : "guest:test",
    };
  return requireProject(
    specifier.startsWith("@/") ? resolve("src", specifier.slice(2)) : specifier,
  );
};
new Function("require", "module", "exports", compiled.outputText)(
  routeRequire,
  routeModule,
  routeModule.exports,
);
const route = routeModule.exports as {
  GET(): Promise<Response>;
  PUT(request: Request): Promise<Response>;
  DELETE(): Promise<Response>;
};
const put = (body: unknown) =>
  route.PUT(
    new Request("http://localhost/api/ai-settings", {
      method: "PUT",
      body: JSON.stringify(body),
    }),
  );

test("provider settings enforce ownership, protect secrets, and preserve allowance on removal", async () => {
  assert.equal(
    (await put({ provider: "openai", model: "test", apiKey: "secret" })).status,
    401,
  );
  assert.equal((await route.DELETE()).status, 401);
  assert.equal((await (await route.GET()).json()).remaining, 3);
  session = { user: { email: "first@example.test" } };
  for (const body of [
    {},
    null,
    { provider: "other", model: "test", apiKey: "secret" },
    { provider: "openai", model: "https://evil.test/?bad" },
    { provider: "openai", model: "test", apiKey: "has spaces" },
    {
      provider: "openai",
      model: "test",
      apiKey: "secret",
      user_email: "other",
    },
  ])
    assert.equal((await put(body)).status, 400);
  assert.equal(
    (
      await route.PUT(
        new Request("http://localhost/api/ai-settings", {
          method: "PUT",
          body: "{",
        }),
      )
    ).status,
    400,
  );
  assert.equal((await put({ provider: "openai", model: "test" })).status, 400);
  const result = await put({
    provider: "openai",
    model: "test-model",
    apiKey: "private-test-key",
  });
  assert.equal(result.status, 200);
  assert.equal((await result.text()).includes("private-test-key"), false);
  const config = await store.getAIConfiguration(session.user.email);
  assert.ok(config);
  assert.equal(config.encryptedKey.includes("private-test-key"), false);
  assert.equal(
    store.decryptAPIKey(config.encryptedKey, session.user.email),
    "private-test-key",
  );
  assert.throws(() =>
    store.decryptAPIKey(config.encryptedKey, "other@example.test"),
  );
  assert.throws(() =>
    store.decryptAPIKey(
      config.encryptedKey.slice(0, -4) + "AAAA",
      session!.user.email,
    ),
  );
  assert.equal(
    (await put({ provider: "openai", model: "different-model" })).status,
    200,
  );
  assert.equal(
    (await put({ provider: "anthropic", model: "test" })).status,
    400,
  );
  session = { user: { email: "second@example.test" } };
  assert.equal((await (await route.GET()).json()).configuration, null);
  await put({ provider: "mistral", model: "test", apiKey: "second-key" });
  await route.DELETE();
  assert.ok(await store.getAIConfiguration("first@example.test"));
  session = { user: { email: "first@example.test" } };
  await store.reserveFreePrompt(`user:${session.user.email}`);
  await route.DELETE();
  assert.equal((await (await route.GET()).json()).remaining, 2);
  assert.equal(await store.getAIConfiguration(session.user.email), null);
});

test("the database atomically admits exactly three concurrent free prompts and persists exhaustion", async () => {
  await store.initializeAISettings();
  const results = await Promise.allSettled(
    Array.from({ length: 12 }, () =>
      store.reserveFreePrompt("user:concurrent"),
    ),
  );
  assert.equal(
    results.filter((result) => result.status === "fulfilled").length,
    3,
  );
  assert.equal(
    results.filter(
      (result) =>
        result.status === "rejected" &&
        result.reason.code === "AI_CONFIGURATION_REQUIRED",
    ).length,
    9,
  );
  assert.equal((await store.getAIStatus("user:concurrent")).remaining, 0);
  await assert.rejects(() => store.reserveFreePrompt("user:concurrent"), {
    code: "AI_CONFIGURATION_REQUIRED",
  });
  assert.equal((await store.getAIStatus("user:other")).remaining, 3);
});

test("simultaneous provider scopes never exchange account keys or mutate server defaults", async () => {
  const before = process.env.OPENROUTER_API_KEY;
  await Promise.all(
    aiProviders.map((provider, index) =>
      runWithAIModel(
        {
          provider: provider.id,
          model: `model-${index}`,
          apiKey: `key-${index}`,
        },
        async () => {
          await new Promise((done) => setTimeout(done, 10 - index));
          assert.deepEqual(resolveAIModel(), {
            providerId: provider.id,
            modelId: `model-${index}`,
            apiKey: `key-${index}`,
          });
        },
      ),
    ),
  );
  assert.equal(process.env.OPENROUTER_API_KEY, before);
  assert.equal(resolveAIModel().providerId, "openrouter");
});

after(() => db.getDB().close());
