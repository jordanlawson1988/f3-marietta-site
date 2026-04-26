"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { AOCard } from "@/components/ui/AOCard";
import type { WorkoutWithRegion } from "@/types/workout";

type Props = {
  workouts: WorkoutWithRegion[];
  /** Limit applied to Marietta cards only — nearby regions are summarized on overflow. */
  limit?: number;
};

const DAYS: Array<{ key: number | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: 1, label: "Mon" },
  { key: 2, label: "Tue" },
  { key: 3, label: "Wed" },
  { key: 4, label: "Thu" },
  { key: 5, label: "Fri" },
  { key: 6, label: "Sat" },
];

type Bucket = {
  marietta: WorkoutWithRegion[];
  others: WorkoutWithRegion[];
};

function bucketByRegion(list: WorkoutWithRegion[]): Bucket {
  const marietta: WorkoutWithRegion[] = [];
  const others: WorkoutWithRegion[] = [];
  for (const w of list) {
    if (w.region_slug === "marietta") marietta.push(w);
    else others.push(w);
  }
  return { marietta, others };
}

export function WorkoutsFilter({ workouts, limit }: Props) {
  const [activeDay, setActiveDay] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  const { marietta, others } = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const base = activeDay === "all" ? workouts : workouts.filter((w) => w.day_of_week === activeDay);
    const searched = needle
      ? base.filter(
          (w) =>
            w.ao_name.toLowerCase().includes(needle) ||
            (w.location_name ?? "").toLowerCase().includes(needle) ||
            w.address.toLowerCase().includes(needle) ||
            w.region_name.toLowerCase().includes(needle)
        )
      : base;

    const bucketed = bucketByRegion(searched);
    // Apply preview limit to Marietta cards only — nearby regions still surface with a teaser.
    const mariettaList = limit ? bucketed.marietta.slice(0, limit) : bucketed.marietta;
    const othersList = limit ? bucketed.others.slice(0, limit) : bucketed.others;
    return { marietta: mariettaList, others: othersList };
  }, [workouts, activeDay, search, limit]);

  const hasResults = marietta.length + others.length > 0;
  const otherRegionNames = Array.from(new Set(others.map((w) => w.region_name))).sort();

  return (
    <div>
      {/* Filters */}
      <div className="flex flex-wrap gap-2 items-center mb-8">
        {DAYS.map((d) => {
          const isOn = d.key === activeDay;
          return (
            <button
              key={String(d.key)}
              onClick={() => setActiveDay(d.key)}
              className={`px-4 py-2 border font-mono text-[11px] tracking-[.12em] uppercase transition-colors ${
                isOn ? "bg-ink text-bone border-ink" : "bg-transparent text-ink border-line-soft hover:border-ink"
              }`}
            >
              {d.label}
            </button>
          );
        })}
        <div className="relative ml-auto min-w-[240px]">
          <svg viewBox="0 0 20 20" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="currentColor" aria-hidden="true">
            <path d="M13.5 12a5 5 0 1 0-1.5 1.5l3 3a1 1 0 0 0 1.5-1.5l-3-3zM9 13a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search AOs"
            className="w-full pl-9 pr-4 py-2 border border-line-soft bg-transparent font-mono text-[12px] tracking-[.08em] uppercase focus:outline-none focus:border-ink"
          />
        </div>
      </div>

      {!hasResults ? (
        <div className="py-16 text-center text-muted font-mono text-[12px] tracking-[.15em] uppercase">
          No posts match · try another day
        </div>
      ) : (
        <>
          {/* Marietta Region group */}
          {marietta.length > 0 && (
            <RegionGroup
              heading="Marietta Region"
              sublabel="The home region · core AOs"
              tone="primary"
              workouts={marietta}
              codePrefix="MAR"
            />
          )}

          {/* Other Regions group */}
          {others.length > 0 && (
            <div className={marietta.length > 0 ? "mt-16" : ""}>
              <RegionGroup
                heading="Nearby Regions"
                sublabel={
                  otherRegionNames.length > 0
                    ? `F3 AOs within striking distance · ${otherRegionNames.join(" · ")}`
                    : "F3 AOs within striking distance"
                }
                tone="secondary"
                workouts={others}
                codePrefix="REG"
              />
            </div>
          )}

          {/* Preview-mode teaser when we've trimmed others via limit */}
          {limit && (others.length === limit || marietta.length === limit) && (
            <div className="mt-10 flex justify-center">
              <Link
                href="/workouts"
                className="inline-flex items-center gap-2 font-mono text-[11px] tracking-[.15em] uppercase text-muted hover:text-ink transition-colors"
              >
                See the full regional map <span aria-hidden="true">→</span>
              </Link>
            </div>
          )}
        </>
      )}
    </div>
  );
}

type RegionGroupProps = {
  heading: string;
  sublabel: string;
  tone: "primary" | "secondary";
  workouts: WorkoutWithRegion[];
  codePrefix: string;
};

function RegionGroup({ heading, sublabel, tone, workouts, codePrefix }: RegionGroupProps) {
  const toneAccent = tone === "primary" ? "bg-steel text-bone" : "bg-ink/8 text-ink";
  const toneRule = tone === "primary" ? "bg-steel" : "bg-ink/20";

  return (
    <section aria-labelledby={`region-${heading.replace(/\s+/g, "-").toLowerCase()}`}>
      <header className="flex flex-wrap items-end gap-4 mb-6 pb-4 border-b border-line-soft">
        <div className="flex items-center gap-3">
          <span className={`inline-block h-[10px] w-[10px] ${toneRule}`} aria-hidden="true" />
          <h3
            id={`region-${heading.replace(/\s+/g, "-").toLowerCase()}`}
            className="font-display font-bold uppercase text-[22px] md:text-[26px] tracking-[-.01em]"
          >
            {heading}
          </h3>
          <span
            className={`px-2 py-0.5 text-[10px] font-mono tracking-[.15em] uppercase ${toneAccent}`}
          >
            {workouts.length} AO{workouts.length === 1 ? "" : "s"}
          </span>
        </div>
        <p className="font-mono text-[11px] tracking-[.12em] uppercase text-muted ml-auto">
          {sublabel}
        </p>
      </header>

      {/* minmax min must stay BELOW the smallest realistic grid container
          width — section padding + region group rules eat into the viewport.
          On a 320px-class phone (iPhone SE) the available grid is ~260px;
          using a 260px floor keeps cards from overflowing horizontally
          (body has overflow-x:hidden, so overflow == invisible content). */}
      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}>
        {workouts.map((w, i) => (
          <AOCard
            key={w.id}
            workout={w}
            code={`F3.${codePrefix}.${String(i + 1).padStart(2, "0")}`}
            status={w.is_active ? "active" : "launch"}
          />
        ))}
      </div>
    </section>
  );
}
