# Newsletter Enhancement — Design Spec

## Overview

Enhance the F3 Automation newsletter pipeline to produce shorter, more actionable newsletters with a consistent structure: monthly theme, concise recap, FNG spotlight, F2/F3 event callouts, and a closing CTA.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Theme storage | `newsletter_themes` table | One row per month, queried by month/year during generation |
| F2/F3 events | `community_events` table + dashboard CRUD | Manual entry — no external calendar integration needed |
| FNG tracking | `newsletter_fngs` table tied to newsletter | Jordan generates first, adds FNGs, then optionally regenerates or edits manually |
| Q schedule | Deferred | No Q signup system exists yet; will be added in a future iteration |
| Theme in output | Prepended as static block, not AI-generated | Ensures consistency — Claude generates sections 2-6 only |
| Newsletter trigger | Manual "Generate" button + existing cron | Dashboard button calls a dedicated session-auth route (`/api/newsletter/generate`) that shares logic with the cron |

---

## Database Schema

Three new tables. No changes to existing tables.

### Migration SQL

```sql
-- 002_newsletter_enhancements.sql

-- Monthly themes for newsletters
CREATE TABLE newsletter_themes (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  month      INTEGER NOT NULL CHECK (month >= 1 AND month <= 12),
  year       INTEGER NOT NULL CHECK (year >= 2024),
  title      TEXT NOT NULL,
  url        TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(month, year)
);

-- Community events (F2 fellowship + F3 service)
CREATE TABLE community_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type  TEXT NOT NULL CHECK (event_type IN ('f2', 'f3')),
  title       TEXT NOT NULL,
  description TEXT,
  event_date  DATE NOT NULL,
  location    TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_community_events_date_type ON community_events (event_date, event_type);

-- FNG callouts per newsletter
CREATE TABLE newsletter_fngs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  newsletter_id UUID NOT NULL REFERENCES newsletters(id) ON DELETE CASCADE,
  fng_name      TEXT NOT NULL,
  ao_name       TEXT,
  brought_by    TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

---

## API Routes

New routes added under the existing API structure:

```
/api/
├── themes/
│   └── route.ts              # GET current month's theme, PUT to set/update
├── events/
│   ├── route.ts              # GET list (filterable by type, date range), POST create
│   └── [id]/
│       └── route.ts          # PATCH update, DELETE remove
└── newsletter/
    ├── generate/
    │   └── route.ts          # POST: session-auth trigger for newsletter generation
    └── [id]/
        └── fngs/
            └── route.ts      # GET list, POST add, DELETE remove by fng id
```

All routes require valid session cookie (same auth as existing routes).

### Theme API

- `GET /api/themes` — returns theme for current month (or specified `?month=3&year=2026`)
- `PUT /api/themes` — upsert theme for a given month/year: `{ month, year, title, url? }`

### Events API

- `GET /api/events` — list events, filterable: `?type=f2`, `?from=2026-03-17&to=2026-03-23`
- `POST /api/events` — create event: `{ event_type, title, description?, event_date, location? }`
- `PATCH /api/events/[id]` — update event fields
- `DELETE /api/events/[id]` — delete event

### Generate API

- `POST /api/newsletter/generate` — session-auth endpoint for manually triggering newsletter generation from the dashboard. Accepts optional `{ week_start, week_end }` body (defaults to current week calculation). Shares the same generation logic as the cron endpoint but uses `verifySession()` instead of `verifyCronSecret()`. The shared logic is extracted into a `lib/newsletter-generator.ts` function.

### FNG API

- `GET /api/newsletter/[id]/fngs` — list FNGs for a newsletter
- `POST /api/newsletter/[id]/fngs` — add FNG: `{ fng_name, ao_name?, brought_by? }`
- `DELETE /api/newsletter/[id]/fngs?fng_id=xxx` — remove FNG

---

## Newsletter Generation Changes

### Updated Data Flow

The `generate-newsletter` cron/endpoint will:

1. Query current month's **theme** from `newsletter_themes`
2. Query **backblasts** from `f3_events` for the target week (using `created_at`)
3. Query **upcoming F2 events** from `community_events` where `event_type = 'f2'` and `event_date` falls in the coming week (Mon-Sun after the newsletter week)
4. Query **upcoming F3 events** — same as above with `event_type = 'f3'`
5. Pass all data to Claude with the updated prompt
6. **Prepend the theme block** to the generated output (not AI-generated)
7. Insert into `newsletters` table

**FNG workflow:** Generate the newsletter first (FNG section will say "None this week"). Then add FNGs in the dashboard. Then either (a) edit the newsletter body manually to include them, or (b) click "Regenerate" to re-run Claude with the FNG data included. FNGs require a newsletter row to exist (FK constraint).

### Updated Prompt Structure

The system prompt instructs Claude to generate a newsletter with these sections:

1. **Week Recap** — one concise paragraph/section covering all AOs. Mention Qs, notable headcounts, weather/conditions if relevant. Keep it short.
2. **FNG Spotlight** — if FNG data is provided, celebrate new men. If none, omit this section entirely.
3. **Upcoming F2 Events** — list fellowship events for the coming week. If none provided, output "None for the week."
4. **Upcoming F3 Events** — list service events for the coming week. If none provided, output "None for the week."
5. **Closing** — short, punchy CTA encouraging men to post next week.

The theme is NOT part of the Claude output. It's prepended as a formatted block after generation:

```
:dart: *March Theme: [Title]*
[URL if provided]

