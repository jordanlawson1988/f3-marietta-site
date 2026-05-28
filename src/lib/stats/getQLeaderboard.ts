import { getSql } from "@/lib/db";
import { getAliasMap } from "./aliasMap";
import { resolvePaxIdentity, type SlackUser } from "./resolvePaxIdentity";
import { nameToSlug } from "./slugify";
import type { TimeRange } from "./timeRange";

export type QLeaderboardRow = {
  qKey: string;
  qLabel: string;
  qSlug: string;
  count: number;
  aoCount: number;
  topAo: string | null;
};

/**
 * Region-wide Q leaderboard: who led the most beatdowns, across how many AOs,
 * and where most often. Drillable into the PAX detail page via qSlug.
 */
export async function getQLeaderboard(
  range: TimeRange,
  aoSlugs: string[] | null,
  topN: number,
): Promise<QLeaderboardRow[]> {
  try {
    const sql = getSql();
    const from = range.from.toISOString().slice(0, 10);
    const to = range.to.toISOString().slice(0, 10);
    const aoFilter = aoSlugs && aoSlugs.length > 0 ? aoSlugs : null;

    const [qRows, userRows, aliasMap] = await Promise.all([
      sql`
        SELECT q.q_slack_user_id AS pax_token, e.ao_display_name AS ao_name
        FROM f3_event_qs q
        JOIN f3_events e ON e.id = q.event_id
        JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
        WHERE e.event_kind = 'backblast'
          AND e.is_deleted = false
          AND c.is_enabled = true
          AND e.event_date IS NOT NULL
          AND e.event_date >= ${from} AND e.event_date <= ${to}
          AND e.ao_display_name IS NOT NULL
          AND q.q_slack_user_id IS NOT NULL
      `,
      sql`
        SELECT slack_user_id, display_name, real_name
        FROM slack_users
        WHERE display_name IS NOT NULL OR real_name IS NOT NULL
      `,
      getAliasMap(),
    ]);

    type Row = { pax_token: string; ao_name: string };
    const rows = qRows as Row[];

    const counts = new Map<string, number>();
    const aosByToken = new Map<string, Map<string, number>>();
    for (const r of rows) {
      const slug = nameToSlug(r.ao_name);
      if (aoFilter && !aoFilter.includes(slug)) continue;
      counts.set(r.pax_token, (counts.get(r.pax_token) ?? 0) + 1);
      if (!aosByToken.has(r.pax_token)) aosByToken.set(r.pax_token, new Map());
      const inner = aosByToken.get(r.pax_token)!;
      inner.set(r.ao_name, (inner.get(r.ao_name) ?? 0) + 1);
    }

    const ranked = resolvePaxIdentity(counts, userRows as SlackUser[], aliasMap);
    // Build a token → canonical-key map so we can aggregate AO sets after
    // identity resolution.
    const aoByCanonical = new Map<string, Map<string, number>>();
    const slackById = new Map<string, string>();
    for (const u of userRows as SlackUser[]) {
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

    for (const [token, inner] of aosByToken) {
      const canonical = canonicalize(token);
      if (!aoByCanonical.has(canonical)) aoByCanonical.set(canonical, new Map());
      const dest = aoByCanonical.get(canonical)!;
      for (const [aoName, n] of inner) {
        dest.set(aoName, (dest.get(aoName) ?? 0) + n);
      }
    }

    const enriched: QLeaderboardRow[] = ranked.map((r) => {
      const aoMap = aoByCanonical.get(r.key) ?? new Map();
      let topAo: string | null = null;
      let topCount = 0;
      for (const [name, n] of aoMap) {
        if (n > topCount) {
          topAo = name;
          topCount = n;
        }
      }
      return {
        qKey: r.key,
        qLabel: r.label,
        qSlug: nameToSlug(r.label),
        count: r.count,
        aoCount: aoMap.size,
        topAo,
      };
    });

    return enriched.slice(0, topN);
  } catch (err) {
    console.error("[getQLeaderboard] failed:", err);
    return [];
  }
}
