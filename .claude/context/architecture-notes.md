# Architecture Notes — F3 Marietta

> Living record of tech debt, architectural decisions, and system health. Last updated: 2026-03-22

## Active Tech Debt

| Issue | Severity | Notes |
|-------|----------|-------|
| `@supabase/supabase-js` in devDependencies | **Low** | Leftover from Supabase-to-Neon migration. Unused in runtime code. Should be removed. |
| CI workflow references Supabase secrets | **Medium** | `ci.yml` still uses `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`. Should be updated to `DATABASE_URL`. |
| README.md references Supabase setup | **Low** | Entire "Backblasts Feature Setup" section references Supabase. Should be rewritten for Neon + Better Auth. |
| `f3-automation/` legacy directory | **Low** | Standalone automation project consolidated into the admin dashboard. ESLint ignores it. Can be removed entirely. |
| No unit test framework | **Medium** | Only Playwright E2E tests exist. Pure functions (glossary search, Slack normalization, rate limiter) have no fast-feedback tests. |
| Backblasts child record upsert is sequential | **Low** | Attendees, Qs, and blocks are inserted one-by-one in loops. Could use batch inserts for better performance on large events. |
| No input validation library | **Low** | API routes do ad-hoc validation. No Zod or similar schema validation. Acceptable for current complexity. |
| OpenAI API key required for build | **Low** | CI uses placeholder `"sk-placeholder"` for OpenAI key. Build doesn't actually call OpenAI but the env var must exist. |

## Known Footguns

1. **Slack event handler must return 200 within 3 seconds** — Slack retries on timeout. All processing is done inline (no background jobs on Vercel Hobby). If processing takes too long, Slack will send duplicate events.
2. **`getSql()` throws if `DATABASE_URL` is missing** — The lazy initialization pattern means the error only surfaces on first database call, not at import time. This is by design for build-time safety but can be confusing during debugging.
3. **Better Auth session cookie name is `better-auth.session_token`** — Middleware does a lightweight cookie-exists check (Edge Runtime compatible). Full session validation only happens in API routes (Node.js runtime). Don't validate sessions in middleware.
4. **Neon serverless driver has cold start latency** — First query after a period of inactivity may take 500ms-1s. Subsequent queries are fast. This can cause the Slack event handler to approach the 3-second timeout.
5. **The glossary CSV is 353KB** — `f3Glossary.ts` imports and parses it at module load time. This adds to serverless function cold start time for the assistant route.
6. **Slack `message_changed` events reprocess the entire message** — Upsert is idempotent (ON CONFLICT DO UPDATE), but child records are deleted and re-inserted on every edit. This is correct but generates extra database writes.

## Dependency Health

### Core
- Next.js 16.0.10, React 19.2.0, TypeScript 5.9.3
- `@neondatabase/serverless` 1.0.2 (Neon Postgres driver)
- `better-auth` 1.5.5 (authentication)
- `@slack/web-api` 7.13.0 (Slack integration)
- OpenAI SDK 6.9.1 (AI assistant)
- `@anthropic-ai/sdk` 0.80.0 (Instagram/newsletter automation)

### UI
- Tailwind CSS 4.x, `tailwind-merge` 3.4.0
- Lucide React 0.554.0 (icons)
- `clsx` 2.1.1 (class names)

### Content
- `gray-matter` 4.0.3 (markdown front matter parsing)
- `sanitize-html` 2.17.0 (HTML sanitization)

### Email
- Resend 6.6.0 (transactional email)

### Media
- `@vercel/blob` 2.3.1 (image storage for Instagram drafts)

### Testing
- Playwright 1.57.0 (E2E tests)

### Dev-only (removable)
- `@supabase/supabase-js` 2.99.3 — **unused, leftover from migration**

## Infrastructure

| Component | Details |
|-----------|---------|
| Hosting | Vercel (Hobby plan) |
| Database | Neon serverless Postgres (free tier) |
| Auth | Better Auth (sessions in Neon, email/password) |
| AI (Public) | OpenAI `gpt-4o-mini` (AI assistant) |
| AI (Automation) | Anthropic Claude `claude-sonnet-4-20250514` (captions, newsletters) |
| Slack | Events API webhook + Web API for user lookup |
| Email | Resend (contact form) |
| Media | Vercel Blob (draft images) |
| DNS | Custom domain: f3marietta.com |
| CI/CD | GitHub Actions (lint + build + Playwright on Chromium) |
| Cron | Vercel Crons (2 daily jobs: reconcile + sync-users) |

## Migration History

10 SQL migrations in `supabase/migrations/` (named for historical reasons, applied to Neon):

1. `20260106_backblasts_schema.sql` — Original `ao_channels` + `backblasts` tables
2. `20260108_01_f3_events_schema.sql` — Canonical `f3_events` table
3. `20260108_02_slack_users.sql` — Slack user profile cache
4. `20260108_03_normalization_tables.sql` — Attendees, Qs, blocks, elements
5. `20260108_04_backblasts_v2_view.sql` — Compatibility view
6. `20260220_workout_schedule.sql` — Workout schedule + automation tables
7. `20260221_f3_events_indexes.sql` — Performance indexes
8. `20260304_security_hardening.sql` — Security improvements
9. `20260308_schedule_updates.sql` — Schedule schema updates
10. `20260312_regions_and_workout_fk.sql` — Regions table + FK to workouts

Combined schema: `scripts/neon-schema.sql` (authoritative full schema, 20KB)
