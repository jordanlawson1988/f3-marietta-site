export interface WorkoutScheduleRow {
  id: string;
  ao_name: string;
  workout_type: string;
  day_of_week: number;
  start_time: string;
  end_time: string;
  location_name: string | null;
  address: string;
  region: string;
  nearby_region: string | null;
  map_link: string | null;
  is_active: boolean;
}
