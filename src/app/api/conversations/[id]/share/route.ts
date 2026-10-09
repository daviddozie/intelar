import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getConversation, createSharedConversationSnapshot } from "@/lib/db";
import { databaseErrorResponse } from "@/lib/database-errors";
import { NextRequest } from "next/server";

export async function POST(
    req: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { id } = await params;
        if (!id || typeof id !== "string" || !id.trim() || id.length > 200) {
            return Response.json({ error: "Invalid conversation id" }, { status: 400 });
        }

        let conversation = await getConversation(session.user.email, id);
        if (!conversation) {
            try {
                const body = await req.json();
                if (body && Array.isArray(body.messages) && body.messages.length > 0) {
                    const { saveConversation } = await import("@/lib/db");
                    await saveConversation(
                        session.user.email,
                        id,
                        body.title || "Shared Chat",
                        body.messages
                    );
                    conversation = await getConversation(session.user.email, id);
                }
            } catch {
                // Ignore parse errors, will check conversation below
            }
        }
        if (!conversation) {
            return Response.json({ error: "Conversation not found" }, { status: 404 });
        }

        if (!Array.isArray(conversation.messages) || conversation.messages.length === 0) {
            return Response.json({ error: "Cannot share an empty conversation" }, { status: 400 });
        }

        const shareId = await createSharedConversationSnapshot(
            session.user.email,
            conversation.id,
            conversation.title || "Shared Chat",
            conversation.messages
        );

        return Response.json({
            shareId,
            url: `/share/${shareId}`,
            title: conversation.title,
            createdAt: new Date().toISOString(),
        });
    } catch (err) {
        console.error("Failed to create shared conversation snapshot:", err);
        return databaseErrorResponse(err) ?? Response.json(
            { error: "Failed to create share link" },
            { status: 500 }
        );
    }
}
