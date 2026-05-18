export const TIME_RANGE_SLUGS = [
  "ytd",
  "mtd",
  "last-30",
  "last-90",
  "custom",
] as const;

export type TimeRangeSlug = (typeof TIME_RANGE_SLUGS)[number];

export const TIME_RANGE_LABELS: Record<TimeRangeSlug, string> = {
  ytd: "Year-to-date",
  mtd: "Month-to-date",
  "last-30": "Last 30 days",
  "last-90": "Last 90 days",
  custom: "Custom range",
};

export type TimeRange = {
  slug: TimeRangeSlug;
  from: Date;
  to: Date;
  label: string;
};

const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

function toDateOnly(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
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
  if (slug === "mtd") {
    const from = new Date(
      Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1),
    );
    return { slug, from, to: today, label: TIME_RANGE_LABELS[slug] };
  }
  if (slug === "last-30" || slug === "last-90") {
    const days = slug === "last-30" ? 30 : 90;
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
  if (to.getTime() - from.getTime() > TWO_YEARS_MS) return null;
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
  return parseTimeRange({ range: "ytd" }, now)!;
}
