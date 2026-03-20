-- Combined Neon Postgres Schema for F3 Marietta
-- Generated from Supabase migrations (sorted chronologically)
-- RLS, policies, search_path modifications, and security_invoker removed for Neon compatibility

BEGIN;

-- ============================================================================
-- Extensions
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- ============================================================================
-- Migration: 20260106_backblasts_schema.sql
-- ============================================================================

-- ao_channels: Maps Slack channels to AO display names
CREATE TABLE ao_channels (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_channel_id text UNIQUE NOT NULL,
  slack_channel_name text,
  ao_display_name text NOT NULL,
  is_enabled boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- backblasts: Stores parsed backblast content
CREATE TABLE backblasts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_channel_id text NOT NULL,
  slack_message_ts text NOT NULL,
  slack_permalink text,
  ao_display_name text,
  title text,
  backblast_date date,
  q_name text,
  pax_text text,
  fng_text text,
  pax_count integer,
  content_text text NOT NULL,
  content_json jsonb,
  last_slack_edit_ts text,
  is_deleted boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(slack_channel_id, slack_message_ts)
);

CREATE INDEX idx_backblasts_date_ao ON backblasts(backblast_date DESC, ao_display_name);
CREATE INDEX idx_backblasts_not_deleted ON backblasts(is_deleted) WHERE is_deleted = false;

-- Auto-update updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER backblasts_updated_at
  BEFORE UPDATE ON backblasts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ao_channels seed data will be migrated from Supabase via data migration script

-- ============================================================================
-- Migration: 20260108_01_f3_events_schema.sql
-- ============================================================================

-- f3_events: Canonical table for all F3 events (backblasts + preblasts)
CREATE TABLE f3_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slack_channel_id text NOT NULL,
  slack_message_ts text NOT NULL,
  slack_permalink text,
  ao_display_name text,
  event_kind text NOT NULL DEFAULT 'unknown',
  title text,
  event_date date,
  event_time text,
  location_text text,
  q_slack_user_id text,
  q_name text,
  pax_count int,
  content_text text,
  content_html text,
  content_json jsonb NOT NULL,
  raw_envelope_json jsonb,
  last_slack_edit_ts text,
  is_deleted bool DEFAULT false,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(slack_channel_id, slack_message_ts)
);

CREATE INDEX idx_f3_events_date ON f3_events(event_date DESC);
CREATE INDEX idx_f3_events_ao ON f3_events(ao_display_name);
CREATE INDEX idx_f3_events_kind ON f3_events(event_kind);
CREATE INDEX idx_f3_events_q_slack ON f3_events(q_slack_user_id);
CREATE INDEX idx_f3_events_not_deleted ON f3_events(is_deleted) WHERE is_deleted = false;

CREATE OR REPLACE FUNCTION update_f3_events_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER f3_events_updated_at
  BEFORE UPDATE ON f3_events
  FOR EACH ROW EXECUTE FUNCTION update_f3_events_updated_at();

COMMENT ON TABLE f3_events IS 'Canonical normalized storage for F3 events (backblasts and preblasts) from Slack';
COMMENT ON COLUMN f3_events.event_kind IS 'Type: preblast, backblast, or unknown';
COMMENT ON COLUMN f3_events.content_json IS 'Normalized Slack message object (blocks, metadata)';
COMMENT ON COLUMN f3_events.raw_envelope_json IS 'Full original Slack webhook payload for debugging';

-- ============================================================================
-- Migration: 20260108_02_slack_users.sql
-- ============================================================================

