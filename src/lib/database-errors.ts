const CONNECTION_ERROR_CODES = new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "EHOSTUNREACH",
    "EAI_AGAIN",
    "ENETUNREACH",
    "ENOTFOUND",
    "ETIMEDOUT",
    "UND_ERR_CONNECT_TIMEOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_SOCKET",
]);

export function isDatabaseConnectionError(error: unknown): boolean {
    const seen = new Set<object>();
    let current = error;
    while (current && typeof current === "object" && !seen.has(current)) {
        seen.add(current);
        const { code, cause } = current as { code?: unknown; cause?: unknown };
        if (typeof code === "string" && CONNECTION_ERROR_CODES.has(code)) return true;
        current = cause;
    }
    return false;
}

export function databaseErrorResponse(error: unknown): Response | null {
    if (!isDatabaseConnectionError(error)) return null;
    return Response.json(
        { error: "Saved data is temporarily unavailable. Please try again shortly." },
        { status: 503, headers: { "Retry-After": "5", "Cache-Control": "no-store" } }
    );
}
