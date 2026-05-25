import { notFound, redirect } from "next/navigation";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import Link from "next/link";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { getPaxStats } from "@/lib/stats/getPaxStats";
import { getSql } from "@/lib/db";
import { nameToSlug } from "@/lib/stats/slugify";
import { FilterBar } from "../../../admin/analytics/_components/FilterBar";
import { MetricCard } from "../../../admin/analytics/_components/MetricCard";
import { PostsOverTimeChart } from "../../../admin/analytics/_components/PostsOverTimeChart";
import { AoDistributionPie } from "../../../admin/analytics/_components/AoDistributionPie";
import { QdWorkoutsTable } from "../../../admin/analytics/_components/QdWorkoutsTable";

export const dynamic = "force-dynamic";

type SP = { range?: string; from?: string; to?: string; fromAo?: string };

export default async function StatsPaxPage({
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
    if (sp.range || sp.from || sp.to) redirect(`/stats/pax/${slug}`);
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

  const aoHref = (aoSlug: string) => `/stats/ao/${aoSlug}${rangeParam}`;

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

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow={
          <Link
            href={
              fromAo
                ? `/stats/ao/${fromAo.slug}${rangeParam}`
                : `/stats${rangeParam}`
            }
            className="inline-block"
          >
            <MonoTag>
              // stats {fromAo ? `/ ${fromAo.name} ` : ""}/ pax
            </MonoTag>
          </Link>
        }
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
      </div>
    </section>
  );
}
