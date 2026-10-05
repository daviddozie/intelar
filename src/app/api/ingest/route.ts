import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { processDocument } from "@/lib/document-processor";
import { processImage } from "@/lib/image-processor";
import { storeDocumentChunks, deleteFileChunks } from "@/lib/vector-store";
import { NextRequest } from "next/server";
import { assertConversationAccess, ConversationAccessError } from "@/lib/db";
import { databaseErrorResponse } from "@/lib/database-errors";
import { documentChunkId } from "@/lib/document-scope";

export const runtime = "nodejs";
export const maxDuration = 60;

async function mapWithConcurrency<T, R>(items: T[], limit: number, work: (item: T) => Promise<R>) {
    const results = new Array<R>(items.length);
    let nextIndex = 0;
    const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
        while (nextIndex < items.length) {
            const index = nextIndex++;
            results[index] = await work(items[index]);
        }
    });
    await Promise.all(workers);
    return results;
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const formData = await req.formData();
        const files = formData.getAll("files") as File[];
        const conversationId = formData.get("conversationId") as string;

        if (!files.length) {
            return Response.json({ error: "No files provided" }, { status: 400 });
        }
        if (typeof conversationId !== "string" || !conversationId.trim() || conversationId.length > 200) {
            return Response.json({ error: "conversationId required" }, { status: 400 });
        }
        await assertConversationAccess(session.user.email, conversationId);

        const results = await mapWithConcurrency(files, 2, async (file) => {
                const buffer = Buffer.from(await file.arrayBuffer());
                const processed = file.type.startsWith("image/")
                    ? await processImage(buffer, file.type)
                    : await processDocument(buffer, file.name, file.type);

                // Clean up previous vector chunks for this file in this conversation first to prevent duplicates/orphans
                await deleteFileChunks(conversationId, file.name, session.user!.email!);

                // Build chunk objects for Pinecone with deterministic IDs
                const chunks = processed.chunks.map((text, i) => ({
                    id: documentChunkId(session.user!.email!, conversationId, file.name, i),
                    text,
                    fileName: file.name,
                    fileType: file.type,
                    userEmail: session.user!.email!,
                    conversationId,
                    chunkIndex: i,
                }));

                if (chunks.length > 0) await storeDocumentChunks(chunks);

                return {
                    name: file.name,
                    chunks: chunks.length,
                    skipped: false,
                    kind: file.type.startsWith("image/") ? "image" : "document",
                };
        });

        return Response.json({ success: true, files: results });
    } catch (err) {
        if (err instanceof ConversationAccessError) {
            return Response.json({ error: "Conversation not found" }, { status: 404 });
        }
        const unavailable = databaseErrorResponse(err);
        if (unavailable) return unavailable;
        console.error("Ingest error:", err);
        return Response.json(
            { error: err instanceof Error ? err.message : "Ingest failed" },
            { status: 500 }
        );
    }
}
