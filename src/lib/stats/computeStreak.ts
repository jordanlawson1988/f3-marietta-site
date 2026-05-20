/**
 * Longest consecutive ISO-week streak across a set of YYYY-MM-DD dates.
 *
 * - Dates in the same ISO week count as one week.
 * - Adjacent ISO weeks extend the streak. A gap of one or more weeks resets.
 * - Returns 0 for empty input.
 */
export function computeLongestStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  const weeks = new Set<number>();
  for (const d of dates) {
    weeks.add(isoWeekKey(d));
  }
  const sorted = [...weeks].sort((a, b) => a - b);
  let best = 1;
  let run = 1;
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === sorted[i - 1] + 1) {
      run++;
      if (run > best) best = run;
    } else {
      run = 1;
    }
  }
  return best;
}

/**
 * Encode a date's ISO week as an absolute week number since the Unix epoch.
 *
 * Jan 1, 1970 was a Thursday, so it belongs to ISO W1 1970. Shifting any date
 * to the Thursday of its ISO week and dividing by 7 days gives a contiguous
 * integer that increments by exactly 1 for every adjacent ISO week — including
 * across year boundaries where `year * 53 + week` would produce a gap.
 */
function isoWeekKey(yyyyMmDd: string): number {
  const d = new Date(yyyyMmDd + "T00:00:00Z");
  // Move to Thursday of this ISO week (Mon=0, Sun=6).
  const dayNum = (d.getUTCDay() + 6) % 7;
  d.setUTCDate(d.getUTCDate() - dayNum + 3);
  // Total weeks elapsed since Unix epoch Thursday (1970-01-01).
  return Math.floor(d.getTime() / (7 * 86_400_000));
}
