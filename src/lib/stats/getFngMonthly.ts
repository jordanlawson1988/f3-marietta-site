import { getSql } from "@/lib/db";
import { getAliasMap } from "./aliasMap";
import { parseAttendance } from "./parseAttendance";
import { nameToSlug } from "./slugify";
import type { SlackUser } from "./resolvePaxIdentity";
import { monthsInRange, type TimeRange } from "./timeRange";

/**
 * Monthly count of NEW (first-time) FNG callouts in the active range.
 * "New" = canonical identity not seen in any earlier event.
 */
export async function getFngMonthly(
  range: TimeRange,
  aoSlugs: string[] | null,
): Promise<Array<{ month: string; count: number }>> {
  try {
    const sql = getSql();
    const from = range.from.toISOString().slice(0, 10);
    const to = range.to.toISOString().slice(0, 10);
    const aoFilter = aoSlugs && aoSlugs.length > 0 ? aoSlugs : null;

    const [rangeRows, priorRows, slackUsers, aliasMap] = await Promise.all([
      sql`
        SELECT
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
        ORDER BY e.event_date ASC
      ` as unknown as Promise<Array<{
        event_date: string;
        ao_name: string;
        content_text: string | null;
      }>>,
      sql`
        SELECT e.content_text, e.ao_display_name AS ao_name
        FROM f3_events e
        JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
        WHERE e.event_kind = 'backblast'
          AND e.is_deleted = false
          AND c.is_enabled = true
          AND e.event_date IS NOT NULL
          AND e.event_date < ${from}
          AND e.ao_display_name IS NOT NULL
      ` as unknown as Promise<Array<{ content_text: string | null; ao_name: string }>>,
      sql`
        SELECT slack_user_id, display_name, real_name
        FROM slack_users
        WHERE display_name IS NOT NULL OR real_name IS NOT NULL
      ` as unknown as Promise<SlackUser[]>,
      getAliasMap(),
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

    // Pre-range FNG identities — never count these as "new" in range.
    const seenBefore = new Set<string>();
    for (const r of priorRows) {
      if (aoFilter && !aoFilter.includes(nameToSlug(r.ao_name))) continue;
      const tokens = parseAttendance(r.content_text ?? "").fngTokens;
      for (const t of tokens) seenBefore.add(canonicalize(t));
    }

    const monthCounts = new Map<string, Set<string>>();
    for (const r of rangeRows) {
      if (aoFilter && !aoFilter.includes(nameToSlug(r.ao_name))) continue;
      const tokens = parseAttendance(r.content_text ?? "").fngTokens;
      for (const token of tokens) {
        const canonical = canonicalize(token);
        if (seenBefore.has(canonical)) continue;
        const month = r.event_date.slice(0, 7);
        if (!monthCounts.has(month)) monthCounts.set(month, new Set());
        monthCounts.get(month)!.add(canonical);
        seenBefore.add(canonical);
      }
    }

    return monthsInRange(range.from, range.to).map((m) => ({
      month: m,
      count: monthCounts.get(m)?.size ?? 0,
    }));
  } catch (err) {
    console.error("[getFngMonthly] failed:", err);
    return [];
  }
}
