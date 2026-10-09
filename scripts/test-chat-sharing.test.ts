import assert from "node:assert/strict";
import { test } from "node:test";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { transpileModule, ModuleKind, ScriptTarget } from "typescript";

process.env.TURSO_DATABASE_URL = "file::memory:";
delete process.env.TURSO_AUTH_TOKEN;

const requireProject = createRequire(resolve("package.json"));
const db = requireProject(resolve("src/lib/db.ts")) as typeof import("../src/lib/db");

let currentSession: { user: { email: string } } | null = null;

function loadRoute(relPath: string) {
  const source = readFileSync(resolve(relPath), "utf8");
  const compiled = transpileModule(source, {
    compilerOptions: { module: ModuleKind.CommonJS, target: ScriptTarget.ES2022 },
  });
  const routeModule = { exports: {} };
  const routeRequire = (specifier: string) => {
    if (specifier === "next-auth") return { getServerSession: async () => currentSession };
    if (specifier === "@/lib/auth") return { authOptions: {} };
    return requireProject(
      specifier.startsWith("@/") ? resolve("src", specifier.slice(2)) : specifier
    );
  };
  new Function("require", "module", "exports", compiled.outputText)(
    routeRequire,
    routeModule,
    routeModule.exports
  );
  return routeModule.exports as any;
}

const shareRoute = loadRoute("src/app/api/conversations/[id]/share/route.ts");
const publicShareRoute = loadRoute("src/app/api/share/[shareId]/route.ts");

test("chat sharing: snapshots are immutable, isolated from original conversation updates, and publicly viewable", async () => {
  const authorEmail = "alice@example.test";
  const convId = "conv-share-test-1";

  // 1. Create original conversation with 2 messages
  const initialMessages = [
    { id: "m1", role: "user", content: "Explain quantum teleportation simply.", createdAt: new Date().toISOString() },
    { id: "m2", role: "assistant", content: "Quantum teleportation is a technique...", createdAt: new Date().toISOString() },
  ];

  await db.saveConversation(authorEmail, convId, "Quantum Teleportation", initialMessages);

  const savedConv = await db.getConversation(authorEmail, convId);
  assert.ok(savedConv, "Original conversation should exist");
  assert.equal(savedConv.messages.length, 2);

  // 2. Create shared snapshot
  const shareId = await db.createSharedConversationSnapshot(
    authorEmail,
    convId,
    savedConv.title,
    savedConv.messages
  );
  assert.ok(shareId, "Share ID should be generated");
  assert.equal(typeof shareId, "string");

  // 3. Retrieve snapshot publicly without auth
  const snapshot = await db.getSharedConversationSnapshot(shareId);
  assert.ok(snapshot, "Snapshot must be retrievable");
  assert.equal(snapshot.id, shareId);
  assert.equal(snapshot.conversationId, convId);
  assert.equal(snapshot.title, "Quantum Teleportation");
  assert.equal(snapshot.messages.length, 2);
  assert.equal(snapshot.messages[0].content, "Explain quantum teleportation simply.");
  assert.equal(snapshot.viewCount, 1, "View count should be 1 on first get");

  // 4. Verify IMMUTABILITY: Add new messages to original conversation
  const updatedMessages = [
    ...initialMessages,
    { id: "m3", role: "user", content: "What about entanglement?", createdAt: new Date().toISOString() },
    { id: "m4", role: "assistant", content: "Entanglement is the underlying phenomenon...", createdAt: new Date().toISOString() },
  ];
  await db.saveConversation(authorEmail, convId, "Quantum Teleportation - Continued", updatedMessages);

  // Confirm original conversation has 4 messages and updated title
  const currentConv = await db.getConversation(authorEmail, convId);
  assert.ok(currentConv);
  assert.equal(currentConv.messages.length, 4);
  assert.equal(currentConv.title, "Quantum Teleportation - Continued");

  // Retrieve the snapshot again: MUST STILL HAVE EXACTLY 2 MESSAGES and original title!
  const snapshotAfterUpdate = await db.getSharedConversationSnapshot(shareId);
  assert.ok(snapshotAfterUpdate);
  assert.equal(snapshotAfterUpdate.messages.length, 2, "Snapshot must remain frozen and not reflect new messages!");
  assert.equal(snapshotAfterUpdate.title, "Quantum Teleportation", "Snapshot title must not change!");
  assert.equal(snapshotAfterUpdate.viewCount, 2, "View count should increment to 2");

  // 5. Verify DELETION ISOLATION: Deleting the original conversation does not delete the shared snapshot
  await db.deleteConversation(authorEmail, convId);
  const deletedConv = await db.getConversation(authorEmail, convId);
  assert.equal(deletedConv, null, "Original conversation is deleted");

  const snapshotAfterConvDelete = await db.getSharedConversationSnapshot(shareId);
  assert.ok(snapshotAfterConvDelete, "Snapshot should persist even if original conversation is deleted");
  assert.equal(snapshotAfterConvDelete.messages.length, 2);

  // 6. Verify AUTHORIZATION & REVOCATION
  const bobEmail = "bob@example.test";
  const bobDeleteResult = await db.deleteSharedConversationSnapshot(bobEmail, shareId);
  assert.equal(bobDeleteResult, false, "Unauthorized user cannot delete another user's snapshot");

  const aliceDeleteResult = await db.deleteSharedConversationSnapshot(authorEmail, shareId);
  assert.equal(aliceDeleteResult, true, "Original author can revoke/delete their snapshot");

  const revokedSnapshot = await db.getSharedConversationSnapshot(shareId);
  assert.equal(revokedSnapshot, null, "Revoked snapshot should no longer be found");
});

