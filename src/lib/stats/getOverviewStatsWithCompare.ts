import { getOverviewStats, type OverviewStats } from "./getOverviewStats";
import {
  getPriorRange,
  type CompareMode,
  deltaLabelForRange,
} from "./getPriorRange";
import type { TimeRange } from "./timeRange";

export type CompareKpi = {
  /** prior period absolute value (null when out of data) */
  prior: number | null;
  /** "vs Apr", "vs 2025 YTD", etc. */
  label: string;
};

export type OverviewWithCompare = OverviewStats & {
  /** if `compare` is "off", these are null */
  compare: {
    totalPosts: CompareKpi;
    uniquePax: CompareKpi;
    newFngs: CompareKpi;
    avgHeadcount: CompareKpi;
    activeAos: CompareKpi;
    /** prior-period monthly trend for overlay */
    postsOverTimePrior: Array<{ month: string; count: number }>;
  } | null;
};

/**
 * Wrap getOverviewStats with a second call against the prior comparable
 * window. Mode "off" skips the second call entirely.
 */
export async function getOverviewStatsWithCompare(
  range: TimeRange,
  aoSlugs: string[] | null,
  topN: number,
  compare: CompareMode,
): Promise<OverviewWithCompare> {
  const current = await getOverviewStats(range, aoSlugs, topN);
  if (compare === "off") {
    return { ...current, compare: null };
  }
  const prior = getPriorRange(range, compare);
  if (!prior) {
    return { ...current, compare: null };
  }
  const priorStats = await getOverviewStats(
    { slug: range.slug, from: prior.from, to: prior.to, label: prior.label },
    aoSlugs,
    topN,
  );
  const label = prior.label || deltaLabelForRange(range.slug);

  return {
    ...current,
    compare: {
      totalPosts: { prior: priorStats.totalPosts || null, label },
      uniquePax: { prior: priorStats.uniquePax || null, label },
      newFngs: { prior: priorStats.newFngs || null, label },
      avgHeadcount: { prior: priorStats.avgHeadcount, label },
      activeAos: {
        prior: priorStats.byAo.length || null,
        label,
      },
      postsOverTimePrior: priorStats.postsOverTime,
    },
  };
}
