"use client";

import { useEffect, useState } from "react";
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

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

export function FilterBar({ aos = [], showAoFilter = true, showTopN = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentRange = (searchParams.get("range") ?? "ytd") as TimeRangeSlug;
  const currentAo = searchParams.get("ao") ?? "all";
  const currentTopN = searchParams.get("topN") ?? "20";
  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";

  const isCustomActive = currentRange === "custom" && !!currentFrom && !!currentTo;

  const [showCustom, setShowCustom] = useState<boolean>(isCustomActive);
  const [fromInput, setFromInput] = useState<string>(currentFrom || daysAgoIso(30));
  const [toInput, setToInput] = useState<string>(currentTo || todayIso());
  const [customError, setCustomError] = useState<string>("");

  // Sync local state when URL changes (e.g. back button, drill-down preserves custom range)
  useEffect(() => {
    if (isCustomActive) {
      setShowCustom(true);
      setFromInput(currentFrom);
      setToInput(currentTo);
    }
  }, [isCustomActive, currentFrom, currentTo]);

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

  function handleRangeClick(slug: TimeRangeSlug) {
    if (slug === "custom") {
      // Toggle picker rather than navigating — actual apply happens on Apply click
      setShowCustom((open) => !open);
      setCustomError("");
      return;
    }
    setShowCustom(false);
    setParam("range", slug);
  }

  function applyCustomRange() {
    if (!fromInput || !toInput) {
      setCustomError("Both dates required");
      return;
    }
    if (fromInput > toInput) {
      setCustomError("'From' must be on or before 'To'");
      return;
    }
    if (toInput > todayIso()) {
      setCustomError("'To' cannot be in the future");
      return;
    }
    setCustomError("");
    const p = new URLSearchParams(searchParams);
    p.set("range", "custom");
    p.set("from", fromInput);
    p.set("to", toInput);
    router.push(`${pathname}?${p.toString()}`);
  }

  return (
    <ClipFrame padding="p-5" className="mb-6">
      <MonoTag>// filters</MonoTag>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3 font-mono text-xs">
        <div className="md:col-span-6 flex flex-wrap gap-2 items-center">
          <span className="text-muted">range:</span>
          {TIME_RANGE_SLUGS.map((slug) => {
            const isActive =
              slug === "custom" ? isCustomActive : currentRange === slug;
            return (
              <button
                key={slug}
                type="button"
                onClick={() => handleRangeClick(slug)}
                aria-pressed={isActive}
                aria-expanded={slug === "custom" ? showCustom : undefined}
                className={
                  isActive
                    ? "bg-foreground text-background px-3 py-1.5"
                    : "border border-black/20 px-3 py-1.5 hover:bg-black/5"
                }
              >
                {TIME_RANGE_LABELS[slug]}
              </button>
            );
          })}
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

      {showCustom && (
        <div className="mt-4 pt-4 border-t border-black/10 flex flex-wrap items-end gap-3 font-mono text-xs">
          <div className="flex flex-col gap-1">
            <label htmlFor="custom-from" className="text-muted">from:</label>
            <input
              id="custom-from"
              type="date"
              value={fromInput}
              max={toInput || todayIso()}
              onChange={(e) => setFromInput(e.target.value)}
              className="border border-black/20 px-2 py-1.5"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="custom-to" className="text-muted">to:</label>
            <input
              id="custom-to"
              type="date"
              value={toInput}
              min={fromInput}
              max={todayIso()}
              onChange={(e) => setToInput(e.target.value)}
              className="border border-black/20 px-2 py-1.5"
            />
          </div>
          <button
            type="button"
            onClick={applyCustomRange}
            className="bg-foreground text-background px-3 py-1.5 hover:opacity-90"
          >
            Apply
          </button>
          {isCustomActive && (
            <button
              type="button"
              onClick={() => {
                setShowCustom(false);
                setParam("range", "ytd");
              }}
              className="border border-black/20 px-3 py-1.5 hover:bg-black/5"
            >
              Clear
            </button>
          )}
          {customError && (
            <span role="alert" className="text-red-600">
              {customError}
            </span>
          )}
          <span className="text-muted ml-auto">
            // up to a 2-year span
          </span>
        </div>
      )}
    </ClipFrame>
  );
}
