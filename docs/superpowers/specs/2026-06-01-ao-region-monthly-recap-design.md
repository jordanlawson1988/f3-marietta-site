# AO + Region Monthly Recap — Design Spec

- **Date:** 2026-06-01
- **Status:** Approved (design); pending spec review → implementation plan
- **Branch:** `feature/ao-region-monthly-recap`
- **Author:** Jordan Lawson (with Claude)

## Goal

On the 1st of each month, post a deterministic, stats-driven recap of the **prior**
calendar month to:

1. **Each enabled AO's Slack channel** — one post per AO (skip AOs with zero posts).
2. **The region channel `#all-f3-marietta`** (`SLACK_NEWSLETTER_CHANNEL_ID`) — one
   region-wide post.

Each post gives a short stat summary, a shout-out to the top poster(s), a shout-out
to the top Q(s), the top-10 posters with counts, and a deep-dive URL into the stats
site. This complements the existing per-PAX recap DM (`monthly-pax-recap`) — same
month window, different audience (channels, not individuals).

## Decisions (resolved during brainstorming)

| Question | Decision |
|---|---|
| Summary copy | **Deterministic template** — no AI, no approval gate. |
| Trigger | **Auto monthly cron** with a `live`/`dry-run` gate, mirroring `monthly-pax-recap`. |
| Coverage | **All 6 enabled AOs**, skip any with 0 posts; **plus** the region post. |
| Schedule | **`0 10 1 * *`** = 10:00 UTC = **5:00 AM EST** (literal). See DST note below. |
| Double-post safety | **Idempotency guard** — record `(period, channel)` after each live post; skip already-posted. Replaces the manual "disarm after live" dance. |

### DST note (explicit footgun)

Vercel crons run in fixed UTC and do **not** follow daylight saving. `0 10 1 * *`
is 5:00 AM during EST months and 6:00 AM during EDT months (7 of 12 "1st of month"
dates are EDT). This is accepted: for a monthly channel post the hour drift is
cosmetic. Alternative if a steady summer 5 AM is ever wanted: `0 9 1 * *`.

## Message format

Plain Slack `mrkdwn` text (single `chat.postMessage` per channel). Pure render
functions, no I/O, fully unit-testable.

**Per-AO** (posted to `ao_channels.slack_channel_id`):
```
*The Battlefield — May 2026 Recap* 🏋️
142 posts · 18 beatdowns · 27 PAX

🏆 Most posts: Milton (16)
🎤 Most Q'd: Mr Clean (5)

Top 10 by posts:
 1. Milton — 16
 2. Mr Clean — 14
 …
10. Clipboard — 7

Deep dive → https://www.f3marietta.com/stats?range=last-month&ao=the-battlefield
```

**Region** (posted to `SLACK_NEWSLETTER_CHANNEL_ID`):
```
*F3 Marietta — May 2026 Region Recap* 🌎
842 posts · 96 beatdowns · 118 PAX · 6 AOs

🏆 Most posts (region): Milton (41)
🎤 Most Q'd (region): Mr Clean (12)

Top 10 PAX region-wide:
 1. …

Deep dive → https://www.f3marietta.com/stats?range=last-month
```

### Rendering rules

- **Header:** AO → ``*{aoDisplayName} — {monthLabel} Recap* 🏋️``; region →
  ``*F3 Marietta — {monthLabel} Region Recap* 🌎``. `monthLabel` from
  `formatRecapMonth` (UTC), e.g. "May 2026".
- **Stat line:** `{posts} posts · {beatdowns} beatdowns · {paxCount} PAX`; region
  appends ` · {aoCount} AOs`. Pluralize posts/beatdowns/AOs ("1 post"…); "PAX"
  is invariant.
- **Most posts:** `🏆 Most posts{ (region)}: {names} ({count})` — `names` lists
  **all** PAX tied at the max post count, comma-joined (honors "PAX or PAX's").