-- slack_users: Cache of Slack user profiles for Q name resolution
CREATE TABLE slack_users (
  slack_user_id text PRIMARY KEY,
  team_id text,
  display_name text,
  real_name text,
  image_48 text,
  is_bot bool DEFAULT false,
  deleted bool DEFAULT false,
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_slack_users_team ON slack_users(team_id);

COMMENT ON TABLE slack_users IS 'Cached Slack user profiles synced daily for Q name resolution';
COMMENT ON COLUMN slack_users.display_name IS 'Slack display_name - primary name to show';
COMMENT ON COLUMN slack_users.real_name IS 'Slack real_name - fallback if display_name empty';

-- ============================================================================
-- Migration: 20260108_03_normalization_tables.sql
-- ============================================================================

-- f3_event_attendees: PAX attendees for an event
CREATE TABLE f3_event_attendees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES f3_events(id) ON DELETE CASCADE,
  attendee_external_id bigint,
  attendee_slack_user_id text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_f3_event_attendees_external
  ON f3_event_attendees(event_id, attendee_external_id)
  WHERE attendee_external_id IS NOT NULL;

CREATE UNIQUE INDEX idx_f3_event_attendees_slack
  ON f3_event_attendees(event_id, attendee_slack_user_id)
  WHERE attendee_slack_user_id IS NOT NULL;

CREATE INDEX idx_f3_event_attendees_event ON f3_event_attendees(event_id);

-- f3_event_qs: Q leaders for an event (can have multiple Qs)
CREATE TABLE f3_event_qs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES f3_events(id) ON DELETE CASCADE,
  q_external_id bigint,
  q_slack_user_id text,
  created_at timestamptz DEFAULT now()
);

CREATE UNIQUE INDEX idx_f3_event_qs_external
  ON f3_event_qs(event_id, q_external_id)
  WHERE q_external_id IS NOT NULL;

CREATE UNIQUE INDEX idx_f3_event_qs_slack
  ON f3_event_qs(event_id, q_slack_user_id)
  WHERE q_slack_user_id IS NOT NULL;

CREATE INDEX idx_f3_event_qs_event ON f3_event_qs(event_id);

-- slack_message_blocks: Slack Block Kit blocks for an event message
CREATE TABLE slack_message_blocks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES f3_events(id) ON DELETE CASCADE,
  block_index int NOT NULL,
  block_type text,
  block_id text,
  block_json jsonb,
  UNIQUE(event_id, block_index)
);

CREATE INDEX idx_slack_message_blocks_event ON slack_message_blocks(event_id);

-- slack_block_elements: Elements within a Slack block
CREATE TABLE slack_block_elements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  block_row_id uuid NOT NULL REFERENCES slack_message_blocks(id) ON DELETE CASCADE,
  element_index int NOT NULL,
  element_type text,
  element_json jsonb,
  UNIQUE(block_row_id, element_index)
);

CREATE INDEX idx_slack_block_elements_block ON slack_block_elements(block_row_id);

COMMENT ON TABLE f3_event_attendees IS 'PAX attendees for F3 events - from metadata.event_payload.the_pax or attendees';
COMMENT ON TABLE f3_event_qs IS 'Q leaders for F3 events - supports multiple Qs per event';
COMMENT ON TABLE slack_message_blocks IS 'Slack Block Kit blocks for rendering structured content';
COMMENT ON TABLE slack_block_elements IS 'Elements within Slack blocks for detailed parsing';

-- ============================================================================
-- Migration: 20260108_04_backblasts_v2_view.sql
-- ============================================================================

CREATE VIEW backblasts_v2 AS
SELECT
  id,
  slack_channel_id,
  slack_message_ts,
  slack_permalink,
  ao_display_name,
  title,
  event_date AS backblast_date,
  q_name,
  NULL::text AS pax_text,
  NULL::text AS fng_text,
  pax_count,
  content_text,
  content_json,
  last_slack_edit_ts,
  is_deleted,
  created_at,
  updated_at
FROM f3_events
WHERE event_kind = 'backblast' AND is_deleted = false;

COMMENT ON VIEW backblasts_v2 IS 'Backward-compatible view for website migration - reads from f3_events';

-- ============================================================================
-- Migration: 20260220_workout_schedule.sql
-- ============================================================================

CREATE TABLE workout_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ao_name text NOT NULL,
  workout_type text NOT NULL,
  day_of_week smallint NOT NULL CHECK (day_of_week BETWEEN 1 AND 7),
  start_time time NOT NULL,
  end_time time NOT NULL,
  location_name text,
  address text NOT NULL,
  region text NOT NULL CHECK (region IN ('Marietta', 'West Cobb', 'Other Nearby')),
  nearby_region text,
  map_link text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX idx_workout_schedule_day ON workout_schedule(day_of_week) WHERE is_active = true;

-- Seed data: all workouts
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

-- ============================================================================
-- Migration: 20260221_f3_events_indexes.sql
-- ============================================================================

CREATE INDEX idx_f3_events_list_query
  ON f3_events (event_date DESC, created_at DESC)
  WHERE is_deleted = false AND event_kind = 'backblast';

