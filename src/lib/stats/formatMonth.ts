/**
 * Convert a "YYYY-MM" key (the canonical shape used by getOverviewStats
 * and monthsInRange) into a 3-letter uppercase month abbreviation suitable
 * for chart X-axis labels.
 *
 *   formatChartMonth("2026-01") → "JAN"
 *   formatChartMonth("2026-12") → "DEC"
 *
 * Returns the raw input when it doesn't parse — defensive against any
 * future change in the upstream serialization.
 */
export function formatChartMonth(yyyyMm: string): string {
  const m = /^(\d{4})-(\d{2})$/.exec(yyyyMm);
  if (!m) return yyyyMm;
  const month = parseInt(m[2], 10);
  if (month < 1 || month > 12) return yyyyMm;
  const d = new Date(Date.UTC(2000, month - 1, 1));
  return d
    .toLocaleString("en-US", { month: "short", timeZone: "UTC" })
    .toUpperCase();
}
