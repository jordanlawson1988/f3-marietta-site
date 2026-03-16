-- 001_automation_tables.sql

-- Instagram post drafts (links to existing f3_events)
CREATE TABLE instagram_drafts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id           UUID NOT NULL REFERENCES f3_events(id),
  caption            TEXT NOT NULL,
  story_text         TEXT,
  hashtags           TEXT[],
  alt_text           TEXT,
  image_url          TEXT,
  image_storage_path TEXT,
  status             TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'posted', 'rejected', 'edited')),
  post_type          TEXT NOT NULL DEFAULT 'feed'
    CHECK (post_type IN ('feed', 'story')),
  buffer_post_id     TEXT,
  approved_at        TIMESTAMPTZ,
  posted_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(event_id, post_type)
);

-- Weekly newsletters
CREATE TABLE newsletters (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start         DATE NOT NULL,
  week_end           DATE NOT NULL,
  title              TEXT,
  body_markdown      TEXT,
  body_slack_mrkdwn  TEXT,
  status             TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'posted')),
  slack_message_ts   TEXT,
  approved_at        TIMESTAMPTZ,
  posted_at          TIMESTAMPTZ,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(week_start)
);

-- Audit log for cron and publish runs
CREATE TABLE agent_runs (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type           TEXT NOT NULL
    CHECK (run_type IN ('generate_drafts', 'generate_newsletter', 'publish_instagram', 'publish_newsletter')),
  status             TEXT NOT NULL
    CHECK (status IN ('success', 'failure', 'partial')),
  details            JSONB,
  error_message      TEXT,
  started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at       TIMESTAMPTZ
);

-- Week boundary convention: covers the most recent completed Mon-Sun week.
-- The Saturday cron calculates: week_start = Monday 12 days ago, week_end = Sunday 6 days ago.
-- Example: cron runs Saturday March 14 -> week_start = March 2 (Mon), week_end = March 8 (Sun).
-- Content query: WHERE event_date >= week_start AND event_date <= week_end.
