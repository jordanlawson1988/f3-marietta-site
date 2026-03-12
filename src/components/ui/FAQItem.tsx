"use client";

import * as React from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface FAQItemProps {
    question: string;
    answer: string;
}

export function FAQItem({ question, answer }: FAQItemProps) {
    const [isOpen, setIsOpen] = React.useState(false);

    return (
        <div className="border-b border-border/40 last:border-0">
            <button
                className="flex w-full items-center justify-between py-4 text-left font-medium transition-all hover:text-primary"
                onClick={() => setIsOpen(!isOpen)}
            >
                {question}
                <ChevronDown
                    className={cn(
                        "h-4 w-4 shrink-0 transition-transform duration-200",
                        isOpen && "rotate-180"
                    )}
                />
            </button>
            <div
                className={cn(
                    "overflow-hidden text-sm transition-all duration-300 ease-in-out",
                    isOpen ? "max-h-96 pb-4 opacity-100" : "max-h-0 opacity-0"
                )}
            >
                <p className="text-muted-foreground">{answer}</p>
            </div>
        </div>
    );
}
