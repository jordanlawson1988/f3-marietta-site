import { redirect } from "next/navigation";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { nameToSlug } from "@/lib/stats/slugify";
import Link from "next/link";
import { Crumbs } from "./_components/Crumbs";
import { FilterBar } from "./_components/FilterBar";
import { MetricCard } from "./_components/MetricCard";
import { PostsByAoChart } from "@/components/admin/PostsByAoChart";
import { TopPaxChart } from "@/components/admin/TopPaxChart";
import { getOverviewStats } from "@/lib/stats/getOverviewStats";
import { PostsOverTimeChart } from "./_components/PostsOverTimeChart";
import { DayOfWeekChart } from "./_components/DayOfWeekChart";
import { ExportButton } from "./_components/ExportButton";

export const dynamic = "force-dynamic";

type SP = { range?: string; from?: string; to?: string; ao?: string; topN?: string };

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

  // Multi-AO CSV. Backwards-compatible: single-slug links like ?ao=foo
  // parse into a one-element array; legacy ?ao=all is treated as empty.
  const rawAo = sp.ao;
  const aoSlugs =
    rawAo && rawAo !== "all"
      ? rawAo.split(",").map((s) => s.trim()).filter(Boolean)
      : [];

  const topNParam = sp.topN ?? "20";
  const topN =
    topNParam === "all" ? Number.MAX_SAFE_INTEGER : parseInt(topNParam, 10) || 20;

  const stats = await getOverviewStats(range, aoSlugs.length > 0 ? aoSlugs : null, topN);

  // Chip row uses the FULL ranked list (allAoRanking) — not the filtered
  // byAo — so selecting one AO doesn't make the others vanish from the
  // filter. Selected chips highlight; unselected stay visible (dimmed).
  const aoOptions = stats.allAoRanking.map((row, rank) => ({
    aoSlug: row.aoSlug,
    aoName: row.ao,
    rank,
  }));

  // Build URL suffix that preserves current range filter
  const rangeParam =
    range.slug === "custom"
      ? `?range=custom&from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}`
      : range.slug === "current-month"
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
        eyebrow={
          <Crumbs
            items={[
              { label: "§ Admin", href: "/admin" },
              { label: "Analytics" },
            ]}
          />
        }
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
            href={`/admin/analytics/fngs${rangeParam}`}
            className="block transition-opacity hover:opacity-80"
            aria-label="Drill into the FNG roster"
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

        <div className="mt-6 flex flex-wrap gap-3">
          <ExportButton
            href={`/admin/analytics/export?scope=overview&range=${range.slug}${range.slug === "custom" ? `&from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}` : ""}`}
            label="Download CSV (overview)"
          />
          <ExportButton href={`/admin/analytics/export?scope=raw`} label="Download all raw data" />
        </div>
      </div>
    </section>
  );
}
