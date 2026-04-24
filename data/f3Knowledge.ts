import fs from "fs";
import path from "path";

export interface KnowledgeDoc {
    id: string;
    title: string;
    content: string;
}

const KNOWLEDGE_DIR = path.join(process.cwd(), "data");
const ASSISTANT_DIR = path.join(process.cwd(), "data", "assistant");

const KNOWLEDGE_FILES = [
    { id: "about", filename: "f3-about.md", title: "What is F3?" },
    { id: "mission", filename: "f3-mission-core-principles.md", title: "Mission and Core Principles" },
    { id: "first-workout", filename: "f3-first-workout.md", title: "Your First Workout" },
    { id: "leadership", filename: "f3-leadership.md", title: "Leadership (The Q)" },
    { id: "marietta", filename: "f3-marietta-region.md", title: "F3 Marietta Region" },
    { id: "faq", filename: "faq.md", title: "Frequently Asked Questions" },
];

/**
 * Persona + boundary files that ALWAYS get loaded as system instruction
 * context for the AMA assistant, regardless of the user's query. These are
 * the rules that shape the assistant's voice, scope, and core vocabulary.
 */
const PERSONA_FILES = [
    { id: "persona-tone", filename: "tone-voice.md" },
    { id: "persona-boundary", filename: "topic-boundary.md" },
    { id: "persona-lexicon", filename: "core-lexicon.md" },
];

export function getAllKnowledgeDocs(): KnowledgeDoc[] {
    return KNOWLEDGE_FILES.map((file) => {
        const filePath = path.join(KNOWLEDGE_DIR, file.filename);
        try {
            const content = fs.readFileSync(filePath, "utf-8");
            return {
                id: file.id,
                title: file.title,
                content,
            };
        } catch (error) {
            console.error(`Error reading knowledge file ${file.filename}:`, error);
            return {
                id: file.id,
                title: file.title,
                content: "",
            };
        }
    }).filter(doc => doc.content !== "");
}

let _personaCache: string | null = null;
/**
 * Read and concatenate the always-on persona files. Cached per-process so we
 * only hit disk once per cold start. Returns empty string if files are
 * missing rather than throwing — the assistant should still function with
 * reduced persona discipline in that case.
 */
export function getAssistantPersona(): string {
    if (_personaCache !== null) return _personaCache;
    const chunks: string[] = [];
    for (const file of PERSONA_FILES) {
        const filePath = path.join(ASSISTANT_DIR, file.filename);
        try {
            const content = fs.readFileSync(filePath, "utf-8");
            if (content.trim().length > 0) {
                chunks.push(content.trim());
            }
        } catch (error) {
            console.error(`[assistant persona] missing file ${file.filename}:`, error);
        }
    }
    _personaCache = chunks.join("\n\n---\n\n");
    return _personaCache;
}

export function searchKnowledgeDocs(query: string, limit = 3): KnowledgeDoc[] {
    const docs = getAllKnowledgeDocs();
    const normalizedQuery = query.toLowerCase().trim();
    const terms = normalizedQuery.split(" ").filter(t => t.length > 2); // Filter out small words

    const scored = docs.map((doc) => {
        let score = 0;
        const title = doc.title.toLowerCase();
        const content = doc.content.toLowerCase();

        // Exact phrase match
        if (content.includes(normalizedQuery)) score += 50;
        if (title.includes(normalizedQuery)) score += 100;

        // Keyword match
        terms.forEach(term => {
            if (title.includes(term)) score += 20;
            if (content.includes(term)) score += 5;
        });

        return { doc, score };
    });

    return scored
        .filter((s) => s.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, limit)
        .map((s) => s.doc);
}
