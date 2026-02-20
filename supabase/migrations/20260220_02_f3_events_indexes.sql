-- Composite index for the primary list query pattern
CREATE INDEX idx_f3_events_list_query
  ON f3_events (event_date DESC, created_at DESC)
  WHERE is_deleted = false AND event_kind = 'backblast';

-- Composite index for AO-filtered queries
CREATE INDEX idx_f3_events_ao_date
  ON f3_events (ao_display_name, event_date DESC)
  WHERE is_deleted = false AND event_kind = 'backblast';

-- pg_trgm for ILIKE search performance
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX idx_f3_events_content_trgm ON f3_events USING gin (content_text gin_trgm_ops);
CREATE INDEX idx_f3_events_title_trgm ON f3_events USING gin (title gin_trgm_ops);
CREATE INDEX idx_f3_events_q_name_trgm ON f3_events USING gin (q_name gin_trgm_ops);

-- CHECK constraint to enforce valid event_kind values
ALTER TABLE f3_events ADD CONSTRAINT chk_event_kind
  CHECK (event_kind IN ('backblast', 'preblast', 'unknown'));
