# FNG Welcome Callouts in Monthly AO + Region Recap — Design Spec

- **Date:** 2026-06-01
- **Status:** Approved (design); pending implementation plan
- **Branch:** `feature/ao-region-monthly-recap`
- **Author:** Jordan Lawson (with Claude)
- **Extends:** `2026-06-01-ao-region-monthly-recap-design.md`

## Goal

Add a celebratory **FNG welcome callout** to each monthly recap post:

1. **Per-AO recap** (posted to each enabled AO channel) — celebrate the FNGs who
   had their first callout **at that AO** during the recapped month: a count and a
   welcome naming each of them.
2. **Region recap** (posted to `#all-f3-marietta`) — celebrate **all** FNGs who
   joined the region that month: the region-wide total and a welcome naming each.

FNG = first-timer (F3 lexicon). This complements the existing stat/leaderboard
content already in the recap. No new audience, no new schedule — it's an extra
section inside the posts the cron already sends.

## Decisions (resolved during brainstorming)

| Question | Decision |
|---|---|
| **"New FNG this month" definition** | **Match the FNG roster page** — distinct FNGs called out in the month, via `getFngsList(range)`. The recap count always agrees with `/admin/analytics/fngs`. Single source of truth; no parallel parser. |
| **Addressing** | **@-mention when a Slack ID is resolvable** (`<@U…>`); fall back to the plain display name otherwise. Most FNGs are first-timers with no Slack account yet, so a mixed line is expected and accepted. |
| **AO attribution** | Each FNG is pinned to the AO of their **earliest** callout in the window — already how `getFngsList` dedupes. Answers "the AO in which they posted." |
| **Empty case** | An AO with posts but **zero** FNGs omits the line entirely (mirrors how the Q-line is omitted when 0). |
| **Region list length** | List **all** FNG names — celebrating everyone is the point. No truncation (YAGNI). |
| **Ordering** | Honorees sorted by display label ascending (locale compare) for deterministic output. |

## Reconciliation guarantee

`getFngsList` dedupes each FNG identity to a **single** earliest entry across the
whole window, so every FNG lands in exactly one AO bucket. Therefore
**Σ(per-AO FNG counts) == region FNG total**. The two scopes never disagree.

## Message format

### Per-AO (new line in **bold** placement)

```
*The Battlefield — May 2026 Recap* 🏋️
142 posts · 18 beatdowns · 27 PAX
🌱 3 new FNGs this month — welcome <@U07ABC>, Carmine, Dredd! 🎉

🏆 Most posts: Milton (16)
🎤 Most Q'd: Mr Clean (5)

Top 10 by posts:
 1. Milton — 16
 …

Deep dive → https://www.f3marietta.com/stats?range=last-month&ao=the-battlefield
```

### Region

```
*F3 Marietta — May 2026 Region Recap* 🌎
842 posts · 96 beatdowns · 118 PAX · 6 AOs
🌱 7 new FNGs joined the region this month — welcome <@U07ABC>, Carmine, Dredd, Edsel, Fannie, Gump, Hightower! 🎉

🏆 Most posts (region): Milton (41)
…
```

### Rendering rules

- The FNG line sits **directly under the stat line**, before the blank line that
  precedes the shout-outs.
- AO copy: `🌱 {N} new FNG{s} this month — welcome {list}! 🎉`
- Region copy: `🌱 {N} new FNG{s} joined the region this month — welcome {list}! 🎉`
- Pluralize "new FNG" → "new FNGs" for N≠1.
- `{list}` = honorees comma-joined; each honoree renders as `<@{slackUserId}>`
  when a Slack ID is present, else the plain display label.
- **Omit the entire line** when the scope has 0 FNGs (`fngs == null`).

## Architecture

Additive to the existing pure-function recap pipeline. No new files except tests.

### `src/lib/stats/getFngsList.ts` (extend — keep single source of truth)

- Add `slackUserId: string | null` to `FngEntry`.
- In the internal `resolve(token)`, capture the originating Slack id: `slackUserId
  = token.startsWith("U") ? token : null`. The canonical `key`/`label` behavior is
  unchanged (still `n:<name>` for cross-source dedupe); we just stop discarding the
  id.
- Earliest-callout-wins dedupe already chooses the entry; `slackUserId` rides along
  on that winning entry. So the id reflects whichever first callout also fixed the
  AO — internally consistent. (If that first callout used a plain name, `slackUserId`
  is null and we render the plain label — acceptable.)
