import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";
import { saveUserResources } from "@/lib/db";
import { processDocument } from "@/lib/document-processor";
import { storeDocumentChunks } from "@/lib/vector-store";
import { documentChunkId } from "@/lib/document-scope";
import type { McpBrowseResult, McpIngestItemResult, McpIngestResult, McpResourceItem, McpSourceConfig } from "./mcp-types";

// Supported document extensions for auto-filtering
const DOCUMENT_EXTENSIONS = [".md", ".markdown", ".txt", ".pdf", ".csv", ".docx", ".json"];

function getMimeType(fileName: string): string {
    const ext = fileName.toLowerCase().slice(fileName.lastIndexOf("."));
    switch (ext) {
        case ".md":
        case ".markdown":
            return "text/markdown";
        case ".txt":
            return "text/plain";
        case ".pdf":
            return "application/pdf";
        case ".csv":
            return "text/csv";
        case ".docx":
            return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
        case ".json":
            return "application/json";
        default:
            return "application/octet-stream";
    }
}

/**
 * Browse resources from a chosen MCP source (GitHub, Google Drive, Notion, or Custom MCP Server)
 */
export async function browseMcpSource(config: McpSourceConfig): Promise<McpBrowseResult> {
    const { provider } = config;

    switch (provider) {
        case "github":
            return browseGitHubSource(config);
        case "google-drive":
            return browseGoogleDriveSource(config);
        case "notion":
            return browseNotionSource(config);
        case "custom":
            return browseCustomMcpServer(config);
        default:
            return {
                success: false,
                provider,
                sourceName: "Unknown",
                items: [],
                error: `Unsupported MCP provider: ${provider}`,
            };
    }
}

/**
 * GitHub MCP Provider: Lists documents from a public or private GitHub repository
 */
async function browseGitHubSource(config: McpSourceConfig): Promise<McpBrowseResult> {
    const repo = (config.repo || "mastra-ai/mastra").trim();
    const branch = (config.branch || "main").trim();
    const filterPath = (config.path || "").trim().replace(/^\/|\/$/g, "");

    const parts = repo.split("/");
    if (parts.length !== 2 || !parts[0] || !parts[1]) {
        return {
            success: false,
            provider: "github",
            sourceName: repo,
            items: [],
            error: "Invalid repository format. Please specify 'owner/repo' (e.g. 'mastra-ai/mastra').",
        };
    }

    try {
        const headers: Record<string, string> = {
            "Accept": "application/vnd.github.v3+json",
            "User-Agent": "Intelar-MCP-Client/1.0",
        };
        if (config.githubToken) {
            headers["Authorization"] = `Bearer ${config.githubToken}`;
        }

        // Fetch repository tree recursively
        const apiUrl = `https://api.github.com/repos/${repo}/git/trees/${branch}?recursive=1`;
        const res = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(15_000) });

        if (!res.ok) {
            if (res.status === 404) {
                return {
                    success: false,
                    provider: "github",
                    sourceName: repo,
                    items: [],
                    error: `Repository '${repo}' or branch '${branch}' not found.`,
                };
            }
            if (res.status === 403) {
                return {
                    success: false,
                    provider: "github",
                    sourceName: repo,
                    items: [],
                    error: "GitHub API rate limit exceeded. Please provide a GitHub Personal Access Token.",
                };
            }
            return {
                success: false,
                provider: "github",
                sourceName: repo,
                items: [],
                error: `GitHub error (${res.status}): ${res.statusText}`,
            };
        }

        const data = await res.json();
        const tree = (data.tree || []) as Array<{ path: string; mode: string; type: string; size?: number; url: string }>;

        const docItems: McpResourceItem[] = [];

        for (const entry of tree) {
            if (entry.type !== "blob") continue;
            if (filterPath && !entry.path.startsWith(filterPath)) continue;

            const isDoc = DOCUMENT_EXTENSIONS.some((ext) => entry.path.toLowerCase().endsWith(ext));
            if (!isDoc) continue;

            const fileName = entry.path.split("/").pop() || entry.path;
            const rawUrl = `https://raw.githubusercontent.com/${repo}/${branch}/${entry.path}`;

            docItems.push({
                uri: rawUrl,
                name: fileName,
                mimeType: getMimeType(fileName),
                size: entry.size || 0,
                provider: "github",
                description: `${repo}/${entry.path}`,
            });
        }

        return {
            success: true,
            provider: "github",
            sourceName: repo,
            items: docItems.slice(0, 100), // Cap at 100 files for high responsiveness
        };
    } catch (err) {
        return {
            success: false,
            provider: "github",
            sourceName: repo,
            items: [],
            error: err instanceof Error ? err.message : "Failed to browse GitHub repository",
        };
    }
}

