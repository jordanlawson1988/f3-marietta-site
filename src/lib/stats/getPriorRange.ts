import type { TimeRange } from "./timeRange";

export type CompareMode = "off" | "prior" | "yoy";

/**
 * Derive the "prior comparable period" for a given range.
 *
 * - `prior`: the immediately-preceding window of the same length.
 *   e.g. current month = May → prior = April (anchored to same calendar
 *   shape when possible; falls back to same-length trailing window).
 * - `yoy`: same calendar window shifted back exactly 1 year.
 *
 * The label is the human-readable string for the delta caption ("vs Apr",
 * "vs 2025-05", etc.).
 */
export function getPriorRange(
  range: TimeRange,
  mode: CompareMode,
): { from: Date; to: Date; label: string } | null {
  if (mode === "off") return null;

  const fromMs = range.from.getTime();
  const toMs = range.to.getTime();
  const spanMs = toMs - fromMs;

  if (mode === "yoy") {
    const from = shiftYears(range.from, -1);
    const to = shiftYears(range.to, -1);
    return {
      from,
      to,
      label: `vs ${from.getUTCFullYear()}`,
    };
  }

  // prior: same-length window ending one day before this one's start.
  // For calendar-anchored ranges (current-month, current-week, ytd), prefer
  // the matching calendar period — looks cleaner in callouts.
  if (range.slug === "current-month" || range.slug === "last-month") {
    // Previous calendar month (full) — for current-month this is "last
    // month", for last-month this is the month before that.
    const y = range.from.getUTCFullYear();
    const m = range.from.getUTCMonth();
    const prevMonth = m === 0 ? 11 : m - 1;
    const prevYear = m === 0 ? y - 1 : y;
    const from = new Date(Date.UTC(prevYear, prevMonth, 1));
    const to = new Date(Date.UTC(prevYear, prevMonth + 1, 0));
    const monthName = from.toLocaleString("en-US", {
      month: "short",
      timeZone: "UTC",
    });
    return { from, to, label: `vs ${monthName}` };
  }

  if (range.slug === "current-week") {
    const from = new Date(fromMs - 7 * 86_400_000);
    const to = new Date(toMs - 7 * 86_400_000);
    return { from, to, label: "vs last wk" };
  }

  if (range.slug === "ytd") {
    // Match days-elapsed in the prior year.
    const prevYearStart = new Date(
      Date.UTC(range.from.getUTCFullYear() - 1, 0, 1),
    );
    const prevYearMatchingDay = new Date(
      prevYearStart.getTime() + (toMs - fromMs),
    );
    return {
      from: prevYearStart,
      to: prevYearMatchingDay,
      label: `vs ${prevYearStart.getUTCFullYear()} YTD`,
    };
  }

  // Default: trailing same-length window.
  const to = new Date(fromMs - 86_400_000);
  const from = new Date(to.getTime() - spanMs);
  return { from, to, label: "vs prior" };
}

function shiftYears(d: Date, years: number): Date {
  return new Date(
    Date.UTC(
      d.getUTCFullYear() + years,
      d.getUTCMonth(),
      d.getUTCDate(),
    ),
  );
}

/**
 * Short human-readable label for a delta chip when no compare is on
 * but the page still wants to hint the comparison span.
 */
export function deltaLabelForRange(slug: string): string {
  switch (slug) {
    case "current-week":
      return "vs last wk";
    case "current-month":
      return "vs last mo";
    case "last-month":
      return "vs prior mo";
    case "ytd":
      return "vs ytd-1";
    case "last-30":
      return "vs prior 30d";
    case "last-90":
      return "vs prior 90d";
    case "trailing-365":
      return "vs prior yr";
    default:
      return "vs prior";
  }
}
