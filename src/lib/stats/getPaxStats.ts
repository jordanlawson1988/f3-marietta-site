import { getSql } from "@/lib/db";
import { getAttendanceFact } from "./getAttendanceFact";
import { resolvePaxIdentity, type SlackUser } from "./resolvePaxIdentity";
import { getAliasMap } from "./aliasMap";
import { computeLongestStreak } from "./computeStreak";
import { nameToSlug } from "./slugify";
import { monthsInRange, type TimeRange } from "./timeRange";

export type PaxStats = {
  paxLabel: string;
  paxSlug: string;
  totalPosts: number;
  aosVisited: number;
  firstSeenMonth: string | null; // YYYY-MM, within selected range
  longestStreak: number;
  postsOverTime: Array<{ month: string; count: number }>;
  byAo: Array<{ ao: string; aoSlug: string; count: number }>;
  qdWorkouts: Array<{
    eventDate: string;
    aoName: string;
    aoSlug: string;
    headcount: number | null;
  }>;
};

export async function getPaxStats(
  range: TimeRange,
  paxSlug: string,
): Promise<PaxStats | null> {
  const sql = getSql();
  const userRows = (await sql`
    SELECT slack_user_id, display_name, real_name
    FROM slack_users
    WHERE display_name IS NOT NULL OR real_name IS NOT NULL
  `) as SlackUser[];
  const aliasMap = await getAliasMap();

  // Build a label-to-canonical-key lookup over all PAX seen in the current
  // calendar year so a slug resolves regardless of whether the PAX posted in
  // the selected range.
  const fullYearFact = await getAttendanceFact({
    from: new Date(`${new Date().getUTCFullYear()}-01-01T00:00:00Z`),
    to: new Date(),
  });
  const countsAll = new Map<string, number>();
  for (const f of fullYearFact) {
    countsAll.set(f.paxToken, (countsAll.get(f.paxToken) ?? 0) + 1);
  }
  const ranked = resolvePaxIdentity(countsAll, userRows, aliasMap);
  const match = ranked.find((r) => nameToSlug(r.label) === paxSlug);
  if (!match) return null;
  const paxLabel = match.label;
  const paxCanonicalKey = match.key;

  const tokenToCanonical = (token: string): string => {
    if (token.startsWith("U")) {
      const u = userRows.find((u) => u.slack_user_id === token);
      const name =
        u?.display_name ?? u?.real_name ?? aliasMap.get(token);
      if (name) return `n:${name.toLowerCase()}`;
      return token;
    }
    return token;
  };

  const fact = await getAttendanceFact({ from: range.from, to: range.to });
  const mine = fact.filter(
    (f) => tokenToCanonical(f.paxToken) === paxCanonicalKey,
  );

  const totalPosts = new Set(mine.map((f) => f.eventId)).size;

  const aoCountMap = new Map<string, { name: string; count: number }>();
  for (const f of mine) {
    const prev = aoCountMap.get(f.aoSlug);
    aoCountMap.set(f.aoSlug, {
      name: f.aoName,
      count: (prev?.count ?? 0) + 1,
    });
  }
  const byAo = [...aoCountMap.entries()]
    .map(([aoSlug, v]) => ({ ao: v.name, aoSlug, count: v.count }))
    .sort((a, b) => b.count - a.count);

  const aosVisited = byAo.length;

  const monthSet = new Map<string, number>();
  const allDates = new Set<string>();
  for (const f of mine) {
    const month = f.eventDate.slice(0, 7);
    monthSet.set(month, (monthSet.get(month) ?? 0) + 1);
    allDates.add(f.eventDate);
  }
  const postsOverTime = monthsInRange(range.from, range.to).map((month) => ({
    month,
    count: monthSet.get(month) ?? 0,
  }));

  const firstSeenInRange = mine
    .map((f) => f.eventDate)
    .sort()[0];
  const firstSeenMonth = firstSeenInRange
    ? firstSeenInRange.slice(0, 7)
    : null;

  const longestStreak = computeLongestStreak([...allDates].sort());

  const qdWorkouts = mine
    .filter((f) => f.isQ)
    .map((f) => ({
      eventDate: f.eventDate,
      aoName: f.aoName,
      aoSlug: f.aoSlug,
      headcount: f.headcount,
    }))
    .sort((a, b) => b.eventDate.localeCompare(a.eventDate));

  return {
    paxLabel,
    paxSlug,
    totalPosts,
    aosVisited,
    firstSeenMonth,
    longestStreak,
    postsOverTime,
    byAo,
    qdWorkouts,
  };
}
