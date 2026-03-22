# Agent Guidelines — F3 Marietta

> Subagent-specific instructions. Every agent dispatched in this project inherits these guidelines in addition to the project CLAUDE.md.

---

## All Agents

### Stack & Constraints
- **Next.js 16** (App Router, Turbopack), **React 19**, **TypeScript**, **Tailwind CSS 4**
- **Database:** Neon (serverless Postgres, free tier) via `@neondatabase/serverless`
- **Auth:** Better Auth (open source, sessions stored in Neon) with email/password
- **AI:** OpenAI `gpt-4o-mini` for the public assistant; Anthropic Claude `claude-sonnet-4-20250514` for automation (Instagram captions, newsletters)
- **Slack:** `@slack/web-api` for backblast ingestion and user sync
- **Email:** Resend (contact form, newsletters)
- **Hosting:** Vercel with Vercel Blob for image storage
- **Path alias:** `@/*` maps to `src/` (e.g., `import { getSql } from '@/lib/db'`)

### Return Shapes / Patterns
- API route handlers return `NextResponse.json()` with consistent shapes
- Database access via `getSql()` — lazy-initialized Neon tagged-template function
- Admin routes validate session via `validateAdminToken(request)` which returns `null` (success) or `NextResponse` (error)
- Slack events handler returns 200 immediately and processes inline (Vercel serverless constraint)

### Do NOT
- Add new npm dependencies without confirming with Jordan
- Import `@/lib/db` in client components — it is server-only
- Use Supabase client code — the project has fully migrated to Neon + Better Auth
- Overwrite `.env.local` — it contains secrets that cannot be recovered
- Push to `main` without going through a feature/fix branch first
- Modify data in production Neon database without explicit approval

### Design System
- Theme: Dark navy (`#050914` background, `#F9FAFB` foreground)
- Primary accent: `#4A76A8` (light blue), Secondary: `#1E3A5F` (steel blue)
- Surface/muted: `#0A1A2F` (navy), Border: `#23334A`
- Typography: Inter (body, `--font-inter`), Oswald (headings, `--font-oswald`)
- Icons: Lucide React only
- Class utility: `cn()` from `@/lib/utils` (clsx + tailwind-merge)
- Always dark mode — no light/dark toggle, single theme enforced globally

---

## Code Review Agent

When reviewing code in this project:

### Test Requirements
- Playwright E2E tests must pass (`npm run test:e2e`) before merging to `main`
- Tests cover: navigation, accessibility, glossary, backblasts, AMA widget, admin workouts
- No unit test framework — only Playwright E2E tests exist
- Flag any API route that handles Slack events without signature verification

### Architecture Checks
- Admin API routes must call `validateAdminToken(request)` for auth
- Slack event handler must verify signature via `verifySlackSignature()`
- All database queries must use `getSql()` — never raw connection strings
- Cron routes must validate `CRON_SECRET` bearer token
- Slack webhook must return 200 quickly to avoid retries (process inline, not async)

### Known Tech Debt to Flag
- `@supabase/supabase-js` still in devDependencies (unused, leftover from migration)
- CI workflow still references `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` secrets
- README.md references Supabase setup (outdated — project uses Neon now)
- `f3-automation/` directory is a legacy standalone project consolidated into admin dashboard

### Performance-Sensitive Areas
- AI assistant route (`/api/assistant`) — rate limited (10 req/min), OpenAI API call + glossary search
- Slack events route (`/api/slack/events`) — must respond < 3 seconds to avoid Slack retries
- Backblasts page — server-rendered, paginated, queries Neon directly

---

## Test Writing Agent

### Framework & Location
- **E2E tests:** Playwright 1.57 in `tests/` — file naming: `[feature].spec.ts`
- **No unit test framework** — no Vitest, no Jest. All testing is Playwright E2E.
- **Config:** `playwright.config.ts` — 5 projects (Chromium, Firefox, WebKit, Mobile Chrome, Mobile Safari)

### Mock Strategy
- Tests run against localhost:3000 with dev server auto-started by Playwright
- `.env.local` is loaded via dotenv in playwright.config.ts
- Tests use `PLAYWRIGHT_TEST_BASE_URL` env var if set
- No database mocking — tests hit the real Neon database
- For API-dependent tests (AI assistant, Slack), use page-level interception or mock at the network layer

### What to Test
- Page navigation and content rendering
- Accessibility landmarks, headings, links, keyboard navigation
- AMA widget open/close, input, glossary term lookup
- Backblasts list pagination and detail view
- Admin dashboard navigation and CRUD flows (workout management, regions)
- Responsive behavior (mobile + desktop viewports)

### What NOT to Test
- Third-party API integrations directly (OpenAI, Slack, Anthropic)
- Cron job execution (tested via manual API calls)
- Database migration correctness (verified at migration time)
- Static content accuracy (managed via markdown files)

### Current Test Health
- **8 test files** covering accessibility, admin-workouts, AMA widget, backblasts, glossary, homepage, navigation, pages
- Tests configured for 5 browser projects (3 desktop, 2 mobile)
- CI runs Chromium only for speed

---

## Architecture / Planning Agent

### Business Constraints That Shape Technical Decisions
- **F3 is a free, volunteer-run organization.** No budget for paid services beyond free tiers. Neon free tier, Vercel Hobby, OpenAI API costs kept minimal.
- **Jordan Lawson is the sole developer and an active F3 Marietta leader.** Admin tools are used by Jordan primarily. Public site is for the F3 Marietta community.
- **Content is community-driven.** Backblasts come from Slack automatically. Glossary terms come from F3 Nation's Lexicon/Exicon. Knowledge base is markdown files curated by Jordan.
- **The site represents a real community.** Accuracy of workout schedules, AO locations, and event data is critical — PAX rely on this information to show up.

