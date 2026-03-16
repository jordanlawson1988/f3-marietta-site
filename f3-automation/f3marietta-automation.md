# F3 Marietta Automation Agent — Project Spec

## Overview

An automated agent that handles recurring F3 Marietta content operations: monitoring backblasts, generating Instagram posts/stories with human-in-the-loop approval, and producing a weekly newsletter posted to Slack.

---

## Architecture Summary

```
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Vercel Cron /   │────▶│  Backblast   │────▶│  Claude API  │
│  GitHub Actions  │     │  Scraper     │     │  (Sonnet)    │
└─────────────────┘     └──────────────┘     └──────┬───────┘
                                                     │
                                                     ▼
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│  ntfy.sh Push   │◀────│  Supabase    │◀────│  Draft       │
│  Notification   │     │  (Drafts DB) │     │  Generator   │
└─────────────────┘     └──────┬───────┘     └──────────────┘
                               │
                               ▼
┌─────────────────┐     ┌──────────────┐     ┌──────────────┐
│  Instagram API  │◀────│  Approval    │────▶│  Slack API   │
│  (or Buffer)    │     │  Dashboard   │     │  (Newsletter)│
└─────────────────┘     └──────────────┘     └──────────────┘
```

---

## Tech Stack

| Component            | Tool / Service                                      |
| -------------------- | --------------------------------------------------- |
| Framework            | Next.js (App Router, TypeScript)                    |
| Hosting              | Vercel                                              |
| Database             | Supabase (PostgreSQL + Auth + Storage)               |
| Scheduling           | Vercel Cron Jobs (`vercel.json`)                    |
| AI Copy Generation   | Claude API (claude-sonnet-4-20250514)                  |
| Backblast Source     | Web scrape `f3marietta.com/backblasts` + Slack API   |
| Instagram Publishing | Instagram Graph API (or Buffer API as fallback)      |
| Slack Publishing     | Slack Bot Token + `chat.postMessage`                 |
| Push Notifications   | ntfy.sh                                              |
| Image Storage        | Supabase Storage (bucket: `f3-media`)                |
| Dev Environment      | Claude Code + Antigravity IDE                        |

---

## Phase 1 — Backblast Scraper + Draft Pipeline

### Goal
Automatically detect new backblasts, generate Instagram-ready captions, store drafts in Supabase, and notify Jordan for review.

### 1.1 Backblast Scraper

**Primary Source:** `f3marietta.com/backblasts`
- Scrape the backblasts page for new entries (title, date, AO, Q, PAX list, content, image URL)
- Use `cheerio` or `jsdom` for HTML parsing
- Compare against `backblasts` table in Supabase to identify new entries (dedupe by title + date)

**Secondary Source:** Slack API
- Read messages from the F3 Marietta Slack channel (backblast channel)
- Parse structured backblast format (Q, AO, PAX, etc.)
- Use as fallback or cross-reference

**Scraper Output Schema:**
```typescript
interface Backblast {
  id: string;                // uuid
  title: string;
  date: string;              // ISO date
  ao: string;                // Area of Operation (workout location)
  q: string;                 // Workout leader
  pax: string[];             // List of attendees
  pax_count: number;
  content: string;           // Full backblast body text
  image_url: string | null;  // Featured image from the post
  source: 'website' | 'slack';
  source_url: string;        // Original URL or Slack message link
  scraped_at: string;        // ISO timestamp
}
```

### 1.2 Claude Caption Generator

**System Prompt Context:**
```
You are a social media content creator for F3 Marietta, a free men's 
workout group. You write Instagram captions that are motivational, 
community-focused, and highlight the men who showed up. Tone: authentic, 
encouraging, not cheesy. Use relevant F3 terminology naturally.

F3 Lexicon quick reference:
- PAX = participants
- Q = workout leader
- AO = Area of Operation (workout location)
- HC = headcount
- FNG = Friendly New Guy (first-timer)
- BD = beatdown (the workout)
- COT = Circle of Trust (closing circle)
- 6 = your back / having someone's back
```

**Input:** Backblast data (title, AO, Q, PAX, content, image)
**Output:** 
```typescript
interface InstagramDraft {
  caption: string;          // Instagram caption with hashtags
  story_text: string;       // Shorter text overlay for Story version
  suggested_hashtags: string[];
  alt_text: string;         // Accessibility alt text for the image
}
```

