import { exiconEntries, type GlossaryEntry } from '@/../data/f3Glossary';
import type { BeatdownFocus } from '@/types/beatdown';

/**
 * Codex tags (stored by syncGlossary as category/keywords) that map to each
 * focus. Tag hits are the strongest signal; keyword matching remains as a
 * fallback because only a subset of Exicon entries carry tags.
 */
const FOCUS_TAGS: Record<BeatdownFocus, string[]> = {
  full: ['Full Body'],
  legs: ['Legs'],
  core: ['Core', 'Mary'],
  upper: ['Arms'],
  cardio: ['Cardio', 'Run', 'Mosey'],
};

const FOCUS_KEYWORDS: Record<BeatdownFocus, string[]> = {
  full: [],
  legs: ['squat', 'lunge', 'monkey humper', 'imperial walker', 'jump', 'sprint', 'mountain climber', 'calf'],
  core: ['hammer', 'sit-up', 'lbc', 'flutter', 'freddy', 'dolly', 'plank', 'crunch', 'box cutter', 'cockroach'],
  upper: ['merkin', 'pull-up', 'dip', 'press', 'curl', 'derkin', 'diamond'],
  cardio: ['burpee', 'run', 'sprint', 'mosey', 'broad jump', 'mountain climber'],
};

const ROUTINE_TAGS = new Set(['routine', 'workouts']);
const ROUTINE_SEED_COUNT = 12;

/**
 * Rank Exicon entries for a focus. Order: focus-scored exercises first
 * (tag match 4 pts, term keyword 2 pts, description keyword 1 pt), then a
 * seed of Routine/format entries (11s, Dora, ladders — structural
 * vocabulary that applies to any focus), then a general backfill up to max.
 */
export function rankExiconEntries(entries: GlossaryEntry[], focus: BeatdownFocus, max = 80): GlossaryEntry[] {
  const focusTags = new Set(FOCUS_TAGS[focus].map((t) => t.toLowerCase()));
  const kws = FOCUS_KEYWORDS[focus];

  const scored = entries.map((e) => {
    const entryTags = [e.category, ...(e.keywords ?? [])]
      .filter((t): t is string => Boolean(t))
      .map((t) => t.toLowerCase());
    const isRoutine = entryTags.some((t) => ROUTINE_TAGS.has(t));

    let score = 0;
    if (entryTags.some((t) => focusTags.has(t))) score += 4;
    const term = e.term.toLowerCase();
    const desc = (e.shortDescription || '').toLowerCase();
    if (kws.some((k) => term.includes(k))) score += 2;
    else if (kws.some((k) => desc.includes(k))) score += 1;

    return { e, score, isRoutine };
  });

  const picked: GlossaryEntry[] = [];
  const pickedIds = new Set<string>();
  const push = (entry: GlossaryEntry) => {
    if (picked.length >= max || pickedIds.has(entry.id)) return;
    pickedIds.add(entry.id);
    picked.push(entry);
  };

  const byScoreThenTerm = (a: { score: number; e: GlossaryEntry }, b: { score: number; e: GlossaryEntry }) =>
    b.score - a.score || a.e.term.localeCompare(b.e.term);

  scored.filter((s) => s.score > 0 && !s.isRoutine).sort(byScoreThenTerm).forEach((s) => push(s.e));
  scored.filter((s) => s.isRoutine).sort(byScoreThenTerm).slice(0, ROUTINE_SEED_COUNT).forEach((s) => push(s.e));
  for (const s of scored) {
    if (picked.length >= max) break;
    push(s.e);
  }

  return picked;
}

export function filterExiconForFocus(focus: BeatdownFocus, max = 80): GlossaryEntry[] {
  return rankExiconEntries(exiconEntries, focus, max);
}
