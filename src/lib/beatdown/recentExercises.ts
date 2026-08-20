/**
 * Deterministic analysis of which Exicon exercises appeared in recent
 * backblasts. Powers the "avoid over-repeating" block in the beatdown
 * prompt — the count is the number of recent beatdowns that used the
 * term (not raw mentions), which is the honest repeat signal for a Q.
 */

export interface RecentExerciseStat {
  term: string;
  /** Number of recent backblasts (events) mentioning the term. */
  count: number;
  /** ISO date (YYYY-MM-DD) of the most recent backblast using it. */
  lastUsed: string | null;
}

interface RecentEventText {
  event_date: string | Date | null;
  content_text: string | null;
}

export function extractRecentExercises(
  events: RecentEventText[],
  exicon: { term: string }[],
  opts: { max?: number; minTermLength?: number } = {}
): RecentExerciseStat[] {
  const max = opts.max ?? 25;
  const minTermLength = opts.minTermLength ?? 3;

  const texts = events
    .filter((e): e is RecentEventText & { content_text: string } => Boolean(e.content_text))
    .map((e) => ({ date: normalizeDate(e.event_date), text: e.content_text }));
  if (texts.length === 0 || exicon.length === 0) return [];

  // Keyed by canonical form so singular/plural Exicon entries for the same
  // movement fold together. termPattern() already matches both, so leaving
  // them separate double-counts one movement in the ledger and in the
  // avoid-repeat list the model reads.
  const byCanonical = new Map<string, RecentExerciseStat>();

  for (const { term } of exicon) {
    if (!term || term.length < minTermLength) continue;
    const key = canonicalKey(term);

    const pattern = termPattern(term);
    let count = 0;
    let lastUsed: string | null = null;
    for (const { date, text } of texts) {
      if (!pattern.test(text)) continue;
      count++;
      if (date && (!lastUsed || date > lastUsed)) lastUsed = date;
    }
    if (count === 0) continue;

    const existing = byCanonical.get(key);
    if (!existing) {
      byCanonical.set(key, { term, count, lastUsed });
      continue;
    }
    // Same movement under another spelling: keep the shorter (singular)
    // label, the higher count, and the most recent sighting.
    byCanonical.set(key, {
      term: term.length < existing.term.length ? term : existing.term,
      count: Math.max(count, existing.count),
      lastUsed: laterOf(lastUsed, existing.lastUsed),
    });
  }

  const stats: RecentExerciseStat[] = [...byCanonical.values()];

  stats.sort(
    (a, b) =>
      b.count - a.count ||
      (b.lastUsed ?? '').localeCompare(a.lastUsed ?? '') ||
      a.term.localeCompare(b.term)
  );
  return stats.slice(0, max);
}

/**
 * Case-insensitive, word-bounded, plural-tolerant matcher. Lookarounds are
 * used instead of \b because Exicon terms can start/end with digits or
 * punctuation ("11s", "1st & 10").
 */
function termPattern(term: string): RegExp {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pluralSuffix = /s$/i.test(term) ? '' : '(?:s|es)?';
  return new RegExp(`(?<![\\w])${escaped}${pluralSuffix}(?![\\w])`, 'i');
}

function normalizeDate(d: string | Date | null): string | null {
  if (!d) return null;
  if (d instanceof Date) return d.toISOString().slice(0, 10);
  return d.slice(0, 10);
}

/**
 * Fold a term to the movement it names. Strips one trailing "s" only — which
 * is exactly the set of duplicates the Exicon actually carries (LBC/LBCs,
 * Mountain Climber/Mountain Climbers, Rosalita/Rosalitas...). Stripping "es"
 * as well would break Blockee/Blockees, which differ by a single "s".
 */
function canonicalKey(term: string): string {
  const lower = term.toLowerCase();
  return lower.endsWith('s') ? lower.slice(0, -1) : lower;
}

function laterOf(a: string | null, b: string | null): string | null {
  if (!a) return b;
  if (!b) return a;
  return a > b ? a : b;
}
