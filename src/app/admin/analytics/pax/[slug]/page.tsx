import { notFound, redirect } from "next/navigation";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { getPaxStats } from "@/lib/stats/getPaxStats";
import { FilterBar } from "../../_components/FilterBar";

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
        <p className="font-mono text-xs text-muted">// PAX detail body lands in Task 15</p>
      </div>
    </section>
  );
}
