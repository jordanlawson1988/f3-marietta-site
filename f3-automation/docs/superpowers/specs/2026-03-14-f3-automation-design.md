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
| Images | Manual upload in dashboard | `f3_events` has no image data; Jordan uploads a photo before approving each draft |

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
└─────────────────┘     │  (image upload)  │     └──────────────┘
                        └──────────────────┘
                               │
┌─────────────────┐     ┌──────┴───────────┐
│  Slack API      │◀────│  newsletters     │
│  (weekly post)  │     │  table           │
└─────────────────┘     └──────────────────┘
```

### Daily Flow (noon ET)

1. Cron triggers `/api/cron/generate-drafts`
2. Query `f3_events` for backblasts not yet in `instagram_drafts` (left join, null check)
3. For each new backblast: call Claude Sonnet 4.6 to generate caption + story text
4. Insert into `instagram_drafts` with status `pending` (no image yet)
5. Log run to `agent_runs`

### Weekly Flow (Saturday 8 AM ET)

1. Cron triggers `/api/cron/generate-newsletter`
2. Query `f3_events` for the most recent completed week (Monday through Sunday, ending the Sunday before the cron runs)
3. Call Claude to generate Slack-formatted newsletter
4. Insert into `newsletters` with status `draft`
5. Log run to `agent_runs`

### Approval Flow (manual)

1. Jordan opens `/dashboard`, sees pending drafts
2. Upload an image for each draft (required before approval)
3. Edit caption/hashtags if needed, then Approve or Reject
4. On approve: image is uploaded to Supabase Storage, public URL is sent to Buffer, draft status becomes `posted`
5. On newsletter approve: posts to Slack via `chat.postMessage`
6. All publish actions are logged to `agent_runs`

### Image Flow

`f3_events` contains no image data (backblasts come from Slack text). Images are handled manually:

1. Jordan uploads an image in the dashboard draft card (file input)
2. Image is uploaded to Supabase Storage bucket `f3-media` at path `instagram/{draft_id}.{ext}`
3. `image_storage_path` and `image_url` (public URL) are saved to the draft
4. Approval is blocked until an image is attached
5. Buffer receives the public Supabase Storage URL for `media[photo]`

---

## Database Schema

Three new tables added to the shared Supabase project. No changes to existing tables.

### Migration SQL

```sql
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
```

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
│       ├── approve/route.ts            # POST: upload image, approve, publish to Buffer
│       ├── reject/route.ts             # POST: mark rejected
│       └── regenerate/route.ts         # POST: re-call Claude for new caption
├── newsletter/
│   ├── route.ts                        # GET: list newsletters
│   └── [id]/
│       ├── route.ts                    # PATCH: edit newsletter body
│       └── approve/route.ts            # POST: approve -> post to Slack
└── auth/
    └── route.ts                        # POST: validate token, set session cookie
```

The approve routes handle publishing internally (calling `lib/buffer.ts` or `lib/slack.ts`) — no separate publish endpoint needed.

### Security

- Cron routes verify Vercel's `CRON_SECRET` header to prevent unauthorized triggers
- All `/api/drafts/*` and `/api/newsletter/*` routes require a valid session cookie (set by `/api/auth`)

### Authentication Flow

1. Jordan visits the dashboard and sees a login form (rendered by `AuthGate` component)
2. Submits the admin token via the login form
3. `POST /api/auth` validates the token against `ADMIN_TOKEN` env var
4. On success, sets an httpOnly secure cookie (`f3-auto-session`) with a signed value
5. All protected API routes call `lib/auth.ts` to verify the cookie
6. `AuthGate` wraps the dashboard layout — if no valid cookie, shows the login form instead of dashboard content

### Error Handling

- If Claude API returns an error or rate-limits during draft generation, that draft is skipped and the cron run is logged as `partial` in `agent_runs` with the error in `details`
- Skipped drafts will be picked up on the next cron run (they still won't have an `instagram_drafts` row)
- If Buffer publish fails, the draft stays in `approved` status (not `posted`), the error is logged to `agent_runs`, and the dashboard shows a "Retry Publish" option
- If Slack post fails, same pattern — newsletter stays `approved`, error logged, retry available

---

## Dashboard Pages

### `/` — Login / Redirect

If authenticated, redirects to `/dashboard`. If not, shows login form.

### `/dashboard` — Pending Drafts

Card layout showing each pending draft:
- Backblast AO name, date, Q name, PAX count
- **Image upload zone** — drag-and-drop or file picker (required before approval)
- Image preview after upload
- Editable caption textarea with character count (Instagram limit: 2,200)
- Editable hashtags as tag chips
- Story text preview (separate shorter version)
- Buttons: **Approve & Post** (disabled until image uploaded), **Reject**, **Regenerate Caption**
- Empty state when no pending drafts

### `/dashboard/history` — Post History

- Table/list of all drafts with status badge (posted, rejected, edited)
- Filter by status, date range
- Posted items show Buffer post ID / timestamp
- Failed publishes show "Retry Publish" button

### `/dashboard/newsletter` — Newsletter Review

- Preview of Slack-formatted newsletter (rendered mrkdwn)
- Editable textarea for raw Slack mrkdwn
- Side-by-side: edit left, preview right
- **Approve & Post to Slack** button
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
- `alt_text` — image accessibility text (generated generically since image is not yet uploaded at generation time)

### Newsletter

**System prompt context:** Brotherhood, accountability, encouragement tone. Slack mrkdwn formatting.

**Input:** All `f3_events` from the most recent completed week (Monday through Sunday), grouped by AO.

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

- Auth: OAuth2 access token (stored as env var)
- Publish feed post: `POST https://api.bufferapp.com/1/updates/create.json`
  - `profile_ids[]` — Instagram profile ID
  - `text` — approved caption
  - `media[photo]` — public Supabase Storage URL for the uploaded image
- On success: store `update_id` in `instagram_drafts.buffer_post_id`
- Note: Story publishing via Buffer may require a paid plan. Feed posts are the primary target; story support is a stretch goal.

### Slack API

- Reuses `SLACK_BOT_TOKEN` from main app
- `chat.postMessage` to newsletter channel
- Store `message_ts` in `newsletters.slack_message_ts`
- `unfurl_links: false`

### Supabase Storage

- Bucket: `f3-media` (create if not exists)
- Path pattern: `instagram/{draft_id}.{ext}`
- Public URL used for Buffer `media[photo]` and dashboard image preview

---

## Vercel Configuration

```json
{
  "crons": [
    {
      "path": "/api/cron/generate-drafts",
      "schedule": "0 16 * * *"
    },
    {
      "path": "/api/cron/generate-newsletter",
      "schedule": "0 12 * * 6"
    }
  ]
}
```

Schedules are in UTC:
- `0 16 * * *` = noon ET (EDT, UTC-4). During EST (Nov-Mar), this runs at 11 AM ET. Adjust seasonally or pick a fixed UTC time.
- `0 12 * * 6` = 8 AM ET on Saturdays (EDT). Same DST caveat.

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
│   │   ├── page.tsx                          # Login / redirect to dashboard
│   │   ├── layout.tsx                        # Root layout
│   │   ├── dashboard/
│   │   │   ├── layout.tsx                    # Dashboard layout (wraps AuthGate)
│   │   │   ├── page.tsx                      # Pending drafts
│   │   │   ├── history/page.tsx              # Post history
│   │   │   └── newsletter/page.tsx           # Newsletter review
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
│   │       └── newsletter/
│   │           ├── route.ts
│   │           └── [id]/
│   │               ├── route.ts
│   │               └── approve/route.ts
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
│   │   ├── ImageUpload.tsx
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
