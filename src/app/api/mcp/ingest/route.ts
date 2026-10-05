import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { ingestMcpResources } from "@/lib/mcp/mcp-client-service";
import type { McpResourceItem, McpSourceConfig } from "@/lib/mcp/mcp-types";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = (await req.json()) as { items: McpResourceItem[]; config?: McpSourceConfig };
        if (!body.items || !Array.isArray(body.items) || body.items.length === 0) {
            return Response.json({ error: "No items provided for ingestion" }, { status: 400 });
        }

        if (body.items.length > 50) {
            return Response.json({ error: "Cannot ingest more than 50 items at once" }, { status: 400 });
        }

        const result = await ingestMcpResources(session.user.email, body.items, body.config);
        if (!result.success) {
            return Response.json({ error: result.error || "Ingestion failed" }, { status: 400 });
        }

        return Response.json(result);
    } catch (err) {
        console.error("MCP ingest error:", err);
        return Response.json(
            { error: err instanceof Error ? err.message : "Failed to ingest MCP resources" },
            { status: 500 }
        );
    }
}
