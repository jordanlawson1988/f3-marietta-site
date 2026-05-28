import { getSql } from "@/lib/db";
import { getAttendanceFact } from "./getAttendanceFact";
import { getAliasMap } from "./aliasMap";
import { resolvePaxIdentity, type SlackUser } from "./resolvePaxIdentity";
import { nameToSlug } from "./slugify";
import type { TimeRange } from "./timeRange";

export type NotYetQdRow = {
  paxKey: string;
  paxLabel: string;
  paxSlug: string;
  /** posts in range (after AO filter) */
  posts: number;
  /** distinct AOs visited in range (after AO filter) */
  aosVisited: number;
  /** has this PAX ever Q'd a workout — all-time, ignores AO filter */
  everQd: boolean;
};

/**
 * Ranked list of PAX who attended ≥1 workout in the range but did NOT Q
 * any workout in that range. Sorted by posts desc so the warmest Q
 * recruits surface first.
 *
 * - Identity resolution mirrors getQLeaderboard / getOverviewStats so a
 *   Slack ID and a free-text nickname for the same person never split
 *   into two rows.
 * - AO filter narrows BOTH the attendance window and the in-range Q
 *   exclusion. "everQd" stays all-time so a lapsed Q is visually
 *   distinguishable from a true first-timer.
 */
export async function getNotYetQdPax(
  range: TimeRange,
  aoSlugs: string[] | null,
  topN: number,
): Promise<NotYetQdRow[]> {
  try {
    const sql = getSql();
    const aoFilter = aoSlugs && aoSlugs.length > 0 ? aoSlugs : null;

    const [fact, allTimeQRows, slackUsers, aliasMap] = await Promise.all([
      getAttendanceFact({
        from: range.from,
        to: range.to,
        aoSlugs: aoFilter ?? undefined,
      }),
      sql`
        SELECT DISTINCT q_slack_user_id AS pax_token
        FROM f3_event_qs
        WHERE q_slack_user_id IS NOT NULL
      ` as unknown as Promise<Array<{ pax_token: string }>>,
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

    // Canonical key for a PAX token — same shape used by resolvePaxIdentity
    // ("n:<lowercased name>" preferred when a name is known, else the raw
    // Slack ID).
    const canonicalize = (token: string): string => {
      if (token.startsWith("U")) {
        const name = slackById.get(token) ?? aliasMap.get(token);
        if (name) return `n:${name.toLowerCase()}`;
      }
      return token;
    };

    // Aggregate range attendance per canonical PAX.
    const postCounts = new Map<string, number>();
    const seenEvents = new Map<string, Set<string>>(); // pax → eventIds
    const aosByPax = new Map<string, Set<string>>();
    const qdInRange = new Set<string>();

    for (const f of fact) {
      const key = canonicalize(f.paxToken);
      if (!seenEvents.has(key)) seenEvents.set(key, new Set());
      const events = seenEvents.get(key)!;
      if (!events.has(f.eventId)) {
        events.add(f.eventId);
        postCounts.set(key, (postCounts.get(key) ?? 0) + 1);
      }
      if (!aosByPax.has(key)) aosByPax.set(key, new Set());
      aosByPax.get(key)!.add(f.aoSlug);
      if (f.isQ) qdInRange.add(key);
    }

    // All-time Q set (for the everQd flag, ignoring AO filter).
    const everQdSet = new Set<string>();
    for (const row of allTimeQRows) {
      everQdSet.add(canonicalize(row.pax_token));
    }

    // Build a label map by running the resolvePaxIdentity pipeline on the
    // attendance counts. Reuses the same name-resolution chain as the rest
    // of the BI surface.
    const labelMap = new Map<string, string>();
    {
      const counts = new Map<string, number>();
      for (const [k, v] of postCounts) counts.set(k, v);
      const ranked = resolvePaxIdentity(counts, slackUsers, aliasMap);
      for (const r of ranked) labelMap.set(r.key, r.label);
    }

    const rows: NotYetQdRow[] = [];
    for (const [paxKey, posts] of postCounts) {
      if (qdInRange.has(paxKey)) continue;
      const paxLabel = labelMap.get(paxKey) ?? paxKey;
      rows.push({
        paxKey,
        paxLabel,
        paxSlug: nameToSlug(paxLabel),
        posts,
        aosVisited: aosByPax.get(paxKey)?.size ?? 0,
        everQd: everQdSet.has(paxKey),
      });
    }

    rows.sort((a, b) => b.posts - a.posts);
    return rows.slice(0, topN);
  } catch (err) {
    console.error("[getNotYetQdPax] failed:", err);
    return [];
  }
}
