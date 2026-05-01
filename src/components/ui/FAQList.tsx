"use client";

import { useState, useMemo } from "react";

export interface FAQEntry {
  slug: string;
  question: string;
  answer: string;
  category: string;
}

function groupByCategory(entries: FAQEntry[]): Record<string, FAQEntry[]> {
  const groups: Record<string, FAQEntry[]> = {};
  for (const entry of entries) {
    const cat = entry.category || "General";
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(entry);
  }
  return groups;
}

export function FAQList({ entries }: { entries: FAQEntry[] }) {
  const [searchQuery, setSearchQuery] = useState("");
  const [openSlug, setOpenSlug] = useState<string | null>(null);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(
      (e) =>
        e.question.toLowerCase().includes(q) ||
        e.answer.toLowerCase().includes(q)
    );
  }, [searchQuery, entries]);

  const groups = useMemo(() => groupByCategory(filtered), [filtered]);
  const categories = useMemo(
    () => Object.keys(groups).sort((a, b) => a.localeCompare(b)),
    [groups]
  );

  const toggle = (slug: string) =>
    setOpenSlug((prev) => (prev === slug ? null : slug));

  return (
    <div>
      {/* Search bar */}
      <div className="relative mb-4">
        <svg
          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <circle cx="11" cy="11" r="8" />
          <line x1="21" y1="21" x2="16.65" y2="16.65" />
        </svg>
        <input
          type="text"
          placeholder="Search questions..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-3 border border-line-soft bg-transparent font-mono text-[13px] tracking-[.05em] uppercase focus:outline-none focus:border-ink"
        />
      </div>

      {/* Count */}
      <p className="font-mono text-[11px] tracking-[.1em] uppercase text-muted mb-10">
        {filtered.length} question{filtered.length !== 1 ? "s" : ""}
        {searchQuery.trim() ? " matched" : " total"}
      </p>

      {/* Categories */}
      {categories.length === 0 ? (
        <div className="py-16 text-center">
          <p className="font-mono text-[13px] tracking-[.05em] uppercase text-muted">
            No results for &ldquo;{searchQuery}&rdquo;
          </p>
          <button
            onClick={() => setSearchQuery("")}
            className="mt-4 font-mono text-[11px] tracking-[.1em] uppercase text-ink underline underline-offset-4"
          >
            Clear search
          </button>
        </div>
      ) : (
        categories.map((cat) => (
          <div key={cat} className="mb-12">
            <h2 className="font-mono text-[11px] tracking-[.15em] uppercase text-muted mb-4">
              // {cat}
            </h2>
            <div className="border-t border-line-soft">
              {groups[cat].map((faq) => {
                const isOpen = openSlug === faq.slug;
                return (
                  <div
                    key={faq.slug}
                    className="border-b border-line-soft"
                  >
                    <button
                      type="button"
                      onClick={() => toggle(faq.slug)}
                      className="w-full flex items-center justify-between gap-4 py-5 text-left group"
                      aria-expanded={isOpen}
                    >
                      <span className="font-display font-bold uppercase text-[16px] sm:text-[18px] tracking-[-.01em] group-hover:text-steel transition-colors">
                        {faq.question}
                      </span>
                      <span
                        className={`shrink-0 font-mono text-[18px] text-muted transition-transform duration-200 ${
                          isOpen ? "rotate-45" : ""
                        }`}
                        aria-hidden="true"
                      >
                        +
                      </span>
                    </button>
                    <div
                      className={`overflow-hidden transition-all duration-200 ${
                        isOpen ? "max-h-[500px] pb-5" : "max-h-0"
                      }`}
                    >
                      <p className="text-[15px] leading-[1.65] text-ink/80 max-w-2xl">
                        {faq.answer}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
