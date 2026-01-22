"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/Button";
import { Sparkles, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { RELEASES } from "@/data/releases";

const STORAGE_KEY = "f3-marietta-last-seen-version";

export function ReleaseNotes() {
    const [isOpen, setIsOpen] = useState(false);
    const [hasNewUpdates, setHasNewUpdates] = useState(false);

    useEffect(() => {
        // Check if user has seen the latest version
        const lastSeenVersion = localStorage.getItem(STORAGE_KEY);
        const latestVersion = RELEASES[0]?.version;

        if (latestVersion && lastSeenVersion !== latestVersion) {
            setHasNewUpdates(true);
        }
    }, []);

    const handleOpen = () => {
        setIsOpen(true);
        // Mark as seen
        const latestVersion = RELEASES[0]?.version;
        if (latestVersion) {
            localStorage.setItem(STORAGE_KEY, latestVersion);
            setHasNewUpdates(false);
        }
    };

    const handleClose = () => {
        setIsOpen(false);
    };

    return (
        <div className="fixed bottom-4 left-4 z-50 flex flex-col items-start sm:bottom-8 sm:left-8">
            {/* Release Notes Panel */}
            <div
                className={cn(
                    "mb-4 w-[90vw] sm:w-[360px] rounded-xl border border-border bg-muted shadow-2xl transition-all duration-300 origin-bottom-left overflow-hidden flex flex-col max-h-[70vh]",
                    isOpen
                        ? "opacity-100 scale-100 translate-y-0"
                        : "opacity-0 scale-95 translate-y-4 pointer-events-none h-0 mb-0"
                )}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-4 border-b border-border bg-muted/30">
                    <div className="flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-primary" />
                        <h3 className="font-bold font-heading text-lg">What&apos;s New</h3>
                    </div>
                    <Button
                        variant="ghost"
                        size="icon"
                        onClick={handleClose}
                        className="h-8 w-8 rounded-full hover:bg-background/80"
                    >
                        <X className="h-4 w-4" />
                        <span className="sr-only">Close</span>
                    </Button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {RELEASES.map((release) => (
                        <div key={release.version} className="space-y-2">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-sm">{release.title}</h4>
                                <span className="text-xs text-muted-foreground">
                                    {new Date(release.date + 'T00:00:00').toLocaleDateString("en-US", {
                                        month: "short",
                                        day: "numeric",
                                        year: "numeric",
                                    })}
                                </span>
                            </div>
                            <ul className="space-y-1">
                                {release.changes.map((change, idx) => (
                                    <li
                                        key={idx}
                                        className="text-sm text-muted-foreground flex items-start gap-2"
                                    >
                                        <span className="text-primary mt-1">•</span>
                                        <span>{change}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>
            </div>

            {/* Toggle Button */}
            <Button
                onClick={() => (isOpen ? handleClose() : handleOpen())}
                size="icon"
                className={cn(
                    "rounded-full shadow-lg transition-all duration-300 hover:scale-105 h-12 w-12 relative",
                    isOpen
                        ? "bg-muted text-muted-foreground hover:bg-muted/80"
                        : "bg-primary text-primary-foreground hover:bg-[#3A5E88]"
                )}
            >
                {isOpen ? (
                    <X className="h-5 w-5" />
                ) : (
                    <Sparkles className="h-5 w-5" />
                )}

                {/* NEW badge */}
                {hasNewUpdates && !isOpen && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full animate-pulse">
                        NEW
                    </span>
                )}

                <span className="sr-only">Release Notes</span>
            </Button>
        </div>
    );
}
