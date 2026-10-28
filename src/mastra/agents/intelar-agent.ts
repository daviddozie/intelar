import { Agent } from "@mastra/core/agent";
import { Memory } from "@mastra/memory";
import { LibSQLStore } from "@mastra/libsql";
import { resolveAIModel } from "@/lib/ai-model";
import { webSearchTool } from "../tools/web-search-tool";
import { webFetchTool } from "../tools/web-fetch-tool";
import { sourceRerankTool } from "../tools/source-rerank-tool";
import { exportReportTool } from "../tools/export-report-tool";
import { saveDigestTool } from "../tools/save-digest-tool";
import { sendWebhookTool } from "../tools/send-webhook-tool";
import { askFactCheckerTool } from "../tools/ask-fact-checker-tool";
import { askCodeReviewerTool } from "../tools/ask-code-reviewer-tool";
import { factCheckerAgent } from "./fact-checker-agent";
import { codeReviewerAgent } from "./code-reviewer-agent";
import { buildIntelarInstructions } from "./intelar-instructions";
import { getSystemTemporalContext } from "@/lib/temporal";

const tursoUrl = process.env.TURSO_DATABASE_URL?.trim();

const memory = new Memory({
    storage: tursoUrl
        ? new LibSQLStore({
            id: "intelar-memory",
            url: tursoUrl,
            authToken: process.env.TURSO_AUTH_TOKEN,
        })
        : undefined,
    options: {
        lastMessages: 40,
    },
});

export const intelarAgent = new Agent({
    id: "intelar_agent",
    name: "Intelar",
    instructions: ({ requestContext }) => {
        let tz: string | undefined;
        let userName: string | undefined;
        try {
            if (requestContext && typeof requestContext.get === "function") {
                tz = (requestContext.get("timezone") || requestContext.get("userTimezone")) as string | undefined;
                userName = requestContext.get("userName") as string | undefined;
            }
        } catch {
            // fallback to default
        }
        return buildIntelarInstructions(getSystemTemporalContext(tz), userName);
    },
    model: resolveAIModel,
    tools: {
        webSearchTool,
        webFetchTool,
        sourceRerankTool,
        exportReportTool,
        saveDigestTool,
        sendWebhookTool,
        askFactCheckerTool,
        askCodeReviewerTool,
    },
    agents: {
        factCheckerAgent,
        codeReviewerAgent,
    },
    memory,
});
