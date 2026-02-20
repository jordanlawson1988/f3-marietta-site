import { supabase } from '@/lib/supabase';
import type { WorkoutScheduleRow } from '@/types/workout';

export interface DaySchedule {
  marietta: WorkoutScheduleRow[];
  westCobb: WorkoutScheduleRow[];
  otherNearby: WorkoutScheduleRow[];
}

/**
 * Fetches all active workouts, ordered by day_of_week + start_time,
 * grouped into a Map keyed by ISO day number (1=Mon … 7=Sun).
 */
export async function getWorkoutSchedule(): Promise<Map<number, DaySchedule>> {
  const { data, error } = await supabase
    .from('workout_schedule')
    .select('id, ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, nearby_region, map_link, is_active')
    .eq('is_active', true)
    .order('day_of_week', { ascending: true })
    .order('start_time', { ascending: true });

  if (error) {
    console.error('Error fetching workout schedule:', error);
    return new Map();
  }

  const rows = (data || []) as WorkoutScheduleRow[];

  const schedule = new Map<number, DaySchedule>();

  // Initialize all 7 days
  for (let d = 1; d <= 7; d++) {
    schedule.set(d, { marietta: [], westCobb: [], otherNearby: [] });
  }

  for (const row of rows) {
    const day = schedule.get(row.day_of_week);
    if (!day) continue;

    switch (row.region) {
      case 'Marietta':
        day.marietta.push(row);
        break;
      case 'West Cobb':
        day.westCobb.push(row);
        break;
      case 'Other Nearby':
        day.otherNearby.push(row);
        break;
    }
  }

  return schedule;
}
