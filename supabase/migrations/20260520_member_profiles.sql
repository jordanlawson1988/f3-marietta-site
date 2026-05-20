-- Migration: 20260520_member_profiles.sql
-- Multi-admin system: per-user admin/ops access profile (1:1 with Better Auth "user").
-- Additive only. status vocabulary mirrors src/lib/constants/memberStatus.ts.

CREATE TABLE IF NOT EXISTS member_profiles (
  user_id      text PRIMARY KEY REFERENCES "user"(id) ON DELETE CASCADE,
  status       text NOT NULL DEFAULT 'pending'
                 CHECK (status IN ('pending', 'admin', 'revoked')),
  f3_name      text,
  real_name    text,
  f3nation_url text,
  approved_by  text,
  approved_at  timestamptz,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_member_profiles_status ON member_profiles(status);

COMMENT ON TABLE member_profiles IS 'Admin/ops access + lean profile, 1:1 with Better Auth user. status: pending|admin|revoked.';
COMMENT ON COLUMN member_profiles.approved_by IS 'user_id of the admin who last changed this row''s status.';

-- Bootstrap: seed every existing Better Auth account as admin so console access
-- is not lost on deploy (today this is just admin@f3marietta.com). Self-approved.
INSERT INTO member_profiles (user_id, status, approved_by, approved_at)
SELECT u.id, 'admin', u.id, now()
FROM "user" u
ON CONFLICT (user_id) DO NOTHING;
