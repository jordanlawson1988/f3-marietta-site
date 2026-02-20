"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { cn } from "@/lib/utils";
import Link from "next/link";
import Image from "next/image";
import { Send, Loader2 } from "lucide-react";
import type { AssistantResponse } from "@/types/assistant";
import { EXAMPLE_QUESTIONS } from "@/types/assistant";

interface AssistantWidgetProps {
    title?: string;
    description?: string;
    compact?: boolean;
    variant?: "widget" | "page";
}

export function AssistantWidget({
    title,
    description,
    compact = false,
    variant = "widget",
}: AssistantWidgetProps) {
    const [query, setQuery] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [response, setResponse] = useState<AssistantResponse | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Start with first 4 questions for SSR consistency, then randomize on client
    const [displayedQuestions, setDisplayedQuestions] = useState(() =>
        EXAMPLE_QUESTIONS.slice(0, 4)
    );

    useEffect(() => {
        // Randomize questions on client-side mount to avoid hydration mismatch
        const shuffled = [...EXAMPLE_QUESTIONS].sort(() => Math.random() - 0.5);
        setDisplayedQuestions(shuffled.slice(0, 4));
    }, []);

    const isPageVariant = variant === "page";

    const handleSearch = async (searchQuery: string) => {
        if (!searchQuery.trim()) return;

        setIsLoading(true);
        setError(null);
        setResponse(null);
        setQuery(searchQuery);

        try {
            const res = await fetch("/api/assistant", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ query: searchQuery }),
            });

            const data = await res.json();

            if (!res.ok) {
                throw new Error(data.error || "Failed to get answer");
            }

            setResponse(data);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : "Something went wrong. Please try again.";
            setError(message);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        e.stopPropagation();
        handleSearch(query);
    };

    return (
        <div className={cn("w-full", isPageVariant && "max-w-3xl mx-auto my-8 px-4")}>
            {/* Header */}
            {(title || description || isPageVariant) && (
                <div className={cn("text-center mb-6", compact && "mb-4")}>
                    {(title || isPageVariant) && (
                        <h2 className={cn(
                            "font-bold font-heading mb-2",
                            compact ? "text-xl" : "text-2xl"
                        )}>
                            {title || "What would you like to know?"}
                        </h2>
                    )}
                    {(description || isPageVariant) && (
                        <p className={cn("text-muted-foreground", compact && "text-sm")}>
                            {description || "Ask about F3, workouts, the Lexicon, or where to start."}
                        </p>
                    )}
                </div>
            )}

            {/* Search Form */}
            <div className={cn("mb-6", isPageVariant && "mb-8")}>
                <form onSubmit={handleSubmit} className="relative mb-4">
                    <div className="relative flex items-center">
                        <input
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder={isPageVariant
                                ? "e.g., What is a Merkin? or When are the workouts?"
                                : "Ask a question..."}
                            className={cn(
                                "w-full border border-input bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary placeholder:text-muted-foreground",
                                isPageVariant
                                    ? "px-4 sm:px-6 py-4 text-base sm:text-lg rounded-full pr-20 sm:pr-32"
                                    : "px-4 py-3 pr-12 text-base rounded-lg"
                            )}
                        />
                        <div className="absolute right-2">
                            {isPageVariant ? (
                                <Button
                                    type="submit"
                                    disabled={isLoading || !query.trim()}
                                    className="rounded-full px-6"
                                >
                                    {isLoading ? (
                                        <span className="animate-spin mr-2">⏳</span>
                                    ) : (
                                        <span>Ask</span>
                                    )}
                                </Button>
                            ) : (
                                <Button
                                    type="submit"
                                    disabled={isLoading || !query.trim()}
                                    size="icon"
                                    variant="ghost"
                                    className="h-8 w-8"
                                >
                                    {isLoading ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                    ) : (
                                        <Send className="h-4 w-4" />
                                    )}
                                    <span className="sr-only">Ask</span>
                                </Button>
                            )}
                        </div>
                    </div>
                </form>

                {/* Example Questions */}
                {!response && !isLoading && (
                    <div className={cn(
                        "grid gap-2",
                        isPageVariant ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-2"
                    )}>
                        {displayedQuestions.map((q) => (
                            <button
                                key={q}
                                onClick={() => handleSearch(q)}
                                className={cn(
                                    "bg-muted/50 hover:bg-muted px-3 py-2 rounded-lg transition-colors text-muted-foreground hover:text-foreground text-left",
                                    isPageVariant ? "text-sm" : "text-xs"
                                )}
                            >
                                {q}
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Error Display */}
            {error && (
                <div className={cn(
                    "p-4 rounded-lg bg-destructive/10 text-destructive text-center mb-6",
                    !isPageVariant && "text-sm"
                )}>
                    {error}
                </div>
            )}

            {/* Response Display */}
            {response && (
                <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {/* Answer Card */}
                    <Card className={cn(
                        "border-primary/20",
                        isPageVariant ? "bg-primary/5" : "bg-muted"
                    )}>
                        <CardContent className={isPageVariant ? "pt-6" : "pt-4 pb-4"}>
                            <h3 className={cn(
                                "font-bold mb-2 flex items-center gap-2 uppercase tracking-wider text-muted-foreground",
                                isPageVariant ? "text-lg" : "text-sm"
                            )}>
                                <Image
                                    src="/icons/f3-assistant-icon.png"
                                    alt="F3"
                                    width={24}
                                    height={24}
                                    className={cn(
                                        "rounded-full",
                                        isPageVariant ? "h-6 w-6" : "h-5 w-5"
                                    )}
                                /> {isPageVariant ? "Assistant Answer" : "Answer"}
                            </h3>
                            <p className={cn(
                                "leading-relaxed whitespace-pre-wrap",
                                isPageVariant ? "text-lg" : "text-sm"
                            )}>
                                {response.answerText}
                            </p>
                        </CardContent>
                    </Card>

                    {/* Related Pages */}
                    {response.relatedPages && response.relatedPages.length > 0 && (
                        <div>
                            <h4 className={cn(
                                "font-bold text-muted-foreground uppercase tracking-wider",
                                isPageVariant ? "text-sm mb-3" : "text-xs mb-2"
                            )}>
                                Recommended Pages
                            </h4>
                            <div className={cn(
                                isPageVariant ? "flex flex-wrap gap-3" : "flex flex-col gap-2"
                            )}>
                                {response.relatedPages.map((page) => (
                                    <Link
                                        key={page.url}
                                        href={page.url}
                                        className={cn(
                                            "border border-border bg-card hover:border-primary/50 hover:bg-accent/50 transition-colors font-medium",
                                            isPageVariant
                                                ? "inline-flex items-center gap-2 px-4 py-2 rounded-lg"
                                                : "flex items-center justify-between px-3 py-2 rounded-md text-sm"
                                        )}
                                    >
                                        {page.title}
                                        <span className="text-muted-foreground">→</span>
                                    </Link>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Related Glossary Entries */}
                    {response.relatedEntries.length > 0 && (
                        <div>
                            <h4 className={cn(
                                "font-bold text-muted-foreground uppercase tracking-wider",
                                isPageVariant ? "text-sm mb-3" : "text-xs mb-2"
                            )}>
                                {isPageVariant ? "Related Terms & Exercises" : "Related Terms"}
                            </h4>
                            <div className={cn(
                                isPageVariant
                                    ? "grid grid-cols-1 sm:grid-cols-2 gap-3"
                                    : "flex flex-col gap-2"
                            )}>
                                {response.relatedEntries.map((entry) => (
                                    <a
                                        key={entry.slug}
                                        href={entry.url}
                                        className={cn(
                                            "flex items-center justify-between border border-border bg-card hover:border-primary/50 hover:bg-accent/50 transition-all group",
                                            isPageVariant ? "p-3 rounded-lg" : "p-2 rounded-md text-sm"
                                        )}
                                    >
                                        <div>
                                            <span className="font-bold block group-hover:text-primary transition-colors">
                                                {entry.term}
                                            </span>
                                            <span className={cn(
                                                "text-muted-foreground bg-muted rounded",
                                                isPageVariant ? "text-xs px-1.5 py-0.5" : "text-[10px] px-1 py-0.5"
                                            )}>
                                                {entry.type}
                                            </span>
                                        </div>
                                        <span className="text-muted-foreground group-hover:translate-x-1 transition-transform">
                                            →
                                        </span>
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
