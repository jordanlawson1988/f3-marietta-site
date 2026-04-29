# F3 Marietta — Session Handoff (2026-04-25)

## TL;DR

Follow-up session to the website redesign. Ten commits to `develop`,
all live on Vercel preview, none promoted to `main` yet. Major themes:
content-correctness fixes (logo, copy, PAX count, region scoping),
Gemini AMA migration, Slack photo integration, and visual polish.

**Current branch:** `develop` @ `c07ac83`
**Preview:** https://f3-marietta-site-git-develop-jordan-lawsons-projects.vercel.app
**Production:** https://f3marietta.com (still on `main` from prior session)
**Pending action:** Jordan reviews preview → merge `develop` → `main` to ship.

---

## Commits this session (newest first)

| Commit | Subject |
|---|---|
| `c07ac83` | fix(freshness): revalidate / alongside /backblasts on Slack events |
| `940627a` | fix(backblasts): single generic fallback instead of rotating region photos |
| `7246ad3` | feat(backblasts): use actual Slack photos + flatten listing to photo list |
| `fc27f8b` | feat(visual): weave real PAX photos into feature cards, impact, CTA, headers |
| `7bc6a8f` | chore(favicon): regenerate icon.png + apple-icon.png from new logo |
| `fb1266e` | fix(backblasts): use resolved Slack handles in previews + detail kicker |
| `47c47c2` | fix(home): strip filter overlays on hero emblem; add region socials |
| `61d429e` | feat: region-scoped redesign fixes + Gemini AMA migration |

`24d8f91` is the prior session's redesign merge — anything before that is
out of session scope.

---

## What's done

### Content / copy
- Hero headline: `Hold the Battlefield. Leave no man behind.` → `Remove your obstacles, unlock your potential.`
- All hardcoded `05:15` → `05:30` (Hero, Footer, JoinCTA watermark, /new-here, TopBar)
- "Find Your Battlefield" → "Find Your Beatdown" (home + /workouts)
- "Battlefield Reports" → "Backblasts" (home + feature card defaults)
- Coordinates ribbon replaced with "Marietta Region · F3 Nation"

### Logo
- New emblem at `/public/images/new-f3-marietta-logo.png` referenced from
  Hero, Navbar, Footer, Logo component, BackblastFeatureCard.
- Hero emblem: stripped invert/contrast/drop-shadow filter and the
  `bg-bone/5` chamfered card, per Jordan's direction ("show raw image").
- `src/app/icon.png` (64×64) + `src/app/apple-icon.png` (180×180)
  regenerated from the new logo via `sips`.

### Region scoping (Marietta-only)
- **TopBar Next Muster** now reads `workout_schedule` JOIN `regions` filtered
  to `slug='marietta'`, via new `src/lib/stats/getNextMarietteMuster.ts`.
- **Weekly PAX count** scoped to current ISO week (Mon–Sun, America/New_York)
  AND Marietta-only channels via `ao_channels`. Helper:
  `src/lib/stats/getWeeklyPaxCount.ts` — parses PAX from `content_text`
  (handles Slack IDs + multi-word F3 names like "Bill Nye").

### AO grid
- New `WorkoutWithRegion` type. `WorkoutsFilter` rewritten to split into
  "Marietta Region" (primary tone) and "Nearby Regions" (secondary, with
  region-name sublabel) — see `src/components/home/WorkoutsFilter.tsx`.

### AMA / AI Assistant
- Migrated from OpenAI `gpt-4o-mini` to Google Gemini `gemini-2.5-flash`
  via `@google/genai` SDK. Route: `src/app/api/assistant/route.ts`.
- Persona files ALWAYS loaded as system instruction:
  - `data/assistant/tone-voice.md` — F3-Edgy voice rules + good/bad examples
  - `data/assistant/topic-boundary.md` — humorous off-topic redirects
  - `data/assistant/core-lexicon.md` — top F3 terms scraped from glossary
