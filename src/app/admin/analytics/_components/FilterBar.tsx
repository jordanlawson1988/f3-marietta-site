"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { TIME_RANGE_SLUGS, TIME_RANGE_LABELS, type TimeRangeSlug } from "@/lib/stats/timeRange";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { getAoColor } from "@/lib/stats/aoColors";

const DEFAULTS: Record<string, string> = { range: "current-month", topN: "20" };

type Props = {
  aoOptions?: Array<{ aoSlug: string; aoName: string; rank: number }>;
  showAoFilter?: boolean;
  showTopN?: boolean;
};

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIso(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString().slice(0, 10);
}

function parseAoCsv(raw: string | null): string[] {
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}

export function FilterBar({ aoOptions = [], showAoFilter = true, showTopN = true }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentRange = (searchParams.get("range") ?? "current-month") as TimeRangeSlug;
  const currentTopN = searchParams.get("topN") ?? "20";
  const currentFrom = searchParams.get("from") ?? "";
  const currentTo = searchParams.get("to") ?? "";
  const selectedSlugs = useMemo(
    () => parseAoCsv(searchParams.get("ao")),
    [searchParams],
  );

  const isCustomActive = currentRange === "custom" && !!currentFrom && !!currentTo;

  const [showCustom, setShowCustom] = useState<boolean>(isCustomActive);
  const [fromInput, setFromInput] = useState<string>(currentFrom || daysAgoIso(30));
  const [toInput, setToInput] = useState<string>(currentTo || todayIso());
  const [customError, setCustomError] = useState<string>("");

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

  function setAoSlugs(slugs: string[]) {
    setParam("ao", slugs.length === 0 ? "" : slugs.join(","));
  }

  function toggleAo(slug: string) {
    const next = selectedSlugs.includes(slug)
      ? selectedSlugs.filter((s) => s !== slug)
      : [...selectedSlugs, slug];
    setAoSlugs(next);
  }

  function handleRangeClick(slug: TimeRangeSlug) {
    if (slug === "custom") {
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

  const chipBase =
    "inline-flex items-center px-3 py-1.5 border font-mono text-[11px] tracking-[.12em] uppercase transition-all";
  const chipOn = "bg-foreground text-background border-foreground";
  const chipOff = "bg-transparent border-black/20 hover:border-foreground hover:bg-black/5";
  // When one+ AO chips are selected, unselected chips fade to signal they're
  // still clickable but not part of the current filter. Hover restores full
  // opacity so labels stay readable.
  const someAoSelected = selectedSlugs.length > 0;
  const chipDim = "opacity-40 hover:opacity-100";

  return (
    <ClipFrame padding="p-5" className="mb-6">
      <MonoTag>// filters</MonoTag>
      <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3 font-mono text-xs">
        <div className="md:col-span-10 flex flex-wrap gap-2 items-center">
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
                className={`${chipBase} ${isActive ? chipOn : chipOff}`}
              >
                {TIME_RANGE_LABELS[slug]}
              </button>
            );
          })}
        </div>

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

      {showAoFilter && aoOptions.length > 0 && (
        <div className="mt-4 pt-4 border-t border-black/10">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">
              // ao filter
              {selectedSlugs.length > 0 ? ` · ${selectedSlugs.length} selected` : ""}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setAoSlugs([])}
              aria-pressed={selectedSlugs.length === 0}
              className={`${chipBase} ${selectedSlugs.length === 0 ? chipOn : chipOff}`}
            >
              All AOs
            </button>
            {aoOptions.map((a) => {
              const on = selectedSlugs.includes(a.aoSlug);
              const dim = someAoSelected && !on;
              return (
                <button
                  key={a.aoSlug}
                  type="button"
                  onClick={() => toggleAo(a.aoSlug)}
                  aria-pressed={on}
                  className={`${chipBase} ${on ? chipOn : chipOff} ${dim ? chipDim : ""}`}
                >
                  <span
                    className="inline-block w-2 h-2 rounded-full mr-2 border border-black/40"
                    style={{ background: getAoColor(a.rank) }}
                    aria-hidden="true"
                  />
                  {a.aoName}
                </button>
              );
            })}
          </div>
        </div>
      )}

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
                setParam("range", "current-month");
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
