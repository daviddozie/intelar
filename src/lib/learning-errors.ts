import { ZodError } from "zod";
import { databaseErrorResponse } from "./database-errors";
import { LearningNotFoundError, LearningProgressError } from "./learning-db";

export class InsufficientMaterialError extends Error {
    constructor(message = "Selected resources contain insufficient material to generate 3 to 5 grounded lessons. Please provide more detailed study materials.") {
        super(message);
        this.name = "InsufficientMaterialError";
    }
}

export class InvalidSourceReferenceError extends Error {
    constructor(message = "Invalid source reference: citation excerpt could not be verified against the selected resource documents.") {
        super(message);
        this.name = "InvalidSourceReferenceError";
    }
}

export class OutlineStructureError extends Error {
    constructor(message = "An outline needs three to five lessons.") {
        super(message);
        this.name = "OutlineStructureError";
    }
}

export class LearningSourceUnavailableError extends Error {
    constructor(cause: unknown) {
        super("Could not retrieve your original study materials. Check your connection and try again shortly.", { cause });
        this.name = "LearningSourceUnavailableError";
    }
}

export function learningErrorResponse(error: unknown): Response {
    if (error instanceof LearningSourceUnavailableError) {
        return Response.json({ error: error.message }, {
            status: 503,
            headers: { "Retry-After": "5", "Cache-Control": "no-store" },
        });
    }
    if (error instanceof LearningNotFoundError) {
        return Response.json({ error: "Learning path or resource not found" }, { status: 404 });
    }
    if (error instanceof InsufficientMaterialError || error instanceof InvalidSourceReferenceError) {
        return Response.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof OutlineStructureError) {
        return Response.json({ error: error.message }, { status: 400 });
    }
    if (error instanceof ZodError || error instanceof SyntaxError || error instanceof LearningProgressError) {
        return Response.json({ error: "Invalid learning request" }, { status: 400 });
    }
    return databaseErrorResponse(error) ?? Response.json({ error: "Could not load or save learning data" }, { status: 500 });
}
