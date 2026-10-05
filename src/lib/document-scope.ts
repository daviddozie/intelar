import { createHash } from "node:crypto";

// Include the owner so equal client-generated IDs/file names cannot overwrite
// another account's vectors. Older vectors remain searchable by owner metadata.
export function documentChunkId(userEmail: string, conversationId: string, fileName: string, chunkIndex: number) {
    const scope = createHash("sha256").update(JSON.stringify([userEmail, conversationId, fileName])).digest("hex");
    return `${scope}-${chunkIndex}`;
}
