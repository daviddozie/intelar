import type { ResourceDocumentText } from "./learning-types";

function normalize(text: string): string {
    return text.toLowerCase().replace(/\s+/g, " ").trim();
}

/** Resolve a whole quote, or expand an abbreviated quote using only its original document. */
export function resolveExamSource(excerpt: string | undefined, documents: ResourceDocumentText[]) {
    const quote = excerpt?.trim() ?? "";
    if (quote.length < 15) return undefined;
    const exact = documents.find((document) => normalize(document.text).includes(normalize(quote)));
    if (exact) return { document: exact, excerpt: quote };

    const fragments = quote.split(/\.{3}|…/).map(normalize);
    // Require substantial text on both sides of every omission. Never accept just a matching prefix.
    if (fragments.length < 2 || fragments.length > 8 || fragments.some((fragment) => fragment.length < 15)) return undefined;
    for (const document of documents) {
        const text = document.text.replace(/\s+/g, " ").trim();
        const comparable = text.toLowerCase();
        const start = comparable.indexOf(fragments[0]);
        if (start < 0) continue;
        let end = start + fragments[0].length;
        let matched = true;
        for (const fragment of fragments.slice(1)) {
            const next = comparable.indexOf(fragment, end);
            // Keep the expanded passage bounded, ordered, and in the same document.
            if (next < 0 || next + fragment.length - start > 12000) {
                matched = false;
                break;
            }
            end = next + fragment.length;
        }
        const passage = text.slice(start, end);
        // Case folding can change Unicode string lengths; reject ambiguous offsets.
        if (matched && normalize(passage) === comparable.slice(start, end)) {
            return { document, excerpt: passage };
        }
    }
    return undefined;
}
