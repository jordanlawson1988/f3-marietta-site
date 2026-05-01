"use client";

import { useState, useMemo } from "react";
import { lexiconEntries, exiconEntries, type GlossaryEntry } from "@/../data/f3Glossary";

type Tab = "all" | "lexicon" | "exicon";

const TABS: { id: Tab; label: string; count: number }[] = [
  { id: "all", label: "All Terms", count: lexiconEntries.length + exiconEntries.length },
  { id: "lexicon", label: "Lexicon", count: lexiconEntries.length },
  { id: "exicon", label: "Exicon", count: exiconEntries.length },
];

function normalizeFirstChar(term: string): string {
  const first = term.replace(/^[^A-Za-z0-9]/, "").charAt(0).toUpperCase();
  return /[0-9]/.test(first) ? "#" : first;
}

function groupByLetter(
  entries: GlossaryEntry[]
): Record<string, GlossaryEntry[]> {
  const groups: Record<string, GlossaryEntry[]> = {};
  for (const entry of entries) {
    const letter = normalizeFirstChar(entry.term);
    if (!groups[letter]) groups[letter] = [];
    groups[letter].push(entry);
  }
  return groups;
}

function sortedLetters(groups: Record<string, unknown>): string[] {
  return Object.keys(groups).sort((a, b) => {
    if (a === "#") return 1;
    if (b === "#") return -1;
    return a.localeCompare(b);
  });
}

export function GlossaryList() {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState<Tab>("all");

  const baseEntries = useMemo(() => {
    if (activeTab === "lexicon") return lexiconEntries;
    if (activeTab === "exicon") return exiconEntries;
    return [...lexiconEntries, ...exiconEntries];
  }, [activeTab]);

  const filteredEntries = useMemo(() => {
    if (!searchQuery.trim()) return baseEntries;
    const q = searchQuery.toLowerCase();
    return baseEntries.filter(
      (e) =>
        e.term.toLowerCase().includes(q) ||
        e.shortDescription.toLowerCase().includes(q) ||
        (e.longDescription && e.longDescription.toLowerCase().includes(q))
    );
  }, [searchQuery, baseEntries]);

  const groups = useMemo(() => groupByLetter(filteredEntries), [filteredEntries]);
  const letters = useMemo(() => sortedLetters(groups), [groups]);

  const isLexicon = (entry: GlossaryEntry) => lexiconEntries.includes(entry);

  return (
    <div>
      {/* Tab bar */}
      <div className="flex gap-1 mb-6 border-b border-line-soft">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-3 font-mono text-[11px] tracking-[.12em] uppercase transition-colors border-b-2 -mb-px ${
              activeTab === tab.id
                ? "border-ink text-ink"
                : "border-transparent text-muted hover:text-ink"
            }`}
          >
            {tab.label} ({tab.count})
          </button>
        ))}
      </div>

      {/* Subtitle for current tab */}
      <p className="font-mono text-[11px] tracking-[.08em] text-muted mb-6">
        {activeTab === "lexicon" && "// Culture, roles, places, and the language of the Gloom."}
        {activeTab === "exicon" && "// Exercises — the movements that make up a Beatdown."}
        {activeTab === "all" && "// Everything. Lexicon terms + Exicon exercises."}
      </p>

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
          placeholder="Search terms..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-3 border border-line-soft bg-transparent font-mono text-[13px] tracking-[.05em] uppercase focus:outline-none focus:border-ink"
        />
      </div>

      {/* Term count */}
      <p className="font-mono text-[11px] tracking-[.1em] uppercase text-muted mb-10">
        {filteredEntries.length} term{filteredEntries.length !== 1 ? "s" : ""}
        {searchQuery.trim() ? " matched" : " total"}
      </p>

      {/* Letter groups */}
      {letters.length === 0 ? (
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
        letters.map((letter) => (
          <div
            key={letter}
            id={letter}
            className="py-12 border-b border-line-soft"
          >
            <div className="font-display font-bold uppercase text-steel text-[clamp(56px,8vw,96px)] leading-none">
              {letter}
            </div>
            <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
              {groups[letter].map((t) => (
                <div key={t.id} id={t.id} className="flex flex-col">
                  <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">
                    // {activeTab === "all" ? (isLexicon(t) ? "Lexicon" : "Exicon") : t.term}
                  </span>
                  <span className="font-display font-bold uppercase text-[22px] tracking-[-.01em] mt-1">
                    {t.term}
                  </span>
                  <span className="mt-1 text-[14px] leading-[1.55] text-ink/80">
                    {t.shortDescription}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
