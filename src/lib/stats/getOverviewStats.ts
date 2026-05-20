import { getSql } from "@/lib/db";
import { getAttendanceFact } from "./getAttendanceFact";
import { resolvePaxIdentity, type SlackUser, type PaxRanking } from "./resolvePaxIdentity";
import { getAliasMap } from "./aliasMap";
import { nameToSlug } from "./slugify";
import { parseAttendance } from "./parseAttendance";
import { monthsInRange, type TimeRange } from "./timeRange";

export type OverviewStats = {
  totalPosts: number;
  uniquePax: number;
  newFngs: number;
  avgHeadcount: number | null;
  byAo: Array<{ ao: string; aoSlug: string; count: number }>;
  topPax: PaxRanking[];
  postsOverTime: Array<{ month: string; count: number }>; // YYYY-MM
  byDayOfWeek: Array<{ dow: number; count: number }>; // 0=Sun
};

export async function getOverviewStats(
  range: TimeRange,
  aoSlug: string | null,
  topN: number,
): Promise<OverviewStats> {
  try {
    const sql = getSql();
    const from = range.from.toISOString().slice(0, 10);
    const to = range.to.toISOString().slice(0, 10);

    const [byAoRows, monthRows, dowRows, userRows, aliasMap, fact] =
      await Promise.all([
        sql`
          SELECT e.ao_display_name AS ao, COUNT(*)::int AS n
          FROM f3_events e
          JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
          WHERE e.event_kind = 'backblast'
            AND e.is_deleted = false
            AND c.is_enabled = true
            AND e.event_date IS NOT NULL
            AND e.event_date >= ${from} AND e.event_date <= ${to}
            AND e.ao_display_name IS NOT NULL
          GROUP BY e.ao_display_name
          ORDER BY n DESC
        `,
        sql`
          SELECT to_char(e.event_date, 'YYYY-MM') AS month, COUNT(*)::int AS n
          FROM f3_events e
          JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
          WHERE e.event_kind = 'backblast'
            AND e.is_deleted = false
            AND c.is_enabled = true
            AND e.event_date IS NOT NULL
            AND e.event_date >= ${from} AND e.event_date <= ${to}
            AND e.ao_display_name IS NOT NULL
          GROUP BY 1
          ORDER BY 1
        `,
        sql`
          SELECT EXTRACT(DOW FROM e.event_date)::int AS dow, COUNT(*)::int AS n
          FROM f3_events e
          JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
          WHERE e.event_kind = 'backblast'
            AND e.is_deleted = false
            AND c.is_enabled = true
            AND e.event_date IS NOT NULL
            AND e.event_date >= ${from} AND e.event_date <= ${to}
            AND e.ao_display_name IS NOT NULL
          GROUP BY 1
          ORDER BY 1
        `,
        sql`
          SELECT slack_user_id, display_name, real_name
          FROM slack_users
          WHERE display_name IS NOT NULL OR real_name IS NOT NULL
        `,
        getAliasMap(),
        getAttendanceFact({ from: range.from, to: range.to, aoSlug: aoSlug ?? undefined }),
      ]);

    // Client-side AO filter (consistent with getAttendanceFact pattern)
    const byAo = (byAoRows as Array<{ ao: string | null; n: number }>)
      .filter((r) => r.ao !== null)
      .filter((r) => !aoSlug || nameToSlug(r.ao!) === aoSlug)
      .map((r) => ({ ao: r.ao!, aoSlug: nameToSlug(r.ao!), count: Number(r.n) }));

    const totalPosts = byAo.reduce((s, r) => s + r.count, 0);

    const paxCounts = new Map<string, number>();
    const headcounts: number[] = [];
    const seenEvents = new Set<string>();
    for (const f of fact) {
      paxCounts.set(f.paxToken, (paxCounts.get(f.paxToken) ?? 0) + 1);
      if (!seenEvents.has(f.eventId)) {
        seenEvents.add(f.eventId);
        if (f.headcount !== null) headcounts.push(f.headcount);
      }
    }
    const slackUsers = userRows as SlackUser[];
    const ranked = resolvePaxIdentity(paxCounts, slackUsers, aliasMap);
    const uniquePax = ranked.length;
    const topPax = ranked.slice(0, topN);

    // newFngs: fetch content_text for events in range and parse FNG tokens.
    // Client-side AO filter applied after fetch, consistent with getAttendanceFact.
    const fngParseRows = (await sql`
      SELECT e.ao_display_name AS ao_name, e.content_text
      FROM f3_events e
      JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
      WHERE e.event_kind = 'backblast'
        AND e.is_deleted = false
        AND c.is_enabled = true
        AND e.event_date IS NOT NULL
        AND e.event_date >= ${from} AND e.event_date <= ${to}
        AND e.ao_display_name IS NOT NULL
    `) as Array<{ ao_name: string | null; content_text: string | null }>;

    const fngs = new Set<string>();
    for (const r of fngParseRows) {
      if (aoSlug && (r.ao_name === null || nameToSlug(r.ao_name) !== aoSlug)) continue;
      for (const t of parseAttendance(r.content_text ?? "").fngTokens) fngs.add(t);
    }
    const fngCounts = new Map<string, number>();
    for (const t of fngs) fngCounts.set(t, 1);
    const newFngs = resolvePaxIdentity(fngCounts, slackUsers, aliasMap).length;

    const avgHeadcount =
      headcounts.length === 0
        ? null
        : Math.round(
            (headcounts.reduce((s, h) => s + h, 0) / headcounts.length) * 10,
          ) / 10;

    // Build a month->count lookup from whichever source is authoritative.
    // No AO filter: use unfiltered DB monthRows. AO filter: re-aggregate fact.
    const monthCounts = new Map<string, number>();
    if (aoSlug) {
      const seenForCharts = new Set<string>();
      for (const f of fact) {
        if (!seenForCharts.has(f.eventId)) {
          seenForCharts.add(f.eventId);
          const month = f.eventDate.slice(0, 7);
          monthCounts.set(month, (monthCounts.get(month) ?? 0) + 1);
        }
      }
    } else {
      for (const r of monthRows as Array<{ month: string; n: number }>) {
        monthCounts.set(r.month, Number(r.n));
      }
    }
    const finalPostsOverTime = monthsInRange(range.from, range.to).map(
      (month) => ({ month, count: monthCounts.get(month) ?? 0 }),
    );

    const byDayOfWeek = (dowRows as Array<{ dow: number; n: number }>)
      .filter(() => !aoSlug)
      .map((r) => ({ dow: Number(r.dow), count: Number(r.n) }));

    let finalByDayOfWeek = byDayOfWeek;
    if (aoSlug) {
      const dowMap = new Map<number, number>();
      const seenForDow = new Set<string>();
      for (const f of fact) {
        if (!seenForDow.has(f.eventId)) {
          seenForDow.add(f.eventId);
          const d = new Date(f.eventDate + "T00:00:00Z");
          const dow = d.getUTCDay();
          dowMap.set(dow, (dowMap.get(dow) ?? 0) + 1);
        }
      }
      finalByDayOfWeek = [...dowMap.entries()]
        .map(([dow, count]) => ({ dow, count }))
        .sort((a, b) => a.dow - b.dow);
    }

    return {
      totalPosts,
      uniquePax,
      newFngs,
      avgHeadcount,
      byAo,
      topPax,
      postsOverTime: finalPostsOverTime,
      byDayOfWeek: finalByDayOfWeek,
    };
  } catch (err) {
    console.error("[getOverviewStats] failed:", err);
    return {
      totalPosts: 0,
      uniquePax: 0,
      newFngs: 0,
      avgHeadcount: null,
      byAo: [],
      topPax: [],
      postsOverTime: [],
      byDayOfWeek: [],
    };
  }
}