---
```

### User Prompt Data

The user prompt fed to Claude will include:

```
Week: 2026-03-10 through 2026-03-16
Total events: 3

Backblasts:
- 2026-03-10 | The Battlefield | Q: Riggs | 3 PAX
  Summary: [excerpt]
- 2026-03-11 | Black Ops | Q: Riggs | 3 PAX
  Summary: [excerpt]
...

FNGs this week:
- [name] at [AO], brought by [PAX]
(or "None this week")

Upcoming F2 Events (week of 2026-03-17):
- 2026-03-19 | Coffee at Tin Lizzy's | Marietta Square
(or "None scheduled")

Upcoming F3 Events (week of 2026-03-17):
- 2026-03-22 | Park Cleanup | Kennesaw Mountain
(or "None scheduled")
```

---

## Dashboard Changes

### Newsletter Page (`/dashboard/newsletter`)

Add three new sections above the existing editor:

**1. Theme Manager (top of page)**
- Shows current month's theme: title + URL
- Inline edit: click to change title/URL
- If no theme set: shows "Set March 2026 Theme" form with title input + optional URL
- Small, minimal — not a separate page

**2. FNG Entry (above editor, below theme)**
- Only visible when a draft newsletter exists
- List of FNGs added for this newsletter (name, AO, brought by)
- "Add FNG" button opens inline row with inputs
- Delete button per FNG
- Note: FNGs are reference data for Jordan when editing — they're also passed to Claude if regenerating

**3. Generate Button**
- "Generate Newsletter" button (next to the existing empty state)
- Calls the cron endpoint with auth and current week range
- Shows loading state, then refreshes to show the new draft

### New Events Page (`/dashboard/events`)

New nav item in the dashboard layout.

- Table of upcoming events sorted by date
- Type badge (F2 = blue, F3 = green)
- Add event form: type dropdown, title, date, location (optional), description (optional)
- Edit inline or via modal
- Delete with confirmation
- Filter by type (All / F2 / F3)
- Past events shown in a collapsed "Past Events" section

---

## Updated Types

```typescript
// Add to src/types/index.ts

export interface NewsletterTheme {
  id: string;
  month: number;
  year: number;
  title: string;
  url: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommunityEvent {
  id: string;
  event_type: 'f2' | 'f3';
  title: string;
  description: string | null;
  event_date: string;
  location: string | null;
  created_at: string;
  updated_at: string;
}

export interface NewsletterFng {
  id: string;
  newsletter_id: string;
  fng_name: string;
  ao_name: string | null;
  brought_by: string | null;
  created_at: string;
}
```

---

## File Changes Summary

### New Files
- `supabase/migrations/002_newsletter_enhancements.sql`
- `src/app/api/themes/route.ts`
- `src/app/api/events/route.ts`
- `src/app/api/events/[id]/route.ts`
- `src/app/api/newsletter/generate/route.ts`
- `src/app/api/newsletter/[id]/fngs/route.ts`
- `src/lib/newsletter-generator.ts` — shared generation logic (extracted from cron route)
- `src/app/dashboard/events/page.tsx`

### Modified Files
- `src/types/index.ts` — add 3 new interfaces
- `src/lib/prompts/newsletter.ts` — rewrite prompt and buildUserPrompt
- `src/app/api/cron/generate-newsletter/route.ts` — fetch theme, F2/F3 events, prepend theme block
- `src/app/dashboard/newsletter/page.tsx` — add theme manager, FNG entry, generate button
- `src/app/dashboard/layout.tsx` — add "Events" nav link

---

## What's NOT in Scope

- Q schedule / signup system (deferred to future iteration)
- Auto-detection of FNGs from backblast text
- Google Calendar integration for events
- Notification system (ntfy.sh, email, etc.)
