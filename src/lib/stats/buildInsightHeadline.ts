import type { OverviewWithCompare } from "./getOverviewStatsWithCompare";

type Args = {
  stats: OverviewWithCompare;
  rangeLabel: string;
  scope: "region" | "ao";
  aoName?: string;
};

/**
 * Produce a one-sentence "5-second takeaway" for the current page filter.
 * Falls back gracefully when no compare data is available — never returns
 * an empty string.
 */
export function buildInsightHeadline({
  stats,
  rangeLabel,
  scope,
  aoName,
}: Args): string {
  const who = scope === "ao" && aoName ? aoName : "F3 Marietta";
  const posts = stats.totalPosts;
  const pax = stats.uniquePax;
  const fngs = stats.newFngs;

  if (posts === 0) {
    return `No backblasts logged for ${who} in ${rangeLabel.toLowerCase()}.`;
  }

  const c = stats.compare;
  let postsClause = `${posts.toLocaleString()} backblast${posts === 1 ? "" : "s"}`;
  if (c && c.totalPosts.prior !== null) {
    const delta = c.totalPosts.prior;
    if (delta === 0) {
      postsClause = `${postsClause} (new vs ${c.totalPosts.label})`;
    } else {
      const pct = Math.round(((posts - delta) / delta) * 100);
      const sign = pct > 0 ? "up" : pct < 0 ? "down" : "flat";
      const abs = Math.abs(pct);
      postsClause = `${postsClause} (${sign} ${abs}% ${c.totalPosts.label})`;
    }
  }

  const paxClause = `${pax.toLocaleString()} unique PAX`;
  let fngClause = "";
  if (fngs > 0) {
    fngClause = ` and ${fngs} FNG${fngs === 1 ? "" : "s"} on the books`;
  }

  let leadClause = "";
  if (scope === "region" && stats.byAo.length > 0) {
    const top = stats.byAo[0];
    leadClause = `, led by ${top.ao} with ${top.count} post${top.count === 1 ? "" : "s"}`;
  }

  return `${who} posted ${postsClause}${leadClause}, drawing ${paxClause}${fngClause}.`;
}
