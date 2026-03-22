# CLAUDE.md

@AGENTS.md
@.claude/context/test-health.md
@.claude/context/feature-status.md
@.claude/context/architecture-notes.md
@.claude/context/business-context.md

---

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start development server (localhost:3000)
npm run build            # Production build
npm run lint             # Run ESLint
npm run test:e2e         # Run Playwright tests (starts dev server automatically)
npm run test:e2e:ui      # Run Playwright tests with interactive UI
npx playwright test tests/backblasts.spec.ts  # Run a single test file
```

Scripts in `scripts/` run with `npx tsx scripts/<name>.ts` (require DATABASE_URL env var).

## Architecture (migrated 2026-03-19)

- **Database**: Neon (serverless Postgres, free tier)
- **Auth**: Better Auth (open source, sessions in Neon)
- **Hosting**: Vercel (Next.js App Router)
- **Previous stack**: Supabase (fully removed)

**Next.js 16 App Router** with TypeScript, Tailwind CSS v4, Neon (PostgreSQL), and OpenAI.

### Auth pattern

Better Auth handles sessions. API routes verify via:
```typescript
const session = await auth.api.getSession({ headers: request.headers });
```

Middleware uses lightweight cookie check (Edge Runtime compatible):
```typescript
const hasSession = request.cookies.has('better-auth.session_token');
```
Full session validation in API routes only (Node.js runtime).

### Source Structure

- `src/app/` - App Router pages and API routes
- `src/components/ui/` - Reusable UI components (AssistantWidget, GlossaryList, Hero, etc.)
- `src/components/layout/` - Global layout (Navbar, Footer)
- `src/lib/` - Utilities organized by domain:
  - `db.ts` - Neon database client (lazy-initialized `getSql()` helper)
  - `auth.ts` - Better Auth server config
  - `auth-client.ts` - Better Auth client helper
  - `slack/` - Slack API client, message parsing, signature verification
  - `backblast/` - Backblast parsing and pagination queries
  - `search/` - Vector index rebuilding for AI assistant
  - `admin/auth.ts` - Admin session validation via Better Auth
- `src/types/` - TypeScript interfaces (F3Event, Backblast, etc.)
- `data/` - Static content (markdown files, f3Glossary.ts, f3Knowledge.ts)

### Path Alias

Use `@/*` for imports from `src/` (e.g., `import { getSql } from '@/lib/db'`).

### Key Data Flow

1. **Backblasts**: Slack events → `/api/slack/events` → parsed and stored in `f3_events` table → displayed on `/backblasts`
2. **AI Assistant**: User question → `/api/assistant` → OpenAI with vector index context → streamed response

### Database Tables

- `f3_events` - Canonical event storage (backblasts and preblasts)
- `slack_users` - Cached Slack user profiles for name resolution
- `ao_channels` - Maps Slack channel IDs to AO display names
- `workout_schedule` - Recurring workout schedules
- `regions` - Region definitions
- `f3_event_attendees` - PAX attendees per event
- `f3_event_qs` - Q leaders per event
- `slack_message_blocks` - Slack Block Kit content
- `slack_block_elements` - Block elements

### Environment Variables

Required in `.env.local`:
- `DATABASE_URL` - Neon Postgres connection string
- `BETTER_AUTH_SECRET` - Better Auth session encryption
- `BETTER_AUTH_URL` - App base URL
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` - Slack integration
- `OPENAI_API_KEY` - AI assistant

## Testing

Playwright E2E tests in `tests/`. Tests run against localhost:3000 with automatic dev server startup. Tests cover navigation, accessibility, glossary, backblasts, and the AI assistant widget.

## Deployment

Deployed via Vercel. Push to `main` triggers automatic deployment. Use `feature/*`, `fix/*`, or `hotfix/*` branches for changes.

---

## Session Quickstart

> When starting a new Claude Code session, begin here:

1. This file auto-loads `AGENTS.md` and all `.claude/context/*.md` files via `@imports` above — review them for current project state.
2. Check `.claude/context/feature-status.md` for current features and data flows.
3. Review `.claude/context/architecture-notes.md` for tech debt and known footguns.
4. Run `/status-check` for a quick project dashboard, or `/project-health` for a comprehensive audit.
5. Run `/context-refresh` if context files are stale (check timestamps at the top of each).
6. Ask Jordan what to focus on in this session.

### Available Commands

| Command | Purpose |
|---------|---------|
| `/test-report` | Run Playwright E2E tests, update test-health.md, report regressions |
| `/status-check` | Quick dashboard: git state, build, lint, tests, context freshness |
| `/context-refresh` | Refresh all 4 context files with live project data |
| `/project-health` | Comprehensive audit: deps, lint, TODOs, migrations, tech debt |
| `/session-end` | Capture session work, suggest memory updates, output summary |
