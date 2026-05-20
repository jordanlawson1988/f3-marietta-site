"use client";

import { useEffect } from "react";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

export default function Error({
  error,
  reset,
}: {
  error: Error;
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin/analytics] page error:", error);
  }, [error]);

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <ClipFrame padding="p-8">
        <MonoTag>// error</MonoTag>
        <h2 className="font-display font-black uppercase text-[28px] mt-3 mb-4">
          Something went sideways
        </h2>
        <p className="font-mono text-xs text-muted mb-4">
          // {error.message || "Unknown error rendering this view."}
        </p>
        <button
          type="button"
          onClick={reset}
          className="bg-foreground text-background font-mono text-xs px-4 py-2"
        >
          retry
        </button>
      </ClipFrame>
    </section>
  );
}