### 1.3 Supabase Schema

```sql
-- Backblasts (source of truth for scraped content)
CREATE TABLE backblasts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  date DATE NOT NULL,
  ao TEXT,
  q TEXT,
  pax TEXT[],
  pax_count INTEGER,
  content TEXT,
  image_url TEXT,
  source TEXT CHECK (source IN ('website', 'slack')),
  source_url TEXT,
  scraped_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(title, date)
);

-- Instagram post drafts
CREATE TABLE instagram_drafts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  backblast_id UUID REFERENCES backblasts(id),
  caption TEXT NOT NULL,
  story_text TEXT,
  hashtags TEXT[],
  alt_text TEXT,
  image_url TEXT,
  image_storage_path TEXT,         -- Supabase Storage path
  status TEXT DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'posted', 'rejected', 'edited')),
  post_type TEXT DEFAULT 'feed'
    CHECK (post_type IN ('feed', 'story')),
  instagram_post_id TEXT,          -- ID returned after publishing
  approved_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weekly newsletters
CREATE TABLE newsletters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start DATE NOT NULL,
  week_end DATE NOT NULL,
  title TEXT,
  body_markdown TEXT,
  body_slack_mrkdwn TEXT,          -- Slack-formatted version
  status TEXT DEFAULT 'draft'
    CHECK (status IN ('draft', 'approved', 'posted')),
  slack_message_ts TEXT,           -- Slack message timestamp after posting
  approved_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Audit / run log
CREATE TABLE agent_runs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  run_type TEXT CHECK (run_type IN ('scrape', 'generate', 'post', 'newsletter')),
  status TEXT CHECK (status IN ('success', 'failure', 'partial')),
  details JSONB,
  error_message TEXT,
  started_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);
```

### 1.4 Cron Job (Vercel)

```json
// vercel.json
{
  "crons": [
    {
      "path": "/api/cron/scrape-backblasts",
      "schedule": "0 12 * * *"
    },
    {
      "path": "/api/cron/generate-newsletter",
      "schedule": "0 8 * * 6"
    }
  ]
}
```

**Daily Scrape Flow (`/api/cron/scrape-backblasts`):**
1. Fetch f3marietta.com/backblasts
2. Parse HTML for new backblast entries
3. Dedupe against Supabase `backblasts` table
4. For each new backblast:
   a. Insert into `backblasts` table
   b. Download image → upload to Supabase Storage
   c. Call Claude API to generate caption + story text
   d. Insert into `instagram_drafts` table (status: `pending`)
   e. Send ntfy.sh notification with approval dashboard link
5. Log run to `agent_runs` table

### 1.5 Notifications (ntfy.sh)

```typescript
// Notify Jordan when drafts are ready for review
await fetch('https://ntfy.sh/f3marietta-agent', {
  method: 'POST',
  headers: {
    'Title': `${newDrafts.length} new F3 post(s) ready for review`,
    'Click': 'https://f3marietta-automation.vercel.app/dashboard',
    'Tags': 'muscle,clipboard',
    'Priority': '3'
  },
  body: `New backblast(s) from ${backblasts.map(b => b.ao).join(', ')}. Tap to review and approve.`
});
```

---

## Phase 2 — Approval Dashboard + Instagram Publishing

### 2.1 Approval Dashboard (Next.js Pages)

**Route:** `/dashboard`
- Requires Supabase Auth (magic link or password — Jordan only)
- Shows pending drafts in a card layout
- Each card shows: image preview, generated caption (editable textarea), hashtags (editable), story text (editable)
- Action buttons: **Approve & Post**, **Edit**, **Reject**, **Regenerate Caption**
- After feed post is approved → auto-generate Story draft from same backblast

**Route:** `/dashboard/history`
- View all past posts with status, posted timestamps, Instagram links

**Route:** `/dashboard/newsletter`
- Preview and edit weekly newsletter before posting to Slack

### 2.2 Instagram Graph API Setup

**Prerequisites:**
1. Facebook Business Page (can create one just for this)
2. Instagram Business or Creator account linked to that FB Page
3. Facebook App (developers.facebook.com) with permissions:
   - `instagram_basic`
   - `instagram_content_publish`
   - `pages_read_engagement`
