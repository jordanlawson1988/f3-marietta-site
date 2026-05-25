import { redirect } from "next/navigation";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { nameToSlug } from "@/lib/stats/slugify";
import Link from "next/link";
import { FilterBar } from "../admin/analytics/_components/FilterBar";
import { MetricCard } from "../admin/analytics/_components/MetricCard";
import { PostsByAoChart } from "@/components/admin/PostsByAoChart";
import { TopPaxChart } from "@/components/admin/TopPaxChart";
import { getOverviewStats } from "@/lib/stats/getOverviewStats";
import { getBeatdownsList } from "@/lib/stats/getBeatdownsList";
import { PostsOverTimeChart } from "../admin/analytics/_components/PostsOverTimeChart";
import { DayOfWeekChart } from "../admin/analytics/_components/DayOfWeekChart";
import { BeatdownsList } from "../admin/analytics/_components/BeatdownsList";

export const dynamic = "force-dynamic";

type SP = { range?: string; from?: string; to?: string; ao?: string; topN?: string };

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

  const rawAo = sp.ao;
  const aoSlugs =
    rawAo && rawAo !== "all"
      ? rawAo.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const topNParam = sp.topN ?? "20";
  const topN =
    topNParam === "all" ? Number.MAX_SAFE_INTEGER : parseInt(topNParam, 10) || 20;

  const [stats, beatdowns] = await Promise.all([
    getOverviewStats(range, aoSlugs.length > 0 ? aoSlugs : null, topN),
    getBeatdownsList(range, aoSlugs.length > 0 ? aoSlugs : null),
  ]);

  const aoOptions = stats.allAoRanking.map((row, rank) => ({
    aoSlug: row.aoSlug,
    aoName: row.ao,
    rank,
  }));

  const rangeParam =
    range.slug === "custom"
      ? `?range=custom&from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}`
      : range.slug === "current-month"
      ? ""
      : `?range=${range.slug}`;

  const aoHref = (slug: string) => `/stats/ao/${slug}${rangeParam}`;
  const paxHref = (paxKey: string) => {
    const label = stats.topPax.find((p) => p.key === paxKey)?.label ?? paxKey;
    return `/stats/pax/${nameToSlug(label)}${rangeParam}`;
  };

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow={<MonoTag>// region stats</MonoTag>}
        h2="Region BI"
        kicker={
          <>
            {range.label}
            {aoSlugs.length > 0
              ? ` · ${aoSlugs.length === 1
                  ? (stats.byAo.find((b) => b.aoSlug === aoSlugs[0])?.ao ?? aoSlugs[0])
                  : `${aoSlugs.length} AOs`}`
              : ""}
          </>
        }
        align="left"
      />
      <div className="mt-10">
        <FilterBar aoOptions={aoOptions} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 mb-6">
          <MetricCard label="total posts" value={stats.totalPosts} />
          <MetricCard label="unique pax" value={stats.uniquePax} />
          <Link
            href={`/stats/fngs${rangeParam}`}
            className="block transition-opacity hover:opacity-80"
            aria-label="See the FNG roster"
          >
            <MetricCard label="new fngs" value={stats.newFngs} />
          </Link>
          <MetricCard
            label="avg headcount"
            value={stats.avgHeadcount ?? "—"}
            caption="per workout"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-5">
            <PostsByAoChart
              data={stats.byAo.map((b) => ({
                ao: b.ao,
                count: b.count,
                aoSlug: b.aoSlug,
              }))}
              href={aoHref}
            />
          </div>
          <div className="md:col-span-7">
            <TopPaxChart
              data={stats.topPax}
              topN={topNParam === "all" ? undefined : parseInt(topNParam, 10) || 20}
              href={paxHref}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mt-4">
          <div className="md:col-span-8">
            <PostsOverTimeChart data={stats.postsOverTime} />
          </div>
          <div className="md:col-span-4">
            <DayOfWeekChart data={stats.byDayOfWeek} />
          </div>
        </div>

        <div className="mt-4">
          <BeatdownsList data={beatdowns} />
        </div>
      </div>
    </section>
  );
}
