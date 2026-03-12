# CLAUDE.md

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

Scripts in `scripts/` run with `npx tsx scripts/<name>.ts` (require SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars).

## Architecture

**Next.js 16 App Router** with TypeScript, Tailwind CSS v4, Supabase (PostgreSQL), and OpenAI.

### Source Structure

- `src/app/` - App Router pages and API routes
- `src/components/ui/` - Reusable UI components (AssistantWidget, GlossaryList, Hero, etc.)
- `src/components/layout/` - Global layout (Navbar, Footer)
- `src/lib/` - Utilities organized by domain:
  - `slack/` - Slack API client, message parsing, signature verification
  - `backblast/` - Backblast parsing and pagination queries
  - `search/` - Vector index rebuilding for AI assistant
- `src/types/` - TypeScript interfaces (F3Event, Backblast, etc.)
- `data/` - Static content (markdown files, f3Glossary.ts, f3Knowledge.ts)
- `supabase/migrations/` - SQL schema migrations (run manually in Supabase SQL Editor)

### Path Alias

Use `@/*` for imports from `src/` (e.g., `import { supabase } from '@/lib/supabase'`).

### Key Data Flow

1. **Backblasts**: Slack events → `/api/slack/events` → parsed and stored in `f3_events` table → displayed on `/backblasts`
2. **AI Assistant**: User question → `/api/assistant` → OpenAI with vector index context → streamed response

### Database Tables

- `f3_events` - Canonical event storage (backblasts and preblasts)
- `slack_users` - Cached Slack user profiles for name resolution
- `ao_channels` - Maps Slack channel IDs to AO display names

### Environment Variables

Required in `.env.local`:
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` - Database access
- `SLACK_BOT_TOKEN`, `SLACK_SIGNING_SECRET` - Slack integration
- `OPENAI_API_KEY` - AI assistant

## Testing

Playwright E2E tests in `tests/`. Tests run against localhost:3000 with automatic dev server startup. Tests cover navigation, accessibility, glossary, backblasts, and the AI assistant widget.

## Deployment

Deployed via Vercel. Push to `main` triggers automatic deployment. Use `feature/*`, `fix/*`, or `hotfix/*` branches for changes.
