import { redirect } from "next/navigation";
import { getSql } from "@/lib/db";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { nameToSlug } from "@/lib/stats/slugify";
import { FilterBar } from "./_components/FilterBar";

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

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow="§ Admin · Analytics"
        h2="Region BI"
        kicker={<>{range.label}{aoSlug ? ` · ${aos.find((a) => a.aoSlug === aoSlug)?.aoName}` : ""}</>}
        align="left"
      />
      <div className="mt-10">
        <FilterBar aos={aos} />
        <p className="font-mono text-xs text-muted">// charts and metrics land in Task 11–13</p>
      </div>
    </section>
  );
}