- Loader: `getAssistantPersona()` in `data/f3Knowledge.ts` (cached).
- Fast-path glossary direct match preserved (no LLM call for known terms).
- `GOOGLE_AI_API_KEY` added to Vercel Production + Preview + Development.

### Backblast photos (the big arc)
- **Discovery:** Slackblast bot stores PAX photos as Block Kit image
  blocks in `content_json.blocks[].image_url`, pointing to public
  `storage.googleapis.com/f3-public-images/event_instance_images/...`
  URLs. **No auth needed.**
- `extractFirstImageUrl(content_json)` in `getBackblastsPaginated.ts`
  scans blocks; `F3EventRow.image_url` populated on every paginated row.
- `getBackblastImage(id, imageUrl?)` returns the real URL when present,
  otherwise a SINGLE generic fallback (`/images/workout-placeholder.jpg`).
- **Important** (Jordan correction during session): originally I rotated
  through real region group photos as a fallback. Jordan rejected this —
  attaching real PAX from one workout to a card about a different one
  was misleading. Now there is exactly one generic AI fallback.
- `next.config.ts` `images.remotePatterns` whitelists
  `storage.googleapis.com` and `files.slack.com`.
- `getRecentBackblastPhotos(n)` in `src/lib/backblast/` — pulls fresh
  PAX-in-the-gloom photos from newest backblasts. Used as the dynamic
  background for ImpactSection (most recent), JoinCTASection (2nd-most
  recent), and the /backblasts page header.

### Backblasts list layout
- Killed the "every-4th-is-a-feature-card" pattern on `/backblasts`.
  Now a single-column expanded photo list (280px photo rail + text).
- `BackblastListItem` gained `variant: "compact" | "expanded"` —
  compact stays on the home rail, expanded runs the full listing page.

### Excerpt / detail kicker
- Backblast detail page kicker was rendering raw Slack IDs
  (`@U0A53EBH0JF`) because it sliced `content_text`. Now uses
  `excerptFromEvent()` which prefers `content_html` (with @Knope-style
  resolved handles) → strips tags → truncates at word boundary.
  Same helper now powers feature card + list item excerpts.

### Footer socials
- New `src/lib/socialLinks.ts` (single source of truth):
  - Facebook: `https://www.facebook.com/people/F3-Marietta/61585217978212/`
  - Instagram: `https://www.instagram.com/f3marietta` (assumed; not yet confirmed)
  - X: `https://x.com/F3MariettaGA`
- Footer "Follow the Region" row uses Lucide for FB/IG and an inline X SVG.

### Data freshness
- `/api/slack/events` upsert + delete handlers now revalidate `/`
  alongside `/backblasts` and `/backblasts/[id]`.
- `/api/slack/reconcile` revalidates both `/` and `/backblasts`.
- Home ISR window dropped from `revalidate = 3600` to `revalidate = 300`
  as a safety net for missed webhook revalidations.

---

## Architecture / data gotchas worth remembering

1. **`f3_event_attendees` is empty** for all current backblasts — the
   ingest pipeline doesn't normalize PAX into that table. The Muster Log
   count parses the `PAX:` line from `content_text` directly. If anyone
   builds analytics that relies on `f3_event_attendees`, they'll get
   zero rows. Backfill is a future task.

2. **Slack file attachments are NOT captured** in `raw_envelope_json.event.files`.
   - Slackblast bot photos ARE captured — they're embedded as Block Kit
     image blocks (handled by current code).
   - User-uploaded photos in thread replies are missed.
   - To capture them: parse `event.message.files` on `file_shared`
     subtype messages, auth-download via `SLACK_BOT_TOKEN`, upload to
     Vercel Blob, store on a new column. `getBackblastImage` is already
     the swap-in point — adding a real-photo column ahead of the
     Slackblast block extract is a small change.

