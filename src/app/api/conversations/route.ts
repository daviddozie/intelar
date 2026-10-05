import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ConversationAccessError, getUserConversations, saveConversation } from "@/lib/db";
import { databaseErrorResponse } from "@/lib/database-errors";
import { NextRequest } from "next/server";

export async function GET() {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ conversations: [] });
    }

    try {
        const conversations = await getUserConversations(session.user.email);
        return Response.json({ conversations });
    } catch (err) {
        console.error("Failed to load conversations:", err);
        return databaseErrorResponse(err) ?? Response.json({ error: "Failed to load conversations" }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ success: true, guest: true });
    }

    try {
        const { id, title, messages } = await req.json();
        if (typeof id !== "string" || !id.trim() || id.length > 200 ||
            typeof title !== "string" || !Array.isArray(messages)) {
            return Response.json({ error: "A valid id, title, and messages array are required" }, { status: 400 });
        }
        await saveConversation(session.user.email, id, title, messages);
        return Response.json({ success: true });
    } catch (err) {
        if (err instanceof ConversationAccessError) {
            return Response.json({ error: "Conversation not found" }, { status: 404 });
        }
        if (err instanceof SyntaxError) {
            return Response.json({ error: "Invalid JSON body" }, { status: 400 });
        }
        console.error("Failed to save conversation:", err);
        return databaseErrorResponse(err) ?? Response.json({ error: "Failed to save conversation" }, { status: 500 });
    }
}
