export type McpSourceProvider = "github" | "google-drive" | "notion" | "custom";

export interface McpSourceConfig {
    provider: McpSourceProvider;
    // GitHub config
    repo?: string;
    branch?: string;
    path?: string;
    githubToken?: string;

    // Google Drive config
    driveFolderId?: string;
    driveApiKey?: string;

    // Notion config
    notionPageId?: string;
    notionApiKey?: string;

    // Custom MCP Server config
    serverUrl?: string;
}

export interface McpResourceItem {
    uri: string;
    name: string;
    mimeType: string;
    size?: number;
    provider: McpSourceProvider;
    description?: string;
    lastModified?: string;
}

export interface McpBrowseResult {
    success: boolean;
    provider: McpSourceProvider;
    sourceName: string;
    items: McpResourceItem[];
    error?: string;
}

export interface McpIngestItemResult {
    name: string;
    url: string;
    type: string;
    chunksCount?: number;
    sizeBytes?: number;
}

export interface McpIngestResult {
    success: boolean;
    importedCount: number;
    resources: McpIngestItemResult[];
    error?: string;
}
