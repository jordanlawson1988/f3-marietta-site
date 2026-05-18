import { notFound, redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { nameToSlug } from "@/lib/stats/slugify";
import { FilterBar } from "../../_components/FilterBar";

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

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow="§ Admin · Analytics · AO"
        h2={match.ao_display_name}
        kicker={<>{range.label}</>}
        align="left"
      />
      <div className="mt-10">
        <FilterBar showAoFilter={false} showTopN={true} />
        <p className="font-mono text-xs text-muted">// AO detail body lands in Task 14</p>
      </div>
    </section>
  );
}
