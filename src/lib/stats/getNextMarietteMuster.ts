import { getSql } from "@/lib/db";

const DAY_LABELS: Record<number, string> = {
  1: "MON",
  2: "TUE",
  3: "WED",
  4: "THU",
  5: "FRI",
  6: "SAT",
  7: "SUN",
};

const WEEKDAY_TO_ISO: Record<string, number> = {
  Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7,
};

/**
 * Public shape of the resolved next muster — used by TopBar to render a
 * tappable link straight to the AO card on /workouts.
 *
 * Marietta GA is in America/New_York; we always compute relative to that
 * timezone so the result is correct no matter where the request is served
 * from (Vercel functions run in UTC by default — using `new Date()`'s
 * local accessors would silently roll over to "tomorrow" hours before ET
 * does and bury today's last beatdown).
 */
export interface NextMuster {
  /** "MON" / "TUE" / … — short day code matching the AOCard chip. */
  dayLabel: string;
  /** "5:30am" — 12-hour lowercase, matches the AOCard time chip. */
  timeLabel: string;
  /** "MON 5:30am" — single-line combined label for the bar. */
  combinedLabel: string;
  /** AO display name e.g. "The Battlefield". */
  aoName: string;
  /** Slugified AO name used as the anchor id on the AOCard. */
  aoSlug: string;
  /** Deep link to the AO card on the /workouts page. */
  href: string;
  /** True when the schedule was empty / unavailable — caller can fall back. */
  isFallback: boolean;
}

interface ScheduleRow {
  day_of_week: number;
  start_time: string;
  ao_name: string;
}

/** Slugify "Marietta Square" → "marietta-square" for stable card anchors. */
export function slugifyAo(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** "06:00:00" → "6:00am" — same logic as AOCard.formatTime so the bar
 *  reads identically to the card the user lands on. */
function formatTimeLabel(hhmmss: string): string {
  const [h, m] = hhmmss.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "am" : "pm";
  return `${hour12}:${(m ?? 0).toString().padStart(2, "0")}${ampm}`;
}

/**
 * Compute (day_of_week, minutes_of_day) in America/New_York from any
 * Date instance. ISO week numbering: Mon=1 .. Sun=7.
 */
export function nowInET(now: Date = new Date()): {
  day_of_week: number;
  minutes_of_day: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekday = get("weekday");
  let hour = parseInt(get("hour"), 10);
  const minute = parseInt(get("minute"), 10);
  // Some Intl impls emit "24" for midnight with hour12:false — normalize.
  if (hour === 24) hour = 0;
  return {
    day_of_week: WEEKDAY_TO_ISO[weekday] ?? 1,
    minutes_of_day: hour * 60 + minute,
  };
}

/**
 * Pure: pick the next workout in the week given the schedule and an ET
 * "now". Returns null if the schedule is empty. Logic:
 *   1. Same day, start_time strictly after now → that one (sorted by time).
 *   2. Otherwise the earliest workout on the next day with a workout,
 *      walking forward up to 7 days (wraps through Sunday).
 *
 * "Strictly after" means a workout already started is skipped — most
 * users won't drive to a beatdown that's already begun.
 */
export function findNextMuster(
  schedule: ScheduleRow[],
  now: { day_of_week: number; minutes_of_day: number },
): ScheduleRow | null {
  if (schedule.length === 0) return null;

  // Annotate with minutes so we can sort and compare numerically.
  const enriched = schedule
    .map((r) => {
      const [hh, mm] = r.start_time.split(":").map(Number);
      return { ...r, _minutes: hh * 60 + (mm ?? 0) };
    })
    .sort((a, b) => a._minutes - b._minutes);

  // 1. Today, still upcoming.
  const todayUpcoming = enriched.find(
    (w) => w.day_of_week === now.day_of_week && w._minutes > now.minutes_of_day,
  );
  if (todayUpcoming) {
    const { _minutes: _m, ...rest } = todayUpcoming;
    void _m;
    return rest;
  }

  // 2. Next day with at least one workout (wrap through to next week).
  for (let offset = 1; offset <= 7; offset++) {
    const targetDay = ((now.day_of_week - 1 + offset) % 7) + 1;
    const next = enriched.find((w) => w.day_of_week === targetDay);
    if (next) {
      const { _minutes: _m, ...rest } = next;
      void _m;
      return rest;
    }
  }
  return null;
}

const FALLBACK: NextMuster = {
  dayLabel: "MON",
  timeLabel: "5:30am",
  combinedLabel: "MON 5:30am",
  aoName: "The Battlefield",
  aoSlug: "the-battlefield",
  href: "/workouts",
  isFallback: true,
};

/**
 * Look up the next Marietta Region muster (day + time + AO) and return
 * a deep link to the AO's card on /workouts. Times are always evaluated
 * in America/New_York. Only Marietta-region (`regions.slug='marietta'`)
 * AOs are considered.
 */
export async function getNextMarietteMuster(): Promise<NextMuster> {
  try {
    const sql = getSql();
    const rows = (await sql`
      SELECT ws.day_of_week, ws.start_time, ws.ao_name
      FROM workout_schedule ws
      JOIN regions r ON r.id = ws.region_id
      WHERE ws.is_active = true
        AND r.is_active = true
        AND r.slug = 'marietta'
      ORDER BY ws.day_of_week, ws.start_time
    `) as Array<{ day_of_week: number; start_time: string; ao_name: string }>;

    if (!rows || rows.length === 0) return FALLBACK;

    const next = findNextMuster(rows, nowInET());
    if (!next) return FALLBACK;

    const dayLabel = DAY_LABELS[next.day_of_week] ?? "MON";
    const timeLabel = formatTimeLabel(next.start_time);
    const aoSlug = slugifyAo(next.ao_name);

    return {
      dayLabel,
      timeLabel,
      combinedLabel: `${dayLabel} ${timeLabel}`,
      aoName: next.ao_name,
      aoSlug,
      href: `/workouts#ao-${aoSlug}`,
      isFallback: false,
    };
  } catch (err) {
    console.error("[getNextMarietteMuster] failed:", err);
    return FALLBACK;
  }
}
