import { redirect } from "next/navigation";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { nameToSlug } from "@/lib/stats/slugify";
import { rangeParam } from "@/lib/stats/rangeParam";
import { getOverviewStatsWithCompare } from "@/lib/stats/getOverviewStatsWithCompare";
import { getBeatdownsList } from "@/lib/stats/getBeatdownsList";
import {
  getDayTimeHeatmap,
  TIME_BUCKETS,
  CANONICAL_BUCKETS,
} from "@/lib/stats/getDayTimeHeatmap";
import { getQLeaderboard } from "@/lib/stats/getQLeaderboard";
import { getFngFunnel } from "@/lib/stats/getFngFunnel";
import { getAoHealth } from "@/lib/stats/getAoHealth";
import { buildInsightHeadline } from "@/lib/stats/buildInsightHeadline";
import type { CompareMode } from "@/lib/stats/getPriorRange";
import { deltaLabelForRange } from "@/lib/stats/getPriorRange";

import { FilterBar } from "@/components/stats/FilterBar";
import { KpiTile } from "@/components/stats/KpiTile";
import { InsightHeadline } from "@/components/stats/InsightHeadline";
import { FreshnessBadge } from "@/components/stats/FreshnessBadge";
import { TrendChart } from "@/components/stats/TrendChart";
import { DayTimeHeatmap } from "@/components/stats/DayTimeHeatmap";
import { FngFunnelWidget } from "@/components/stats/FngFunnel";
import { AoLeaderboardTable } from "@/components/stats/AoLeaderboardTable";
import { PaxLeaderboardTable } from "@/components/stats/PaxLeaderboardTable";
import { QLeaderboardTable } from "@/components/stats/QLeaderboardTable";
import { BeatdownsTable } from "@/components/stats/BeatdownsTable";
import { StatsNav } from "@/components/stats/StatsNav";

export const dynamic = "force-dynamic";

type SP = {
  range?: string;
  from?: string;
  to?: string;
  ao?: string;
  topN?: string;
  compare?: string;
};

function parseCompare(v?: string): CompareMode {
  if (v === "prior" || v === "yoy") return v;
  return "off";
}

