import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { getPaxStats } from "@/lib/stats/getPaxStats";
import { getStreakCalendar } from "@/lib/stats/getStreakCalendar";
import { getSql } from "@/lib/db";
import { nameToSlug } from "@/lib/stats/slugify";
import { rangeParam } from "@/lib/stats/rangeParam";
import {
  deltaLabelForRange,
  type CompareMode,
} from "@/lib/stats/getPriorRange";

import { Crumbs, type Crumb } from "@/components/stats/Crumbs";
import { FilterBar } from "@/components/stats/FilterBar";
import { KpiTile } from "@/components/stats/KpiTile";
import { FreshnessBadge } from "@/components/stats/FreshnessBadge";
import { TrendChart } from "@/components/stats/TrendChart";
import { AoDistributionCard } from "@/components/stats/AoDistributionCard";
import { StreakCalendar } from "@/components/stats/StreakCalendar";
import { ChartCard } from "@/components/stats/ChartCard";
import { ExportButton } from "@/components/stats/ExportButton";

export const dynamic = "force-dynamic";

type SP = {
  range?: string;
  from?: string;
  to?: string;
  fromAo?: string;
  compare?: string;
};

function parseCompare(v?: string): CompareMode {
  if (v === "prior" || v === "yoy") return v;
  return "off";
}

export default async function AnalyticsPaxPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<SP>;
}) {
  const { slug } = await params;
  const sp = await searchParams;
  let range = parseTimeRange({ range: sp.range, from: sp.from, to: sp.to });
  if (!range) {
    if (sp.range || sp.from || sp.to) redirect(`/admin/analytics/pax/${slug}`);
    range = defaultTimeRange();
  }
  const compare = parseCompare(sp.compare);

  const [stats, streak] = await Promise.all([
    getPaxStats(range, slug),
    getStreakCalendar(slug, 12),
  ]);
  if (!stats) notFound();

  const linkSuffix = rangeParam(range, compare);
  const aoHref = (aoSlug: string) =>
    `/admin/analytics/ao/${aoSlug}${linkSuffix}`;
  const deltaLabel = deltaLabelForRange(range.slug);

  let fromAo: { slug: string; name: string } | null = null;
  if (sp.fromAo) {
    const sql = getSql();
    const aoRows = (await sql`
      SELECT DISTINCT ao_display_name
      FROM f3_events
      WHERE ao_display_name IS NOT NULL
    `) as Array<{ ao_display_name: string }>;
    const match = aoRows.find((r) => nameToSlug(r.ao_display_name) === sp.fromAo);
    if (match) {
      fromAo = { slug: sp.fromAo, name: match.ao_display_name };
    }
  }

  const crumbs: Crumb[] = [
    { label: "§ Admin", href: "/admin" },
    { label: "Analytics", href: `/admin/analytics${linkSuffix}` },
    ...(fromAo
      ? [
          {
            label: fromAo.name,
            href: `/admin/analytics/ao/${fromAo.slug}${linkSuffix}`,
          },
        ]
      : []),
    { label: stats.paxLabel },
  ];

  const recentPosts = stats.postsOverTime.slice(-1)[0]?.count ?? 0;
  const insight =
    stats.totalPosts === 0
      ? `${stats.paxLabel} did not post during ${range.label.toLowerCase()}.`
      : `${stats.paxLabel} posted ${stats.totalPosts} time${
          stats.totalPosts === 1 ? "" : "s"
        } across ${stats.aosVisited} AO${stats.aosVisited === 1 ? "" : "s"}${
          stats.qdWorkouts.length
            ? `, Q'd ${stats.qdWorkouts.length}`
            : ""
        }${recentPosts ? `, ${recentPosts} this month` : ""}.`;

  const trendSpark = stats.postsOverTime.slice(-6).map((p) => p.count);

  const exportParams = `scope=pax&pax=${slug}&range=${range.slug}${
    range.slug === "custom"
      ? `&from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}`
      : ""
  }`;

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow={<Crumbs items={crumbs} />}
        h2={stats.paxLabel}
        kicker={
          <div className="flex items-center gap-4 flex-wrap">
            <span>{range.label}</span>
            <FreshnessBadge />
          </div>
        }
        align="left"
      />

      <div className="mb-6 p-5 border border-line-soft bg-bone-2/60">
        <p className="font-display font-medium text-[20px] leading-tight tracking-[-.01em] text-ink">
          {insight}
        </p>
      </div>

      <FilterBar showAoFilter={false} showTopN={false} />

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
        <KpiTile
          label="total posts"
          value={stats.totalPosts}
          spark={trendSpark}
          delta={{ prior: null, label: deltaLabel }}
        />
        <KpiTile label="aos visited" value={stats.aosVisited} />
        <KpiTile
          label="first seen"
          value={stats.firstSeenMonth ?? "—"}
          caption="in this range"
        />
        <KpiTile
          label="longest streak"
          value={`${stats.longestStreak} wk`}
          caption="consecutive weeks"
        />
        <KpiTile
          label="q'd workouts"
          value={stats.qdWorkouts.length}
          caption="led a beatdown"
          featured
        />
      </div>

      {streak && (
        <div className="mb-4">
          <StreakCalendar data={streak} />
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
        <div className="md:col-span-7">
          <TrendChart
            data={stats.postsOverTime}
            title={`Posts over time for ${stats.paxLabel}`}
            subtitle="Backblasts per month in the active range."
          />
        </div>
        <div className="md:col-span-5">
          <AoDistributionCard
            data={stats.byAo}
            aoHref={aoHref}
            title={`Where ${stats.paxLabel} posts`}
          />
        </div>
      </div>

      <ChartCard
        eyebrow={`workouts q'd · ${stats.qdWorkouts.length}`}
        title={`Beatdowns ${stats.paxLabel} has led`}
      >
        {stats.qdWorkouts.length === 0 ? (
          <p className="font-mono text-xs text-muted">// no Q records in range</p>
        ) : (
          <ul className="font-mono text-[11px] space-y-1">
            <li
              role="row"
              className="grid grid-cols-[110px_1fr_70px] gap-3 text-muted tracking-[.15em] uppercase border-b border-line-soft pb-1.5"
            >
              <span>date</span>
              <span>AO</span>
              <span className="text-right">PAX</span>
            </li>
            {stats.qdWorkouts.map((r) => (
              <li
                key={`${r.eventDate}-${r.aoSlug}`}
                className="grid grid-cols-[110px_1fr_70px] items-baseline gap-3"
              >
                <span className="text-muted">{r.eventDate}</span>
                <Link
                  href={aoHref(r.aoSlug)}
                  prefetch={false}
                  className="truncate hover:underline underline-offset-4"
                >
                  {r.aoName}
                </Link>
                <span className="text-right text-muted tabular-nums">
                  {r.headcount ?? "—"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </ChartCard>

      <div className="mt-8 pt-6 border-t border-line-soft">
        <MonoTag>// admin exports</MonoTag>
        <div className="mt-3">
          <ExportButton
            href={`/admin/analytics/export?${exportParams}`}
            label="This PAX CSV"
          />
        </div>
      </div>
    </section>
  );
}
