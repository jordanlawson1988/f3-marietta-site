import { test } from "node:test";
import { strict as assert } from "node:assert";
import { rankExiconEntries } from "../src/lib/beatdown/exicon";
import type { GlossaryEntry } from "../data/f3Glossary";

const ENTRIES: GlossaryEntry[] = [
  { id: "bonnie-blairs", term: "Bonnie Blairs", shortDescription: "Alternating jump lunges.", category: "Legs", keywords: ["Legs"] },
  { id: "monkey-humpers", term: "Monkey Humpers", shortDescription: "Squat hold, grab ankles.", keywords: [] },
  { id: "merkin", term: "Merkin", shortDescription: "The F3 push-up.", category: "Arms", keywords: ["Arms"] },
  { id: "lbc", term: "LBC", shortDescription: "Little Baby Crunches for the core.", category: "Core", keywords: ["Core"] },
  { id: "dora", term: "Dora 1-2-3", shortDescription: "Partner workout: 100/200/300 reps.", category: "Routine", keywords: ["Routine", "Partner"] },
  { id: "elevens", term: "11s", shortDescription: "Ladder totaling eleven reps.", category: "Routine", keywords: ["Routine"] },
  { id: "ssh", term: "SSH", shortDescription: "Side Straddle Hop.", category: "Full Body", keywords: ["Full Body", "Cardio"] },
  { id: "tempo-squat", term: "Tempo Squat", shortDescription: "Slow squat with pause.", keywords: [] },
];

test("category/keyword tag matches outrank description keyword matches", () => {
  const ranked = rankExiconEntries(ENTRIES, "legs", 5);
  const terms = ranked.map((e) => e.term);
  assert.equal(terms[0], "Bonnie Blairs", "tagged Legs entry ranks first");
  assert.ok(terms.includes("Tempo Squat"), "keyword 'squat' match still included");
});

test("routine/format entries are seeded for every focus", () => {
  const ranked = rankExiconEntries(ENTRIES, "upper", 8);
  const terms = ranked.map((e) => e.term);
  assert.ok(terms.includes("Dora 1-2-3"), "routine included for upper focus");
  assert.ok(terms.includes("11s"), "routine included for upper focus");
  assert.equal(terms[0], "Merkin", "focus-tagged entry still ranks first");
});

test("full focus prefers Full Body tags and backfills generalists", () => {
  const ranked = rankExiconEntries(ENTRIES, "full", 8);
  assert.equal(ranked[0].term, "SSH");
  assert.ok(ranked.length >= 5, "backfills beyond direct tag matches");
});

test("max cap is respected and results are unique", () => {
  const ranked = rankExiconEntries(ENTRIES, "core", 3);
  assert.equal(ranked.length, 3);
  assert.equal(new Set(ranked.map((e) => e.id)).size, 3);
});
