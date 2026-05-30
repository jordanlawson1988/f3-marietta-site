"use client";

import { cn } from "@/lib/utils";
import { WorkoutBlock } from "./WorkoutBlock";
import type { WorkoutScheduleRow } from "@/types/workout";
import type { Region } from "@/types/region";

const DAY_HEADERS = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

interface WorkoutGridProps {
  workouts: WorkoutScheduleRow[];
  regions: Region[];
  selectedIds: Set<string>;
  regionFilter: string | null; // null = show all
  onSelectWorkout: (id: string) => void;
  onClickWorkout: (workout: WorkoutScheduleRow) => void;
  onAddToDay: (day: number) => void;
}

export function WorkoutGrid({
  workouts,
  regions,
  selectedIds,
  regionFilter,
  onSelectWorkout,
  onClickWorkout,
  onAddToDay,
}: WorkoutGridProps) {
  const regionMap = new Map(regions.map((r) => [r.id, r]));

  // Group workouts by day, sorted by start_time
  const byDay: Record<number, WorkoutScheduleRow[]> = {};
  for (let d = 1; d <= 7; d++) byDay[d] = [];

  const filtered = regionFilter
    ? workouts.filter((w) => w.region_id === regionFilter)
    : workouts;

  for (const w of filtered) {
    byDay[w.day_of_week]?.push(w);
  }

  // Sort each day by start_time
  for (const day of Object.values(byDay)) {
    day.sort((a, b) => a.start_time.localeCompare(b.start_time));
  }

  return (
    // Mobile: stack days vertically (full-width, readable). Desktop: 7-col week grid.
    <div className="grid grid-cols-1 md:grid-cols-7 md:min-h-[420px] border border-line-soft overflow-hidden">
      {[1, 2, 3, 4, 5, 6, 7].map((dayNum, i) => (
        <div
          key={dayNum}
          className={cn(
            "flex flex-col bg-ink",
            i < 6 && "border-b border-line-soft md:border-b-0 md:border-r md:border-line-soft",
          )}
        >
          {/* Day header — sits atop each column on desktop, atop each section on mobile */}
          <div className="px-2 py-2 text-center font-mono text-[11px] tracking-[.15em] uppercase text-muted border-b border-line-soft bg-ink-2">
            {DAY_HEADERS[dayNum - 1]}
          </div>

          {/* Day workouts */}
          <div className="flex flex-1 flex-col gap-1 p-1.5">
            {byDay[dayNum].length === 0 && (
              <div className="text-[11px] text-muted text-center py-4">
                No workouts
              </div>
            )}
            {byDay[dayNum].map((workout) => (
              <WorkoutBlock
                key={workout.id}
                workout={workout}
                region={regionMap.get(workout.region_id)}
                isSelected={selectedIds.has(workout.id)}
                onSelect={onSelectWorkout}
                onClick={onClickWorkout}
              />
            ))}
            <button
              onClick={() => onAddToDay(dayNum)}
              className="mt-auto border border-dashed border-bone/20 p-2 text-center text-muted text-[11px] hover:border-steel hover:text-steel transition-colors"
            >
              + Add
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
