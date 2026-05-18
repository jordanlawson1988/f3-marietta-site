import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { nameToSlug } from "@/lib/stats/slugify";
import { FilterBar } from "./_components/FilterBar";
import { MetricCard } from "./_components/MetricCard";
import { PostsByAoChart } from "@/components/admin/PostsByAoChart";
import { TopPaxChart } from "@/components/admin/TopPaxChart";
import { getOverviewStats } from "@/lib/stats/getOverviewStats";
import { PostsOverTimeChart } from "./_components/PostsOverTimeChart";
import { DayOfWeekChart } from "./_components/DayOfWeekChart";

export const dynamic = "force-dynamic";

type SP = { range?: string; from?: string; to?: string; ao?: string; topN?: string };

async function loadAos() {
  const sql = getSql();
  const rows = (await sql`
    SELECT DISTINCT f3_events.ao_display_name
    FROM ao_channels
    JOIN f3_events ON ao_channels.slack_channel_id = f3_events.slack_channel_id
    WHERE ao_channels.is_enabled = true AND f3_events.ao_display_name IS NOT NULL
    ORDER BY f3_events.ao_display_name
  `) as Array<{ ao_display_name: string }>;
  return rows.map((r) => ({
    aoSlug: nameToSlug(r.ao_display_name),
    aoName: r.ao_display_name,
  }));
}

export default async function AnalyticsOverviewPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  let range = parseTimeRange({ range: sp.range, from: sp.from, to: sp.to });
  if (!range) {
    if (sp.range || sp.from || sp.to) redirect("/admin/analytics");
    range = defaultTimeRange();
  }

  const aos = await loadAos();
  const aoSlug = sp.ao && sp.ao !== "all" ? sp.ao : null;
  if (aoSlug && !aos.find((a) => a.aoSlug === aoSlug)) {
    redirect(`/admin/analytics?range=${range.slug}`);
  }

  const topNParam = sp.topN ?? "20";
  const topN =
    topNParam === "all" ? Number.MAX_SAFE_INTEGER : parseInt(topNParam, 10) || 20;

  const stats = await getOverviewStats(range, aoSlug, topN);

  // Build URL suffix that preserves current range filter
  const rangeParam =
    range.slug === "custom"
      ? `?range=custom&from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}`
      : range.slug === "ytd"
      ? ""
      : `?range=${range.slug}`;

  const aoHref = (slug: string) => `/admin/analytics/ao/${slug}${rangeParam}`;
  const paxHref = (paxKey: string) => {
    const label = stats.topPax.find((p) => p.key === paxKey)?.label ?? paxKey;
    return `/admin/analytics/pax/${nameToSlug(label)}${rangeParam}`;
  };

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow="§ Admin · Analytics"
        h2="Region BI"
        kicker={
          <>
            {range.label}
            {aoSlug ? ` · ${aos.find((a) => a.aoSlug === aoSlug)?.aoName}` : ""}
          </>
        }
        align="left"
      />
      <div className="mt-10">
        <FilterBar aos={aos} />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-6 mb-6">
          <MetricCard label="total posts" value={stats.totalPosts} />
          <MetricCard label="unique pax" value={stats.uniquePax} />
          <MetricCard label="new fngs" value={stats.newFngs} />
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
      </div>
    </section>
  );
}
