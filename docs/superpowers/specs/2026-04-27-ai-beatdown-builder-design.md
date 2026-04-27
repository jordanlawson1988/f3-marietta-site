# AI Beatdown Builder — Design Spec

**Date:** 2026-04-27
**Status:** Draft (pending Jordan's review)
**Author:** Jordan Lawson + Claude
**Roadmap slot:** Feature #1 of 3 (followed by Backblasts Newsfeed, Upcoming Events)

## Problem

A Q at F3 Marietta has 30 minutes the night before to plan tomorrow's beatdown. Today, Qs reach for ChatGPT or Claude — generic LLMs that don't know our AOs, our PAX, or our voice. They produce sterile, one-size-fits-all workouts that ignore F3's structure (Warm-up → Thang → COT), miss F3 vocabulary, and don't reflect what the region has been doing the last six months. Worse, they sometimes invent unsafe moves or repeat exactly what was Q'd at the same AO last week.

We have everything an F3-aware generator needs: every Marietta backblast, the F3 Lexicon (~2000 terms) and Exicon (~50 local + the full national CSV), and editorial knowledge of famous F3 beatdowns including IPC (Iron Pax Challenge) workouts. Putting this in a public, mobile-first builder turns "scrambling for ideas" into a 30-second job — and gives Qs a printable Q-sheet they can read in the gloom.

## Goals

1. **Replace generic LLMs as the Q's first stop** for beatdown ideation.
2. **Ground every generation in F3 Marietta-specific data** — every backblast, every AO, every famous BD that matters to us.
3. **Preserve F3 structure and voice** — Warm-up, The Thang, COT; F3 vocabulary; brotherhood tone.
4. **Make it fast and frictionless** — public, no login, generates in under 8 seconds end-to-end.
5. **Mobile-first, gloom-friendly** — dark Q-sheet readable on a phone at 5:15 a.m.
6. **Printable** — one-tap browser print yields a clean B&W single-column sheet.
7. **Customizable** — Qs can regenerate sections, swap exercises from the Exicon, or hand-edit any line.
8. **Shareable** — saved beatdowns get a public URL; one-click "Copy as Slackblast" for Slack posting.

## Non-Goals (v1)

- User accounts / personal beatdown history (public-by-URL is enough for v1)
- Server-side PDF generation (browser print → "Save as PDF" handles this)
- Email delivery (URL is the universal share)
- Vector RAG / pgvector retrieval — Approach 2 (precomputed knowledge + live AO context) is sufficient
- Equipment library beyond a fixed chip set (Bodyweight / Coupon / Sandbag / Kettlebell / Sled)
- Multi-region support — F3 Marietta only, matches existing region scope
- Conversational refinement chat ("make it harder") — moderate customization (Level B) only
- Pinning sections, side-by-side compare, audit history
- Auto-posting to Slack — copy-to-clipboard is the v1 share path
- Disclaimer in the printed output (Qs say it verbally; not part of the printed Q-sheet)
- Mary section as a separate block (folds naturally into The Thang)

## User Flow

### Public path

1. Visitor lands on `/beatdown-builder`.
2. Form section (above the fold):
   - **AO** — required, dropdown populated from `ao_channels`.
   - **Focus Area** — chip group, single-select (Full / Legs / Core / Upper / Cardio).
   - **Theme / Occasion** — chip group, single-select (FNG-friendly / Holiday / Q-school / Birthday Q / Ruck / Honor / None).
   - **Equipment** — chip group, multi-select (Bodyweight / Coupon / Sandbag / Kettlebell / Sled). Bodyweight pre-selected.
   - **Inspired by** — typeahead input querying `data/content/famous-beatdowns/` titles. Optional. Suggestions: Murph, 11s, Dora 1-2-3, Jack Webb, Hammer Time, Wheel of Misery, Lap Pyramid, Cinco de Burpee, Jacob's Ladder, 4 Corners, IPC Round 1–6 entries.
   - **Q's Notes** — textarea, max 200 chars.
   - **Generate** button.
3. On submit, the form scrolls fixed and a loader appears below ("Building your beatdown — pulling from F3 Marietta backblasts and the Exicon…").
4. Result section appears below: a dark Q-sheet card showing Header, Warm-up, The Thang, COT.
5. Each section has a **Regenerate** ↻ button and **+ Add exercise** affordance.
6. Each exercise row has a **Swap** button (opens Exicon picker filtered by Focus) and **Remove** button.
7. Any line can be clicked to enter free-text edit mode.
8. Action bar (sticky bottom on mobile, top of card on desktop):
   - **Save** — POSTs the current state, redirects to `/beatdown/[id]`.
   - **Copy Slackblast** — formats the current state as Slack mrkdwn and copies to clipboard.
   - **Print** — triggers `window.print()` with print stylesheet.

### Saved-view path

1. Visitor opens `/beatdown/[id]`.
2. Public read-only view of the saved beatdown.
3. Same sticky action bar with **Copy Slackblast** and **Print**.
4. **Remix this beatdown** button → routes to `/beatdown-builder?seed=[id]` to fork the inputs.

## Data Model

### New table: `beatdowns`

```sql
CREATE TABLE beatdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id text NOT NULL UNIQUE,           -- 8-char URL slug, e.g., "k3p9q2v7"
  inputs jsonb NOT NULL,                   -- { ao_id, ao_name, focus, theme, equipment[], famous_bd, q_notes }
  sections jsonb NOT NULL,                 -- { header, warmup: {...}, thang: {...}, cot: {...} }
  title text NOT NULL,                     -- AI-generated, e.g., "Crawl, Walk, Run"
  ip_hash text,                            -- sha256(ip + salt) for abuse tracking, never raw IP
  generation_model text NOT NULL,          -- 'gemini-2.5-flash'
  generation_ms integer NOT NULL,          -- end-to-end latency
  knowledge_version integer,               -- FK soft-ref to marietta_bd_knowledge.id at generation time
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX beatdowns_short_id_idx ON beatdowns (short_id);
CREATE INDEX beatdowns_created_at_idx ON beatdowns (created_at DESC);
```

- `short_id`: URL-friendly base32 slug (8 chars, ~10^12 space, collision-safe). Used in `/beatdown/[short_id]`.
- `inputs.equipment`: array of strings.
- `sections`: stored as JSONB for shape flexibility during early iteration. Frozen shape:
  ```json
  {
    "header": { "title": "...", "ao_name": "...", "length_min": 45, "summary": "..." },
    "warmup": { "items": [{ "exercise": "SSH", "reps": "x 25 IC", "note": "" }, ...] },
    "thang": { "items": [...], "format_note": "11s on the hill — Merkins at top, Squats at bottom" },
    "cot": { "talking_points": ["Count-o-rama", "Name-o-rama", "BOM"], "notes": "..." }
  }
  ```
- `ip_hash`: salted SHA256 — supports rate limit + spam detection without storing PII. Salt is `BEATDOWN_IP_SALT` env var.

### New table: `marietta_bd_knowledge`

```sql
CREATE TABLE marietta_bd_knowledge (
  id serial PRIMARY KEY,
  generated_at timestamptz NOT NULL DEFAULT now(),
  source_event_count integer NOT NULL,     -- # f3_events backblasts read for this build
  content text NOT NULL,                   -- distilled markdown / structured plain text
  per_ao_summary jsonb NOT NULL,           -- { ao_display_name: { top_exercises: [...], common_formats: [...] } }
  generation_model text NOT NULL,          -- 'claude-sonnet-4-6'
  generation_ms integer NOT NULL,
  cost_usd numeric(10,4)                   -- approximate cost of this build
);

CREATE INDEX marietta_bd_knowledge_generated_at_idx ON marietta_bd_knowledge (generated_at DESC);
```

- One row per nightly cron run. Latest row is read at every `/api/beatdown/generate` call.
- Older rows kept for audit/debug — DELETE after 30 days via cleanup query (added to existing reconcile cron).

### Migration file

`supabase/migrations/20260427_beatdown_builder.sql`. Contains both CREATE TABLE statements and all indexes. Follows naming convention from existing migrations even though the directory is named `supabase` (we run on Neon — historical artifact noted in CLAUDE.md).

## API Routes

### `POST /api/beatdown/generate`

**Runtime:** Node.js (needs `fs` for Exicon and famous BD MDs).

**Rate limit:** 10 requests / 60 seconds / IP via existing `checkRateLimit`.

**Request body:**
```ts
{
  ao_id: string;            // uuid from ao_channels.id
  ao_display_name: string;  // ao_channels.ao_display_name (sent for prompt convenience; server re-fetches for trust)
  focus: 'full' | 'legs' | 'core' | 'upper' | 'cardio';
  theme: string | null;     // 'fng-friendly' | 'holiday' | ... or null
  equipment: string[];      // ['bodyweight'] minimum
  famous_bd: string | null; // slug from famous-beatdowns/, or null
  q_notes: string;          // <= 200 chars
}
```

The server re-fetches `ao_display_name` from `ao_channels` by `ao_id` to prevent client-side spoofing.

**Response:**
```ts
{
  draft_id: string;       // ephemeral uuid for regenerate-section to reference
  title: string;
  sections: { header, warmup, thang, cot };
  generation_ms: number;
  model: string;
}
```

Notes:
- Draft is **not** persisted to `beatdowns` until the Save action. Held in-memory client-side.
- For "regenerate-section" continuity, the draft gets a short-lived (1 hr) cache key in Neon (or just re-sent in the request body — simpler).

**Error cases:**
- `400` — invalid `ao_id`, missing required fields, bad equipment value
- `429` — rate limit hit
- `500` — Gemini failure (with retryable hint in payload)
- `503` — `GOOGLE_AI_API_KEY` missing (mirrors AMA assistant)

### `POST /api/beatdown/regenerate-section`

**Body:**
```ts
{
  inputs: <same as generate>;
  current: { title, sections };
  section: 'warmup' | 'thang' | 'cot';
}
```

Calls Gemini with a prompt that instructs "regenerate the {section} only, preserving the rest." Response is the new section JSON.

### `POST /api/beatdown/save`

**Body:**
```ts
{
  inputs: <same as generate>;
  draft: { title, sections };
  generation_ms: number;
  model: string;
}
```

**Response:** `{ short_id }`. Client redirects to `/beatdown/${short_id}`.

Implementation:
1. Validate inputs (AO exists, focus in enum, equipment items in allowlist, q_notes ≤ 200 chars).
2. Hash IP with salt.
3. Generate `short_id` via `crypto.randomBytes(5).toString('base32')` (collision-resilient).
4. Read latest `marietta_bd_knowledge.id` for `knowledge_version`.
5. INSERT row, return `short_id`.

### `GET /api/beatdown/[short_id]`

Public read. Returns full `inputs + sections + title + created_at`. No auth.

### `GET /api/beatdown/exicon-search?focus={focus}&q={query}`

Server-side filter against the local Exicon files (fast, no DB call). Used by the Swap modal. Returns up to 30 entries: `[{ slug, term, shortDescription, focusTags }]`.

### Knowledge build — piggybacked on `/api/slack/reconcile`

**Why piggyback:** Vercel Hobby allows 2 daily cron jobs; the project already uses both (`reconcile` + `sync-users`). Rather than upgrade or add a third cron, the BD knowledge build runs as a final step inside the existing reconcile route. This is also operationally clean — fresh backblasts get reflected in fresh knowledge in the same run.

**Trigger condition:** After `reconcile` finishes successfully and persists new f3_events rows. If `process.env.SKIP_BD_KNOWLEDGE === '1'` or `f3_events` row count delta is 0, skip the rebuild for the day.

**Standalone-callable variant:** Expose `POST /api/admin/build-bd-knowledge` (admin-only, requires Better Auth admin session) to manually trigger a rebuild from the admin dashboard. Useful for backfills and forcing a refresh after editing the famous BD library.

Pipeline:
1. Query `f3_events` where `event_kind = 'backblast'` and `is_deleted = false` (the DB is single-region by design — every backblast is a Marietta backblast; no region filter needed).
2. Group by `ao_display_name` and dump `content_text` excerpts.
3. Build a single Claude Sonnet 4.6 prompt:
   - System: "You are an F3 historian distilling a region's beatdown patterns…"
   - User: full backblast dump grouped by AO + ask for: `{ marietta_voice_summary, top_50_exercises_overall, per_ao_summaries: { ao_id: { top_10_exercises, common_formats, voice_samples[3] } } }`
4. Receive structured JSON, persist into `marietta_bd_knowledge` row.
5. Delete `marietta_bd_knowledge` rows older than 30 days.

**Token budget:** Anticipated ~30k input tokens once backblast count grows; well within Sonnet limits. Cost estimate: ≤ $0.10 per nightly run.

**Failure mode:** A failed knowledge build does NOT fail the reconcile route (the rebuild runs in a try/catch, errors are logged but reconcile still returns 200 to Vercel). The generate route falls back to pulling last 30 backblasts at the AO live if no `marietta_bd_knowledge` row exists or the latest row is > 7 days old.

## Pages and Components

### Pages

- `src/app/beatdown-builder/page.tsx` — public form + result
- `src/app/beatdown/[short_id]/page.tsx` — public read-only view

### Components

All in `src/components/beatdown/`:

- `BeatdownForm.tsx` — controlled form, posts to `/api/beatdown/generate`
- `BeatdownDisplay.tsx` — renders the result, owns customization state
- `BeatdownSection.tsx` — single section card (warmup / thang / cot) with regenerate + add controls
- `ExerciseRow.tsx` — single exercise line with reps + swap + remove + inline-edit
- `ExerciseSwapModal.tsx` — Exicon picker, queries `/api/beatdown/exicon-search`
- `ShareActionsBar.tsx` — sticky action bar (Save / Copy Slackblast / Print)
- `BeatdownLoader.tsx` — themed loader during generation
- `RemixButton.tsx` — only on saved view

### Library

`src/lib/beatdown/`:

- `prompts/beatdown-system.ts` — Gemini system instruction (persona + structure rules + output JSON schema)
- `prompts/beatdown-user.ts` — `buildUserPrompt(inputs, knowledge, recentAtAo, exiconSubset, famousBdContent)`
- `prompts/regenerate-section.ts` — narrower prompt for single-section regen
- `prompts/marietta-knowledge.ts` — Claude Sonnet system + user prompt for the cron
- `buildContext.ts` — assembles knowledge + recent + Exicon + famous BD into a prompt-ready bundle
- `parseResponse.ts` — validates the model's JSON, repairs minor schema drift, throws if irreparable
- `formatSlackblast.ts` — converts `{title, sections}` to Slack mrkdwn
- `loadFamousBeatdowns.ts` — reads + caches `data/content/famous-beatdowns/*.md` at module load
- `exicon.ts` — focus-based filter helpers over local Exicon entries

### Print stylesheet

In `src/app/beatdown-builder/page.tsx` and `src/app/beatdown/[short_id]/page.tsx`:

```css
@media print {
  /* Hide nav, footer, action bar, and any controls */
  nav, footer, .no-print { display: none !important; }
  /* Force light mode and single column */
  .beatdown-card { background: white; color: #111; box-shadow: none; }
  .beatdown-section { break-inside: avoid; }
  /* Larger body type for paper readability */
  body { font-size: 12pt; }
}
```

## Prompt Strategy

### System instruction (per-request generator)

```
You are the F3 Marietta Beatdown Builder. You generate workouts in the F3 format
for use by Qs leading peer-led outdoor men's workouts in Marietta, GA.

# Voice
- F3 brotherhood: warm, direct, encouraging. Not corporate.
- Use F3 vocabulary naturally: PAX, Q, AO, FNG, COT, BOM, mosey, IC (in cadence).
- No safety-disclaimer language in the output — Qs say that verbally.

# Format Rules
- Output STRICT JSON matching the schema below.
- Three sections: warmup, thang, cot.
- Total beatdown is 45 minutes (≈5 min warmup, ≈30 min thang, ≈5 min COT, plus mosey transitions).
- Mary (core) folds into the Thang naturally — do not produce a separate Mary block.
- Detail level — "adaptive":
  * Default: terse format, e.g., "SSH x 25 IC", "Mosey to flag pole".
  * If theme = fng-friendly OR theme = q-school: include a short coaching cue per exercise.
- Cite F3 exercises by their canonical Exicon term when available.
- Do NOT invent exercises that contradict our Exicon. Prefer Exicon entries.
- The Thang format may borrow from a famous BD if Q chose one — adapt, don't copy verbatim.
- COT contains talking points (Count-o-rama, Name-o-rama, BOM, optional prayer / honor) — no exercises.

# Schema
{
  "title": "string — 2-5 word memorable name",
  "header": { "ao_name": "string", "length_min": 45, "summary": "≤140 chars" },
  "warmup": { "items": [{ "exercise": "string", "reps": "string", "note": "string" }] },
  "thang": { "items": [{ "exercise": "string", "reps": "string", "note": "string" }],
             "format_note": "string — describes the structure (e.g., '11s on the hill')" },
  "cot":   { "talking_points": ["string"], "notes": "string — optional Q reminders" }
}
```

### User prompt assembly (`buildUserPrompt`)

```
[PINNED — F3 Marietta Knowledge]
{marietta_bd_knowledge.content}

[PINNED — Famous F3 Beatdowns Library]
{loadFamousBeatdowns() → indexed by slug}

[PINNED — Local Exicon (filtered by focus)]
{filterExicon(focus) — top 80 entries with terms + 1-line definitions}

[DYNAMIC — Recent at this AO]
Last 10 backblasts at {ao_name}: {trimmed content_text excerpts}

[Q INPUTS]
AO: {ao_name}
Focus: {focus}
Theme: {theme || "—"}
Equipment: {equipment.join(", ")}
Inspired by: {famous_bd_title || "—"}  ← if set, attach the matching MD content here
Q's notes: {q_notes || "—"}

Generate a beatdown that fits these inputs. Output JSON only.
```

Pinned blocks live at the top of the user message so prompt caching (Gemini's automatic cache) hits.

### Regenerate-section prompt

Smaller variant: keep the system instruction; in the user message, send only the relevant sub-prompt + the existing sections + "regenerate ONLY {section}, return JSON for {section} alone."

### Cron prompt (Marietta knowledge builder)

System: "You are an F3 historian distilling a region's beatdown patterns into a structured knowledge document."

User: A grouped dump of all backblasts (by AO) from `f3_events`, plus the Exicon vocabulary list as a reference. Asks for the structured JSON described in the cron pipeline section.

## Famous Beatdown Library

`data/content/famous-beatdowns/` — markdown files with frontmatter:

```yaml
---
title: Murph
slug: murph
category: famous          # or 'ipc'
length_min: 45
equipment: [bodyweight]
focus: full
description: 1-line description for typeahead
---

# Body
Full description: history, structure, common variations, Marietta-specific notes.
```

### Initial files (~12)

**Famous (10):**
- `murph.md` — Memorial Day classic. 1mi run, 100 pull-ups, 200 push-ups, 300 squats, 1mi run.
- `11s.md` — Hill or pull-up bar; descending/ascending reps.
- `dora-1-2-3.md` — Partner work, 100/200/300 reps split.
- `jack-webb.md` — 1:4 ratio merkins-to-squats ladder, IC.
- `hammer-time.md` — American Hammer-centric routine.
- `wheel-of-misery.md` — Spinner / random exercise wheel.
- `lap-pyramid.md` — Track laps with reps at each end.
- `cinco-de-burpee.md` — 5×5×5 burpee chains.
- `jacobs-ladder.md` — Hill ladder, increasing reps each round.
- `4-corners.md` — Four-station circuit with mosey between.

**IPC (2 to start, expandable):**
- `ipc-2024-round-1.md`
- `ipc-2024-round-2.md`

Frontmatter parsing reuses existing `gray-matter` setup from `data/f3Knowledge.ts`.

## Edge Cases and Error Handling

- **Empty AO list** — render an inline error "No AOs configured — admin needs to set up `ao_channels`." (Cannot happen in practice; defensive only.)
- **No backblasts at AO yet** — buildContext omits the recent-at-AO block silently. Knowledge doc still feeds region-wide context.
- **Knowledge doc missing** (cron never ran, or all rows older than 30d) — fall back to pulling 30 random region-wide backblasts at request time. Logged as a warning.
- **Gemini returns malformed JSON** — `parseResponse` attempts repair (strip code fences, trailing-comma fix). On second failure, return 500 with `{ error: 'parse_error', message: 'Try again' }`.
- **Famous BD slug not found** — silently drop from prompt. Log a warning.
- **Exicon entry referenced by AI not in our local files** — accept it (Exicon is non-exhaustive).
- **Q types > 200 chars in notes** — client-side maxLength + server-side truncate.
- **Save called with no `draft`** — 400.
- **Regenerate-section called with stale `current`** — server doesn't validate; trust the client's payload as source-of-truth for in-flight drafts.
- **Concurrent saves of the same draft** — short_id collisions are vanishingly rare; on collision, retry once with a new short_id.
- **Reconcile run while previous run still in flight** — Vercel cron prevents this by default. The knowledge build inherits this protection. Belt-and-braces: a Postgres advisory lock around the build.
- **Print on dark mode** — print stylesheet forces light theme via `@media print` overrides regardless of user OS preference.
- **Browser without clipboard API** — fallback to a `<textarea>` selection-copy pattern with a "Copied!" toast.

## Testing Strategy

The project's only test harness is Playwright E2E (no unit tests). Add:

1. `tests/beatdown-builder-form.spec.ts` — Visit `/beatdown-builder`, fill form, click Generate, assert a beatdown card renders within 15s. Mock `/api/beatdown/generate` to return a fixture.
2. `tests/beatdown-builder-customize.spec.ts` — On the rendered beatdown, click "Swap" on an exercise, pick a substitute from the Exicon picker, assert the row updates.
3. `tests/beatdown-saved-view.spec.ts` — Seed a row in `beatdowns`, visit `/beatdown/[short_id]`, assert content renders and Print button is wired.
4. `tests/beatdown-rate-limit.spec.ts` — Hit `/api/beatdown/generate` 11 times in 60s, assert the 11th returns 429.

Manual checklist (in addition):
- Mobile (iPhone 12) — form usable, generated card readable in dark mode.
- Print preview — single column, no nav/footer, font ≥ 12pt.
- Copy Slackblast — paste into Slack, verify mrkdwn renders correctly.
- Cron — manually invoke `/api/cron/build-bd-knowledge` once, assert a row lands in `marietta_bd_knowledge`.

No fixture-free integration tests against Gemini in CI (cost + flakiness). Add an opt-in `BEATDOWN_LIVE_TEST=1` smoke script for local dev.

## Security Considerations

- Public endpoint — same surface as AMA assistant. Same rate limiter, same IP-hashing strategy (salt env var).
- No PII stored. Inputs are all enum-bounded except `q_notes` (200-char cap, sanitized on render via existing `sanitize-html` patterns).
- `short_id` is unguessable (10^12 space). No enumeration risk for saved beatdowns, but they are public-by-design.
- Knowledge build inherits the existing reconcile cron's Vercel cron-header auth.
- The standalone admin trigger requires a Better Auth admin session.
- Gemini key only used server-side. Never exposed to the browser.

## Cost Model

- Per-request: ~12k input tokens (knowledge + Exicon + famous BD + recent + inputs) + ~2k output tokens at Gemini 2.5 Flash. With prompt caching on the pinned blocks, ~$0.001 per generation.
- Regenerate-section: ~$0.0005.
- Daily knowledge rebuild (within reconcile): ≤$0.10 with Claude Sonnet 4.6. Skipped on days with no new backblasts → typical month is ~20 rebuilds.
- Estimated monthly: $5–15 at 1000 generations + 20 rebuilds. Well within current AI budget. No new Vercel cron consumed (piggyback on existing reconcile).

## Open Questions / Future Work

- **v2: Conversational refinement** — "make it harder" / "less running" chat after generation.
- **v2: Pin a section** — lock so regenerates skip it.
- **v2: Personal history** — would require auth; not v1.
- **v2: AO-specific equipment metadata** — currently the Q hand-picks; we could store per-AO available equipment in `ao_channels`.
- **v2: Q rating loop** — a thumbs-up/down on the saved view feeds a quality signal back to the prompt.
- **v2: Better "scan ALL" via vector RAG** — if the precomputed knowledge doc proves insufficient.

## Implementation Phasing (suggested for the plan)

1. **Schema** — migration + types
2. **Famous BD library** — write 12 MD files (or stub them and have AI flesh out content)
3. **Knowledge builder** — `lib/beatdown/buildKnowledge.ts` + Claude prompt + integration into existing `/api/slack/reconcile` + admin manual-trigger route
4. **Generation API** — `/api/beatdown/generate` + prompt builders
5. **Builder page + form** — `/beatdown-builder` form + display (no customization)
6. **Customization** — regenerate-section, swap modal, exercise add/remove, free-text edit
7. **Save + saved view** — `/api/beatdown/save`, `/beatdown/[short_id]`
8. **Share + print** — Copy Slackblast, print stylesheet
9. **Rate limiting + tests** — Playwright suite
10. **Polish + launch** — surface entry point on homepage / nav, announce in Slack

The plan will break these further into atomic tasks.

---

**Next step:** Implementation plan via `superpowers:writing-plans`.
