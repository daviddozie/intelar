import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { browseMcpSource } from "@/lib/mcp/mcp-client-service";
import type { McpSourceConfig } from "@/lib/mcp/mcp-types";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
        return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const body = (await req.json()) as McpSourceConfig;
        if (!body.provider) {
            return Response.json({ error: "Provider is required (github, google-drive, notion, custom)" }, { status: 400 });
        }

        const result = await browseMcpSource(body);
        if (!result.success) {
            return Response.json({ error: result.error || "Failed to browse MCP source" }, { status: 400 });
        }

        return Response.json(result);
    } catch (err) {
        console.error("MCP browse error:", err);
        return Response.json(
            { error: err instanceof Error ? err.message : "Failed to browse MCP source" },
            { status: 500 }
        );
    }
}
