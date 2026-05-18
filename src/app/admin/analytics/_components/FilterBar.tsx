"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TIME_RANGE_SLUGS, TIME_RANGE_LABELS, type TimeRangeSlug } from "@/lib/stats/timeRange";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

const DEFAULTS: Record<string, string> = { range: "ytd", ao: "all", topN: "20" };

type Props = {
  aos?: Array<{ aoSlug: string; aoName: string }>;
  showAoFilter?: boolean;
  showTopN?: boolean;
};

export function FilterBar({ aos = [], showAoFilter = true, showTopN = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentRange = (searchParams.get("range") ?? "ytd") as TimeRangeSlug;
  const currentAo = searchParams.get("ao") ?? "all";
  const currentTopN = searchParams.get("topN") ?? "20";

  function setParam(key: string, value: string) {
    const p = new URLSearchParams(searchParams);
    if (key === "range" && value !== "custom") {
      p.delete("from");
      p.delete("to");
    }
    if (value === "" || value === DEFAULTS[key]) {
      p.delete(key);
    } else {
      p.set(key, value);
    }
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <ClipFrame padding="p-5" className="mb-6">
      <MonoTag>// filters</MonoTag>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3 font-mono text-xs">
        <div className="md:col-span-6 flex flex-wrap gap-2 items-center">
          <span className="text-muted">range:</span>
          {TIME_RANGE_SLUGS.map((slug) => (
            <button
              key={slug}
              type="button"
              onClick={() => setParam("range", slug)}
              aria-pressed={currentRange === slug}
              className={
                currentRange === slug
                  ? "bg-foreground text-background px-3 py-1.5"
                  : "border border-black/20 px-3 py-1.5 hover:bg-black/5"
              }
            >
              {TIME_RANGE_LABELS[slug]}
            </button>
          ))}
        </div>

        {showAoFilter && aos.length > 0 && (
          <div className="md:col-span-4 flex items-center gap-2">
            <label htmlFor="ao-filter" className="text-muted">ao:</label>
            <select
              id="ao-filter"
              value={currentAo}
              onChange={(e) => setParam("ao", e.target.value)}
              className="flex-1 border border-black/20 px-2 py-1.5"
            >
              <option value="all">All AOs</option>
              {aos.map((a) => (
                <option key={a.aoSlug} value={a.aoSlug}>{a.aoName}</option>
              ))}
            </select>
          </div>
        )}

        {showTopN && (
          <div className="md:col-span-2 flex items-center gap-2">
            <label htmlFor="topn-filter" className="text-muted">top:</label>
            <select
              id="topn-filter"
              value={currentTopN}
              onChange={(e) => setParam("topN", e.target.value)}
              className="flex-1 border border-black/20 px-2 py-1.5"
            >
              <option value="10">10</option>
              <option value="20">20</option>
              <option value="all">all</option>
            </select>
          </div>
        )}
      </div>
    </ClipFrame>
  );
}