- **Most Q'd:** `🎤 Most Q'd{ (region)}: {names} ({count})` — **omit the whole
  line** if the max Q count is 0.
- **Top 10:** label line (`Top 10 by posts:` / `Top 10 PAX region-wide:`) then
  numbered `{n}. {label} — {posts}`. Sort posts desc, then label asc. Show fewer
  than 10 if fewer PAX exist. Right-align the index for ≥10 (cosmetic).
- **URL:** `Deep dive → {url}`. AO url:
  `https://www.f3marietta.com/stats?range=last-month&ao={nameToSlug(aoDisplayName)}`;
  region url: `https://www.f3marietta.com/stats?range=last-month`.

### Metric definitions

- **post** = one (PAX, beatdown) attendance record.
- **beatdown** = one distinct event (`eventId`).
- **PAX** = distinct people.
- **Most posts** = PAX with the most distinct beatdowns attended in the window.
- **Most Q'd** = PAX with the most events where `isQ` is true.
- **aoCount** (region) = number of AOs with ≥1 post in the window.

## Architecture

Mirrors the just-shipped `monthly-pax-recap` for consistency and maximum reuse.

### New units

- **`src/lib/stats/buildAoRecap.ts`** (pure + one I/O entry):
  - `planMonthlyAoRecap(now = new Date()): Promise<AoRecapPlan>` — resolves the
    last-month range (`parseTimeRange({range:"last-month"}, now)`), loads the
    attendance fact once (`getAttendanceFact`), the AO channel map
    (`ao_channels` where `is_enabled`), and the name maps
    (`slack_users` + `getAliasMap`). Slices the fact per-AO and region-wide and
    emits a plan. **AO scoping:** `getAttendanceFact` already JOINs `ao_channels`
    and filters to `is_enabled = true`, so every fact row is from an enabled AO.
    Per-AO blocks group fact rows by `nameToSlug(fact.aoName)` and match to a
    channel by `nameToSlug(ao_display_name)`. **Region totals aggregate all fact
    rows** in the window. An enabled AO with no fact rows is skipped; a fact slug
    with no matching channel row (name drift) still counts region-wide and is
    surfaced in the run-report rather than silently dropped.
  - `rankPaxForRecap(factSubset, maps): RankedPax[]` — pure aggregation →
    `{ label, posts, qd }[]` sorted posts desc / label asc. Shared by AO and
    region. Includes **unmapped/nickname-only PAX by label** (see edge cases).
  - `buildAoRecapMessage(block): string` and `buildRegionRecapMessage(block): string`
    — pure renderers.
  - Types: `AoRecapBlock { aoDisplayName, slug, channelId, posts, beatdowns,
    paxCount, topPosters: {names,count}, topQs: {names,count}|null, top10:
    RankedPax[], url }`, `RegionRecapBlock` (adds `aoCount`, no `channelId`-from-AO
    — uses the region channel), `AoRecapPlan { window, aoBlocks: AoRecapBlock[],
    regionBlock: RegionRecapBlock }`.

- **`src/app/api/cron/monthly-ao-recap/route.ts`** (new): same shape as the PAX
  cron — `CRON_SECRET` bearer auth; `isLive = MONTHLY_AO_RECAP_LIVE==="true" &&
  ?live=1 && !?dry=1`; build the plan; in live mode post each AO block + region
  block via `getSlackClient().chat.postMessage` paced at 250 ms, **guarded by the
  idempotency table**; then build + DM an admin run-report. `maxDuration = 60`,
  `dynamic = "force-dynamic"`.

- **`src/app/api/admin/monthly-ao-recap/preview/route.ts`** (new): admin-session
  gated (`validateAdminToken`); returns the full plan, every rendered message, and
  `liveFlagSet`; performs **no** Slack calls. Lets an admin eyeball every post
  before the 1st.

