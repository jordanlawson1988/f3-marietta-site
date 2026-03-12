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
SELECT DISTINCT
  nearby_region,
  lower(replace(nearby_region, ' ', '-')),
  2 + row_number() OVER (ORDER BY nearby_region),
  false
FROM workout_schedule
WHERE nearby_region IS NOT NULL AND nearby_region != '';

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

-- 5. Drop the CHECK constraint on the old region column (name may vary)
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
