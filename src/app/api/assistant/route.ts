import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { randomUUID } from "crypto";
import { lexiconEntries, exiconEntries, GlossaryEntry } from "@/../data/f3Glossary";
import { searchKnowledgeDocs } from "@/../data/f3Knowledge";
import { searchGlossaryEntries } from "@/lib/searchGlossary";
import { checkRateLimit } from "@/lib/security/rateLimiter";

// Force Node.js runtime (not Edge) for OpenAI and fs compatibility
export const runtime = "nodejs";

// Helper to normalize mobile keyboard quirks (smart quotes, special whitespace, etc.)
function normalizeQuery(input: string): string {
    return input
        // Smart quotes and curly apostrophes → straight versions
        .replace(/[\u2018\u2019\u201A\u201B]/g, "'")  // Single curly quotes
        .replace(/[\u201C\u201D\u201E\u201F]/g, '"')  // Double curly quotes
        .replace(/[\u2032\u2035]/g, "'")              // Prime marks
        // Special whitespace → regular space
        .replace(/[\u00A0\u2000-\u200B\u202F\u205F\u3000]/g, ' ')
        // Normalize dashes
        .replace(/[\u2013\u2014\u2015]/g, '-')
        // Remove zero-width characters
        .replace(/[\u200B-\u200D\uFEFF]/g, '')
        // Collapse multiple spaces
        .replace(/\s+/g, ' ')
        .trim();
}

// Helper to normalize query and extract core term
function extractCoreTerm(query: string): string {
    // First normalize mobile keyboard quirks
    let term = normalizeQuery(query).toLowerCase();

    // Remove common question prefixes (order matters - longer prefixes first)
    const prefixes = [
        "what is an ", "what is a ", "what is the ", "what is ",
        "what's an ", "what's a ", "what's the ", "what's ",
        "whats an ", "whats a ", "whats the ", "whats ",
        "define the ", "define a ", "define an ", "define ",
        "tell me about the ", "tell me about a ", "tell me about an ", "tell me about ",
        "explain the ", "explain a ", "explain an ", "explain ",
        "how do i ", "how do you ", "how does ", "how to ",
        "what are ", "who is ", "who are ",
    ];
    for (const prefix of prefixes) {
        if (term.startsWith(prefix)) {
            term = term.slice(prefix.length);
            break;
        }
    }

    // Remove trailing punctuation
    term = term.replace(/[?.,!]+$/, "");

    // Remove any remaining leading articles
    term = term.replace(/^(a |an |the )/, "");

    return term.trim();
}


// Use shared search logic - wrapper for compatibility
function getRelevantEntries(query: string, entries: GlossaryEntry[], limit = 10): GlossaryEntry[] {
    if (!query) return [];
    return searchGlossaryEntries(entries, query).slice(0, limit);
}

async function getKnowledgeBaseContext(query: string): Promise<string | null> {
    try {
        const relevantLexicon = getRelevantEntries(query, lexiconEntries, 3);
        const relevantExicon = getRelevantEntries(query, exiconEntries, 3);
        const relevantDocs = searchKnowledgeDocs(query, 3);

        const allRelevantGlossary = [...relevantLexicon, ...relevantExicon];

        if (relevantDocs.length === 0 && allRelevantGlossary.length === 0) {
            return null;
        }

        let contextString = "";

        if (relevantDocs.length > 0) {
            contextString += "--- F3 KNOWLEDGE DOCS ---\n";
            contextString += relevantDocs.map(d => `Title: ${d.title}\nContent:\n${d.content}`).join("\n\n");
            contextString += "\n\n";
        }

        if (allRelevantGlossary.length > 0) {
            contextString += "--- F3 GLOSSARY ENTRIES ---\n";
            contextString += allRelevantGlossary
                .map((e) => `Term: ${e.term}\nType: ${lexiconEntries.includes(e) ? "Lexicon" : "Exicon"}\nDefinition: ${e.shortDescription}`)
                .join("\n\n");
        }

        return contextString;
    } catch (error) {
        console.error("Error getting knowledge base context:", error);
        return null;
    }
}

// Lazy singleton for OpenAI client (avoid re-instantiation per request)
let _openai: OpenAI | null = null;
function getOpenAI(): OpenAI {
    if (!_openai) {
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) throw new Error("OPENAI_API_KEY is not set");
        _openai = new OpenAI({ apiKey });
    }
    return _openai;
}

async function callOpenAI(query: string, context: string | null): Promise<string> {
    const openai = getOpenAI();

    const systemPromptBase = `
You are the F3 Marietta AI assistant.
Always answer as helpfully and concisely as possible.
If you are not sure, be honest and suggest checking f3marietta.com or f3nation.com.
Focus on F3, F3 Marietta, workouts, locations, Lexicon/Exicon, and FAQ topics.
`;

    const systemPrompt = context
        ? `${systemPromptBase}\n\nUse the following F3 Marietta knowledge base context if relevant:\n${context}`
        : `${systemPromptBase}\n\nYou do not have any special context for this question; answer from your general knowledge of F3.`;

    const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: query },
        ],
        max_tokens: 500,
        temperature: 0.5,
    });

    return completion.choices[0]?.message?.content || "I couldn't generate an answer at this time.";
}

