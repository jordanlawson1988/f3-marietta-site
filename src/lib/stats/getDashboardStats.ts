import { getSql } from "@/lib/db";
import { extractPaxTokens } from "@/lib/stats/getWeeklyPaxCount";
import { parseFngLine } from "./parseFngLine";
import {
  resolvePaxIdentity,
  type SlackUser,
  type PaxRanking,
} from "./resolvePaxIdentity";
import { getAliasMap } from "./aliasMap";

export type DashboardStats = {
  totalPosts: number;
  uniquePax: number;
  newFngs: number;
  byAo: Array<{ ao: string; count: number }>;
  topPax: PaxRanking[];
};

const EMPTY_STATS: DashboardStats = {
  totalPosts: 0,
  uniquePax: 0,
  newFngs: 0,
  byAo: [],
  topPax: [],
};

/**
 * Fetch year-to-date analytics for the Marietta region admin dashboard.
 *
 * Runs three parallel SQL queries: posts grouped by AO, raw content_text
 * rows for parsing, and slack_users for identity resolution. Returns the
 * empty stats object on any error so the dashboard renders zero state
 * instead of crashing.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const sql = getSql();
    const [byAoRows, contentRows, userRows, aliasMap] = await Promise.all([
      sql`
        SELECT e.ao_display_name AS ao, COUNT(*)::int AS n
        FROM f3_events e
        JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
        WHERE e.event_kind = 'backblast'
          AND e.is_deleted = false
          AND c.is_enabled = true
          AND e.event_date IS NOT NULL
          AND e.event_date >= date_trunc('year', (now() AT TIME ZONE 'America/New_York'))::date
          AND e.ao_display_name IS NOT NULL
        GROUP BY e.ao_display_name
        ORDER BY n DESC
      `,
      sql`
        SELECT e.content_text
        FROM f3_events e
        JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
        WHERE e.event_kind = 'backblast'
          AND e.is_deleted = false
          AND c.is_enabled = true
          AND e.event_date IS NOT NULL
          AND e.event_date >= date_trunc('year', (now() AT TIME ZONE 'America/New_York'))::date
          AND e.ao_display_name IS NOT NULL
      `,
      sql`
        SELECT slack_user_id, display_name, real_name
        FROM slack_users
        WHERE display_name IS NOT NULL OR real_name IS NOT NULL
      `,
      getAliasMap(),
    ]);

    const byAo = (byAoRows as Array<{ ao: string | null; n: number }>)
      .filter((r) => r.ao !== null)
      .map((r) => ({ ao: r.ao as string, count: Number(r.n) }));
    const totalPosts = byAo.reduce((sum, r) => sum + r.count, 0);

    const paxCounts = new Map<string, number>();
    const fngTokens = new Set<string>();
    for (const row of contentRows as Array<{ content_text: string | null }>) {
      const text = row.content_text ?? "";
      for (const token of extractPaxTokens(text)) {
        paxCounts.set(token, (paxCounts.get(token) ?? 0) + 1);
      }
      for (const fng of parseFngLine(text)) {
        fngTokens.add(fng);
      }
    }

    const slackUsers = userRows as SlackUser[];
    const ranked = resolvePaxIdentity(paxCounts, slackUsers, aliasMap);
    const topPax = ranked.slice(0, 20);
    const uniquePax = ranked.length;

    const fngCounts = new Map<string, number>();
    for (const t of fngTokens) fngCounts.set(t, 1);
    const newFngs = resolvePaxIdentity(fngCounts, slackUsers, aliasMap).length;

    return { totalPosts, uniquePax, newFngs, byAo, topPax };
  } catch (err) {
    console.error("[getDashboardStats] failed:", err);
    return EMPTY_STATS;
  }
}
