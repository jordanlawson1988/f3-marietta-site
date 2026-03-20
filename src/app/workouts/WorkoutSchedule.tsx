"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { ChevronDown, MapPin, Clock, ExternalLink } from "lucide-react";
import type { WorkoutScheduleRow } from "@/types/workout";
import type { DaySchedule } from "@/lib/workouts/getWorkoutSchedule";

const DAY_NAMES: Record<number, string> = {
  1: "Monday",
  2: "Tuesday",
  3: "Wednesday",
  4: "Thursday",
  5: "Friday",
  6: "Saturday",
  7: "Sunday",
};

function formatTime(time: string): string {
  const [h, m] = time.split(":");
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

// ── Workout Card ────────────────────────────────────────────────────────────
function WorkoutCard({
  workout,
  regionName,
  variant = "primary",
}: {
  workout: WorkoutScheduleRow;
  regionName?: string;
  variant?: "primary" | "secondary";
}) {
  const timeStr = `${formatTime(workout.start_time)} – ${formatTime(workout.end_time)}`;
  const isPrimary = variant === "primary";

  return (
    <div
      className={cn(
        "rounded-md p-3 space-y-2 transition-colors",
        isPrimary
          ? "bg-card border border-border hover:border-primary/50"
          : "bg-muted/40 border border-border/50 hover:border-border"
      )}
    >
      <div className="space-y-1">
        <h4
          className={cn(
            "font-bold leading-tight",
            isPrimary ? "text-sm text-foreground" : "text-sm text-foreground/80"
          )}
        >
          {workout.ao_name}
        </h4>
        <div className="flex flex-wrap gap-1">
          <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
            {workout.workout_type}
          </span>
          {regionName && (
            <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
              {regionName}
            </span>
          )}
        </div>
      </div>
      <div className="space-y-1 text-xs text-muted-foreground">
        <div className="flex items-center gap-1.5">
          <Clock className="h-3 w-3 shrink-0" />
          <span>{timeStr}</span>
        </div>
        {workout.location_name && (
          <div className="flex items-start gap-1.5">
            <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
            <span className="leading-tight">{workout.location_name}</span>
          </div>
        )}
        <div className="text-xs text-muted-foreground/70 pl-[1.125rem] leading-tight">
          {workout.address}
        </div>
      </div>
      {workout.map_link && (
        <a
          href={workout.map_link}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Directions <ExternalLink className="h-3 w-3" />
        </a>
      )}
    </div>
  );
}

// ── Other Nearby Section (collapsible) ──────────────────────────────────────
function OtherNearbySection({
  workouts,
}: {
  workouts: { workout: WorkoutScheduleRow; regionName: string }[];
}) {
  const [isOpen, setIsOpen] = useState(false);

  if (workouts.length === 0) return null;

  return (
    <div className="mt-4 pt-3 border-t border-dashed border-border/60">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-left"
      >
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
        <span className="font-semibold uppercase tracking-wider">
          Other Nearby
        </span>
        <span className="bg-muted px-1.5 py-0.5 rounded text-[10px]">
          {workouts.length}
        </span>
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[2000px] opacity-100 mt-3" : "max-h-0 opacity-0"
        )}
      >
        <div className="space-y-2">
          {workouts.map(({ workout, regionName }) => (
            <WorkoutCard
              key={workout.id}
              workout={workout}
              regionName={regionName}
              variant="secondary"
            />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Day Card ────────────────────────────────────────────────────────────────
function DayCard({
  dayNum,
  schedule,
  defaultOpen,
}: {
  dayNum: number;
  schedule: DaySchedule;
  defaultOpen: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const primaryRegions = schedule.regions.filter((rg) => rg.region.is_primary);
  const nonPrimaryRegions = schedule.regions.filter((rg) => !rg.region.is_primary);

  const totalWorkouts = schedule.regions.reduce(
    (sum, rg) => sum + rg.workouts.length,
    0
  );

  if (totalWorkouts === 0) return null;

  const otherNearbyWorkouts = nonPrimaryRegions.flatMap((rg) =>
    rg.workouts.map((w) => ({ workout: w, regionName: rg.region.name }))
  );

  return (
    <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="font-bold font-heading text-foreground">
            {DAY_NAMES[dayNum]}
          </span>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
            {totalWorkouts} workout{totalWorkouts !== 1 ? "s" : ""}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-5 w-5 text-muted-foreground transition-transform duration-200",
            isOpen && "rotate-180"
          )}
        />
      </button>
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        <div className="p-4 pt-0 border-t border-border">
          {/* Primary regions — prominent display */}
          {primaryRegions.map((rg) => (
            <div key={rg.region.slug} className="mb-4 last:mb-0">
              <h4 className="text-xs font-semibold text-primary uppercase tracking-wider mb-2 pb-1 border-b border-primary/20">
                {rg.region.name}
              </h4>
              <div className="space-y-2">
                {rg.workouts.map((w) => (
                  <WorkoutCard key={w.id} workout={w} variant="primary" />
                ))}
              </div>
            </div>
          ))}

          {/* Non-primary regions — collapsed by default */}
          <OtherNearbySection workouts={otherNearbyWorkouts} />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────
interface WorkoutScheduleProps {
  schedule: Record<number, DaySchedule>;
  todayIndex: number;
}

export function WorkoutSchedule({ schedule, todayIndex }: WorkoutScheduleProps) {
  return (
    <div className="space-y-3 max-w-4xl mx-auto">
      {[1, 2, 3, 4, 5, 6, 7].map((dayNum) => {
        const daySchedule = schedule[dayNum];
        if (!daySchedule) return null;
        return (
          <DayCard
            key={dayNum}
            dayNum={dayNum}
            schedule={daySchedule}
            defaultOpen={dayNum === todayIndex}
          />
        );
      })}
    </div>
  );
}
