import { loadEnvConfig } from "@next/env";
import { createClient } from "@libsql/client";

// Read-only probe. Never prints the token, environment contents, or query data.
async function main() {
    loadEnvConfig(process.cwd());
    const url = process.env.TURSO_DATABASE_URL;
    if (!url) throw new Error("TURSO_DATABASE_URL is not set");
    const client = createClient({ url, authToken: process.env.TURSO_AUTH_TOKEN });
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
        await Promise.race([
            client.execute("SELECT 1 AS ok"),
            new Promise<never>((_, reject) => {
                timeout = setTimeout(() => reject(Object.assign(new Error("Database probe timed out"), { code: "PROBE_TIMEOUT" })), 15000);
            }),
        ]);
        console.log("Database connectivity: SELECT 1 passed");
    } finally {
        clearTimeout(timeout);
        client.close();
    }
}

main().catch((error: unknown) => {
    const codes: string[] = [];
    const seen = new Set<object>();
    let current = error;
    while (current && typeof current === "object" && !seen.has(current)) {
        seen.add(current);
        const { code, cause } = current as { code?: unknown; cause?: unknown };
        if (typeof code === "string") codes.push(code);
        current = cause;
    }
    console.error("Database connectivity failed", codes.length ? `(${codes.join(" → ")})` : "(check configuration and network)");
    process.exitCode = 1;
});