- Additive field; existing consumers (`/admin/analytics/fngs`, `/stats/fngs`) ignore
  it. No behavior change for them.

### `src/lib/stats/buildAoRecap.ts` (extend)

- New view types:
  ```ts
  export type FngHonoree = { label: string; slackUserId: string | null };
  export type FngWelcome = { count: number; honorees: FngHonoree[] };
  ```
- New pure helper `groupFngs(entries: FngEntry[]): { byAoSlug: Map<string,
  FngWelcome>; region: FngWelcome | null }` — groups entries by `aoSlug`, builds a
  region bucket from all entries, sorts honorees by label asc, returns `null` for an
  empty region.
- Add `fngs: FngWelcome | null` to both `AoRecapBlock` and `RegionRecapBlock`.
- `buildRecapBlocks(fact, aoChannels, maps, baseUrl, fngEntries: FngEntry[] = [])` —
  new trailing param (defaulted, backward compatible). Attaches the per-AO
  `FngWelcome` (by slug, `null` if none) to each AO block and the region `FngWelcome`
  to the region block.
- `buildAoRecapMessage` / `buildRegionRecapMessage` — render the FNG line per the
  rules above. New private helpers `renderHonorees(f)` and the two copy builders.

### `src/lib/stats/buildAoRecap.ts` → `planMonthlyAoRecap` (wire I/O)

- Add `getFngsList(range)` to the existing `Promise.all` (same window).
- Pass `fngsList.entries` as the new `buildRecapBlocks` arg.

### `src/app/api/admin/monthly-ao-recap/preview/route.ts` (faithful preview)

- The rendered `message` already includes the FNG line. Additionally surface
  `fngCount` per AO post and a region `fngCount` for at-a-glance review.

### `src/lib/stats/aoRecapReport.ts` + cron route (observability)

- `AoRecapRunReportInput` gains optional `fngTotal?: number`; the report adds one
  line `New FNGs celebrated: {N}` when `N > 0`. Cron passes
  `plan.regionBlock?.fngs?.count ?? 0`.

### Reused as-is (single source of truth)

`getFngsList` (FNG detection), `parseAttendance`/`parseFngLine` (FNG parsing),
`nameToSlug`, `plural`. No new vocabulary, enums, or status sets.

## Edge cases

- **AO with posts, 0 FNGs** → no FNG line (`fngs == null`).
- **Region with 0 FNGs** → no FNG line.
- **1 FNG** → singular "1 new FNG".
- **FNG with no Slack id** (nickname-only first-timer) → plain label.
- **FNG with Slack id** → `<@U…>` mention.
- **FNG slug with no matching enabled-AO channel** (name drift) → not shown in any
  AO block, but **still counted region-wide** (mirrors the existing fact-slug drift
  rule). Σ-reconciliation holds at the region level.
- **Numeric-only FNG line** ("FNG: 2") → already dropped by `parseFngLine` (no
  names to dedupe/welcome); not counted. The recap count equals the named-FNG count
  the roster page shows — intentional and consistent.

## Testing strategy (TDD — tests first)

Pure functions carry the customer-visible behavior; they get unit tests first:

- **`groupFngs`** — grouping by AO slug; region aggregates all; honoree sort order;
  empty → null; Σ(per-AO) == region.
- **`buildRecapBlocks`** — FNG entries attach to the correct AO block; AO with posts
  but no FNG → `fngs == null`; region block carries the region `FngWelcome`; a
  drift slug counts region-wide only.
- **`buildAoRecapMessage` / `buildRegionRecapMessage`** — line present/omitted;
  singular vs plural; `<@U…>` mention vs plain label; region wording + full list;
  placement directly under the stat line.

`planMonthlyAoRecap`, the preview route, and the cron are thin I/O orchestration
over these tested pure functions. The `getFngsList` field addition is
type-enforced; its `slackUserId` is exercised end-to-end by the renderer tests via
synthetic `FngEntry` objects.

## Out of scope (YAGNI)

- AI-written welcome copy.
- Per-FNG profile links or photos.
- "FNG of the month" / retention or return-rate stats (already backlog in BI).
- Changing the roster page's FNG definition (the recap intentionally matches it).
- Truncating long region welcome lists.
