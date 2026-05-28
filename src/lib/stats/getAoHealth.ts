import { getAttendanceFact } from "./getAttendanceFact";
import { parseAttendance } from "./parseAttendance";
import { getSql } from "@/lib/db";
import { nameToSlug } from "./slugify";
import type { TimeRange } from "./timeRange";

export type AoHealthRow = {
  ao: string;
  aoSlug: string;
  /** raw posts in range */
  posts: number;
  /** unique PAX in range */
  uniquePax: number;
  /** distinct Qs in range */
  uniqueQs: number;
  /** FNG count in range */
  fngCount: number;
  /** avg headcount (rounded to .1) */
  avgHeadcount: number | null;
  /** Q rotation diversity — 1 - Gini coefficient, 0..1 (higher = healthier) */
  qDiversity: number | null;
  /** composite 0-100 health score */
  health: number;
};

/**
 * Compute the AO Health Index across all AOs in scope. Health is a weighted
 * blend of:
 *  - Activity volume (posts per week) — 35%
 *  - PAX breadth (unique PAX per post) — 25%
 *  - Q rotation diversity (1 - Gini) — 20%
 *  - FNG generation rate (FNGs / posts) — 20%
 *
 * Scaled per-AO against the region max so the leaderboard is comparable.
 */
export async function getAoHealth(
  range: TimeRange,
  aoSlugs: string[] | null,
): Promise<AoHealthRow[]> {
  try {
    const sql = getSql();
    const from = range.from.toISOString().slice(0, 10);
    const to = range.to.toISOString().slice(0, 10);
    const aoFilter = aoSlugs && aoSlugs.length > 0 ? aoSlugs : null;

    const [events, qRows, fact] = await Promise.all([
      sql`
        SELECT
          e.id::text AS event_id,
          e.event_date::text AS event_date,
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
        SELECT q.event_id::text AS event_id, q.q_slack_user_id AS q_id, e.ao_display_name AS ao_name
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
      ` as unknown as Promise<Array<{ event_id: string; q_id: string; ao_name: string }>>,
      getAttendanceFact({
        from: range.from,
        to: range.to,
        aoSlugs: aoFilter ?? undefined,
      }),
    ]);

    // Aggregate by AO.
    type Agg = {
      ao: string;
      aoSlug: string;
      posts: number;
      headcountSum: number;
      headcountN: number;
      fngTotal: number;
      qCounts: Map<string, number>;
      pax: Set<string>;
    };
    const byAo = new Map<string, Agg>();

    for (const e of events) {
      const slug = nameToSlug(e.ao_name);
      if (aoFilter && !aoFilter.includes(slug)) continue;
      const parsed = parseAttendance(e.content_text ?? "");
      let agg = byAo.get(slug);
      if (!agg) {
        agg = {
          ao: e.ao_name,
          aoSlug: slug,
          posts: 0,
          headcountSum: 0,
          headcountN: 0,
          fngTotal: 0,
          qCounts: new Map(),
          pax: new Set(),
        };
        byAo.set(slug, agg);
      }
      agg.posts += 1;
      if (parsed.headcount !== null) {
        agg.headcountSum += parsed.headcount;
        agg.headcountN += 1;
      }
      agg.fngTotal += parsed.fngTokens.size;
    }

    for (const q of qRows) {
      const slug = nameToSlug(q.ao_name);
      if (aoFilter && !aoFilter.includes(slug)) continue;
      const agg = byAo.get(slug);
      if (!agg) continue;
      agg.qCounts.set(q.q_id, (agg.qCounts.get(q.q_id) ?? 0) + 1);
    }

    for (const f of fact) {
      const agg = byAo.get(f.aoSlug);
      if (!agg) continue;
      agg.pax.add(f.paxToken);
    }

    // Compute features per AO.
    type Feature = {
      ao: string;
      aoSlug: string;
      posts: number;
      uniquePax: number;
      uniqueQs: number;
      fngCount: number;
      avgHeadcount: number | null;
      activityScore: number; // raw — to be normalized
      breadthScore: number;
      diversityScore: number;
      fngScore: number;
    };
    const features: Feature[] = [];
    for (const a of byAo.values()) {
      const activityScore = a.posts;
      const breadthScore = a.posts > 0 ? a.pax.size / a.posts : 0;
      const qDiversity = giniInverse([...a.qCounts.values()]);
      const fngScore = a.posts > 0 ? a.fngTotal / a.posts : 0;
      features.push({
        ao: a.ao,
        aoSlug: a.aoSlug,
        posts: a.posts,
        uniquePax: a.pax.size,
        uniqueQs: a.qCounts.size,
        fngCount: a.fngTotal,
        avgHeadcount:
          a.headcountN === 0
            ? null
            : Math.round((a.headcountSum / a.headcountN) * 10) / 10,
        activityScore,
        breadthScore,
        diversityScore: qDiversity ?? 0,
        fngScore,
      });
    }

    if (features.length === 0) return [];

    // Normalize each feature column against the region max.
    const max = {
      activity: Math.max(...features.map((f) => f.activityScore), 1),
      breadth: Math.max(...features.map((f) => f.breadthScore), 0.01),
      diversity: Math.max(...features.map((f) => f.diversityScore), 0.01),
      fng: Math.max(...features.map((f) => f.fngScore), 0.01),
    };

    const out: AoHealthRow[] = features
      .map((f) => {
        const health =
          0.35 * (f.activityScore / max.activity) * 100 +
          0.25 * (f.breadthScore / max.breadth) * 100 +
          0.2 * (f.diversityScore / max.diversity) * 100 +
          0.2 * (f.fngScore / max.fng) * 100;
        return {
          ao: f.ao,
          aoSlug: f.aoSlug,
          posts: f.posts,
          uniquePax: f.uniquePax,
          uniqueQs: f.uniqueQs,
          fngCount: f.fngCount,
          avgHeadcount: f.avgHeadcount,
          qDiversity: f.diversityScore,
          health: Math.round(health),
        };
      })
      .sort((a, b) => b.health - a.health);

    return out;
  } catch (err) {
    console.error("[getAoHealth] failed:", err);
    return [];
  }
}

/**
 * Returns 1 - Gini for a count distribution. Higher = more even distribution.
 * Returns null when the array is empty.
 */
function giniInverse(values: number[]): number | null {
  if (values.length === 0) return null;
  if (values.length === 1) return 0; // one Q only — concentration is total
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const sum = sorted.reduce((s, v) => s + v, 0);
  if (sum === 0) return null;
  let weighted = 0;
  for (let i = 0; i < n; i++) {
    weighted += (i + 1) * sorted[i];
  }
  const gini = (2 * weighted) / (n * sum) - (n + 1) / n;
  return Math.max(0, Math.min(1, 1 - gini));
}
