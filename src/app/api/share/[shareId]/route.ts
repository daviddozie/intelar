import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getSharedConversationSnapshot, deleteSharedConversationSnapshot } from "@/lib/db";
import { databaseErrorResponse } from "@/lib/database-errors";
import { NextRequest } from "next/server";

export async function GET(
    _req: NextRequest,
    { params }: { params: Promise<{ shareId: string }> }
) {
    try {
        const { shareId } = await params;
        if (!shareId || typeof shareId !== "string" || !shareId.trim() || shareId.length > 100) {
            return Response.json({ error: "Invalid share identifier" }, { status: 400 });
        }

        const snapshot = await getSharedConversationSnapshot(shareId);
        if (!snapshot) {
            return Response.json({ error: "Shared conversation not found" }, { status: 404 });
        }

        return Response.json({
            id: snapshot.id,
            conversationId: snapshot.conversationId,
            title: snapshot.title,
            messages: snapshot.messages,
            createdAt: snapshot.createdAt,
            viewCount: snapshot.viewCount,
        });
    } catch (err) {
        console.error("Failed to load shared conversation snapshot:", err);
        return databaseErrorResponse(err) ?? Response.json(
            { error: "Failed to load shared conversation" },
            { status: 500 }
        );
    }
}

export async function DELETE(
    _req: NextRequest,
    { params }: { params: Promise<{ shareId: string }> }
) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const { shareId } = await params;
        if (!shareId || typeof shareId !== "string" || !shareId.trim() || shareId.length > 100) {
            return Response.json({ error: "Invalid share identifier" }, { status: 400 });
        }

        const success = await deleteSharedConversationSnapshot(session.user.email, shareId);
        if (!success) {
            return Response.json({ error: "Shared link not found or unauthorized" }, { status: 404 });
        }

        return Response.json({ success: true });
    } catch (err) {
        console.error("Failed to delete shared conversation snapshot:", err);
        return databaseErrorResponse(err) ?? Response.json(
            { error: "Failed to delete shared link" },
            { status: 500 }
        );
    }
}
