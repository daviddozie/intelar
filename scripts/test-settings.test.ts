import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

process.env.TURSO_DATABASE_URL = "file::memory:";
delete process.env.TURSO_AUTH_TOKEN;

const requireProject = createRequire(resolve("package.json"));
const settings = requireProject(
  resolve("src/lib/settings-db.ts"),
) as typeof import("../src/lib/settings-db");
const db = requireProject(
  resolve("src/lib/db.ts"),
) as typeof import("../src/lib/db");
let session: { user: { email: string } } | null = null;
const source = readFileSync(resolve("src/app/api/settings/route.ts"), "utf8");
const compiled = transpileModule(source, {
  compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
});
const routeModule = { exports: {} };
const routeRequire = (specifier: string) => {
  if (specifier === "next-auth")
    return { getServerSession: async () => session };
  if (specifier === "@/lib/auth") return { authOptions: {} };
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
  GET: () => Promise<Response>;
  PATCH: (request: Request) => Promise<Response>;
};
const patch = (body: unknown) =>
  route.PATCH(
    new Request("http://localhost/api/settings", {
      method: "PATCH",
      body: JSON.stringify(body),
    }),
  );

test("settings enforce authentication, validation, partial updates, and account isolation", async () => {
  assert.equal((await route.GET()).status, 401);
  assert.equal((await patch({ theme: "dark" })).status, 401);
  session = { user: { email: "first@example.test" } };
  assert.deepEqual(await (await route.GET()).json(), { preferences: null });
  for (const body of [
    {},
    { theme: "invalid" },
    { motion: "invalid" },
    { user_email: "other@example.test", theme: "dark" },
    null,
    [],
  ]) {
    assert.equal((await patch(body)).status, 400);
  }
  assert.equal(
    (
      await route.PATCH(
        new Request("http://localhost/api/settings", {
          method: "PATCH",
          body: "{",
        }),
      )
    ).status,
    400,
  );
  const first = await patch({ theme: "dark" });
  assert.equal(first.status, 200);
  assert.deepEqual(await first.json(), {
    preferences: { theme: "dark", motion: "system" },
  });
  await patch({ motion: "reduced" });
  assert.deepEqual(await settings.getUserSettings("first@example.test"), {
    theme: "dark",
    motion: "reduced",
  });
  session = { user: { email: "second@example.test" } };
  assert.deepEqual(await (await route.GET()).json(), { preferences: null });
  await patch({ theme: "light", motion: "full" });
  assert.deepEqual(await settings.getUserSettings("second@example.test"), {
    theme: "light",
    motion: "full",
  });
  assert.deepEqual(await settings.getUserSettings("first@example.test"), {
    theme: "dark",
    motion: "reduced",
  });
  await db.getDB().execute("CREATE TABLE preserved_data (value TEXT)");
  await db.getDB().execute("INSERT INTO preserved_data VALUES ('existing')");
  await settings.getUserSettings("first@example.test");
  assert.equal(
    (await db.getDB().execute("SELECT value FROM preserved_data")).rows[0]
      .value,
    "existing",
  );
  session = { user: { email: "first@example.test" } };
  assert.deepEqual(await (await route.GET()).json(), {
    preferences: { theme: "dark", motion: "reduced" },
  });
  assert.equal((await route.GET()).headers.get("Cache-Control"), "no-store");
  const originalExecute = db.getDB().execute.bind(db.getDB());
  db.getDB().execute = async () => {
    throw new Error("Temporary database failure");
  };
  assert.equal((await route.GET()).status, 500);
  assert.equal((await patch({ theme: "system" })).status, 500);
  db.getDB().execute = originalExecute;
  db.getDB().close();
});

test("browser preferences isolate guests and accounts and handle blocked storage", () => {
  const storage = requireProject(
    resolve("src/lib/preferences-storage.ts"),
  ) as typeof import("../src/lib/preferences-storage");
  const values = new Map<string, string>();
  const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
    },
  });
  try {
    values.set("theme", "dark");
    assert.equal(storage.readPreferencesCache(null).preferences.theme, "dark");
    storage.writePreferencesCache(null, {
      preferences: { theme: "light", motion: "reduced" },
      pending: false,
    });
    assert.deepEqual(
      storage.readPreferencesCache("new@example.test").preferences,
      { theme: "light", motion: "system" },
    );
    storage.writePreferencesCache("first@example.test", {
      preferences: { theme: "dark", motion: "full" },
      pending: true,
    });
    storage.writePreferencesCache("second@example.test", {
      preferences: { theme: "system", motion: "system" },
      pending: false,
    });
    assert.equal(
      storage.readPreferencesCache("first@example.test").pending,
      true,
    );
    assert.equal(
      storage.readPreferencesCache("second@example.test").preferences.theme,
      "system",
    );
    assert.equal(storage.readPreferencesCache(null).preferences.theme, "light");
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get: () => {
        throw new Error("Storage blocked");
      },
    });
    assert.equal(storage.readPreferencesCache(null).storageAvailable, false);
    assert.equal(
      storage.writePreferencesCache(null, {
        preferences: { theme: "dark", motion: "reduced" },
        pending: false,
      }),
      false,
    );
  } finally {
    if (previous) Object.defineProperty(globalThis, "localStorage", previous);
    else Reflect.deleteProperty(globalThis, "localStorage");
  }
});
