"use client";

import { useMemo, useState } from "react";
import { AOCard } from "@/components/ui/AOCard";
import type { WorkoutScheduleRow } from "@/types/workout";

type Props = {
  workouts: WorkoutScheduleRow[];
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

export function WorkoutsFilter({ workouts, limit }: Props) {
  const [activeDay, setActiveDay] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const base = activeDay === "all" ? workouts : workouts.filter((w) => w.day_of_week === activeDay);
    const searched = needle
      ? base.filter(
          (w) =>
            w.ao_name.toLowerCase().includes(needle) ||
            (w.location_name ?? "").toLowerCase().includes(needle) ||
            w.address.toLowerCase().includes(needle)
        )
      : base;
    return limit ? searched.slice(0, limit) : searched;
  }, [workouts, activeDay, search, limit]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-5">
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

      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-muted font-mono text-[12px] tracking-[.15em] uppercase">
            No posts match · try another day
          </div>
        ) : (
          filtered.map((w, i) => (
            <AOCard
              key={w.id}
              workout={w}
              code={`F3.MAR.${String(i + 1).padStart(2, "0")}`}
              status={w.is_active ? "active" : "launch"}
            />
          ))
        )}
      </div>
    </div>
  );
}
