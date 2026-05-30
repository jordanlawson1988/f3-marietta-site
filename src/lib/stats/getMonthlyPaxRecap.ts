import { getSql } from "@/lib/db";
import { getAttendanceFact, type FactRow } from "./getAttendanceFact";
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
 * A PAX who posted in the window but cannot be DMed because their token has
 * no Slack mapping (nickname-only, unmapped). They get no recap and are
 * surfaced in the run report so an admin can add an alias.
 */
export type UnreachableRow = {
  paxToken: string; // original token, e.g. "n:bulldog"
  paxLabel: string; // human label, e.g. "bulldog"
  posts: number; // distinct events in the window
  reason: "no-slack-mapping";
};

export type RecapAggregate = {
  recipients: PaxRecapRow[];
  unreachable: UnreachableRow[];
};

export type RecapMaps = {
  /** slack_user_id → display name */
  nameById: Map<string, string>;
  /** lowercased name → slack_user_id (for nickname-only tokens) */
  idByName: Map<string, string>;
  /** slack_user_id → name (alias overrides) */
  aliasMap: Map<string, string>;
};

/**
 * Pure aggregation of attendance fact rows into recap recipients and
 * unreachable PAX. No I/O — tests construct fact rows + maps directly.
 *
 * - Reachable: token resolves to a Slack id (U-prefixed always; nickname via
 *   idByName). Aggregated by slack id into a recipient row.
 * - Unreachable: token resolves to null (nickname-only, unmapped). Aggregated
 *   by token, counting distinct events as `posts`.
 *
 * Both lists are sorted by posts desc (most active first).
 */
export function aggregateRecapRows(
  fact: FactRow[],
  maps: RecapMaps,
): RecapAggregate {
  const { nameById, idByName, aliasMap } = maps;

  /** Resolve a paxToken to a Slack user id, or null when unreachable. */
  const resolveSlackId = (token: string): string | null => {
    if (token.startsWith("U")) return token; // valid Slack id → DM-able
    if (token.startsWith("n:")) return idByName.get(token.slice(2)) ?? null;
    return null;
  };

  const labelForToken = (token: string): string =>
    token.startsWith("n:") ? token.slice(2) : token;

  type Agg = {
    slackUserId: string;
    paxLabel: string;
    posts: Set<string>;
    aoSlugs: Set<string>;
    aoNames: Set<string>;
    qd: number;
  };
  const byId = new Map<string, Agg>();

  type Unreach = { paxToken: string; paxLabel: string; posts: Set<string> };
  const unreachByToken = new Map<string, Unreach>();

  for (const f of fact) {
    const slackId = resolveSlackId(f.paxToken);

    if (!slackId) {
      let u = unreachByToken.get(f.paxToken);
      if (!u) {
        u = { paxToken: f.paxToken, paxLabel: labelForToken(f.paxToken), posts: new Set() };
        unreachByToken.set(f.paxToken, u);
      }
      u.posts.add(f.eventId);
      continue;
    }

    const label =
      nameById.get(slackId) ?? aliasMap.get(slackId) ?? labelForToken(f.paxToken);

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

  const recipients: PaxRecapRow[] = [...byId.values()].map((a) => ({
    slackUserId: a.slackUserId,
    paxLabel: a.paxLabel,
    paxSlug: nameToSlug(a.paxLabel),
    posts: a.posts.size,
    aos: a.aoSlugs.size,
    qd: a.qd,
    aoNames: [...a.aoNames].sort(),
  }));
  recipients.sort((a, b) => b.posts - a.posts);

  const unreachable: UnreachableRow[] = [...unreachByToken.values()].map((u) => ({
    paxToken: u.paxToken,
    paxLabel: u.paxLabel,
    posts: u.posts.size,
    reason: "no-slack-mapping" as const,
  }));
  unreachable.sort((a, b) => b.posts - a.posts);

  return { recipients, unreachable };
}

/**
 * Build the recipient list for the monthly PAX recap DM plus the list of
 * unreachable PAX (posted but un-DMable). Each recipient row carries a Slack
 * user id so the cron can post directly.
 *
 * Identity resolution mirrors the rest of the BI surface but inverts the
 * usual direction: we need name → slack_user_id, not slack_user_id → name.
 */
export async function getMonthlyPaxRecap(
  range: TimeRange,
): Promise<RecapAggregate> {
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

    return aggregateRecapRows(fact, { nameById, idByName, aliasMap });
  } catch (err) {
    console.error("[getMonthlyPaxRecap] failed:", err);
    return { recipients: [], unreachable: [] };
  }
}
