import { getSql } from "@/lib/db";
import { getAttendanceFact } from "./getAttendanceFact";
import { getAliasMap } from "./aliasMap";
import { nameToSlug } from "./slugify";
import type { SlackUser } from "./resolvePaxIdentity";
import type { TimeRange } from "./timeRange";

export type PaxRecapRow = {
  /** Slack user id — present means we can DM them. */
  slackUserId: string;
  paxLabel: string;
  paxSlug: string;
  /** posts in the recap window */
  posts: number;
  /** distinct AOs visited in the recap window */
  aos: number;
  /** workouts Q'd in the recap window */
  qd: number;
  /** distinct AO names — for the "across X, Y, Z" line */
  aoNames: string[];
};

/**
 * Build the recipient list for the monthly PAX recap DM. Each row carries
 * a Slack user id so the cron can post directly — PAX who exist only as
 * nicknames (no Slack mapping) are dropped, since we can't DM them.
 *
 * Identity resolution mirrors the rest of the BI surface but inverts the
 * usual direction: we need name → slack_user_id, not slack_user_id → name.
 */
export async function getMonthlyPaxRecap(
  range: TimeRange,
): Promise<PaxRecapRow[]> {
  try {
    const sql = getSql();
    const [fact, slackUsers, aliasMap] = await Promise.all([
      getAttendanceFact({ from: range.from, to: range.to }),
      sql`
        SELECT slack_user_id, display_name, real_name
        FROM slack_users
        WHERE display_name IS NOT NULL OR real_name IS NOT NULL
      ` as unknown as Promise<SlackUser[]>,
      getAliasMap(),
    ]);

    // Forward: slack_user_id → display name
    const nameById = new Map<string, string>();
    // Inverse: lowercased-name → slack_user_id (for nickname-only tokens)
    const idByName = new Map<string, string>();
    for (const u of slackUsers) {
      const name = u.display_name ?? u.real_name;
      if (!name) continue;
      nameById.set(u.slack_user_id, name);
      idByName.set(name.toLowerCase(), u.slack_user_id);
    }
    // aliasMap is also slackId → name; honor the forward direction too.
    for (const [slackId, name] of aliasMap) {
      if (!nameById.has(slackId)) nameById.set(slackId, name);
      if (!idByName.has(name.toLowerCase())) {
        idByName.set(name.toLowerCase(), slackId);
      }
    }

    /** Resolve a paxToken to a Slack user id, or null when unreachable. */
    const resolveSlackId = (token: string): string | null => {
      if (token.startsWith("U")) {
        return nameById.has(token) || aliasMap.has(token) ? token : token;
      }
      if (token.startsWith("n:")) {
        const lower = token.slice(2);
        return idByName.get(lower) ?? null;
      }
      return null;
    };

    type Agg = {
      slackUserId: string;
      paxLabel: string;
      posts: Set<string>;
      aoSlugs: Set<string>;
      aoNames: Set<string>;
      qd: number;
    };
    const byId = new Map<string, Agg>();

    for (const f of fact) {
      const slackId = resolveSlackId(f.paxToken);
      if (!slackId) continue;
      const label =
        nameById.get(slackId) ??
        aliasMap.get(slackId) ??
        (f.paxToken.startsWith("n:") ? f.paxToken.slice(2) : f.paxToken);

      let agg = byId.get(slackId);
      if (!agg) {
        agg = {
          slackUserId: slackId,
          paxLabel: label,
          posts: new Set(),
          aoSlugs: new Set(),
          aoNames: new Set(),
          qd: 0,
        };
        byId.set(slackId, agg);
      }
      agg.posts.add(f.eventId);
      agg.aoSlugs.add(f.aoSlug);
      agg.aoNames.add(f.aoName);
      if (f.isQ) agg.qd += 1;
    }

    const rows: PaxRecapRow[] = [];
    for (const a of byId.values()) {
      rows.push({
        slackUserId: a.slackUserId,
        paxLabel: a.paxLabel,
        paxSlug: nameToSlug(a.paxLabel),
        posts: a.posts.size,
        aos: a.aoSlugs.size,
        qd: a.qd,
        aoNames: [...a.aoNames].sort(),
      });
    }

    rows.sort((a, b) => b.posts - a.posts);
    return rows;
  } catch (err) {
    console.error("[getMonthlyPaxRecap] failed:", err);
    return [];
  }
}