export async function POST(request: NextRequest) {
    const requestId = randomUUID().slice(0, 8);

    try {
        // Rate limit: 10 requests per 60 seconds per IP
        const rateLimitResponse = checkRateLimit(request, { maxRequests: 10, windowMs: 60 * 1000 });
        if (rateLimitResponse) return rateLimitResponse;

        const { query } = await request.json();

        if (!query || typeof query !== "string") {
            console.log(`[${requestId}] Invalid query received`);
            return NextResponse.json({ error: "Invalid query" }, { status: 400 });
        }

        console.log(`[${requestId}] Assistant request: "${query.slice(0, 50)}${query.length > 50 ? '...' : ''}"`);

        // 1. Normalize and check for direct match
        const coreTerm = extractCoreTerm(query);
        const allEntries = [...lexiconEntries, ...exiconEntries];

        // Debug logging to diagnose mobile vs desktop matching issues
        console.log(`[${requestId}] Raw query: "${query}"`);
        console.log(`[${requestId}] Extracted coreTerm: "${coreTerm}"`);
        console.log(`[${requestId}] Query char codes: ${[...query].map(c => c.charCodeAt(0)).join(',')}`);

        const directMatch = allEntries.find(
            (e) => e.term.toLowerCase() === coreTerm
        );

        console.log(`[${requestId}] Direct match found: ${directMatch ? directMatch.term : 'none'}`);

        if (directMatch) {
            // Direct match found! Return immediately without OpenAI.
            const isLexicon = lexiconEntries.some((l) => l.id === directMatch.id);
            const type = isLexicon ? "Lexicon" : "Exicon";
            const url = `/glossary#${directMatch.id}`;

            const answerText = `${directMatch.term}: ${directMatch.shortDescription}${directMatch.longDescription ? ` ${directMatch.longDescription}` : ""
                }`;

            return NextResponse.json({
                answerText,
                relatedEntries: [{
                    type,
                    term: directMatch.term,
                    slug: directMatch.id,
                    url
                }]
            });
        }

        // 2. Check API Key
        if (!process.env.OPENAI_API_KEY) {
            console.error(`[${requestId}] OPENAI_API_KEY is not set`);
            return NextResponse.json(
                { error: "service_unavailable", message: "The AI assistant is temporarily unavailable. Please try again later." },
                { status: 503 }
            );
        }

        // 3. Get Context
        const context = await getKnowledgeBaseContext(query);

        // 4. Call OpenAI
        const answerText = await callOpenAI(query, context);

        // 5. Build Related Entries/Pages (Best effort based on context)
        // We can re-run getRelevantEntries locally to populate this if context was null, 
        // or just use what we found in getKnowledgeBaseContext if we refactored to return it.
        // For simplicity, let's re-run the cheap local search to populate "related" even if we used fallback.

        const relevantLexicon = getRelevantEntries(query, lexiconEntries, 3);
        const relevantExicon = getRelevantEntries(query, exiconEntries, 3);
        const allRelevantGlossary = [...relevantLexicon, ...relevantExicon];

        const relatedEntries = allRelevantGlossary.map((entry) => {
            const isLexicon = lexiconEntries.some((l) => l.id === entry.id);
            const type = isLexicon ? "Lexicon" : "Exicon";
            return {
                type,
                term: entry.term,
                slug: entry.id,
                url: `/glossary#${entry.id}`,
            };
        });

        // For related pages, we'd need the docs results. 
        // Since getKnowledgeBaseContext swallows them, we might miss them here if we don't re-fetch or refactor.
        // But the user asked for "fallback to plain OpenAI", so missing related links in fallback case is acceptable.
        // We will try to fetch them again safely.
        let relatedPages: { title: string; url: string }[] = [];
        try {
            const relevantDocs = searchKnowledgeDocs(query, 3);
            relatedPages = relevantDocs.map(d => {
                if (d.id === "about" || d.id === "mission" || d.id === "leadership") return { title: "About Us", url: "/about" };
                if (d.id === "first-workout") return { title: "New to F3", url: "/new-here" };
                if (d.id === "marietta") return { title: "Community", url: "/community" };
                return null;
            }).filter((p): p is { title: string; url: string } => p !== null);
        } catch {
            // Ignore doc search errors for related pages
        }

        const uniqueRelatedPages = Array.from(new Set(relatedPages.map(p => JSON.stringify(p)))).map(s => JSON.parse(s));

        return NextResponse.json({
            answerText,
            relatedEntries,
            relatedPages: uniqueRelatedPages
        });

    } catch (error) {
        console.error(`[${requestId}] AMA assistant error:`, error);
        return NextResponse.json(
            {
                error: "assistant_error",
                message: "Sorry, I had trouble answering that. Please try again in a moment or check the FAQ page."
            },
            { status: 500 }
        );
    }
}
