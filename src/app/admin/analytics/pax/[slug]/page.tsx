import { notFound, redirect } from "next/navigation";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { getPaxStats } from "@/lib/stats/getPaxStats";
import { FilterBar } from "../../_components/FilterBar";
import { MetricCard } from "../../_components/MetricCard";
import { PostsOverTimeChart } from "../../_components/PostsOverTimeChart";
import { AoDistributionPie } from "../../_components/AoDistributionPie";
import { QdWorkoutsTable } from "../../_components/QdWorkoutsTable";

export const dynamic = "force-dynamic";

type SP = { range?: string; from?: string; to?: string };

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

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow="§ Admin · Analytics · PAX"
        h2={stats.paxLabel}
        kicker={<>{range.label}</>}
        align="left"
      />
      <div className="mt-10">
        <FilterBar showAoFilter={false} showTopN={false} />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6 mt-6">
          <MetricCard label="total posts" value={stats.totalPosts} />
          <MetricCard label="aos visited" value={stats.aosVisited} />
          <MetricCard label="first seen (ytd)" value={stats.firstSeenMonth ?? "—"} />
          <MetricCard label="longest streak" value={`${stats.longestStreak} wk`} />
          <MetricCard label="q'd workouts" value={stats.qdWorkouts.length} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
          <div className="md:col-span-8">
            <PostsOverTimeChart data={stats.postsOverTime} />
          </div>
          <div className="md:col-span-4">
            <AoDistributionPie data={stats.byAo} />
          </div>
        </div>

        <QdWorkoutsTable data={stats.qdWorkouts} />
      </div>
    </section>
  );
}
