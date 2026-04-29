import { exiconEntries, type GlossaryEntry } from '@/../data/f3Glossary';
import type { BeatdownFocus } from '@/types/beatdown';

const FOCUS_KEYWORDS: Record<BeatdownFocus, string[]> = {
  full: [],
  legs: ['squat', 'lunge', 'monkey humper', 'imperial walker', 'mosey', 'run', 'jump', 'sprint', 'mountain climber'],
  core: ['hammer', 'sit-up', 'lbc', 'flutter', 'freddy', 'dolly', 'plank', 'crunch', 'box cutter', 'cockroach'],
  upper: ['merkin', 'pull-up', 'dip', 'press', 'curl', 'derkin', 'diamond'],
  cardio: ['burpee', 'run', 'sprint', 'mosey', 'broad jump', 'mountain climber'],
};

export function filterExiconForFocus(focus: BeatdownFocus, max = 80): GlossaryEntry[] {
  if (focus === 'full') return exiconEntries.slice(0, max);
  const kws = FOCUS_KEYWORDS[focus];
  const matches = exiconEntries.filter(e => {
    const t = e.term.toLowerCase();
    const d = (e.shortDescription || '').toLowerCase();
    return kws.some(k => t.includes(k) || d.includes(k));
  });
  if (matches.length >= 20) return matches.slice(0, max);
  // Backfill with general entries when focus is sparse.
  const seen = new Set(matches.map(m => m.id));
  for (const e of exiconEntries) {
    if (matches.length >= max) break;
    if (!seen.has(e.id)) matches.push(e);
  }
  return matches.slice(0, max);
}
