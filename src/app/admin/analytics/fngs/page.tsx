import { redirect } from "next/navigation";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import Link from "next/link";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { getFngsList } from "@/lib/stats/getFngsList";
import { Crumbs } from "../_components/Crumbs";
import { FilterBar } from "../_components/FilterBar";
import { MetricCard } from "../_components/MetricCard";

export const dynamic = "force-dynamic";

type SP = { range?: string; from?: string; to?: string };

export default async function AnalyticsFngsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  let range = parseTimeRange({ range: sp.range, from: sp.from, to: sp.to });
  if (!range) {
    if (sp.range || sp.from || sp.to) redirect("/admin/analytics/fngs");
    range = defaultTimeRange();
  }

  const data = await getFngsList(range);

  const rangeParam =
    range.slug === "custom"
      ? `?range=custom&from=${range.from.toISOString().slice(0, 10)}&to=${range.to.toISOString().slice(0, 10)}`
      : range.slug === "ytd"
      ? ""
      : `?range=${range.slug}`;

  const aoHref = (aoSlug: string) =>
    `/admin/analytics/ao/${aoSlug}${rangeParam}`;

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow={
          <Crumbs
            items={[
              { label: "§ Admin", href: "/admin" },
              { label: "Analytics", href: `/admin/analytics${rangeParam}` },
              { label: "FNGs" },
            ]}
          />
        }
        h2="FNGs"
        kicker={<>{range.label}</>}
        align="left"
      />
      <div className="mt-10">
        <FilterBar showAoFilter={false} showTopN={false} />

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-6 mt-6">
          <MetricCard label="fngs in range" value={data.totalInRange} />
          <MetricCard label="fngs all-time" value={data.totalAllTime} />
          <MetricCard
            label="aos with new fngs"
            value={new Set(data.entries.map((e) => e.aoSlug)).size}
          />
        </div>

        <ClipFrame padding="p-6" className="min-h-[180px]">
          <MonoTag>// fng roster · {data.entries.length}</MonoTag>
          {data.entries.length === 0 ? (
            <p className="font-mono text-xs text-muted mt-3">
              // no FNG callouts in range
            </p>
          ) : (
            <>
              <div
                role="row"
                className="font-mono text-[11px] tracking-[.15em] uppercase text-muted border-b border-line-soft pb-1.5 mt-4 flex items-baseline gap-3"
              >
                <span className="w-24">date</span>
                <span className="flex-1">FNG</span>
                <span className="flex-1">AO</span>
                <span
                  className="w-12 text-right"
                  title="cumulative FNG count up to and including this entry"
                >
                  #
                </span>
              </div>
              <ul className="font-mono text-xs mt-2 space-y-1">
                {data.entries
                  .slice()
                  .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
                  .map((e, i) => ({ ...e, runningTotal: i + 1 }))
                  .sort((a, b) => b.eventDate.localeCompare(a.eventDate))
                  .map((e) => (
                    <li
                      key={e.fngKey}
                      className="flex items-baseline gap-3"
                    >
                      <span className="w-24 text-muted">{e.eventDate}</span>
                      <span className="flex-1 truncate">{e.fngLabel}</span>
                      <Link
                        href={aoHref(e.aoSlug)}
                        className="flex-1 truncate text-ink hover:text-ink underline-offset-4 hover:underline transition-colors"
                      >
                        {e.aoName}
                      </Link>
                      <span className="w-12 text-right text-muted">
                        {e.runningTotal}
                      </span>
                    </li>
                  ))}
              </ul>
            </>
          )}
        </ClipFrame>
      </div>
    </section>
  );
}
