-- Workout schedule table: one row per recurring workout per day of week
CREATE TABLE workout_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ao_name text NOT NULL,
  workout_type text NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7), -- ISO: 1=Mon, 7=Sun
  start_time time NOT NULL,
  end_time time NOT NULL,
  location_name text,
  address text NOT NULL,
  region text NOT NULL CHECK (region IN ('Marietta', 'West Cobb', 'Other Nearby')),
  nearby_region text,          -- e.g. "Atlanta", "Cherokee" for Other Nearby entries
  map_link text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_workout_schedule_day ON workout_schedule(day_of_week) WHERE is_active = true;

-- Seed data: all 26 workouts from the hardcoded schedule
-- Monday (day_of_week = 1)
INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, map_link) VALUES
  ('The Last Stand', 'Bootcamp', 1, '05:30', '06:15', 'Custer Park', '600 Kenneth E Marcus Way, Marietta, GA', 'Marietta', 'https://map.f3nation.com/?eventId=44023&locationId=44024');

INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, map_link) VALUES
  ('The Forge', 'Bootcamp', 1, '05:30', '06:15', 'Lost Mountain Park', '4843 Dallas Hwy, Powder Springs, GA 30127', 'West Cobb', 'https://map.f3nation.com/?eventId=34743&locationId=34744'),
  ('The Grove', 'Bootcamp', 1, '05:30', '06:15', 'Hillgrove Highschool', '4165 Luther Ward Rd, Powder Springs, GA', 'West Cobb', 'https://map.f3nation.com/?eventId=32723&locationId=32724'),
  ('The Streak', 'Bootcamp', 1, '05:30', '06:15', 'Logan Farm Park', '4405 Cherokee St, Acworth, GA', 'West Cobb', 'https://map.f3nation.com/');

INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, nearby_region, map_link) VALUES
  ('Madhouse', 'Running', 1, '05:45', '06:15', 'Taylor-Brawner Park', '3180 Atlanta Rd SE, Smyrna, GA', 'Other Nearby', 'Atlanta', 'https://map.f3nation.com/?eventId=40243&locationId=40243');

-- Tuesday (day_of_week = 2)
INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, map_link) VALUES
  ('The Battlefield', 'Bootcamp', 2, '05:30', '06:15', 'Marietta High School', '1171 Whitlock Ave NW, Marietta, GA', 'Marietta', 'https://map.f3nation.com/?eventId=47961&locationId=47965');

INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, map_link) VALUES
  ('Crazy 8''s', 'Running', 2, '05:30', '06:15', 'Lost Mountain Park', '4843 Dallas Hwy, Powder Springs, GA 30127', 'West Cobb', 'https://map.f3nation.com/?eventId=32865&locationId=34744'),
  ('The OG', 'Bootcamp 0-0 (No running)', 2, '05:30', '06:15', 'Due West Methodist Church', '3956 Due West Rd, Marietta, GA', 'West Cobb', 'https://map.f3nation.com/?eventId=32866&locationId=32866'),
  ('The Chase', 'Running', 2, '05:30', '06:15', 'Cobb Vineyard Church', '3206 Old 41 Hwy NW, Kennesaw, GA', 'West Cobb', 'https://map.f3nation.com/?eventId=44452&locationId=44452');

INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, nearby_region, map_link) VALUES
  ('The Flight Deck', 'Bootcamp', 2, '05:30', '06:15', 'Aviation Park', '2659 Barrett Lakes Blvd, Kennesaw, GA', 'Other Nearby', 'Cherokee', 'https://map.f3nation.com/?eventId=32677&locationId=32677'),
  ('Warning Track', 'Bootcamp', 2, '05:45', '06:30', 'Tolleson Park', '3515 McCauley Rd, Smyrna, GA', 'Other Nearby', 'Atlanta', 'https://map.f3nation.com/?eventId=32973&locationId=32975');

-- Wednesday (day_of_week = 3)
INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, map_link) VALUES
  ('The Last Stand', 'Bootcamp', 3, '05:30', '06:15', 'Custer Park', '600 Kenneth E Marcus Way, Marietta, GA', 'Marietta', 'https://map.f3nation.com/?eventId=44023&locationId=44024');

INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, map_link) VALUES
  ('The Forge', 'Bootcamp', 3, '05:30', '06:15', 'Lost Mountain Park', '4843 Dallas Hwy, Powder Springs, GA 30127', 'West Cobb', 'https://map.f3nation.com/?eventId=34743&locationId=34744'),
  ('The Grove', 'Bootcamp', 3, '05:30', '06:30', 'Hillgrove Highschool', '4165 Luther Ward Rd, Powder Springs, GA', 'West Cobb', 'https://map.f3nation.com/?eventId=32723&locationId=32724'),
  ('The Streak', 'Bootcamp', 3, '05:30', '06:15', 'Logan Farm Park', '4405 Cherokee St, Acworth, GA', 'West Cobb', 'https://map.f3nation.com/');

INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, nearby_region, map_link) VALUES
  ('Swiss Army Knife', 'Bootcamp', 3, '05:45', '06:30', 'Jonquil Park', '3000 Park Rd, Smyrna, GA 30080', 'Other Nearby', 'Atlanta', 'https://map.f3nation.com/?eventId=41433&locationId=41433');

-- Thursday (day_of_week = 4)
INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, map_link) VALUES
  ('The Battlefield', 'Bootcamp', 4, '05:30', '06:15', 'Marietta High School', '1171 Whitlock Ave NW, Marietta, GA', 'Marietta', 'https://map.f3nation.com/?eventId=47961&locationId=47965');

INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, map_link) VALUES
  ('Crazy 8''s', 'Running', 4, '05:30', '06:15', 'Lost Mountain Park', '4843 Dallas Hwy, Powder Springs, GA 30127', 'West Cobb', 'https://map.f3nation.com/?eventId=32865&locationId=34744');

INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, nearby_region, map_link) VALUES
  ('Galaxy', 'Bootcamp', 4, '05:30', '06:15', 'East Cobb Park', '3322 Roswell Rd, Marietta, GA', 'Other Nearby', 'West Atlanta', 'https://map.f3nation.com/'),
  ('Warning Track', 'Bootcamp', 4, '05:45', '06:30', 'Tolleson Park', '3515 McCauley Rd, Smyrna, GA', 'Other Nearby', 'Atlanta', 'https://map.f3nation.com/?eventId=32973&locationId=32975');

-- Friday (day_of_week = 5)
INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, map_link) VALUES
  ('The Foundry', 'Bootcamp', 5, '05:15', '06:15', 'Lost Mountain Park', '4843 Dallas Hwy, Powder Springs, GA 30127', 'West Cobb', 'https://map.f3nation.com/?eventId=34744&locationId=34744');

INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, nearby_region, map_link) VALUES
  ('The Flight Deck', 'Bootcamp', 5, '05:30', '06:15', 'Aviation Park', '2659 Barrett Lakes Blvd, Kennesaw, GA', 'Other Nearby', 'Cherokee', 'https://map.f3nation.com/?eventId=32677&locationId=32677'),
  ('Galaxy', 'Bootcamp', 5, '05:30', '06:15', 'East Cobb Park', '3322 Roswell Rd, Marietta, GA', 'Other Nearby', 'West Atlanta', 'https://map.f3nation.com/');

-- Saturday (day_of_week = 6)
INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, map_link) VALUES
  ('The Outpost', 'Bootcamp', 6, '06:30', '07:30', 'West Ridge Church', '3522 Hiram Acworth Hwy, Dallas, GA', 'West Cobb', 'https://map.f3nation.com/?eventId=45391&locationId=45391');

INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region, nearby_region, map_link) VALUES
  ('Warning Track', 'Bootcamp', 6, '06:30', '07:30', 'Tolleson Park', '3515 McCauley Rd, Smyrna, GA', 'Other Nearby', 'Atlanta', 'https://map.f3nation.com/?eventId=32973&locationId=32975');

-- Sunday (day_of_week = 7): no workouts currently scheduled
