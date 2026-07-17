import { getSql } from "@/lib/db";
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
  let regions: Region[] = [];
  let workouts: WorkoutScheduleRow[] = [];
  try {
    const sql = getSql();

    // Fetch active regions
    const regionsData = await sql`SELECT * FROM regions WHERE is_active = true ORDER BY sort_order ASC`;
    regions = regionsData as Region[];

    // Fetch active workouts
    const workoutsData = await sql`SELECT * FROM workout_schedule WHERE is_active = true ORDER BY day_of_week, start_time`;
    workouts = workoutsData as WorkoutScheduleRow[];
  } catch (error) {
    // Same graceful-degradation contract as the other page data loaders:
    // render an empty schedule rather than failing the whole prerender
    // (e.g. CI builds without DATABASE_URL).
    console.error("[getWorkoutSchedule] failed:", error);
  }

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