export default async function StatsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  let range = parseTimeRange({ range: sp.range, from: sp.from, to: sp.to });
  if (!range) {
    if (sp.range || sp.from || sp.to) redirect("/stats");
    range = defaultTimeRange();
  }

  const compare = parseCompare(sp.compare);
  const aoSlugs =
    sp.ao && sp.ao !== "all"
      ? sp.ao.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const aoFilter = aoSlugs.length > 0 ? aoSlugs : null;

  const topNParam = sp.topN ?? "20";
  const topN =
    topNParam === "all" ? Number.MAX_SAFE_INTEGER : parseInt(topNParam, 10) || 20;

  const [stats, beatdowns, heatmap, qLeaderboard, fngFunnel, aoHealth] =
    await Promise.all([
      getOverviewStatsWithCompare(range, aoFilter, topN, compare),
      getBeatdownsList(range, aoFilter),
      getDayTimeHeatmap(range, aoFilter),
      getQLeaderboard(range, aoFilter, 12),
      getFngFunnel(range, aoFilter),
      getAoHealth(range, aoFilter),
    ]);

  const linkSuffix = rangeParam(range, compare);

  const aoOptions = stats.allAoRanking.map((row, rank) => ({
    aoSlug: row.aoSlug,
    aoName: row.ao,
    rank,
  }));

  const aoHref = (slug: string) => `/stats/ao/${slug}${linkSuffix}`;
  const paxHref = (paxKey: string) => {
    const label = stats.topPax.find((p) => p.key === paxKey)?.label ?? paxKey;
    return `/stats/pax/${nameToSlug(label)}${linkSuffix}`;
  };
  const paxSlugHref = (slug: string) => `/stats/pax/${slug}${linkSuffix}`;
  const fngsHref = `/stats/fngs${linkSuffix}`;
  const qsHref = `/stats/qs${linkSuffix}`;

  const deltaLabel = deltaLabelForRange(range.slug);
  const compareSet = stats.compare;

  const insight = buildInsightHeadline({
    stats,
    rangeLabel: range.label,
    scope: aoFilter ? "ao" : "region",
    aoName:
      aoFilter && aoFilter.length === 1
        ? stats.byAo.find((b) => b.aoSlug === aoFilter[0])?.ao
        : undefined,
  });

  // Sparklines from monthly trend (last 6 buckets).
  const trendSpark = stats.postsOverTime.slice(-6).map((p) => p.count);

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow={<MonoTag>// region BI</MonoTag>}
        h2="The pulse of F3 Marietta"
        kicker={
          <div className="flex items-center gap-4 flex-wrap">
            <span>
              {range.label}
              {aoFilter
                ? ` · ${aoFilter.length === 1
                    ? (stats.byAo.find((b) => b.aoSlug === aoFilter[0])?.ao ?? aoFilter[0])
                    : `${aoFilter.length} AOs`}`
                : ""}
            </span>
            <FreshnessBadge />
          </div>
        }
        align="left"
      />

      <StatsNav current="/stats" filterSuffix={linkSuffix} scope="customer" />

      <InsightHeadline sentence={insight} />

      <FilterBar aoOptions={aoOptions} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiTile
          label="total posts"
          value={stats.totalPosts}
          spark={trendSpark}
          delta={
            compareSet
              ? { prior: compareSet.totalPosts.prior, label: compareSet.totalPosts.label }
              : { prior: null, label: deltaLabel }
          }
        />
        <KpiTile
          label="unique pax"
          value={stats.uniquePax}
          delta={
            compareSet
              ? { prior: compareSet.uniquePax.prior, label: compareSet.uniquePax.label }
              : { prior: null, label: deltaLabel }
          }
        />
        <KpiTile
          label="new fngs"
          value={stats.newFngs}
          href={fngsHref}
          caption="tap for roster"
          delta={
            compareSet
              ? { prior: compareSet.newFngs.prior, label: compareSet.newFngs.label }
              : { prior: null, label: deltaLabel }
          }
        />
        <KpiTile
          label="avg headcount"
          value={stats.avgHeadcount ?? "—"}
          caption="per workout"
          delta={
            compareSet && typeof stats.avgHeadcount === "number"
              ? { prior: compareSet.avgHeadcount.prior, label: compareSet.avgHeadcount.label }
              : undefined
          }
        />
      </div>

      <div className="mb-4">
        <TrendChart
          data={stats.postsOverTime}
          priorData={compareSet?.postsOverTimePrior}
          title={
            <>
              {compareSet ? (
                <>Posts over time, this period vs prior</>
              ) : (
                <>Posts over time</>
              )}
            </>
          }
          subtitle="Monthly backblast counts. Peak annotated when ≥20% above median."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
        <div className="md:col-span-7">
          <DayTimeHeatmap
            data={heatmap.cells}
            buckets={TIME_BUCKETS}
            alwaysShowBuckets={CANONICAL_BUCKETS}
            title="When the region posts"
            subtitle={
              heatmap.total > 0 ? (
                <>
                  Day-of-week × scheduled start time.{" "}
                  {heatmap.withTime}/{heatmap.total} posts placed (
                  {Math.round((heatmap.withTime / heatmap.total) * 100)}%).
                </>
              ) : (
                <>Day-of-week × scheduled start time.</>
              )
            }
            footnote={
              heatmap.unscheduledAos.length > 0 ? (
                <>
                  // unscheduled (no <code>workout_schedule</code> entry):{" "}
                  {heatmap.unscheduledAos
                    .slice(0, 4)
                    .map((u) => `${u.ao} (${u.posts})`)
                    .join(" · ")}
                  {heatmap.unscheduledAos.length > 4 &&
                    ` · +${heatmap.unscheduledAos.length - 4} more`}
                </>
              ) : null
            }
          />
        </div>
        <div className="md:col-span-5">
          <FngFunnelWidget data={fngFunnel} fngsHref={fngsHref} />
        </div>
      </div>

      <div className="mb-4">
        <AoLeaderboardTable data={aoHealth} aoHref={aoHref} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
        <div className="md:col-span-7">
          <QLeaderboardTable data={qLeaderboard} paxHref={paxSlugHref} />
          <div className="mt-2 flex justify-end">
            <a
              href={qsHref}
              className="font-mono text-[10px] tracking-[.18em] uppercase text-muted hover:text-ink underline underline-offset-4"
            >
              see full Q leaderboard →
            </a>
          </div>
        </div>
        <div className="md:col-span-5">
          <PaxLeaderboardTable
            data={stats.topPax}
            topN={topNParam === "all" ? undefined : parseInt(topNParam, 10) || 20}
            paxHref={paxHref}
            subtitle="Posts logged in range. Top-N controlled by filter."
          />
        </div>
      </div>

      <BeatdownsTable data={beatdowns} />
    </section>
  );
}
