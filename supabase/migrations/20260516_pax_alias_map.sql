-- 20260516_pax_alias_map.sql
-- Admin-editable alias map for Slack IDs that aren't in slack_users at all.
-- Used as the last-resort lookup in resolvePaxIdentity before falling back
-- to the raw "U..." token.

CREATE TABLE IF NOT EXISTS pax_alias_map (
  slack_id text PRIMARY KEY,
  display_name text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE OR REPLACE FUNCTION pax_alias_map_set_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS pax_alias_map_updated_at ON pax_alias_map;
CREATE TRIGGER pax_alias_map_updated_at
  BEFORE UPDATE ON pax_alias_map
  FOR EACH ROW EXECUTE FUNCTION pax_alias_map_set_updated_at();
