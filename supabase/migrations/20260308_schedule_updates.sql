-- Remove The Last Stand from Wednesday
UPDATE workout_schedule
SET is_active = false, updated_at = now()
WHERE ao_name = 'The Last Stand'
  AND day_of_week = 3;

-- Add Blackops Run on Saturday at 6:00 AM at Marietta Square
INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region)
VALUES ('Blackops Run', 'Running', 6, '06:00', '07:00', 'Marietta Square', '1 Depot St, Marietta, GA 30060', 'Marietta');