### Explicit Scope Boundaries
- Do NOT plan for multi-region support (other F3 regions have their own sites)
- Do NOT plan for user accounts for PAX (only admin accounts exist)
- Do NOT plan for monetization or e-commerce
- Do NOT plan for mobile app — responsive web is sufficient
- If a feature could "prepare" for these, stop and ask Jordan first

### Performance / Scale Requirements
- Current traffic: low (community site for a local F3 region, ~50-100 active PAX)
- In-memory rate limiting is adequate — no Redis needed
- Serverless functions on Vercel Hobby plan
- Neon free tier database — no enterprise features assumed
- Vercel crons limited to daily minimum on Hobby plan

---

## Frontend / UI Agent

### Design Tokens
| Token | Value |
|-------|-------|
| `--background` | `#050914` (dark navy) |
| `--foreground` | `#F9FAFB` (off-white) |
| `--primary` | `#4A76A8` (light blue) |
| `--secondary` | `#1E3A5F` (steel blue) |
| `--muted` | `#0A1A2F` (navy surface) |
| `--muted-foreground` | `#9CA3AF` (gray-400) |
| `--border` | `#23334A` (subtle lines) |

### Typography
- Headings: `font-heading` (Oswald, sans-serif, uppercase)
- Body: `font-sans` (Inter, sans-serif)
- No serif fonts in this project

### Component Patterns
- **Hero sections:** Full-width background image with title, subtitle, CTA
- **Cards:** `bg-card` background, `border-border` borders, rounded corners
- **Buttons:** `Button` component with variants (default, outline), `asChild` prop for link buttons
- **Sections:** `Section` wrapper component for consistent padding/max-width
- **Admin layout:** Sidebar navigation with authenticated layout wrapper
- **Floating assistant:** Fixed-position FAB that opens slide-up panel
- **Icons:** Lucide React — consistent `h-4 w-4` for nav, `h-16 w-16` for feature icons

### Responsive Breakpoints
- Mobile-first: single column, stacked cards
- `md` (768px): multi-column grids, side-by-side layouts
- Admin sidebar: fixed 56-width, main content fills remainder
- Mobile viewports tested via Playwright (Pixel 5, iPhone 12)

### Accessibility
- All images must have `alt` text (enforced via Playwright tests)
- Pages must have proper landmark regions (main, header, footer)
- Heading hierarchy must start with h1 and be sequential
- Links and CTAs must have accessible names
- Keyboard navigation must reach main content

---

## API / Backend Agent

### API Route Patterns
```typescript
// Admin route pattern — all admin endpoints follow this
export async function GET(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const sql = getSql();
  const rows = await sql`SELECT ...`;
  return NextResponse.json(rows);
}
```

### Webhook Handling (Slack)
- Verify Slack signature via HMAC before processing any event
- Parse raw body for signature verification, then JSON parse for payload
- Return 200 immediately — process inline (Vercel serverless time limit)
- Handle: `url_verification`, `message` (new), `message_changed` (edit), `message_deleted` (soft delete)
- Filter: skip thread replies, non-allowlisted channels, non-F3-bot messages

### Rate Limiting
- Use `@/lib/security/rateLimiter.ts` (in-memory sliding window with periodic cleanup)
- AI assistant: 10 req/min per IP
- Add rate limiting to any new public-facing endpoint

### Cron Jobs
- Located in `app/api/cron/` — authenticated via `CRON_SECRET` bearer token
- `generate-drafts`: Creates Instagram caption drafts from new backblasts using Claude
- `generate-newsletter`: Creates weekly newsletter drafts from recent events using Claude
- Vercel cron schedules defined in `vercel.json`:
  - `/api/slack/reconcile` — daily at 7 AM UTC
  - `/api/slack/sync-users` — daily at 6 AM UTC

### Input Sanitization
- `@/lib/security/sanitize.ts` — HTML sanitization for user-submitted content
- Query normalization in assistant route — smart quotes, special whitespace, zero-width characters

---

## Database / Schema Agent

### Conventions
- IDs: `UUID PRIMARY KEY DEFAULT gen_random_uuid()` (via pgcrypto extension)
- Timestamps: `TIMESTAMPTZ DEFAULT now()` for `created_at`, auto-updated `updated_at` via trigger
- Soft deletes: `is_deleted BOOLEAN DEFAULT false` on `f3_events`
- Status fields: `TEXT` with allowed values (e.g., `'pending' | 'approved' | 'posted' | 'rejected' | 'edited'`)
- Migration naming: `YYYYMMDD_description.sql` in `supabase/migrations/`
- JSON columns: `JSONB` for Slack payloads (`content_json`, `raw_envelope_json`, `block_json`)
- Composite unique constraints: `UNIQUE(slack_channel_id, slack_message_ts)` for idempotent upserts

### Key Tables
- `f3_events` — canonical event storage (backblasts + preblasts), upserted from Slack
- `slack_users` — cached Slack profiles for name resolution
- `ao_channels` — Slack channel-to-AO name mapping with `is_enabled` flag
- `workout_schedule` — recurring workout schedules with FK to `regions`
- `regions` — region definitions (Marietta + future sub-regions)
- `instagram_drafts` — AI-generated Instagram captions pending approval
- `newsletters` — AI-generated weekly newsletters pending approval
- `agent_runs` — audit log for automation cron runs

### Migration Safety
- NEVER edit a migration after it has been applied to Neon
- Combined schema lives in `scripts/neon-schema.sql` — authoritative source for full schema
- Test schema changes locally before applying to production Neon
- Destructive operations (DROP, ALTER TYPE, column removal) require Jordan's explicit approval
- Extensions used: `pgcrypto` (UUIDs), `pg_trgm` (trigram text search)