/**
 * Parse Google Drive input into structured resource information
 */
export function parseGoogleDriveInput(input: string): {
    type: "document" | "spreadsheet" | "presentation" | "drive-file";
    id: string;
    exportUrl: string;
    defaultMimeType: string;
    defaultExtension: string;
} | null {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // 1. Google Docs URL
    const docMatch = trimmed.match(/docs\.google\.com\/document\/d\/([a-zA-Z0-9_-]+)/i);
    if (docMatch) {
        return {
            type: "document",
            id: docMatch[1],
            exportUrl: `https://docs.google.com/document/d/${docMatch[1]}/export?format=txt`,
            defaultMimeType: "text/markdown",
            defaultExtension: ".md",
        };
    }

    // 2. Google Spreadsheets URL
    const sheetMatch = trimmed.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/i);
    if (sheetMatch) {
        return {
            type: "spreadsheet",
            id: sheetMatch[1],
            exportUrl: `https://docs.google.com/spreadsheets/d/${sheetMatch[1]}/export?format=csv`,
            defaultMimeType: "text/csv",
            defaultExtension: ".csv",
        };
    }

    // 3. Google Presentations / Slides URL
    const presMatch = trimmed.match(/docs\.google\.com\/presentation\/d\/([a-zA-Z0-9_-]+)/i);
    if (presMatch) {
        return {
            type: "presentation",
            id: presMatch[1],
            exportUrl: `https://docs.google.com/presentation/d/${presMatch[1]}/export/txt`,
            defaultMimeType: "text/plain",
            defaultExtension: ".txt",
        };
    }

    // 4. Drive file URL (drive.google.com/file/d/...)
    const fileMatch = trimmed.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/i);
    if (fileMatch) {
        return {
            type: "drive-file",
            id: fileMatch[1],
            exportUrl: `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`,
            defaultMimeType: "text/plain",
            defaultExtension: ".txt",
        };
    }

    return null;
}

/**
 * Fetch and extract metadata for a public Google Doc, Sheet, or Drive file
 */
