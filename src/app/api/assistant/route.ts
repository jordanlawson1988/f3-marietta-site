import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { randomUUID } from "crypto";
import { lexiconEntries, exiconEntries, GlossaryEntry } from "@/../data/f3Glossary";
import { searchKnowledgeDocs, getAssistantPersona } from "@/../data/f3Knowledge";
import { searchGlossaryEntries } from "@/lib/searchGlossary";
import { checkRateLimit } from "@/lib/security/rateLimiter";

// Force Node.js runtime (not Edge) for fs and Gemini SDK compatibility.
export const runtime = "nodejs";

// Gemini model. Flash is fast, cheap, and right-sized for short F3 answers.
const GEMINI_MODEL = "gemini-2.5-flash";

// Helper to normalize mobile keyboard quirks (smart quotes, special whitespace).
function normalizeQuery(input: string): string {
    return input
        .replace(/[‘’‚‛]/g, "'")
        .replace(/[“”„‟]/g, '"')
        .replace(/[′‵]/g, "'")
        .replace(/[  -​  　]/g, ' ')
        .replace(/[–—―]/g, '-')
        .replace(/[​-‍﻿]/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

function extractCoreTerm(query: string): string {
    let term = normalizeQuery(query).toLowerCase();
    const prefixes = [
        "tell me what is an ", "tell me what is a ", "tell me what is the ", "tell me what is ",
        "tell me what's an ", "tell me what's a ", "tell me what's the ", "tell me what's ",
        "tell me about the ", "tell me about a ", "tell me about an ", "tell me about ",
        "can you tell me what is ", "can you tell me about ",
        "what is an ", "what is a ", "what is the ", "what is ",
        "what's an ", "what's a ", "what's the ", "what's ",
        "whats an ", "whats a ", "whats the ", "whats ",
        "define the ", "define a ", "define an ", "define ",
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
    term = term.replace(/[?.,!]+$/, "");
    term = term.replace(/^(a |an |the )/, "");
    return term.trim();
}

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

// Lazy singleton — only construct the Gemini client on first request so unit
// tests / cold starts that never hit the endpoint don't fail on missing key.
let _gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
    if (!_gemini) {
        const apiKey = process.env.GOOGLE_AI_API_KEY;
        if (!apiKey) throw new Error("GOOGLE_AI_API_KEY is not set");
        _gemini = new GoogleGenAI({ apiKey });
    }
    return _gemini;
}

function buildSystemInstruction(queryContext: string | null): string {
    const persona = getAssistantPersona();
    const contextBlock = queryContext
        ? `\n\n--- QUERY-SPECIFIC F3 CONTEXT ---\nWhen relevant, ground your answer in this retrieved content:\n${queryContext}`
        : `\n\n--- QUERY-SPECIFIC F3 CONTEXT ---\nNo specific Lexicon/Exicon/Knowledge matches were retrieved for this query. Answer from your loaded F3 persona above. If the question isn't about F3, redirect per the Topic Boundary rules.`;

    return `${persona}${contextBlock}`;
}

async function callGemini(query: string, queryContext: string | null): Promise<string> {
    const gemini = getGemini();
    const systemInstruction = buildSystemInstruction(queryContext);

    const response = await gemini.models.generateContent({
        model: GEMINI_MODEL,
        contents: query,
        config: {
            systemInstruction,
            // Gemini 2.5 Flash defaults to dynamic "thinking" — those tokens
            // count against maxOutputTokens AND add several seconds of latency.
            // For 1–4 sentence definitional answers, disable it entirely.
            thinkingConfig: { thinkingBudget: 0 },
            maxOutputTokens: 600,
            temperature: 0.55,
            topP: 0.9,
        },
    });

    const text = response.text;
    if (!text || text.trim().length === 0) {
        return "Couldn't generate an answer. Check the Glossary page or ask in Slack.";
    }
    return text.trim();
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

        // 1. Normalize and check for direct glossary match — skip the LLM entirely.
        const coreTerm = extractCoreTerm(query);
        const allEntries = [...lexiconEntries, ...exiconEntries];

        const directMatch = allEntries.find(
            (e) => e.term.toLowerCase() === coreTerm
        );

        if (directMatch) {
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
        if (!process.env.GOOGLE_AI_API_KEY) {
            console.error(`[${requestId}] GOOGLE_AI_API_KEY is not set`);
            return NextResponse.json(
                { error: "service_unavailable", message: "The AI assistant is temporarily unavailable. Please try again later." },
                { status: 503 }
            );
        }

        // 3. Retrieve query-specific context (may be null)
        const queryContext = await getKnowledgeBaseContext(query);

        // 4. Call Gemini with persona-loaded system instruction
        const answerText = await callGemini(query, queryContext);

        // 5. Build Related Entries/Pages from the same local search
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
