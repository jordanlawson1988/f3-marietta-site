"use client";

import { useState } from "react";
import { AssistantWidget } from "@/components/ui/AssistantWidget";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export function FloatingAssistant() {
    const [isOpen, setIsOpen] = useState(false);
    const [sessionKey, setSessionKey] = useState(0);

    const handleClose = () => {
        setIsOpen(false);
        // Increment session key to reset widget state on next open
        setSessionKey((prev) => prev + 1);
    };

    const handleOpen = () => {
        setIsOpen(true);
    };

    return (
        <>
            {/* Backdrop Overlay - only visible on mobile when open */}
            {isOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-[9998] sm:hidden"
                    onClick={handleClose}
                    onTouchEnd={handleClose}
                    aria-hidden="true"
                    style={{ pointerEvents: "auto" }}
                />
            )}

            {/* Main Container - higher z-index to ensure it's above everything */}
            <div
                className="fixed z-[9999] flex flex-col items-end pointer-events-none"
                style={{
                    bottom: "calc(env(safe-area-inset-bottom, 0px) + 16px)",
                    right: "16px",
                    left: "auto",
                }}
            >
                {/* Chat Panel */}
                <div
                    onClick={(e) => e.stopPropagation()}
                    onTouchEnd={(e) => e.stopPropagation()}
                    className={cn(
                        "pointer-events-auto w-[calc(100vw-32px)] sm:w-[400px] mb-4 border border-ink-3 bg-ink shadow-2xl transition-all duration-300 origin-bottom-right overflow-hidden flex flex-col clip-chamfer",
                        isOpen
                            ? "opacity-100 scale-100 translate-y-0"
                            : "opacity-0 scale-95 translate-y-4 pointer-events-none h-0 mb-0"
                    )}
                    style={{
                        maxHeight: isOpen ? "calc(100dvh - 120px)" : "0",
                    }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between border-b border-ink-3 px-5 py-3">
                        <div>
                            <h3 className="font-display font-semibold uppercase tracking-[.08em] text-[14px] text-bone">F3 Assistant</h3>
                            <p className="text-xs text-bone/60">Ask me anything</p>
                        </div>
                        <button
                            type="button"
                            onClick={handleClose}
                            onTouchEnd={(e) => {
                                e.preventDefault();
                                handleClose();
                            }}
                            className="h-10 w-10 inline-flex items-center justify-center transition-colors text-bone/60 hover:text-bone"
                            aria-label="Close AI Assistant"
                        >
                            <X className="h-5 w-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4">
                        <AssistantWidget key={sessionKey} compact />
                    </div>
                </div>

                {/* Toggle Button - Always visible when closed */}
                {!isOpen && (
                    <button
                        type="button"
                        onClick={handleOpen}
                        onTouchEnd={(e) => {
                            e.preventDefault();
                            handleOpen();
                        }}
                        className="pointer-events-auto inline-flex items-center gap-2 bg-steel text-bone border-[1.5px] border-steel px-5 py-3 font-display font-semibold uppercase tracking-[.1em] text-[13px] clip-chamfer hover:bg-steel-2 hover:border-steel-2 transition-all shadow-[0_8px_24px_rgba(12,12,12,.25)]"
                        aria-label="Open F3 AMA assistant"
                        style={{
                            WebkitTapHighlightColor: "transparent",
                            touchAction: "manipulation",
                        }}
                    >
                        AMA ↗
                    </button>
                )}
            </div>
        </>
    );
}