4. Long-lived Page Access Token (60-day, auto-refreshable)

**Publishing Flow (Feed Post):**
```typescript
// Step 1: Create media container
const createResponse = await fetch(
  `https://graph.facebook.com/v19.0/${igUserId}/media`,
  {
    method: 'POST',
    body: JSON.stringify({
      image_url: publicImageUrl,    // Must be publicly accessible
      caption: approvedCaption,
      access_token: pageAccessToken
    })
  }
);
const { id: creationId } = await createResponse.json();

// Step 2: Publish the container
const publishResponse = await fetch(
  `https://graph.facebook.com/v19.0/${igUserId}/media_publish`,
  {
    method: 'POST',
    body: JSON.stringify({
      creation_id: creationId,
      access_token: pageAccessToken
    })
  }
);
```

**Publishing Flow (Story):**
Same as feed but with `media_type: 'STORIES'` in Step 1.

**Fallback — Buffer API:**
If Meta app review is a blocker, use Buffer's API:
- `POST /updates/create` with `profile_ids`, `text`, `media`
- Simpler auth (OAuth2), handles scheduling natively
- Free tier supports 3 channels

### 2.3 Environment Variables

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Claude API
ANTHROPIC_API_KEY=

# Instagram Graph API
INSTAGRAM_USER_ID=
FACEBOOK_PAGE_ACCESS_TOKEN=

# Slack
SLACK_BOT_TOKEN=
SLACK_CHANNEL_ID=           # F3 Marietta channel

# ntfy.sh
NTFY_TOPIC=f3marietta-agent

# Cron security
CRON_SECRET=                # Vercel cron verification
```

---

## Phase 3 — Weekly Newsletter + Slack Posting

### 3.1 Newsletter Generator

**Cron:** Every Saturday at 8:00 AM ET (`/api/cron/generate-newsletter`)

**Flow:**
1. Query `backblasts` table for entries from the past 7 days
2. Query `instagram_drafts` for any notable engagement data (if available)
3. Call Claude API with newsletter prompt:

```
You are writing the weekly F3 Marietta newsletter for the Slack channel. 
Summarize the week's workouts in a way that celebrates the PAX who posted, 
highlights any FNGs, and builds momentum for next week. 

Tone: brotherhood, accountability, encouragement. Keep it tight — 
Slack readers skim. Use Slack mrkdwn formatting (bold with *text*, 
italic with _text_, bullet lists, emoji).

Structure:
- Opening line (motivational, tied to the week)
- AO-by-AO recap (1-2 sentences each, name the Q and HC)
- Shout-outs (FNGs, milestones, notable efforts)
- Look-ahead (upcoming events, challenges, or CSPs)
- Closing (call to action — post, show up, EH someone)
```

4. Save to `newsletters` table (status: `draft`)
5. Notify Jordan via ntfy.sh

### 3.2 Slack Posting

**On newsletter approval:**
```typescript
const result = await fetch('https://slack.com/api/chat.postMessage', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({
    channel: process.env.SLACK_CHANNEL_ID,
    text: newsletter.body_slack_mrkdwn,
    unfurl_links: false
  })
});
```

---

## Project Structure

