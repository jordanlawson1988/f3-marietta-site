import { notFound, redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { nameToSlug } from "@/lib/stats/slugify";
import { rangeParam } from "@/lib/stats/rangeParam";
import { getQStats } from "@/lib/stats/getQStats";
import { getOverviewStatsWithCompare } from "@/lib/stats/getOverviewStatsWithCompare";
import {
  getDayTimeHeatmap,
  TIME_BUCKETS,
  CANONICAL_BUCKETS,
} from "@/lib/stats/getDayTimeHeatmap";
import { getAoHealth } from "@/lib/stats/getAoHealth";
import { getBeatdownsList } from "@/lib/stats/getBeatdownsList";
import { buildInsightHeadline } from "@/lib/stats/buildInsightHeadline";
import {
  deltaLabelForRange,
  type CompareMode,
} from "@/lib/stats/getPriorRange";

import { Crumbs } from "@/components/stats/Crumbs";
import { FilterBar } from "@/components/stats/FilterBar";
import { KpiTile } from "@/components/stats/KpiTile";
import { InsightHeadline } from "@/components/stats/InsightHeadline";
import { FreshnessBadge } from "@/components/stats/FreshnessBadge";
import { TrendChart } from "@/components/stats/TrendChart";
import { DayTimeHeatmap } from "@/components/stats/DayTimeHeatmap";
import { QRotationCard } from "@/components/stats/QRotationCard";
import { PaxLeaderboardTable } from "@/components/stats/PaxLeaderboardTable";
import { BeatdownsTable } from "@/components/stats/BeatdownsTable";

export const dynamic = "force-dynamic";

type SP = {
  range?: string;
  from?: string;
  to?: string;
  topN?: string;
  compare?: string;
};

function parseCompare(v?: string): CompareMode {
  if (v === "prior" || v === "yoy") return v;
  return "off";
}

export default async function StatsAoPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const { slug } = await params;
  const sp = await searchParams;

  const sql = getSql();
  const aoRows = (await sql`
    SELECT DISTINCT ao_display_name
    FROM f3_events
    WHERE ao_display_name IS NOT NULL
  `) as Array<{ ao_display_name: string }>;
  const match = aoRows.find((r) => nameToSlug(r.ao_display_name) === slug);
  if (!match) notFound();

  let range = parseTimeRange({ range: sp.range, from: sp.from, to: sp.to });
  if (!range) {
    if (sp.range || sp.from || sp.to) redirect(`/stats/ao/${slug}`);
    range = defaultTimeRange();
  }

  const compare = parseCompare(sp.compare);
  const topNParam = sp.topN ?? "20";
  const topN =
    topNParam === "all" ? Number.MAX_SAFE_INTEGER : parseInt(topNParam, 10) || 20;

  const [stats, qStats, heatmap, aoHealth, beatdowns] = await Promise.all([
    getOverviewStatsWithCompare(range, [slug], topN, compare),
    getQStats(range, slug),
    getDayTimeHeatmap(range, [slug]),
    getAoHealth(range, null), // full region for comparison
    getBeatdownsList(range, [slug]),
  ]);

  const linkSuffix = rangeParam(range, compare);
  const aoHref = (s: string) => `/stats/ao/${s}${linkSuffix}`;
  const paxHref = (paxKey: string) => {
    const label = stats.topPax.find((p) => p.key === paxKey)?.label ?? paxKey;
    const sep = linkSuffix ? "&" : "?";
    return `/stats/pax/${nameToSlug(label)}${linkSuffix}${sep}fromAo=${slug}`;
  };

  const myHealth = aoHealth.find((h) => h.aoSlug === slug) ?? null;
  const myRank =
    myHealth && aoHealth.length
      ? aoHealth.findIndex((h) => h.aoSlug === slug) + 1
      : null;

  const deltaLabel = deltaLabelForRange(range.slug);
  const compareSet = stats.compare;

  const insight = buildInsightHeadline({
    stats,
    rangeLabel: range.label,
    scope: "ao",
    aoName: match.ao_display_name,
  });

  const trendSpark = stats.postsOverTime.slice(-6).map((p) => p.count);
  const subtitleHealth = myHealth
    ? `Health ${myHealth.health}/100 · ranked #${myRank} of ${aoHealth.length} AOs in region`
    : undefined;

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow={
          <Crumbs
            items={[
              { label: "// stats", href: `/stats${linkSuffix}` },
              { label: "AO" },
            ]}
          />
        }
        h2={match.ao_display_name}
        kicker={
          <div className="flex items-center gap-4 flex-wrap">
            <span>{range.label}</span>
            {subtitleHealth && (
              <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">
                · {subtitleHealth}
              </span>
            )}
            <FreshnessBadge />
          </div>
        }
        align="left"
      />

      <InsightHeadline sentence={insight} />

      <FilterBar showAoFilter={false} showTopN={true} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
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
              ? {
                  prior: compareSet.avgHeadcount.prior,
                  label: compareSet.avgHeadcount.label,
                }
              : undefined
          }
        />
        <KpiTile
          label="ao health"
          value={myHealth ? myHealth.health : "—"}
          caption={myRank ? `#${myRank} / ${aoHealth.length}` : undefined}
          featured
        />
      </div>

      <div className="mb-4">
        <TrendChart
          data={stats.postsOverTime}
          priorData={compareSet?.postsOverTimePrior}
          title={
            compareSet
              ? "Posts at this AO, current vs prior"
              : "Posts at this AO over time"
          }
          subtitle="Monthly backblast counts."
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
        <div className="md:col-span-7">
          <DayTimeHeatmap
            data={heatmap.cells}
            buckets={TIME_BUCKETS}
            alwaysShowBuckets={CANONICAL_BUCKETS}
            title={`When ${match.ao_display_name} typically posts`}
            subtitle={
              heatmap.total > 0 ? (
                <>
                  Day-of-week × scheduled start time for this AO.{" "}
                  {heatmap.withTime}/{heatmap.total} posts placed.
                </>
              ) : (
                <>Day-of-week × scheduled start time for this AO.</>
              )
            }
            footnote={
              heatmap.unscheduledAos.length > 0 ? (
                <>
                  // {heatmap.unscheduledAos[0].ao} has no{" "}
                  <code>workout_schedule</code> entry — add one to surface its
                  posts in the grid.
                </>
              ) : null
            }
          />
        </div>
        <div className="md:col-span-5">
          <QRotationCard
            data={qStats}
            diversity={myHealth?.qDiversity ?? null}
            subtitle="Distribution of Qs leading workouts at this AO."
          />
        </div>
      </div>

      <div className="mb-4">
        <PaxLeaderboardTable
          data={stats.topPax}
          topN={topNParam === "all" ? undefined : parseInt(topNParam, 10) || 20}
          paxHref={paxHref}
          title="Who's posting most at this AO"
          subtitle="Click a PAX to see their region-wide pattern."
        />
      </div>

      <BeatdownsTable data={beatdowns} />

      <div className="mt-6 flex flex-wrap gap-4 text-[11px] font-mono tracking-[.15em] uppercase text-muted">
        <a
          href={`/stats${linkSuffix}`}
          className="hover:text-ink underline underline-offset-4"
        >
          ← back to region overview
        </a>
        <span className="text-muted">·</span>
        <a href={`/stats/qs${linkSuffix}`} className="hover:text-ink underline underline-offset-4">
          region Q leaderboard →
        </a>
      </div>
    </section>
  );
}
