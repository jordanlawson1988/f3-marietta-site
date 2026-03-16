# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

F3 Marietta Automation — a content automation pipeline for the F3 Marietta fitness community. This app generates social media drafts (Instagram captions) from backblast data, compiles weekly newsletters, and provides a human-in-the-loop dashboard for reviewing and publishing content.

This is a **separate app** from f3marietta.com but shares the same Supabase database.

## Tech Stack

- **Framework:** Next.js 16 (App Router, TypeScript)
- **Styling:** Tailwind CSS v4 (CSS-only config, no tailwind.config)
- **Database:** Supabase (shared with f3marietta.com)
- **AI:** Anthropic SDK (Claude Sonnet 4.6) for content generation
- **Social Publishing:** Buffer API for Instagram
- **Messaging:** Slack Web API for newsletter delivery
- **Hosting:** Vercel (separate deployment from f3marietta.com)

## Key Decisions

- **Human-in-the-loop:** All AI-generated content requires human approval before publishing
- **Shared Supabase:** Uses the same database instance as f3marietta.com; new tables are additive
- **Buffer for Instagram:** Buffer handles Instagram publishing via their API
- **Simple token auth:** Admin access uses a shared token (no user accounts)
- **Manual image upload:** Images are uploaded manually by the admin, not auto-generated

## F3 Terminology

- **PAX** — participants at a workout
- **Q** — the leader/instructor of a workout
- **AO** — Area of Operations (workout location)
- **FNG** — Friendly New Guy (first-time participant)
- **BD** — Beat Down (a workout)
- **COT** — Circle of Trust (closing circle)
- **EH** — Emotional Headlock (recruiting someone to come)
- **HC** — Hard Commit (committed to attend)
- **Backblast** — Post-workout summary report

## Commands

```bash
npm run dev              # Start development server (localhost:3000)
npm run build            # Production build
npm run start            # Start production server
npm run lint             # Run ESLint
```

## Source Structure

- `src/app/` — App Router pages and API routes
- `src/lib/` — Shared utilities (supabase client, anthropic client, etc.)
- `src/types/` — TypeScript type definitions

## Path Alias

Use `@/*` for imports from `src/` (e.g., `import { supabase } from '@/lib/supabase'`).

## Design Spec

Full design specification: `docs/superpowers/specs/2026-03-14-f3-automation-design.md`
