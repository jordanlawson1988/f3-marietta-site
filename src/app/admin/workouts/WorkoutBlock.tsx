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
        "bg-[#112240] border border-[#23334A] rounded cursor-pointer text-xs relative group",
        !workout.is_active && "opacity-50"
      )}
      style={{ borderLeftWidth: 3, borderLeftColor: color }}
      onClick={() => onClick(workout)}
    >
      <input
        type="checkbox"
        checked={isSelected}
        onChange={(e) => {
          e.stopPropagation();
          onSelect(workout.id);
        }}
        onClick={(e) => e.stopPropagation()}
        className="absolute top-1.5 right-1.5 accent-[#4A76A8]"
      />
      <div className="p-1.5 pr-6">
        <div className="font-bold text-[#e2e8f0] leading-tight">
          {workout.ao_name}
        </div>
        <div style={{ color }} className="text-[10px] mt-0.5">
          {workout.workout_type}
        </div>
        <div className="text-[#6b7f96] text-[10px] mt-0.5">{timeStr}</div>
        {region && (
          <div className="text-[#4a5e73] text-[9px] mt-0.5">
            {region.name}
          </div>
        )}
        {!workout.is_active && (
          <div className="text-[9px] text-red-400 mt-0.5">Inactive</div>
        )}
      </div>
    </div>
  );
}