test("chat sharing HTTP API routes: enforces authorization, creates immutable links, handles public requests", async () => {
  const userEmail = "author@domain.test";
  const convId = "api-test-conv-1";
  const messages = [
    { id: "m1", role: "user", content: "Hello AI", createdAt: new Date().toISOString() },
    { id: "m2", role: "assistant", content: "Hello User!", createdAt: new Date().toISOString() },
  ];
  await db.saveConversation(userEmail, convId, "API Sharing Chat", messages);

  // 1. POST /api/conversations/[id]/share without session -> 401 Unauthorized
  currentSession = null;
  const unauthRes = await shareRoute.POST(
    new Request(`http://localhost/api/conversations/${convId}/share`, { method: "POST" }),
    { params: Promise.resolve({ id: convId }) }
  );
  assert.equal(unauthRes.status, 401);

  // 2. POST /api/conversations/[id]/share with session for a non-existent conversation -> 404
  currentSession = { user: { email: userEmail } };
  const notFoundRes = await shareRoute.POST(
    new Request(`http://localhost/api/conversations/non-existent/share`, { method: "POST" }),
    { params: Promise.resolve({ id: "non-existent" }) }
  );
  assert.equal(notFoundRes.status, 404);

  // 3. POST /api/conversations/[id]/share with authorized session -> 200 with shareId & url
  const successRes = await shareRoute.POST(
    new Request(`http://localhost/api/conversations/${convId}/share`, { method: "POST" }),
    { params: Promise.resolve({ id: convId }) }
  );
  assert.equal(successRes.status, 200);
  const successData = await successRes.json();
  assert.ok(successData.shareId);
  assert.equal(successData.url, `/share/${successData.shareId}`);
  assert.equal(successData.title, "API Sharing Chat");

  const shareId = successData.shareId;

  // 4. GET /api/share/[shareId] without session -> 200 Public access
  currentSession = null;
  const getRes = await publicShareRoute.GET(
    new Request(`http://localhost/api/share/${shareId}`),
    { params: Promise.resolve({ shareId }) }
  );
  assert.equal(getRes.status, 200);
  const getData = await getRes.json();
  assert.equal(getData.id, shareId);
  assert.equal(getData.messages.length, 2);
  assert.equal(getData.title, "API Sharing Chat");

  // 5. DELETE /api/share/[shareId] as another user -> 404 Unauthorized / Not found
  currentSession = { user: { email: "attacker@domain.test" } };
  const deleteForbiddenRes = await publicShareRoute.DELETE(
    new Request(`http://localhost/api/share/${shareId}`, { method: "DELETE" }),
    { params: Promise.resolve({ shareId }) }
  );
  assert.equal(deleteForbiddenRes.status, 404);

  // 6. DELETE /api/share/[shareId] as author -> 200 Success
  currentSession = { user: { email: userEmail } };
  const deleteOkRes = await publicShareRoute.DELETE(
    new Request(`http://localhost/api/share/${shareId}`, { method: "DELETE" }),
    { params: Promise.resolve({ shareId }) }
  );
  assert.equal(deleteOkRes.status, 200);
  const deleteData = await deleteOkRes.json();
  assert.equal(deleteData.success, true);

  // 7. GET /api/share/[shareId] after deletion -> 404
  const getAfterDeleteRes = await publicShareRoute.GET(
    new Request(`http://localhost/api/share/${shareId}`),
    { params: Promise.resolve({ shareId }) }
  );
  assert.equal(getAfterDeleteRes.status, 404);
});
