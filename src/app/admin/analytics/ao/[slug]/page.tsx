import { notFound, redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { nameToSlug } from "@/lib/stats/slugify";
import { Crumbs } from "../../_components/Crumbs";
import { FilterBar } from "../../_components/FilterBar";
import { getAoStats } from "@/lib/stats/getAoStats";
import { getQStats } from "@/lib/stats/getQStats";
import { MetricCard } from "../../_components/MetricCard";
import { TopPaxChart } from "@/components/admin/TopPaxChart";
import { PostsOverTimeChart } from "../../_components/PostsOverTimeChart";
import { QRotationList } from "../../_components/QRotationList";
import { ExportButton } from "../../_components/ExportButton";

export const dynamic = "force-dynamic";

type SP = { range?: string; from?: string; to?: string; topN?: string };

export default async function AnalyticsAoPage({
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
    if (sp.range || sp.from || sp.to)
      redirect(`/admin/analytics/ao/${slug}`);
    range = defaultTimeRange();
  }

  const topNParam = sp.topN ?? "20";
  const topN = topNParam === "all" ? Number.MAX_SAFE_INTEGER : parseInt(topNParam, 10) || 20;
  const [stats, qStats] = await Promise.all([
    getAoStats(range, slug, topN),
    getQStats(range, slug),
  ]);
  if (!stats) notFound();

  const customParam =
    range.slug === "custom"
      ? `?range=custom&from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}`
      : range.slug === "ytd"
      ? ""
      : `?range=${range.slug}`;
  const paxHref = (paxKey: string) => {
    const label = stats.topPax.find((p) => p.key === paxKey)?.label ?? paxKey;
    const sep = customParam ? "&" : "?";
    return `/admin/analytics/pax/${nameToSlug(label)}${customParam}${sep}fromAo=${slug}`;
  };

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow={
          <Crumbs
            items={[
              { label: "§ Admin", href: "/admin" },
              { label: "Analytics", href: `/admin/analytics${customParam}` },
              { label: "AO" },
            ]}
          />
        }
        h2={match.ao_display_name}
        kicker={<>{range.label}</>}
        align="left"
      />
      <div className="mt-10">
        <FilterBar showAoFilter={false} showTopN={true} />

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
          <MetricCard label="total posts" value={stats.totalPosts} />
          <MetricCard label="unique pax" value={stats.uniquePax} />
          <MetricCard label="new fngs" value={stats.newFngs} />
          <MetricCard label="avg headcount" value={stats.avgHeadcount ?? "—"} caption="per workout" />
          <MetricCard label="aos visited" value={stats.byAo.length} />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
          <div className="md:col-span-7">
            <PostsOverTimeChart data={stats.postsOverTime} />
          </div>
          <div className="md:col-span-5">
            <QRotationList data={qStats} />
          </div>
        </div>

        <div className="mt-4">
          <TopPaxChart
            data={stats.topPax}
            topN={topNParam === "all" ? undefined : parseInt(topNParam, 10) || 20}
            href={paxHref}
          />
        </div>

        <div className="mt-6">
          <ExportButton
            href={`/admin/analytics/export?scope=ao&ao=${slug}&range=${range.slug}${range.slug === "custom" ? `&from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}` : ""}`}
            label="Download CSV (this AO)"
          />
        </div>
      </div>
    </section>
  );
}