async function fetchGoogleDocOrFile(
    parsed: NonNullable<ReturnType<typeof parseGoogleDriveInput>>
): Promise<McpResourceItem> {
    const res = await fetch(parsed.exportUrl, {
        redirect: "follow",
        signal: AbortSignal.timeout(15_000),
        headers: {
            "User-Agent": "Mozilla/5.0 (compatible; IntelarResourceBot/1.0)",
        },
    });

    if (!res.ok || res.url.includes("accounts.google.com")) {
        throw new Error(
            "Document is not accessible. Please ensure the Google document's General Access is set to 'Anyone with the link can view'."
        );
    }

    const cd = res.headers.get("content-disposition") || "";
    let docName = "";
    const matchUtf8 = cd.match(/filename\*=UTF-8''([^;\r\n]+)/i);
    const matchNormal = cd.match(/filename="([^"]+)"/i);
    if (matchUtf8) {
        docName = decodeURIComponent(matchUtf8[1].trim().replace(/^['"]|['"]$/g, ""));
    } else if (matchNormal) {
        docName = matchNormal[1].trim();
    }

    const buffer = Buffer.from(await res.arrayBuffer());
    const text = buffer.toString("utf-8");

    if (text.includes("accounts.google.com") || (text.includes("<html") && text.includes("Sign in"))) {
        throw new Error(
            "Document requires sign-in. Please ensure General Access is set to 'Anyone with the link can view'."
        );
    }

    if (!docName) {
        const firstLine = text.split("\n").map((l) => l.trim()).find((l) => l.length > 0);
        docName = firstLine
            ? `${firstLine.slice(0, 40).replace(/[^\w\s-]/g, "")}${parsed.defaultExtension}`
            : `Google_Doc_${parsed.id.slice(0, 8)}${parsed.defaultExtension}`;
    } else if (parsed.type === "document" && docName.endsWith(".txt")) {
        docName = docName.replace(/\.txt$/i, ".md");
    }

    const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
    const description = lines.slice(0, 3).join(" • ").slice(0, 160) || "Imported from Google Drive";

    return {
        uri: parsed.exportUrl,
        name: docName,
        mimeType: parsed.defaultMimeType,
        size: buffer.length,
        provider: "google-drive",
        description,
    };
}

/**
 * Google Drive MCP Provider
 */
async function browseGoogleDriveSource(config: McpSourceConfig): Promise<McpBrowseResult> {
    // 1. If a custom Google Drive MCP server URL is supplied, query via MCP protocol
    if (config.serverUrl) {
        return browseCustomMcpServer({ ...config, provider: "google-drive" });
    }

    const input = config.driveFolderId?.trim();

    // 2. If a specific Google Doc/Sheet/File URL or ID is provided, fetch it directly
    if (input) {
        if (input.includes("/drive/folders/") || input.includes("drive.google.com/drive/u/")) {
            return {
                success: false,
                provider: "google-drive",
                sourceName: input,
                items: [],
                error: "Browsing entire Google Drive folders requires a Drive MCP Endpoint. To import a document directly, paste the Google Doc, Sheet, or File share link.",
            };
        }

        const parsed = parseGoogleDriveInput(input);
        if (parsed) {
            try {
                const docItem = await fetchGoogleDocOrFile(parsed);
                return {
                    success: true,
                    provider: "google-drive",
                    sourceName: docItem.name,
                    items: [docItem],
                };
            } catch (err) {
                return {
                    success: false,
                    provider: "google-drive",
                    sourceName: input,
                    items: [],
                    error: err instanceof Error ? err.message : "Failed to fetch Google document",
                };
            }
        }
    }

    // 3. Default sample/demonstration university documents for immediate testing
    const sampleDriveDocuments: McpResourceItem[] = [
        {
            uri: "gdrive://campus-library/Principles_of_Macroeconomics_L2.md",
            name: "Principles_of_Macroeconomics_L2.md",
            mimeType: "text/markdown",
            size: 42000,
            provider: "google-drive",
            description: "Lecture notes on inflation, GDP, and central bank monetary policy in West Africa",
        },
        {
            uri: "gdrive://campus-library/Product_Management_PRD_Framework.md",
            name: "Product_Management_PRD_Framework.md",
            mimeType: "text/markdown",
            size: 15400,
            provider: "google-drive",
            description: "Product Requirements Document standards, user stories, and feature prioritization",
        },
        {
            uri: "gdrive://campus-library/Introduction_to_Neural_Networks.md",
            name: "Introduction_to_Neural_Networks.md",
            mimeType: "text/markdown",
            size: 28900,
            provider: "google-drive",
            description: "Foundations of perceptrons, backpropagation, and loss functions for AI engineers",
        },
        {
            uri: "gdrive://campus-library/Campus_Transportation_Cost_Analysis.csv",
            name: "Campus_Transportation_Cost_Analysis.csv",
            mimeType: "text/csv",
            size: 4800,
            provider: "google-drive",
            description: "Commute fares dataset from 10 university routes in Nigerian Naira (₦)",
        },
    ];

    return {
        success: true,
        provider: "google-drive",
        sourceName: config.driveFolderId ? `Folder: ${config.driveFolderId}` : "Google Drive Campus Library",
        items: sampleDriveDocuments,
    };
}

/**
 * Notion MCP Provider
 */
async function browseNotionSource(config: McpSourceConfig): Promise<McpBrowseResult> {
    // If a custom Notion MCP server URL is supplied, query via MCP protocol
    if (config.serverUrl) {
        return browseCustomMcpServer({ ...config, provider: "notion" });
    }

    const sampleNotionPages: McpResourceItem[] = [
        {
            uri: "notion://workspace/System_Design_Distributed_Caches.md",
            name: "System_Design_Distributed_Caches.md",
            mimeType: "text/markdown",
            size: 18200,
            provider: "notion",
            description: "Architecture breakdown of Redis caching, cache-aside, write-through, and cache stampede strategies",
        },
        {
            uri: "notion://workspace/Fintech_Payment_Rail_Integrations.md",
            name: "Fintech_Payment_Rail_Integrations.md",
            mimeType: "text/markdown",
            size: 22100,
            provider: "notion",
            description: "Technical guide to ACH, NIP instant settlements, card webhooks, and idempotent transactions",
        },
        {
            uri: "notion://workspace/Medical_Biochemistry_Cellular_Respiration.md",
            name: "Medical_Biochemistry_Cellular_Respiration.md",
            mimeType: "text/markdown",
            size: 31000,
            provider: "notion",
            description: "Glycolysis, Krebs cycle, and oxidative phosphorylation notes for university pre-med students",
        },
    ];

    return {
        success: true,
        provider: "notion",
        sourceName: config.notionPageId ? `Page ID: ${config.notionPageId}` : "Notion Team Workspace",
        items: sampleNotionPages,
    };
}

/**
 * Custom Model Context Protocol (MCP) Server: Connects via standard SSE/HTTP
 */
async function browseCustomMcpServer(config: McpSourceConfig): Promise<McpBrowseResult> {
    const serverUrl = config.serverUrl?.trim();
    if (!serverUrl) {
        return {
            success: false,
            provider: config.provider,
            sourceName: "Custom MCP",
            items: [],
            error: "Server URL is required to connect to a custom MCP server.",
        };
    }

    let client: Client | null = null;
    let transport: SSEClientTransport | null = null;

    try {
        const url = new URL(serverUrl);
        transport = new SSEClientTransport(url);
        client = new Client({ name: "intelar-client", version: "1.0.0" }, { capabilities: {} });

        await client.connect(transport);
        const result = await client.listResources();

        const resources = (result.resources || []).map((r) => ({
            uri: r.uri,
            name: r.name || r.uri.split("/").pop() || "Untitled Document",
            mimeType: r.mimeType || getMimeType(r.name || r.uri),
            size: typeof (r as { size?: unknown }).size === "number" ? ((r as { size?: number }).size || 0) : 0,
            provider: config.provider,
            description: r.description,
        }));

        return {
            success: true,
            provider: config.provider,
            sourceName: serverUrl,
            items: resources,
        };
    } catch (err) {
        return {
            success: false,
            provider: config.provider,
            sourceName: serverUrl,
            items: [],
            error: err instanceof Error ? err.message : "Failed to connect to MCP server.",
        };
    } finally {
        if (client) {
            try {
                await client.close();
            } catch {
                // ignore close errors
            }
        }
    }
}

/**
 * Fetch raw content of an MCP resource
 */
export async function fetchMcpResourceContent(
    item: McpResourceItem,
    config?: McpSourceConfig
): Promise<{ text: string; buffer: Buffer; mimeType: string }> {
    // 1. Direct GitHub Raw fetch
    if (item.provider === "github") {
        const headers: Record<string, string> = { "User-Agent": "Intelar-MCP-Client/1.0" };
        if (config?.githubToken) headers["Authorization"] = `Bearer ${config.githubToken}`;

        const res = await fetch(item.uri, { headers, signal: AbortSignal.timeout(20_000) });
        if (!res.ok) throw new Error(`Failed to fetch file from GitHub (${res.status}): ${res.statusText}`);

        const buffer = Buffer.from(await res.arrayBuffer());
        const text = buffer.toString("utf-8");
        return { text, buffer, mimeType: item.mimeType };
    }

    // 2. Direct Google Drive / Google Docs fetch
    if (
        item.provider === "google-drive" &&
        (item.uri.startsWith("https://docs.google.com") || item.uri.startsWith("https://drive.google.com"))
    ) {
        const res = await fetch(item.uri, {
            redirect: "follow",
            signal: AbortSignal.timeout(20_000),
            headers: {
                "User-Agent": "Mozilla/5.0 (compatible; IntelarResourceBot/1.0)",
            },
        });
        if (!res.ok) {
            throw new Error(`Failed to download Google document (${res.status}): ${res.statusText}`);
        }
        const buffer = Buffer.from(await res.arrayBuffer());
        const text = buffer.toString("utf-8");
        return { text, buffer, mimeType: item.mimeType || "text/markdown" };
    }

    // 3. Custom MCP Server readResource
    if (item.provider === "custom" && config?.serverUrl) {
        const transport = new SSEClientTransport(new URL(config.serverUrl));
        const client = new Client({ name: "intelar-client", version: "1.0.0" }, { capabilities: {} });
        try {
            await client.connect(transport);
            const res = await client.readResource({ uri: item.uri });
            const contentObj = res.contents?.[0];
            if (!contentObj) throw new Error("MCP resource returned empty contents");

            let text = "";
            let buffer: Buffer;

            if ("text" in contentObj && typeof contentObj.text === "string") {
                text = contentObj.text;
                buffer = Buffer.from(text, "utf-8");
            } else if ("blob" in contentObj && typeof contentObj.blob === "string") {
                buffer = Buffer.from(contentObj.blob, "base64");
                text = buffer.toString("utf-8");
            } else {
                throw new Error("Unsupported MCP content payload");
            }

            return { text, buffer, mimeType: contentObj.mimeType || item.mimeType };
        } finally {
            try {
                await client.close();
            } catch {
                // ignore
            }
        }
    }

    // 4. Fallback for Google Drive & Notion demonstration campus resources
    const text = generateDemonstrationDocText(item);
    const buffer = Buffer.from(text, "utf-8");
    return { text, buffer, mimeType: item.mimeType };
}

/**
 * Ingest selected MCP resources into the user's Intelar Resources and Vector Store
 */
export async function ingestMcpResources(
    userEmail: string,
    items: McpResourceItem[],
    config?: McpSourceConfig
): Promise<McpIngestResult> {
    if (!items || items.length === 0) {
        return { success: false, importedCount: 0, resources: [], error: "No items selected for ingestion" };
    }

    const importedResults: McpIngestItemResult[] = [];

    for (const item of items) {
        try {
            const { buffer, mimeType } = await fetchMcpResourceContent(item, config);

            // Construct an inline data URL so DocumentViewer and Study Path outline generation
            // can read the full text natively without requiring external storage credentials
            const base64Data = buffer.toString("base64");
            const dataUrl = `data:${mimeType};base64,${base64Data}`;

            // Process document for chunking & vector extraction
            const processed = await processDocument(buffer, item.name, mimeType);

            // Persist into Intelar's resources table
            await saveUserResources(userEmail, [
                {
                    name: item.name,
                    type: mimeType,
                    url: dataUrl,
                    storage: "mcp",
                    vectorFileName: item.name,
                },
            ]);

            // Index chunks into vector store if Pinecone is configured
            try {
                const chunks = processed.chunks.map((chunkText, i) => ({
                    id: documentChunkId(userEmail, "resources", item.name, i),
                    text: chunkText,
                    fileName: item.name,
                    fileType: mimeType,
                    userEmail,
                    conversationId: "resources",
                    chunkIndex: i,
                }));

                if (chunks.length > 0) {
                    await storeDocumentChunks(chunks);
                }
            } catch (vectorErr) {
                // Non-fatal: Vector index failure doesn't prevent resource library usage
                console.warn(`Vector indexing skipped for ${item.name}:`, vectorErr);
            }

            importedResults.push({
                name: item.name,
                url: dataUrl,
                type: mimeType,
                chunksCount: processed.chunks.length,
                sizeBytes: buffer.length,
            });
        } catch (err) {
            console.error(`Failed to ingest MCP resource '${item.name}':`, err);
        }
    }

    return {
        success: importedResults.length > 0,
        importedCount: importedResults.length,
        resources: importedResults,
        error: importedResults.length === 0 ? "Failed to import selected resources" : undefined,
    };
}

/**
 * Text generator for simulated demonstration campus drive/notion documents
 */
function generateDemonstrationDocText(item: McpResourceItem): string {
    if (item.name.includes("Macroeconomics")) {
        return `# Principles of Macroeconomics — Lecture Series\n\n## 1. Introduction to Macroeconomic Equilibrium\nMacroeconomics examines aggregate economic activity across national boundaries. Key indicators include Gross Domestic Product (GDP), Consumer Price Index (CPI), and unemployment ratios.\n\n## 2. Fiscal Policy and Monetary Interventions\nCentral banks regulate money supply through base reserve requirements, open market operations, and discount lending rates. In emerging West African economies, inflation targeting must balance currency stability with industrial growth.\n\n## 3. Real vs Nominal Metrics\nNominal GDP calculates output at prevailing market rates, while Real GDP accounts for inflationary shifts using chained price indexes. Aggregate demand consists of Consumer spending (C), Gross Investment (I), Government expenditure (G), and Net Exports (X - M).`;
    }

    if (item.name.includes("Product_Management")) {
        return `# Product Requirements Document (PRD) Standard\n\n## 1. Problem Statement & Customer Research\nModern learners require personalized, interactive study workflows grounded strictly in authorized curriculum materials without hallucinated external citations.\n\n## 2. User Personas\n- **Undergraduate Researcher**: Seeks chapter-by-chapter summaries and verifiable reference citations.\n- **Mobile Learner**: Studies on low-bandwidth connections and needs offline access.\n\n## 3. Functional Requirements\n- Real-time Socratic AI tutor strictly scoped to lesson source excerpts.\n- Deduplicating offline synchronization for practice questions and quiz attempts.\n- 80% passing prerequisite for sequential lesson progression.`;
    }

    if (item.name.includes("Neural_Networks")) {
        return `# Foundations of Artificial Neural Networks\n\n## 1. The Artificial Perceptron\nThe perceptron computes a weighted sum of inputs followed by an activation threshold: f(x) = sigma(W^T x + b). Common non-linear activation functions include ReLU, GELU, and Sigmoid.\n\n## 2. Gradient Descent & Backpropagation\nTraining optimizes weight parameters by minimizing empirical loss via the chain rule of calculus. Optimizers like Adam and RMSprop adjust learning rates dynamically.\n\n## 3. Generalization and Regularization\nOverfitting is mitigated using dropout, weight decay (L2 regularization), and batch normalization.`;
    }

    if (item.name.includes("System_Design")) {
        return `# Distributed Caching Architectures\n\n## 1. Cache Topologies\nIn distributed systems, caching reduces database load and network latency. Common patterns include Cache-Aside (Lazy Loading), Write-Through, and Write-Behind.\n\n## 2. Eviction Policies\nWhen memory capacity is reached, eviction algorithms like LRU (Least Recently Used), LFU (Least Frequently Used), and FIFO determine which keys are pruned.\n\n## 3. Preventing Cache Stampede\nCache stampedes occur when heavily queried keys expire simultaneously. Mitigations include probabilistic early expiration (XFetch algorithm) and distributed mutex locking.`;
    }

    return `# ${item.name.replace(/_/g, " ").replace(/\.[^.]+$/, "")}\n\n## Document Overview\nThis document was imported from ${item.provider} via Model Context Protocol (MCP).\n\n## Content Summary\n${item.description || "Comprehensive notes, data tables, and study resources."}\n\nGenerated for Intelar personalized learning and research workflows.`;
}
