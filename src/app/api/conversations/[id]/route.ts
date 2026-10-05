import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { deleteConversation, pinConversation, getConversation } from "@/lib/db";
import { databaseErrorResponse } from "@/lib/database-errors";
import { deleteConversationChunks } from "@/lib/vector-store";
import { NextRequest } from "next/server";

export async function GET(
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
        const conversation = await getConversation(session.user.email, id);
        if (!conversation) {
            return Response.json({ error: "Conversation not found" }, { status: 404 });
        }
        return Response.json({ conversation });
    } catch (err) {
        console.error("Failed to load conversation:", err);
        return databaseErrorResponse(err) ?? Response.json({ error: "Failed to load conversation" }, { status: 500 });
    }
}

export async function DELETE(
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
        await deleteConversation(session.user.email, id);
        await deleteConversationChunks(session.user.email, id);
        return Response.json({ success: true });
    } catch (err) {
        console.error("Failed to delete conversation:", err);
        return databaseErrorResponse(err) ?? Response.json({ error: "Failed to delete" }, { status: 500 });
    }
}

export async function PATCH(
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
        const { pinned } = await req.json();
        await pinConversation(session.user.email, id, Boolean(pinned));
        return Response.json({ success: true });
    } catch (err) {
        console.error("Failed to pin conversation:", err);
        return databaseErrorResponse(err) ?? Response.json({ error: "Failed to pin" }, { status: 500 });
    }
}

