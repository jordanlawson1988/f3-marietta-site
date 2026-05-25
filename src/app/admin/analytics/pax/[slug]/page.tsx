import { notFound, redirect } from "next/navigation";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { getPaxStats } from "@/lib/stats/getPaxStats";
import { getSql } from "@/lib/db";
import { nameToSlug } from "@/lib/stats/slugify";
import type { Crumb } from "../../_components/Crumbs";
import { Crumbs } from "../../_components/Crumbs";
import { FilterBar } from "../../_components/FilterBar";
import { MetricCard } from "../../_components/MetricCard";
import { PostsOverTimeChart } from "../../_components/PostsOverTimeChart";
import { AoDistributionPie } from "../../_components/AoDistributionPie";
import { QdWorkoutsTable } from "../../_components/QdWorkoutsTable";
import { ExportButton } from "../../_components/ExportButton";

export const dynamic = "force-dynamic";

type SP = { range?: string; from?: string; to?: string; fromAo?: string };

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
    if (sp.range || sp.from || sp.to)
      redirect(`/admin/analytics/pax/${slug}`);
    range = defaultTimeRange();
  }

  const stats = await getPaxStats(range, slug);
  if (!stats) notFound();

  const rangeParam =
    range.slug === "custom"
      ? `?range=custom&from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}`
      : range.slug === "current-month"
      ? ""
      : `?range=${range.slug}`;

  const aoHref = (aoSlug: string) =>
    `/admin/analytics/ao/${aoSlug}${rangeParam}`;

  let fromAo: { slug: string; name: string } | null = null;
  if (sp.fromAo) {
    const sql = getSql();
    const aoRows = (await sql`
      SELECT DISTINCT ao_display_name
      FROM f3_events
      WHERE ao_display_name IS NOT NULL
    `) as Array<{ ao_display_name: string }>;
    const match = aoRows.find(
      (r) => nameToSlug(r.ao_display_name) === sp.fromAo,
    );
    if (match) {
      fromAo = { slug: sp.fromAo, name: match.ao_display_name };
    }
  }

  const crumbs: Crumb[] = [
    { label: "§ Admin", href: "/admin" },
    { label: "Analytics", href: `/admin/analytics${rangeParam}` },
    ...(fromAo
      ? [
          {
            label: fromAo.name,
            href: `/admin/analytics/ao/${fromAo.slug}${rangeParam}`,
          },
        ]
      : []),
    { label: "PAX" },
  ];

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow={<Crumbs items={crumbs} />}
        h2={stats.paxLabel}
        kicker={<>{range.label}</>}
        align="left"
      />
      <div className="mt-10">
        <FilterBar showAoFilter={false} showTopN={false} />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 mt-6">
          <MetricCard label="total posts" value={stats.totalPosts} />
          <MetricCard label="aos visited" value={stats.aosVisited} />
          <MetricCard label="first seen" value={stats.firstSeenMonth ?? "—"} />
          <MetricCard label="longest streak" value={`${stats.longestStreak} wk`} />
          <MetricCard label="q'd workouts" value={stats.qdWorkouts.length} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
          <div className="md:col-span-8">
            <PostsOverTimeChart data={stats.postsOverTime} />
          </div>
          <div className="md:col-span-4">
            <AoDistributionPie data={stats.byAo} aoHref={aoHref} />
          </div>
        </div>

        <QdWorkoutsTable data={stats.qdWorkouts} aoHref={aoHref} />

        <div className="mt-6">
          <ExportButton
            href={`/admin/analytics/export?scope=pax&pax=${slug}&range=${range.slug}${range.slug === "custom" ? `&from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}` : ""}`}
            label="Download CSV (this PAX)"
          />
        </div>
      </div>
    </section>
  );
}
