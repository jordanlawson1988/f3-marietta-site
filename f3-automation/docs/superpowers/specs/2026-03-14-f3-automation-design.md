# F3 Marietta Automation Agent — Design Spec

## Overview

An automated content pipeline for F3 Marietta that detects new backblasts from the shared Supabase database, generates Instagram captions and weekly Slack newsletters using Claude Sonnet 4.6, and provides a human-in-the-loop approval dashboard before publishing.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Deployment | Separate Next.js app (own Vercel project) | Clean separation from the public f3marietta.com site |
| Data source | Shared Supabase — query `f3_events` directly | Backblasts already flow from Slack into this table; scraping the website would be circular |
| AI model | Claude Sonnet 4.6 (`claude-sonnet-4-6`) | Best balance of quality and cost for caption/newsletter generation |
| Instagram publishing | Buffer API | No Facebook Business Page exists; Buffer has simpler auth and no Meta app review |
| Dashboard auth | Simple token auth (single user) | Only Jordan reviews/approves; Supabase Auth would be overkill |
| Notifications | None (dashboard-only) | Jordan checks the dashboard directly; ntfy.sh can be added later |
| Pipeline trigger | Vercel cron (daily + weekly) | Stateless, predictable, easy to debug; real-time not needed since review is manual |

---

## Architecture

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Vercel Cron     │────▶│  Query f3_events  │────▶│  Claude API  │
│  (daily noon ET) │     │  (shared Supabase)│     │  (Sonnet 4.6)│
└─────────────────┘     └──────────────────┘     └──────┬───────┘
                                                        │
                                                        ▼
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│  Buffer API     │◀────│  Approval        │◀────│  instagram_  │
│  (Instagram)    │     │  Dashboard       │     │  drafts table│
└─────────────────┘     └──────────────────┘     └──────────────┘

┌─────────────────┐     ┌──────────────────┐
│  Slack API      │◀────│  newsletters     │
│  (weekly post)  │     │  table           │
└─────────────────┘     └──────────────────┘
```

### Daily Flow (noon ET)

1. Cron triggers `/api/cron/generate-drafts`
2. Query `f3_events` for backblasts not yet in `instagram_drafts` (left join, null check)
3. For each new backblast: call Claude Sonnet 4.6 to generate caption + story text
4. Insert into `instagram_drafts` with status `pending`
5. Log run to `agent_runs`

### Weekly Flow (Saturday 8 AM ET)

1. Cron triggers `/api/cron/generate-newsletter`
2. Query `f3_events` for the past 7 days
3. Call Claude to generate Slack-formatted newsletter
4. Insert into `newsletters` with status `draft`
5. Log run to `agent_runs`

### Approval Flow (manual)

1. Jordan opens `/dashboard`, sees pending drafts
2. Edit caption/hashtags if needed, then Approve or Reject
3. Approved posts publish to Buffer (Instagram)
4. Approved newsletter posts to Slack via `chat.postMessage`

---

## Database Schema

Three new tables added to the shared Supabase project. No changes to existing tables.

### instagram_drafts

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| event_id | UUID FK -> f3_events(id) | Links to existing backblast |
| caption | TEXT NOT NULL | Generated Instagram caption |
| story_text | TEXT | Shorter text for Story |
| hashtags | TEXT[] | |
| alt_text | TEXT | Image accessibility text |
| image_url | TEXT | From f3_events or Supabase Storage |
| status | TEXT | pending, approved, posted, rejected, edited |
| post_type | TEXT | feed, story |
| buffer_post_id | TEXT | ID from Buffer after publishing |
| approved_at | TIMESTAMPTZ | |
| posted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |
| updated_at | TIMESTAMPTZ | |

Constraints: `UNIQUE(event_id, post_type)` — one feed + one story per backblast.

### newsletters

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| week_start | DATE NOT NULL | |
| week_end | DATE NOT NULL | |
| title | TEXT | |
| body_markdown | TEXT | |
| body_slack_mrkdwn | TEXT | Slack-formatted version |
| status | TEXT | draft, approved, posted |
| slack_message_ts | TEXT | After posting to Slack |
| approved_at | TIMESTAMPTZ | |
| posted_at | TIMESTAMPTZ | |
| created_at | TIMESTAMPTZ | |

Constraints: `UNIQUE(week_start)` — one newsletter per week.

### agent_runs

| Column | Type | Notes |
|--------|------|-------|
| id | UUID PK | |
| run_type | TEXT | generate_drafts, generate_newsletter, post_instagram, post_newsletter |
| status | TEXT | success, failure, partial |
| details | JSONB | Counts, IDs processed, etc. |
| error_message | TEXT | |
| started_at | TIMESTAMPTZ | |
| completed_at | TIMESTAMPTZ | |

---

## API Routes

```
/api/
├── cron/
│   ├── generate-drafts/route.ts        # Daily noon ET
│   └── generate-newsletter/route.ts    # Saturday 8 AM ET
├── drafts/
│   ├── route.ts                        # GET: list drafts (filterable by status)
│   └── [id]/
│       ├── route.ts                    # PATCH: edit caption/hashtags/story_text
│       ├── approve/route.ts            # POST: approve -> publish to Buffer
│       ├── reject/route.ts             # POST: mark rejected
│       └── regenerate/route.ts         # POST: re-call Claude for new caption
├── newsletter/
│   ├── route.ts                        # GET: list newsletters
│   └── [id]/
│       ├── route.ts                    # PATCH: edit newsletter body
│       └── approve/route.ts            # POST: approve -> post to Slack
├── auth/
│   └── route.ts                        # POST: simple token auth
└── buffer/
    └── publish/route.ts                # POST: push approved draft to Buffer
