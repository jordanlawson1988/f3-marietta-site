"use client";

import { useState, useMemo, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { searchGlossaryEntries } from "@/lib/searchGlossary";
import { GlossaryEntry } from "@/../data/f3Glossary";
import { cn } from "@/lib/utils";

interface GlossaryListProps {
    title: string;
    entries: GlossaryEntry[];
    showCategoryFilter?: boolean;
    highlightId?: string;
}

export function GlossaryList({ title, entries, showCategoryFilter = false, highlightId }: GlossaryListProps) {
    const [searchQuery, setSearchQuery] = useState("");
    const [fadedHighlightId, setFadedHighlightId] = useState<string | null>(null);

    const filteredEntries = useMemo(() => {
        return searchGlossaryEntries(entries, searchQuery);
    }, [entries, searchQuery]);

    // Derive active highlight: show if highlightId is set and hasn't been faded yet
    // When highlightId changes (e.g. "A" → "B"), fadedHighlightId is still "A",
    // so "B" !== "A" → highlight shows. After 3s timeout sets fadedHighlightId = "B" → fades.
    const activeHighlight = highlightId && fadedHighlightId !== highlightId ? highlightId : undefined;

    // Scroll to target and schedule fade-out
    useEffect(() => {
        if (!highlightId) return;

        // Wait for DOM to update, then scroll
        const scrollTimer = setTimeout(() => {
            const el = document.getElementById(highlightId);
            if (el) {
                el.scrollIntoView({ behavior: "smooth", block: "center" });
            }
        }, 100);

        // Fade out highlight after 3 seconds
        const fadeTimer = setTimeout(() => {
            setFadedHighlightId(highlightId);
        }, 3000);

        return () => {
            clearTimeout(scrollTimer);
            clearTimeout(fadeTimer);
        };
    }, [highlightId]);

    return (
        <div className="max-w-4xl mx-auto mb-8">
            <div className="flex flex-col md:flex-row gap-4 justify-between items-center mb-6">
                <div className="text-lg font-bold text-muted-foreground">
                    {title} ({filteredEntries.length})
                </div>

                {/* Search */}
                <div className="w-full md:w-auto relative">
                    <input
                        type="text"
                        placeholder={`Search ${title}...`}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full md:w-64 px-4 py-2 rounded-md border border-input bg-background focus:outline-none focus:ring-2 focus:ring-primary"
                    />
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {filteredEntries.slice(0, 100).map((entry, index) => (
                    <Card
                        key={`${entry.id}-${index}`}
                        id={entry.id}
                        className={cn(
                            "transition-all duration-300",
                            activeHighlight === entry.id
                                ? "ring-2 ring-primary hover:border-primary/30"
                                : "hover:border-primary/30"
                        )}
                    >
                        <CardHeader className="pb-2">
                            <div className="flex justify-between items-start">
                                <CardTitle className="text-xl text-primary">{entry.term}</CardTitle>
                                {showCategoryFilter && entry.category && (
                                    <span className="text-xs font-mono bg-muted px-2 py-1 rounded text-muted-foreground">
                                        {entry.category}
                                    </span>
                                )}
                            </div>
                        </CardHeader>
                        <CardContent>
                            <p className="text-foreground font-medium mb-1">{entry.shortDescription}</p>
                            {entry.longDescription && (
                                <p className="text-sm text-muted-foreground mt-2 border-t pt-2 border-border/50">
                                    {entry.longDescription}
                                </p>
                            )}
                        </CardContent>
                    </Card>
                ))}

                {filteredEntries.length > 100 && (
                    <div className="text-center py-8 text-muted-foreground italic">
                        Showing first 100 results. Use search to find more.
                    </div>
                )}

                {filteredEntries.length === 0 && (
                    <div className="text-center py-12">
                        <p className="text-lg text-muted-foreground">No results found for &quot;{searchQuery}&quot;</p>
                        <Button variant="link" onClick={() => setSearchQuery("")}>Clear Search</Button>
                    </div>
                )}
            </div>
        </div>
    );
}
