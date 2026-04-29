-- AI Beatdown Builder schema (2026-04-27)
-- See docs/superpowers/specs/2026-04-27-ai-beatdown-builder-design.md

CREATE TABLE beatdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id text NOT NULL UNIQUE,
  inputs jsonb NOT NULL,
  sections jsonb NOT NULL,
  title text NOT NULL,
  ip_hash text,
  generation_model text NOT NULL,
  generation_ms integer NOT NULL,
  knowledge_version integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX beatdowns_short_id_idx ON beatdowns (short_id);
CREATE INDEX beatdowns_created_at_idx ON beatdowns (created_at DESC);

CREATE TRIGGER beatdowns_updated_at
  BEFORE UPDATE ON beatdowns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE marietta_bd_knowledge (
  id serial PRIMARY KEY,
  generated_at timestamptz NOT NULL DEFAULT now(),
  source_event_count integer NOT NULL,
  content text NOT NULL,
  per_ao_summary jsonb NOT NULL,
  generation_model text NOT NULL,
  generation_ms integer NOT NULL,
  cost_usd numeric(10,4)
);

CREATE INDEX marietta_bd_knowledge_generated_at_idx ON marietta_bd_knowledge (generated_at DESC);

COMMENT ON TABLE beatdowns IS 'AI-generated beatdowns saved by Qs via the public Beatdown Builder';
COMMENT ON TABLE marietta_bd_knowledge IS 'Nightly distilled summary of all F3 Marietta backblast patterns; consumed by the Beatdown Builder generator';
