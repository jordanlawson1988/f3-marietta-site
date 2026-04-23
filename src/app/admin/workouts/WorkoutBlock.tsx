"use client";

import { cn } from "@/lib/utils";
import type { WorkoutScheduleRow } from "@/types/workout";
import type { Region } from "@/types/region";

const TYPE_COLORS: Record<string, string> = {
  Bootcamp: "#4A76A8",
  Run: "#2ea87a",
  Running: "#2ea87a",
  Ruck: "#c59a2e",
  CSAUP: "#a855f7",
  Convergence: "#ec4899",
};

function getTypeColor(type: string): string {
  return TYPE_COLORS[type] || "#6b7f96";
}

interface WorkoutBlockProps {
  workout: WorkoutScheduleRow;
  region?: Region;
  isSelected: boolean;
  onSelect: (id: string) => void;
  onClick: (workout: WorkoutScheduleRow) => void;
}

export function WorkoutBlock({
  workout,
  region,
  isSelected,
  onSelect,
  onClick,
}: WorkoutBlockProps) {
  const color = getTypeColor(workout.workout_type);
  const [h, m] = workout.start_time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  const timeStr = `${h12}:${m} ${ampm}`;

  return (
    <div
      data-testid="workout-block"
      className={cn(
        "bg-ink-2 border border-line-soft cursor-pointer text-xs relative group transition-colors hover:border-steel/50",
        !workout.is_active && "opacity-50"
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
      onClick={() => onClick(workout)}
    >
      {/* Left accent bar on hover */}
      <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-steel scale-y-0 origin-top group-hover:scale-y-100 transition-transform duration-300" />
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          onSelect(workout.id);
        }}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-1.5 right-1.5 accent-steel"
      />
      <div className="p-1.5 pr-6">
        <div className="font-bold text-bone leading-tight">
          {workout.ao_name}
        </div>
        <div style={{ color }} className="text-[10px] mt-0.5">
          {workout.workout_type}
        </div>
        <div className="text-muted text-[10px] mt-0.5">{timeStr}</div>
        {region && (
          <div className="text-muted/60 text-[9px] mt-0.5">
            {region.name}
          </div>
        )}
        {!workout.is_active && (
          <div className="text-[9px] text-rust mt-0.5">Inactive</div>
        )}
      </div>
    </div>
  );
}