- **Idempotency table** `monthly_ao_recap_posts` (additive; created via the repo's
  existing migration path):
  ```sql
  CREATE TABLE IF NOT EXISTS monthly_ao_recap_posts (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    period       text NOT NULL,          -- recapped month, 'YYYY-MM'
    channel_id   text NOT NULL,          -- Slack channel posted to
    scope        text NOT NULL,          -- 'ao' | 'region'
    ao_name      text,                   -- display name for 'ao', null for region
    message_ts   text,                   -- Slack ts of the posted message
    posted_at    timestamptz NOT NULL DEFAULT now(),
    UNIQUE (period, channel_id)
  );
  ```
  Live send: for each block, `INSERT ... ON CONFLICT (period, channel_id) DO
  NOTHING RETURNING id`; post to Slack **only when a row was inserted**. A no-row
  result means "already posted this month" → skip. This makes live runs
  idempotent per (month, channel) and removes the double-post footgun.

- **`vercel.json`**: add `{ "path": "/api/cron/monthly-ao-recap?live=1",
  "schedule": "0 10 1 * *" }`.

### Reused as-is (single source of truth)

`getAttendanceFact`, `getAliasMap`, `nameToSlug`/`formatRecapMonth`,
`parseTimeRange("last-month")`, `getSlackClient`, and the `recapReport` admin-report
pattern (extended for channel scope). The `isLive` gate logic mirrors
`monthly-pax-recap` verbatim (same env-string contract).

## Data flow

1. Cron hits route with `?live=1` + `CRON_SECRET`.
2. `planMonthlyAoRecap()` → one fact query for the month → per-AO + region blocks.
3. Per block: idempotent insert → if inserted, `chat.postMessage` to the channel;
   record `message_ts`. Pace 250 ms.
4. Build run-report (per-channel posted / skipped-already-posted / errors /
   skipped-empty) → DM `SLACK_ADMIN_USER_ID` (both live and dry-run).
5. Return JSON summary.

## Edge cases

- **AO with 0 posts** → omitted from the plan (no empty post).
- **Ties** for most-posts / most-Q'd → list all tied names.
- **Unmapped / nickname-only PAX** → channel posts don't need a DM-able id, so these
  PAX **are** counted and named in leaderboards by their best label (slack name →
  alias → nickname token). This differs from the DM recap, which excludes them.
- **Fewer than 10 PAX** → show all; **no Q's that month at an AO** → omit Q line.
- **Bot not in channel** (`not_in_channel`) → caught per-channel, surfaced in the
  run-report, does not abort the run. (Auto-join via `channels:join` should prevent
  it; the region channel must also include the bot.)
- **Re-run safety** → idempotency guard skips channels already posted for the period.
- **Region channel assumption** → `#all-f3-marietta` == `SLACK_NEWSLETTER_CHANNEL_ID`.

## Testing strategy (TDD)

Pure functions get unit tests first:

- `rankPaxForRecap`: ordering, tie handling, nickname inclusion, Q counts.
- `buildAoRecapMessage` / `buildRegionRecapMessage`: header, pluralization, tie
  rendering, Q-line omission, <10 PAX, URL/slug correctness, region AO count.
- `planMonthlyAoRecap`: fed synthetic fact rows + maps → correct blocks, empty-AO
  skipping, region aggregation.
- Idempotency: insert-then-skip behavior (integration-style against a test row or a
  mocked `sql`).

The cron/preview routes are thin orchestration over tested pure functions.

## Config / env

- `MONTHLY_AO_RECAP_LIVE` — `"true"` to arm; keep **non-sensitive** (so it's
  verifiable). Default/absent → dry-run.
- Reuses `CRON_SECRET`, `SLACK_ADMIN_USER_ID`, `SLACK_NEWSLETTER_CHANNEL_ID`,
  `SLACK_BOT_TOKEN`, `NEXT_PUBLIC_SITE_URL`.

## Out of scope (YAGNI)

- AI-generated narrative copy.
- Admin approve/publish UI (cron-driven; preview endpoint is read-only).
- Per-AO opt-out config, threaded replies, images/charts, week-by-week breakdowns.
- Backfilling recaps for past months.
