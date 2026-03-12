import { supabase } from "@/lib/supabase";
import type { WorkoutScheduleRow } from "@/types/workout";
import type { Region } from "@/types/region";

export interface RegionInfo {
  name: string;
  slug: string;
  is_primary: boolean;
  sort_order: number;
}

export interface RegionWorkouts {
  region: RegionInfo;
  workouts: WorkoutScheduleRow[];
}

export interface DaySchedule {
  regions: RegionWorkouts[];
}

export async function getWorkoutSchedule(): Promise<
  Record<number, DaySchedule>
> {
  // Fetch active regions
  const { data: regionsData } = await supabase
    .from("regions")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  const regions: Region[] = regionsData ?? [];

  // Fetch active workouts
  const { data: workoutsData } = await supabase
    .from("workout_schedule")
    .select("*")
    .eq("is_active", true)
    .order("day_of_week")
    .order("start_time");

  const workouts: WorkoutScheduleRow[] = workoutsData ?? [];

  // Build region lookup
  const regionMap = new Map<string, Region>(
    regions.map((r) => [r.id, r])
  );

  // Group by day, then by region
  const schedule: Record<number, DaySchedule> = {};

  for (let d = 1; d <= 7; d++) {
    const dayWorkouts = workouts.filter((w) => w.day_of_week === d);
    const regionGroups: RegionWorkouts[] = [];

    for (const region of regions) {
      const rWorkouts = dayWorkouts.filter(
        (w) => w.region_id === region.id
      );
      if (rWorkouts.length > 0) {
        regionGroups.push({
          region: {
            name: region.name,
            slug: region.slug,
            is_primary: region.is_primary,
            sort_order: region.sort_order,
          },
          workouts: rWorkouts,
        });
      }
    }

    schedule[d] = { regions: regionGroups };
  }

  return schedule;
}