```
f3marietta-automation/
├── CLAUDE.md                          # Claude Code project context
├── vercel.json                        # Cron job definitions
├── .env.local                         # Local env vars
├── src/
│   ├── app/
│   │   ├── page.tsx                   # Landing / redirect to dashboard
│   │   ├── dashboard/
│   │   │   ├── page.tsx               # Pending drafts review
│   │   │   ├── history/page.tsx       # Post history
│   │   │   └── newsletter/page.tsx    # Newsletter review
│   │   └── api/
│   │       ├── cron/
│   │       │   ├── scrape-backblasts/route.ts
│   │       │   └── generate-newsletter/route.ts
│   │       ├── drafts/
│   │       │   ├── [id]/approve/route.ts
│   │       │   ├── [id]/reject/route.ts
│   │       │   └── [id]/regenerate/route.ts
│   │       ├── instagram/
│   │       │   ├── publish-feed/route.ts
│   │       │   └── publish-story/route.ts
│   │       ├── newsletter/
│   │       │   ├── approve/route.ts
│   │       │   └── post-to-slack/route.ts
│   │       └── webhooks/
│   │           └── ntfy/route.ts
│   ├── lib/
│   │   ├── supabase.ts                # Supabase client setup
│   │   ├── claude.ts                  # Claude API wrapper
│   │   ├── scraper.ts                 # Backblast scraper logic
│   │   ├── instagram.ts              # Instagram Graph API helpers
│   │   ├── slack.ts                   # Slack API helpers
│   │   ├── ntfy.ts                    # ntfy.sh notification helper
│   │   └── prompts/
│   │       ├── instagram-caption.ts   # System prompt for captions
│   │       ├── story-text.ts          # System prompt for stories
│   │       └── newsletter.ts          # System prompt for newsletter
│   ├── components/
│   │   ├── DraftCard.tsx              # Draft review card
│   │   ├── CaptionEditor.tsx          # Editable caption with preview
│   │   ├── ImagePreview.tsx           # Instagram post preview mockup
│   │   ├── NewsletterPreview.tsx      # Slack-formatted newsletter preview
│   │   └── StatusBadge.tsx            # Draft status indicator
│   └── types/
│       └── index.ts                   # Shared TypeScript interfaces
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql     # Database schema
└── package.json
```

---

## CLAUDE.md (for Claude Code)

```markdown
# F3 Marietta Automation Agent

## What This Is
An automated content pipeline for F3 Marietta that scrapes backblasts, 
generates Instagram posts/stories with human approval, and produces 
a weekly Slack newsletter.

## Tech Stack
- Next.js 14+ (App Router, TypeScript, Tailwind CSS)
- Supabase (PostgreSQL, Auth, Storage)
- Vercel (hosting + cron jobs)
- Claude API (claude-sonnet-4-20250514) for content generation
- Instagram Graph API for publishing
- Slack Web API for newsletter posting
- ntfy.sh for push notifications

## Key Decisions
- Human-in-the-loop: ALL posts require Jordan's approval before publishing
- Supabase Storage for images (ensures public URLs for Instagram API)
- Status workflow: pending → approved → posted (or rejected)
- Cron runs: daily scrape at noon ET, newsletter Saturday 8 AM ET
- ntfy.sh topic: f3marietta-agent

## F3 Terminology
- PAX = participants, Q = leader, AO = location, HC = headcount
- FNG = new guy, BD = beatdown (workout), COT = Circle of Trust
- EH = Emotional Headlock (recruiting someone to come)
- Backblast = post-workout summary posted by the Q

## Commands
- `npm run dev` — local dev server
- `npx supabase migration up` — apply database migrations
- `vercel deploy` — deploy to Vercel

## Environment
All secrets in `.env.local` — see spec doc for full list.
Supabase project and Vercel project must be created first.
```

---

## Getting Started Checklist

- [ ] Create Supabase project + run initial migration
- [ ] Create Vercel project linked to repo
- [ ] Set up Facebook App + Instagram Business account (or Buffer account)
- [ ] Generate Slack Bot Token with `chat:write` scope
- [ ] Set up ntfy.sh topic (`f3marietta-agent`)
- [ ] Get Anthropic API key
- [ ] Scaffold Next.js project with above structure
- [ ] Build and test scraper against f3marietta.com/backblasts
- [ ] Build Claude caption generation pipeline
- [ ] Build approval dashboard UI
- [ ] Wire up Instagram publishing
- [ ] Wire up Slack newsletter posting
- [ ] Deploy and test cron jobs

---

## Cost Estimate (Monthly)

| Service          | Tier        | Est. Cost |
| ---------------- | ----------- | --------- |
| Vercel           | Hobby/Pro   | $0–20     |
| Supabase         | Free tier   | $0        |
| Claude API       | Pay-per-use | ~$1–3     |
| Instagram API    | Free        | $0        |
| Slack API        | Free        | $0        |
| ntfy.sh          | Free tier   | $0        |
| Buffer (if used) | Free tier   | $0        |
| **Total**        |             | **~$1–23** |

---

*Generated: March 14, 2026 — Ready for Claude Code implementation.*
