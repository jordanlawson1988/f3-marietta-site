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
      : range.slug === "current-month"
      ? ""
      : `?range=${range.slug}`;

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
                <span className="w-24 shrink-0">date</span>
                <span className="w-36 shrink-0">FNG</span>
                <span className="flex-1">beatdown</span>
                <span className="w-32 shrink-0">Q</span>
                <span className="w-28 shrink-0">AO</span>
              </div>
              <ul className="font-mono text-xs mt-2 space-y-0.5">
                {data.entries.map((e) => (
                  <li key={e.fngKey}>
                    <Link
                      href={`/backblasts/${e.eventId}`}
                      className="flex items-baseline gap-3 -mx-2 px-2 py-1.5 text-ink hover:bg-ink/30 transition-colors"
                      title={`Open backblast — ${e.fngLabel}${e.qName ? ` · Q ${e.qName}` : ""}`}
                    >
                      <span className="w-24 shrink-0 text-muted">
                        {e.eventDate}
                      </span>
                      <span className="w-36 shrink-0 truncate">{e.fngLabel}</span>
                      <span className="flex-1 truncate text-muted">
                        {e.beatdownTitle ?? "—"}
                      </span>
                      <span className="w-32 shrink-0 truncate text-muted">
                        {e.qName ?? "—"}
                      </span>
                      <span className="w-28 shrink-0 truncate text-muted">
                        {e.aoName}
                      </span>
                    </Link>
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