CREATE INDEX idx_f3_events_ao_date
  ON f3_events (ao_display_name, event_date DESC)
  WHERE is_deleted = false AND event_kind = 'backblast';

CREATE INDEX idx_f3_events_content_trgm ON f3_events USING gin (content_text gin_trgm_ops);
CREATE INDEX idx_f3_events_title_trgm ON f3_events USING gin (title gin_trgm_ops);
CREATE INDEX idx_f3_events_q_name_trgm ON f3_events USING gin (q_name gin_trgm_ops);

ALTER TABLE f3_events ADD CONSTRAINT chk_event_kind
  CHECK (event_kind IN ('backblast', 'preblast', 'unknown'));

-- ============================================================================
-- Migration: 20260308_schedule_updates.sql
-- ============================================================================

-- Remove The Last Stand from Wednesday
UPDATE workout_schedule
SET is_active = false, updated_at = now()
WHERE ao_name = 'The Last Stand'
  AND day_of_week = 3;

-- Add Blackops Run on Saturday at 6:00 AM at Marietta Square
INSERT INTO workout_schedule (ao_name, workout_type, day_of_week, start_time, end_time, location_name, address, region)
VALUES ('Blackops Run', 'Running', 6, '06:00', '07:00', 'Marietta Square', '1 Depot St, Marietta, GA 30060', 'Marietta');

-- ============================================================================
-- Migration: 20260312_regions_and_workout_fk.sql
-- ============================================================================

-- 1. Create the regions table
CREATE TABLE regions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  sort_order smallint NOT NULL DEFAULT 0,
  is_primary boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. Seed regions from existing workout_schedule data
INSERT INTO regions (name, slug, sort_order, is_primary) VALUES
  ('Marietta', 'marietta', 1, true),
  ('West Cobb', 'west-cobb', 2, true);

-- Seed non-primary regions from distinct nearby_region values
INSERT INTO regions (name, slug, sort_order, is_primary)
SELECT
  name,
  slug,
  2 + row_number() OVER (ORDER BY slug),
  false
FROM (
  SELECT DISTINCT ON (lower(replace(nearby_region, ' ', '-')))
    nearby_region AS name,
    lower(replace(nearby_region, ' ', '-')) AS slug
  FROM workout_schedule
  WHERE nearby_region IS NOT NULL AND nearby_region != ''
  ORDER BY lower(replace(nearby_region, ' ', '-')), nearby_region
) deduped;

-- 3. Add region_id column to workout_schedule
ALTER TABLE workout_schedule ADD COLUMN region_id uuid;

-- 4. Populate region_id from existing region/nearby_region text values
UPDATE workout_schedule ws
SET region_id = r.id
FROM regions r
WHERE ws.region = 'Marietta' AND r.slug = 'marietta';

UPDATE workout_schedule ws
SET region_id = r.id
FROM regions r
WHERE ws.region = 'West Cobb' AND r.slug = 'west-cobb';

UPDATE workout_schedule ws
SET region_id = r.id
FROM regions r
WHERE ws.region = 'Other Nearby'
  AND r.name = ws.nearby_region;

-- 5. Drop the CHECK constraint on the old region column
DO $$
DECLARE
  _con text;
BEGIN
  SELECT conname INTO _con
    FROM pg_constraint
   WHERE conrelid = 'workout_schedule'::regclass
     AND contype = 'c'
     AND pg_get_constraintdef(oid) ILIKE '%region%';
  IF _con IS NOT NULL THEN
    EXECUTE format('ALTER TABLE workout_schedule DROP CONSTRAINT %I', _con);
  END IF;
END $$;

-- 6. Add foreign key constraint
ALTER TABLE workout_schedule
  ADD CONSTRAINT workout_schedule_region_id_fkey
  FOREIGN KEY (region_id) REFERENCES regions(id);

-- 7. Set region_id to NOT NULL
ALTER TABLE workout_schedule ALTER COLUMN region_id SET NOT NULL;

-- 8. Drop old columns
ALTER TABLE workout_schedule DROP COLUMN region;
ALTER TABLE workout_schedule DROP COLUMN nearby_region;

-- 9. Add index for region_id lookups
CREATE INDEX idx_workout_schedule_region_id ON workout_schedule(region_id);

COMMIT;
