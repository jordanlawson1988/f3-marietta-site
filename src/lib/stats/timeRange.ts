export const TIME_RANGE_SLUGS = [
  "current-week",
  "current-month",
  "last-month",
  "last-30",
  "last-90",
  "ytd",
  "trailing-365",
  "custom",
] as const;

export type TimeRangeSlug = (typeof TIME_RANGE_SLUGS)[number];

export const TIME_RANGE_LABELS: Record<TimeRangeSlug, string> = {
  "current-week": "This week",
  "current-month": "This month",
  "last-month": "Last month",
  "last-30": "Last 30d",
  "last-90": "Last 90d",
  ytd: "YTD",
  "trailing-365": "Trailing 12mo",
  custom: "Custom",
};

export type TimeRange = {
  slug: TimeRangeSlug;
  from: Date;
  to: Date;
  label: string;
};

/**
 * Convert a Date to UTC midnight of its UTC calendar date.
 * NOTE: This uses UTC components — when `now` is a local-time Date evening in
 * a negative-UTC-offset timezone (e.g. America/New_York after 8pm), the UTC
 * calendar date can be the next day. Callers should pass a server-side `now`
 * (server runtime is UTC) rather than a browser-local Date for predictable
 * "today" semantics.
 */
function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

/**
 * The F3 Marietta audience is regional (Eastern Time). For "current month"
 * we calculate the date in ET so that an admin viewing the dashboard at 11pm
 * local on the last day of the month still sees the month they're in, not
 * the next UTC day.
 */
function etDateComponents(d: Date): { year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const [year, month, day] = fmt.format(d).split("-").map(Number);
  return { year, month: month - 1, day };
}

function parseIsoDate(s: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const t = Date.parse(s + "T00:00:00Z");
  if (Number.isNaN(t)) return null;
  return new Date(t);
}

export function parseTimeRange(
  params: { range?: string; from?: string; to?: string },
  now: Date = new Date(),
): TimeRange | null {
  const slug = params.range as TimeRangeSlug | undefined;
  if (!slug || !(TIME_RANGE_SLUGS as readonly string[]).includes(slug)) {
    return null;
  }
  const today = toDateOnly(now);

  if (slug === "ytd") {
    const from = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
    return { slug, from, to: today, label: TIME_RANGE_LABELS[slug] };
  }
  if (slug === "current-week") {
    // ISO week, Monday-anchored, ET-aware. Compute Monday of the user's ET
    // calendar day so a Sunday-night admin sees the week they just lived
    // through, not the upcoming one.
    const et = etDateComponents(now);
    const etToday = new Date(Date.UTC(et.year, et.month, et.day));
    const dow = etToday.getUTCDay(); // 0 = Sun
    const daysFromMonday = dow === 0 ? 6 : dow - 1;
    const from = new Date(etToday.getTime() - daysFromMonday * 86_400_000);
    return { slug, from, to: etToday, label: TIME_RANGE_LABELS[slug] };
  }
  if (slug === "current-month") {
    const et = etDateComponents(now);
    const from = new Date(Date.UTC(et.year, et.month, 1));
    const to = new Date(Date.UTC(et.year, et.month, et.day));
    return { slug, from, to, label: TIME_RANGE_LABELS[slug] };
  }
  if (slug === "last-month") {
    // The full prior calendar month, anchored to the ET-perceived "today".
    // Using day-0 of the current month gives the last day of the previous
    // month, which correctly handles 28/29/30/31-day months and crossing
    // the year boundary in January.
    const et = etDateComponents(now);
    const from = new Date(Date.UTC(et.year, et.month - 1, 1));
    const to = new Date(Date.UTC(et.year, et.month, 0));
    return { slug, from, to, label: TIME_RANGE_LABELS[slug] };
  }
  if (slug === "last-30" || slug === "last-90" || slug === "trailing-365") {
    const days =
      slug === "last-30" ? 30 : slug === "last-90" ? 90 : 365;
    const from = new Date(today.getTime() - days * 24 * 60 * 60 * 1000);
    return { slug, from, to: today, label: TIME_RANGE_LABELS[slug] };
  }
  // custom
  if (!params.from || !params.to) return null;
  const from = parseIsoDate(params.from);
  const to = parseIsoDate(params.to);
  if (!from || !to) return null;
  if (from.getTime() > to.getTime()) return null;
  if (to.getTime() > today.getTime()) return null;
  const maxTo = new Date(
    Date.UTC(from.getUTCFullYear() + 2, from.getUTCMonth(), from.getUTCDate())
  );
  if (to.getTime() > maxTo.getTime()) return null;
  return {
    slug,
    from,
    to,
    label: `${params.from} to ${params.to}`,
  };
}

export function serializeTimeRange(
  r: TimeRange,
): { range: TimeRangeSlug; from?: string; to?: string } {
  if (r.slug === "custom") {
    return {
      range: r.slug,
      from: r.from.toISOString().slice(0, 10),
      to: r.to.toISOString().slice(0, 10),
    };
  }
  return { range: r.slug };
}

export function defaultTimeRange(now: Date = new Date()): TimeRange {
  return parseTimeRange({ range: "current-month" }, now)!;
}

/**
 * Enumerate every YYYY-MM month touched by [from, to], inclusive.
 * Used to pad monthly chart series so the x-axis spans the selected range
 * even when some months have zero posts.
 */
export function monthsInRange(from: Date, to: Date): string[] {
  const months: string[] = [];
  let year = from.getUTCFullYear();
  let month = from.getUTCMonth();
  const endYear = to.getUTCFullYear();
  const endMonth = to.getUTCMonth();
  while (year < endYear || (year === endYear && month <= endMonth)) {
    months.push(`${year}-${String(month + 1).padStart(2, "0")}`);
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }
  return months;
}
