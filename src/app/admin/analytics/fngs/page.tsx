import Link from "next/link";
import { redirect } from "next/navigation";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { rangeParam } from "@/lib/stats/rangeParam";
import { getFngsList } from "@/lib/stats/getFngsList";
import { getFngFunnel } from "@/lib/stats/getFngFunnel";
import { getFngMonthly } from "@/lib/stats/getFngMonthly";
import {
  deltaLabelForRange,
  type CompareMode,
} from "@/lib/stats/getPriorRange";

import { Crumbs } from "@/components/stats/Crumbs";
import { FilterBar } from "@/components/stats/FilterBar";
import { KpiTile } from "@/components/stats/KpiTile";
import { FreshnessBadge } from "@/components/stats/FreshnessBadge";
import { TrendChart } from "@/components/stats/TrendChart";
import { FngFunnelWidget } from "@/components/stats/FngFunnel";
import { StatsNav } from "@/components/stats/StatsNav";

export const dynamic = "force-dynamic";

type SP = {
  range?: string;
  from?: string;
  to?: string;
  ao?: string;
  compare?: string;
  q?: string;
};

function parseCompare(v?: string): CompareMode {
  if (v === "prior" || v === "yoy") return v;
  return "off";
}

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
  const compare = parseCompare(sp.compare);

  const aoSlugs =
    sp.ao && sp.ao !== "all"
      ? sp.ao.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const aoFilter = aoSlugs.length > 0 ? aoSlugs : null;

  const [data, funnel, monthly] = await Promise.all([
    getFngsList(range),
    getFngFunnel(range, aoFilter),
    getFngMonthly(range, aoFilter),
  ]);

  const linkSuffix = rangeParam(range, compare);
  const deltaLabel = deltaLabelForRange(range.slug);
  const aoCount = new Set(data.entries.map((e) => e.aoSlug)).size;

  const filteredEntries = aoFilter
    ? data.entries.filter((e) => aoFilter.includes(e.aoSlug))
    : data.entries;
  const search = sp.q?.trim().toLowerCase() ?? "";
  const finalEntries = search
    ? filteredEntries.filter(
        (e) =>
          e.fngLabel.toLowerCase().includes(search) ||
          e.aoName.toLowerCase().includes(search) ||
          (e.qName ?? "").toLowerCase().includes(search) ||
          (e.beatdownTitle ?? "").toLowerCase().includes(search),
      )
    : filteredEntries;

  const insight =
    funnel.calledOut === 0
      ? `No new FNGs in ${range.label.toLowerCase()}.`
      : `${funnel.calledOut} FNG${funnel.calledOut === 1 ? "" : "s"} called out, ${
          funnel.returned
        } came back at least once, ${funnel.qing} are already Q'ing.`;

  const aoOptions = (() => {
    const counts = new Map<string, { name: string; count: number }>();
    for (const e of data.entries) {
      const prev = counts.get(e.aoSlug);
      counts.set(e.aoSlug, {
        name: e.aoName,
        count: (prev?.count ?? 0) + 1,
      });
    }
    return [...counts.entries()]
      .sort((a, b) => b[1].count - a[1].count)
      .map(([aoSlug, v], rank) => ({
        aoSlug,
        aoName: v.name,
        rank,
      }));
  })();

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow={
          <Crumbs
            items={[
              { label: "§ Admin", href: "/admin" },
              { label: "Analytics", href: `/admin/analytics${linkSuffix}` },
              { label: "FNGs" },
            ]}
          />
        }
        h2="FNG roster"
        kicker={
          <div className="flex items-center gap-4 flex-wrap">
            <span>{range.label}</span>
            <FreshnessBadge />
          </div>
        }
        align="left"
      />

      <StatsNav
        current="/admin/analytics/fngs"
        filterSuffix={linkSuffix}
        scope="admin"
      />

      <div className="mb-6 p-5 border border-line-soft bg-bone-2/60">
        <MonoTag>// 5-second read</MonoTag>
        <p className="font-display font-medium text-[20px] leading-tight tracking-[-.01em] text-ink mt-2">
          {insight}
        </p>
      </div>

      <FilterBar
        aoOptions={aoOptions}
        showAoFilter={aoOptions.length > 0}
        showTopN={false}
      />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiTile
          label="fngs in range"
          value={finalEntries.length}
          delta={{ prior: null, label: deltaLabel }}
        />
        <KpiTile label="fngs all-time" value={data.totalAllTime} />
        <KpiTile label="aos with new fngs" value={aoCount} />
        <KpiTile
          label="return rate"
          value={
            funnel.calledOut === 0
              ? "—"
              : `${Math.round((funnel.returned / funnel.calledOut) * 100)}%`
          }
          caption="ever posted again"
        />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-4">
        <div className="md:col-span-7">
          <TrendChart
            data={monthly}
            title="New FNGs by month"
            eyebrow="fng inflow · monthly"
            subtitle="First-time FNGs only, on the month of their first callout."
          />
        </div>
        <div className="md:col-span-5">
          <FngFunnelWidget data={funnel} />
        </div>
      </div>

      <ClipFrame padding="p-6" className="min-h-[180px]">
        <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
          <MonoTag>// fng roster · {finalEntries.length}</MonoTag>
          <form action="" className="flex items-center gap-2">
            <input
              type="search"
              name="q"
              defaultValue={sp.q ?? ""}
              placeholder="search FNG, AO, Q…"
              className="border border-black/20 px-2 py-1 font-mono text-[11px] w-56"
              aria-label="Search FNG roster"
            />
            {(["range", "from", "to", "ao", "compare"] as const).map((k) => {
              const v = sp[k];
              return v ? <input key={k} type="hidden" name={k} value={v} /> : null;
            })}
            <button
              type="submit"
              className="border border-black/20 px-2 py-1 font-mono text-[10px] tracking-[.15em] uppercase hover:bg-black/5"
            >
              go
            </button>
          </form>
        </div>
        {finalEntries.length === 0 ? (
          <p className="font-mono text-xs text-muted">// no FNG callouts match</p>
        ) : (
          <>
            <div
              role="row"
              className="font-mono text-[11px] tracking-[.15em] uppercase text-muted border-b border-line-soft pb-1.5 mt-2 flex items-baseline gap-3"
            >
              <span className="w-24 shrink-0">date</span>
              <span className="w-36 shrink-0">FNG</span>
              <span className="flex-1">beatdown</span>
              <span className="w-32 shrink-0">Q</span>
              <span className="w-28 shrink-0">AO</span>
            </div>
            <ul className="font-mono text-xs mt-2 space-y-0.5">
              {finalEntries.map((e) => (
                <li key={e.fngKey}>
                  <Link
                    href={`/backblasts/${e.eventId}`}
                    className="flex items-baseline gap-3 -mx-2 px-2 py-1.5 text-ink hover:bg-ink/10 transition-colors"
                  >
                    <span className="w-24 shrink-0 text-muted">{e.eventDate}</span>
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
    </section>
  );
}