```

### Security

- Cron routes verify Vercel's `CRON_SECRET` header
- All `/api/drafts/*` and `/api/newsletter/*` routes require admin token

---

## Dashboard Pages

### `/dashboard` — Pending Drafts

Card layout showing each pending draft:
- Backblast AO name, date, Q name, PAX count
- Editable caption textarea with character count (Instagram limit: 2,200)
- Editable hashtags as tag chips
- Story text preview
- Image preview if available
- Buttons: Approve & Post, Reject, Regenerate Caption
- Empty state when no pending drafts

### `/dashboard/history` — Post History

- Table/list of all drafts with status badge (posted, rejected, edited)
- Filter by status, date range
- Posted items show Buffer post ID / timestamp

### `/dashboard/newsletter` — Newsletter Review

- Preview of Slack-formatted newsletter (rendered mrkdwn)
- Editable textarea for raw Slack mrkdwn
- Side-by-side: edit left, preview right
- Approve & Post to Slack button
- History of past newsletters below

### Styling

Tailwind CSS v4. Minimal and functional. Dark/neutral palette.

---

## Content Generation

### Instagram Caption

**System prompt context:** Authentic, encouraging, community-focused tone. Not cheesy. F3 lexicon reference included (PAX, Q, AO, FNG, BD, COT, EH).

**Input:** AO name, Q name, PAX count, event date, content text from `f3_events`.

**Output (structured JSON):**
- `caption` — Instagram caption with natural hashtag placement
- `story_text` — 1-2 punchy lines for text overlay
- `hashtags[]` — suggested hashtags
- `alt_text` — image accessibility text

### Newsletter

**System prompt context:** Brotherhood, accountability, encouragement tone. Slack mrkdwn formatting.

**Input:** All `f3_events` from the past 7 days grouped by AO.

**Output structure:**
- Opening line (motivational, tied to the week)
- AO-by-AO recap (Q name, headcount, 1-2 sentences)
- Shout-outs (FNGs, milestones)
- Look-ahead
- Closing call to action

### Regeneration

Re-calls Claude with the same backblast data plus previous caption (to avoid repetition) and an instruction to produce a different variation.

---

## External Integrations

### Buffer API

- Auth: OAuth2 access token (env var)
- Publish: `POST https://api.bufferapp.com/1/updates/create.json`
  - `profile_ids[]` — Instagram profile
  - `text` — caption
  - `media[photo]` — image URL
- On success: store `update_id` in `instagram_drafts.buffer_post_id`
- Story support via `subprofile_id`

### Slack API

- Reuses `SLACK_BOT_TOKEN` from main app
- `chat.postMessage` to newsletter channel
- Store `message_ts` in `newsletters.slack_message_ts`
- `unfurl_links: false`

---

## Environment Variables

```env
# Shared Supabase (same project as f3-marietta)
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# Buffer
BUFFER_ACCESS_TOKEN=
BUFFER_PROFILE_ID=

# Slack
SLACK_BOT_TOKEN=
SLACK_NEWSLETTER_CHANNEL_ID=

# Cron security
CRON_SECRET=

# Admin auth
ADMIN_TOKEN=
```

---

## Project Structure

```
f3-automation/
├── CLAUDE.md
├── vercel.json
├── package.json
├── .env.local
├── src/
│   ├── app/
│   │   ├── page.tsx
│   │   ├── layout.tsx
│   │   ├── dashboard/
│   │   │   ├── page.tsx
│   │   │   ├── history/page.tsx
│   │   │   └── newsletter/page.tsx
│   │   └── api/
│   │       ├── auth/route.ts
│   │       ├── cron/
│   │       │   ├── generate-drafts/route.ts
│   │       │   └── generate-newsletter/route.ts
│   │       ├── drafts/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       ├── approve/route.ts
│   │       │       ├── reject/route.ts
│   │       │       └── regenerate/route.ts
│   │       ├── newsletter/
│   │       │   ├── route.ts
│   │       │   └── [id]/
│   │       │       ├── route.ts
│   │       │       └── approve/route.ts
│   │       └── buffer/
│   │           └── publish/route.ts
│   ├── lib/
│   │   ├── supabase.ts
│   │   ├── claude.ts
│   │   ├── buffer.ts
│   │   ├── slack.ts
│   │   ├── auth.ts
│   │   └── prompts/
│   │       ├── instagram-caption.ts
│   │       └── newsletter.ts
│   ├── components/
│   │   ├── DraftCard.tsx
│   │   ├── CaptionEditor.tsx
│   │   ├── NewsletterPreview.tsx
│   │   ├── StatusBadge.tsx
│   │   └── AuthGate.tsx
│   └── types/
│       └── index.ts
└── supabase/
    └── migrations/
        └── 001_automation_tables.sql
```

---

## Cost Estimate (Monthly)

| Service | Tier | Est. Cost |
|---------|------|-----------|
| Vercel | Hobby/Pro | $0-20 |
| Supabase | Free tier (shared) | $0 |
| Claude API (Sonnet 4.6) | Pay-per-use | ~$1-3 |
| Buffer | Free tier | $0 |
| Slack API | Free | $0 |
| **Total** | | **~$1-23** |