3. **`ao_channels` doesn't have `region_id`** — it just maps Slack
   channel IDs to AO display names. Today all 4 enabled channels are
   Marietta, so filtering by `ao_channels.is_enabled = true` is
   effectively "Marietta only". If non-Marietta channels ever get
   enabled, the Marietta scoping breaks. Add `region_id` to
   `ao_channels` if/when other regions sync to this DB.

4. **AO display name vs ao_name mismatch:** `f3_events.ao_display_name`
   doesn't always match `workout_schedule.ao_name` (e.g., "Black Ops"
   appears in events but "Rucktown" appears in schedule). Tied to the
   same workout but different surface label. Don't try to JOIN on those
   directly — go through `ao_channels` for the canonical mapping.

---

## Pending / open

### Blocked on Jordan
- **Confirm Instagram handle.** I assumed `https://www.instagram.com/f3marietta`
  in `src/lib/socialLinks.ts` — Jordan corrected Facebook + X but didn't
  comment on Instagram. Ask before promoting to `main`.
- **Promote `develop` → `main`** when Jordan finishes preview review.

### Future work (non-urgent)
- Capture user-uploaded Slack photos (not just Slackblast bot images).
  See gotcha #2 above for the recipe.
- Backfill `f3_event_attendees` from `content_text` so analytics work
  off the canonical table instead of regex parsing. See gotcha #1.
- The user-supplied generic fallback `/images/workout-placeholder.jpg`
  is fine but feels stocky — consider commissioning a custom AI image
  in F3 brand style if Jordan wants more polish.

---

## Build / cost notes

- This session triggered ~6 builds on `develop` (logo+social, Slack
  excerpt fix, favicon, photo integration, fallback collapse, freshness).
  All under 60s. None on `main`.
- Build minutes still well under monthly budget per the deploy-discipline
  framework.

---

## Files created this session

- `data/assistant/tone-voice.md`
- `data/assistant/topic-boundary.md`
- `data/assistant/core-lexicon.md`
- `src/lib/socialLinks.ts`
- `src/lib/stats/getNextMarietteMuster.ts`
- `src/lib/backblast/getBackblastImage.ts`
- `src/lib/backblast/getRecentBackblastPhotos.ts`
- `public/images/new-f3-marietta-logo.png` (binary)

## Files significantly rewritten

- `src/components/home/HomeHero.tsx`
- `src/components/home/WorkoutsFilter.tsx`
- `src/components/home/ImpactSection.tsx`
- `src/components/home/JoinCTASection.tsx`
- `src/components/ui/BackblastFeatureCard.tsx`
- `src/components/ui/BackblastListItem.tsx` (added variant prop)
- `src/components/ui/brand/CTABand.tsx` (added backgroundImage prop)
- `src/components/ui/brand/PageHeader.tsx` (added backgroundImage prop)
- `src/components/layout/Footer.tsx` (added socials)
- `src/components/layout/TopBar.tsx` (now async, queries DB)
- `src/app/api/assistant/route.ts` (Gemini migration)
- `src/app/backblasts/page.tsx` (list flatten)
- `src/app/backblasts/[id]/page.tsx` (own photo + clean kicker)
- `src/app/api/slack/events/route.ts` (revalidate /)
- `src/app/api/slack/reconcile/route.ts` (revalidate /)
- `src/lib/backblast/getBackblastsPaginated.ts` (image_url + excerpt helpers)
- `src/lib/stats/getWeeklyPaxCount.ts` (full rewrite, region-scoped)
- `data/f3Knowledge.ts` (added persona loader)
- `next.config.ts` (image hostnames)

---

## How to resume

1. `git checkout develop && git pull origin develop` — make sure you're
   at `c07ac83` or later.
2. Read the **Pending** section above before starting new work.
3. If Jordan says "ship it" / "merge to main": follow the deploy-pipeline
   skill, run pre-flight, merge `develop` → `main`, push, verify.
4. If Jordan adds new feedback on the preview: route changes to
   `develop` only, batch where possible to keep build count low.
