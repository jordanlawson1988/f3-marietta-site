import { getSql } from "@/lib/db";
import type { TimeRange } from "./timeRange";

export type DayTimeCell = {
  /** 0 = Mon … 6 = Sun (ISO) */
  dow: number;
  bucket: string;
  count: number;
};

export type HeatmapResult = {
  cells: DayTimeCell[];
  /** total posts that fell into a known time bucket */
  withTime: number;
  /** total posts in the range that we examined */
  total: number;
  /** AOs whose backblasts couldn't be timed (no event_time, no schedule) */
  unscheduledAos: Array<{ ao: string; posts: number }>;
};

/**
 * The exhaustive list of time buckets the heatmap renders. Buckets are
 * tuned to F3 Marietta's actual schedule grain (5:15, 5:30, 5:45, 6:00,
 * 6:30) so two adjacent times don't collapse into the same column. The
 * "later" and "?" columns at the end are hidden by the renderer when
 * empty, but the canonical pre-dawn five are always shown — an empty
 * column there is informative ("no AO posts at that time on that day").
 */
export const TIME_BUCKETS: string[] = [
  "5:15a",
  "5:30a",
  "5:45a",
  "6:00a",
  "6:30a",
  "later",
  "?",
];

/**
 * The 5 F3-canonical buckets that always render even if empty. Anything
 * outside this set ("later", "?") is hidden when its column is all-zero.
 */
export const CANONICAL_BUCKETS = new Set([
  "5:15a",
  "5:30a",
  "5:45a",
  "6:00a",
  "6:30a",
]);

/**
 * Convert an (hour, min) pair to one of the buckets above. Boundaries are
 * chosen so the 5 known F3 start times (05:15, 05:30, 05:45, 06:00, 06:30)
 * each fall cleanly into their own bucket, with reasonable rounding for any
 * off-schedule one-off events.
 */
export function bucketizeFromHourMin(hour: number, min: number): string {
  if (Number.isNaN(hour)) return "?";
  if (hour < 5) return "?";
  if (hour === 5) {
    if (min < 23) return "5:15a"; // 05:00 – 05:22 → 5:15a
    if (min < 38) return "5:30a"; // 05:23 – 05:37 → 5:30a
    return "5:45a"; // 05:38 – 05:59 → 5:45a
  }
  if (hour === 6) {
    if (min < 15) return "6:00a"; // 06:00 – 06:14 → 6:00a
    if (min < 45) return "6:30a"; // 06:15 – 06:44 → 6:30a
    return "later"; // 06:45 – 06:59 → later
  }
  if (hour >= 7) return "later";
  return "?";
}

export function bucketize(time: string | null | undefined): string {
  if (!time) return "?";
  // event_time is stored as either "HH:MM" or "HH:MM:SS" or sometimes the
  // raw Slack date_picker payload. Pull the first H/HH out.
  const m = time.match(/^(\d{1,2})(?::(\d{2}))?/);
  if (!m) return "?";
  return bucketizeFromHourMin(parseInt(m[1], 10), parseInt(m[2] ?? "0", 10));
}

/**
 * Build a (day-of-week × time-bucket) heatmap of backblast counts. Day index
 * is ISO (0 = Monday) so the grid reads Mon-Sun naturally.
 *
 * Backblast `event_time` is rarely populated by the Slack parser, so we fall
 * back to the scheduled `workout_schedule.start_time` joined by `ao_name +
 * day_of_week`. That covers the recurring AOs cleanly; one-offs without a
 * schedule still land in the "?" bucket.
 */
export async function getDayTimeHeatmap(
  range: TimeRange,
  aoSlugs: string[] | null,
): Promise<HeatmapResult> {
  try {
    const sql = getSql();
    const from = range.from.toISOString().slice(0, 10);
    const to = range.to.toISOString().slice(0, 10);
    const aoFilter = aoSlugs && aoSlugs.length > 0 ? aoSlugs : null;

    const [rows, scheduleRows] = await Promise.all([
      sql`
        SELECT
          e.event_date::text AS event_date,
          e.event_time,
          e.ao_display_name AS ao_name
        FROM f3_events e
        JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
        WHERE e.event_kind = 'backblast'
          AND e.is_deleted = false
          AND c.is_enabled = true
          AND e.event_date IS NOT NULL
          AND e.event_date >= ${from} AND e.event_date <= ${to}
          AND e.ao_display_name IS NOT NULL
      ` as unknown as Promise<Array<{
        event_date: string;
        event_time: string | null;
        ao_name: string;
      }>>,
      sql`
        SELECT ao_name, day_of_week, start_time::text AS start_time
        FROM workout_schedule
        WHERE is_active = true
      ` as unknown as Promise<Array<{
        ao_name: string;
        day_of_week: number;
        start_time: string;
      }>>,
    ]);

    // Scheduled-time lookup: key = `${ao_name}|${day_of_week 0..6 with Sun=0}`.
    // workout_schedule.day_of_week is 0=Sun..6=Sat (Postgres EXTRACT DOW
    // convention used elsewhere in this codebase).
    const scheduleLookup = new Map<string, string>();
    for (const s of scheduleRows) {
      scheduleLookup.set(`${s.ao_name}|${s.day_of_week}`, s.start_time);
    }

    const lookup = new Map<string, number>();
    const unscheduledMap = new Map<string, number>();
    let total = 0;
    let withTime = 0;
    for (const r of rows) {
      if (aoFilter) {
        const slug = r.ao_name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "");
        if (!aoFilter.includes(slug)) continue;
      }
      total += 1;
      const d = new Date(r.event_date + "T00:00:00Z");
      const sunDow = d.getUTCDay(); // 0=Sun..6=Sat
      // ISO display ordering: Mon=0..Sun=6
      const isoDow = (sunDow + 6) % 7;

      let bucket = bucketize(r.event_time);
      if (bucket === "?") {
        const scheduled = scheduleLookup.get(`${r.ao_name}|${sunDow}`);
        if (scheduled) bucket = bucketize(scheduled);
      }
      if (bucket === "?") {
        unscheduledMap.set(r.ao_name, (unscheduledMap.get(r.ao_name) ?? 0) + 1);
      } else {
        withTime += 1;
      }
      const key = `${isoDow}|${bucket}`;
      lookup.set(key, (lookup.get(key) ?? 0) + 1);
    }

    const cells: DayTimeCell[] = [];
    for (let dow = 0; dow < 7; dow++) {
      for (const bucket of TIME_BUCKETS) {
        cells.push({
          dow,
          bucket,
          count: lookup.get(`${dow}|${bucket}`) ?? 0,
        });
      }
    }
    const unscheduledAos = [...unscheduledMap.entries()]
      .map(([ao, posts]) => ({ ao, posts }))
      .sort((a, b) => b.posts - a.posts);
    return { cells, withTime, total, unscheduledAos };
  } catch (err) {
    console.error("[getDayTimeHeatmap] failed:", err);
    return { cells: [], withTime: 0, total: 0, unscheduledAos: [] };
  }
}
