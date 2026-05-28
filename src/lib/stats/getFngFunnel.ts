import { getAttendanceFact } from "./getAttendanceFact";
import { getAliasMap } from "./aliasMap";
import { getSql } from "@/lib/db";
import { parseAttendance } from "./parseAttendance";
import type { SlackUser } from "./resolvePaxIdentity";
import type { TimeRange } from "./timeRange";

export type FngFunnel = {
  /** FNGs called out in the range */
  calledOut: number;
  /** Of those, posted at least once *after* their FNG callout */
  returned: number;
  /** Of those, posted 3+ times after callout */
  committed: number;
  /** Of those, are now Q-ing themselves */
  qing: number;
  /** Earliest analyzable date — for the caveat caption */
  earliest: string | null;
};

/**
 * Funnel of FNG → return → committed → Q. Tracks each FNG identity across
 * the full post-callout history (NOT bounded by the active range — once
 * called out we want to know if they ever came back).
 */
export async function getFngFunnel(
  range: TimeRange,
  aoSlugs: string[] | null,
): Promise<FngFunnel> {
  try {
    const sql = getSql();
    const from = range.from.toISOString().slice(0, 10);
    const to = range.to.toISOString().slice(0, 10);

    const [rangeRows, slackUsers, aliasMap, postCallout] = await Promise.all([
      sql`
        SELECT
          e.id::text AS event_id,
          to_char(e.event_date, 'YYYY-MM-DD') AS event_date,
          e.ao_display_name AS ao_name,
          e.content_text
        FROM f3_events e
        JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
        WHERE e.event_kind = 'backblast'
          AND e.is_deleted = false
          AND c.is_enabled = true
          AND e.event_date IS NOT NULL
          AND e.event_date >= ${from} AND e.event_date <= ${to}
          AND e.ao_display_name IS NOT NULL
      ` as unknown as Promise<Array<{
        event_id: string;
        event_date: string;
        ao_name: string;
        content_text: string | null;
      }>>,
      sql`
        SELECT slack_user_id, display_name, real_name
        FROM slack_users
        WHERE display_name IS NOT NULL OR real_name IS NOT NULL
      ` as unknown as Promise<SlackUser[]>,
      getAliasMap(),
      // Attendance from the FIRST FNG callout date to today — bounded only by
      // the latest data we have.
      getAttendanceFact({ from: range.from, to: new Date() }),
    ]);

    const slackById = new Map<string, string>();
    for (const u of slackUsers) {
      const name = u.display_name ?? u.real_name;
      if (name) slackById.set(u.slack_user_id, name);
    }

    const canonicalize = (token: string): string => {
      if (token.startsWith("U")) {
        const name = slackById.get(token) ?? aliasMap.get(token);
        if (name) return `n:${name.toLowerCase()}`;
      }
      return token;
    };

    const aoFilter = aoSlugs && aoSlugs.length > 0 ? aoSlugs : null;
    const matchesAo = (aoName: string) => {
      if (!aoFilter) return true;
      const slug = aoName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "");
      return aoFilter.includes(slug);
    };

    // Step 1: FNG callouts in range.
    const calledOutDateByKey = new Map<string, string>();
    for (const row of rangeRows) {
      if (!matchesAo(row.ao_name)) continue;
      const tokens = parseAttendance(row.content_text ?? "").fngTokens;
      for (const token of tokens) {
        const key = canonicalize(token);
        const existing = calledOutDateByKey.get(key);
        if (!existing || row.event_date < existing) {
          calledOutDateByKey.set(key, row.event_date);
        }
      }
    }
    const calledOut = calledOutDateByKey.size;

    if (calledOut === 0) {
      return { calledOut: 0, returned: 0, committed: 0, qing: 0, earliest: null };
    }

    // Step 2: subsequent posts. Count strictly after the callout date.
    const postsAfterByKey = new Map<string, number>();
    const qingKeys = new Set<string>();
    for (const f of postCallout) {
      const key = canonicalize(f.paxToken);
      const calloutDate = calledOutDateByKey.get(key);
      if (!calloutDate) continue;
      if (f.eventDate <= calloutDate) continue;
      if (aoFilter && !aoFilter.includes(f.aoSlug)) continue;
      postsAfterByKey.set(key, (postsAfterByKey.get(key) ?? 0) + 1);
      if (f.isQ) qingKeys.add(key);
    }

    let returned = 0;
    let committed = 0;
    for (const n of postsAfterByKey.values()) {
      if (n >= 1) returned += 1;
      if (n >= 3) committed += 1;
    }
    const qing = qingKeys.size;

    const earliest = [...calledOutDateByKey.values()].sort()[0] ?? null;

    return { calledOut, returned, committed, qing, earliest };
  } catch (err) {
    console.error("[getFngFunnel] failed:", err);
    return { calledOut: 0, returned: 0, committed: 0, qing: 0, earliest: null };
  }
}
