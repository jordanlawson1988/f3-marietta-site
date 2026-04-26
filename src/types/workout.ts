export interface WorkoutScheduleRow {
  id: string;
  ao_name: string;
  workout_type: string;
  day_of_week: number; // 1 (Mon) – 7 (Sun), ISO
  start_time: string; // HH:MM:SS
  end_time: string; // HH:MM:SS
  location_name: string | null;
  address: string;
  region_id: string; // uuid FK to regions.id
  map_link: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/**
 * Workout row augmented with region display metadata.
 * Used anywhere we need to group/label AOs by region (e.g., the home
 * Beatdown grid and the /workouts page) without a separate lookup.
 */
export interface WorkoutWithRegion extends WorkoutScheduleRow {
  region_name: string;
  region_slug: string;
  region_is_primary: boolean;
}
