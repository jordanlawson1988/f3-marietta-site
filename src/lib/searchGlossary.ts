import type { GlossaryEntry } from "../../data/f3Glossary";

export function searchGlossaryEntries(entries: GlossaryEntry[], query: string): GlossaryEntry[] {
    const q = query.trim().toLowerCase();
    if (!q) return entries;

    const queryWords = q.split(/\s+/).filter(w => w.length > 2);

    const scored = entries
        .map((entry) => {
            const term = entry.term.toLowerCase();
            const shortDesc = entry.shortDescription?.toLowerCase() ?? "";
            const longDesc = entry.longDescription?.toLowerCase() ?? "";
            const keywords = (entry.keywords ?? []).map(k => k.toLowerCase());

            let score = 0;

            if (term === q) {
                score = 100;
            } else if (term.startsWith(q)) {
                score = 80;
            } else if (term.includes(q)) {
                score = 60;
            } else if (shortDesc.includes(q) || longDesc.includes(q)) {
                score = 30;
            }

            for (const kw of keywords) {
                if (q.includes(kw) || kw.includes(q)) {
                    score = Math.max(score, 50);
                    break;
                }
            }

            if (score === 0 && queryWords.length > 0) {
                let kwHits = 0;
                for (const word of queryWords) {
                    for (const kw of keywords) {
                        if (kw.includes(word) || word.includes(kw)) {
                            kwHits++;
                            break;
                        }
                    }
                }
                if (kwHits >= 2) {
                    score = 40;
                } else if (kwHits === 1) {
                    let descHits = 0;
                    for (const word of queryWords) {
                        if (shortDesc.includes(word) || longDesc.includes(word)) {
                            descHits++;
                        }
                    }
                    if (descHits >= 1) score = 35;
                }
            }

            return { entry, score };
        })
        .filter(({ score }) => score > 0)
        .sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.entry.term.localeCompare(b.entry.term);
        });

    return scored.map(({ entry }) => entry);
}
