# Admin Dashboard Analytics — Design

**Status:** Draft
**Author:** Jordan Lawson (with Claude)
**Date:** 2026-05-13
**Related:** `src/app/admin/page.tsx`, `src/lib/stats/`, `src/lib/slack/`

## Summary

Add three analytics blocks to the F3 Marietta admin dashboard (`/admin`) so
region admins can see how the region is performing year-to-date at a glance.
The existing 4-tile nav grid stays in place underneath. No new dependencies;
all charts are hand-rolled SVG / CSS rendered by a Server Component.

## Goals

1. Show **Total Posts YTD** for the Marietta region, with a quick read on
   distribution across AOs (pie chart).
2. Show **Top PAX YTD** as a sorted horizontal bar chart — who's been showing
   up the most across every AO.
3. Show **New FNGs YTD** as a single callout metric, parsed from `FNG:` lines
   in backblast content_text.
4. Preserve the existing four management tiles (Active AOs, Regions, Drafts,
   Newsletter) below the new analytics row.
5. Zero new runtime dependencies.

## Non-goals (v1)

- AO color picker / per-AO theming.
- Date range filters (month, week, custom).
- Month-over-month or year-over-year trend lines.
- Drill-down pages for a single PAX or AO.
- CSV export of the leaderboard.
- Caching, materialized views, or background pre-aggregation. Live queries
  only.

## Decisions captured during brainstorming

| Question | Decision |
| --- | --- |
| Layout relative to existing nav tiles | Analytics on top, existing 4 tiles below |
| YTD definition | Calendar year (Jan 1 → today, America/New_York) |
| FNG detection | Parse `FNG:` line from `content_text` |
| Top PAX size | Top 20 always visible (no expand) |
| PAX identity merging | Best-effort merge via `slack_users.display_name` |
| Refresh strategy | Live query on every page load |
| Chart library | None — hand-rolled SVG + CSS |
| Data fetching | Async Server Component (`getSql()` directly) |

## Architecture

`src/app/admin/page.tsx` becomes an `async` Server Component. It calls a new
`getDashboardStats()` function which runs three SQL queries in parallel via
`Promise.all`, returning a typed `DashboardStats` object. The page passes
data into three new presentation components.

Auth is already enforced by the admin layout (the page is reachable only
after `validateAdminToken`), so no extra check is needed inside the page
itself.

### File layout

```
NEW src/lib/stats/getDashboardStats.ts        # entry point — returns { kpis, byAo, topPax }
NEW src/lib/stats/parseFngLine.ts             # extracts FNG names from content_text
NEW src/lib/stats/resolvePaxIdentity.ts       # merges Slack-ID + nickname tokens via slack_users
NEW src/components/admin/DashboardStats.tsx   # KPI tile grid (server component)
NEW src/components/admin/PostsByAoChart.tsx   # SVG pie chart (server-rendered)
NEW src/components/admin/TopPaxChart.tsx      # horizontal bar chart (CSS grid)
EDIT src/app/admin/page.tsx                   # async, renders new sections above existing tiles
NEW tests/admin-dashboard.spec.ts             # Playwright happy-path + empty state
NEW tests/parseFngLine.test.ts                # unit tests for FNG parser (node --test)
NEW tests/resolvePaxIdentity.test.ts          # unit tests for identity merge
```

Total new code: ≈350 LOC including helpers and tests.

### Data flow

```
GET /admin
   └─ admin/page.tsx (async RSC)
        └─ getDashboardStats()
              ├─ Promise.all
              │    ├─ SQL: COUNT events YTD + GROUP BY ao
              │    ├─ SQL: pull content_text rows YTD
              │    └─ SQL: SELECT slack_user_id, display_name FROM slack_users
              ├─ parseFngLine(row.content_text) per row → Set<token>
              ├─ extractPaxTokens(row.content_text) per row → Map<token, count>
              └─ resolvePaxIdentity(counts, slackUsers) → ranked array
   └─ renders DashboardStats + PostsByAoChart + TopPaxChart + existing nav tiles
```

All data fetching and rendering happens on the server. Client receives only
HTML; no chart JS ships to the browser.

## Data definitions

### Region filter (used in all queries)

```sql
FROM f3_events e
JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
WHERE e.event_kind = 'backblast'
  AND e.is_deleted = false
  AND c.is_enabled = true
  AND e.event_date IS NOT NULL
  AND e.event_date >= date_trunc('year', (now() AT TIME ZONE 'America/New_York'))::date
```

The `ao_channels` join (rather than `ao_display_name` matching) ensures
Slack-only AOs (e.g., Black Ops) that aren't mirrored in `workout_schedule`
are included. Matches the precedent in `src/lib/stats/getWeeklyPaxCount.ts`.

### Total Posts YTD

Derived from the Posts-by-AO query below — `sum(n)` across all AO rows. No
separate SQL query.

### Posts by AO (pie chart data)

```sql
SELECT e.ao_display_name AS ao, COUNT(*)::int AS n
FROM f3_events e
JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
WHERE … (region filter)
GROUP BY e.ao_display_name
ORDER BY n DESC;
```

Returns `Array<{ ao: string; n: number }>`. In the renderer, the top 4 AOs
get their own pie slice; AOs ranked 5+ collapse into a single "Other"
slice. The chart component computes percentages and SVG arc paths from
counts.

### Unique PAX YTD

```sql
SELECT e.content_text
FROM f3_events e
JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
WHERE … (region filter)
```

In TypeScript:
1. For each row, run `extractPaxTokens(row.content_text)` (already exported
   from `src/lib/stats/getWeeklyPaxCount.ts`).
2. Union all returned Sets into a single Set.
3. Run `resolvePaxIdentity` on the union to collapse Slack-ID ↔ nickname
   duplicates. Return `.size`.

### Top PAX YTD (bar chart data)

Uses the same `content_text` rows as Unique PAX YTD.

1. For each row, run `extractPaxTokens(row.content_text)`.
2. Increment a `Map<token, number>` — each token gets +1 per event it
   appears in. (Same person posting twice on the same backblast doesn't
   double-count; the Set returned by `extractPaxTokens` is per-event.)
3. Run `resolvePaxIdentity(map, slackUsers)` to merge tokens belonging to
   the same person.
4. Sort by count descending, take top 20, return
   `Array<{ label: string; count: number }>`.

### New FNGs YTD

Uses the same `content_text` rows again (shared with Unique PAX / Top PAX
queries — no extra fetch).

1. For each row, run new `parseFngLine(row.content_text)` → `Set<token>`.
2. Union all returned Sets.
3. Run `resolvePaxIdentity` on the union to collapse duplicates.
4. Return `.size`.

#### parseFngLine spec

```typescript
export function parseFngLine(content: string): Set<string>;
```

- Regex: `/^[\s*_]*FNG[s]?[\s*_]*:\s*(.+)$/im` — matches `FNG:` or `FNGs:`
  at start of any line, case-insensitive, tolerant of Slack-markdown
  asterisks / underscores wrapping the label.
- Extract names the same way `extractPaxTokens` does: pull `@U...` Slack
  IDs first, then split the remainder by comma, trim, lowercase, prefix
  nickname tokens with `n:` to avoid collision with Slack IDs.
- **Stopwords filtered out** (return empty set if the line is just one of
  these): `none`, `n/a`, `na`, `-`, `0`, `zero`, `pax`, `fng`, `fngs`,
  empty string.
- **Numeric-only lines** (`FNG: 2`, `FNG: 3 (no names)`) → return an empty
  Set. Without names we can't dedupe across the year, and same FNGs are
  often re-mentioned the next week. Logged at `console.warn` so we can
  audit how often this happens.

#### resolvePaxIdentity spec

```typescript
type SlackUser = { slack_user_id: string; display_name: string | null };

export function resolvePaxIdentity(
  counts: Map<string, number>,
  slackUsers: SlackUser[],
): Array<{ key: string; label: string; count: number }>;
```

Behavior:
1. Build `slackById: Map<U… → display_name>` (with original casing) and
   `slackByName: Map<n:<lower(display_name)> → display_name>` for reverse
   lookup.
2. For each `(token, count)` in input, decide the canonical key:
   - If `token` starts with `U` (Slack ID) and has a row in `slackById`,
     canonical key = `n:<lower(display_name)>`.
   - If `token` starts with `n:` and `slackByName.has(token)`, canonical
     key = `token` (already in the form `n:<lower-name>`).
   - Otherwise canonical key = `token` (raw, unmerged).
3. Determine the display label per canonical key:
   - If `slackByName.has(key)`, label = `slackByName.get(key)` (the actual
     `display_name` from Slack — preserves the user's preferred casing).
   - Else if key starts with `U`, label = key (the raw Slack ID — only
     happens when the `slack_users` row is missing).
   - Else label = `key.slice(2)` (nickname without `n:` prefix) with the
     first letter of each word capitalized. Limitation: loses distinctive
     casing like `MC` → `Mc`. Acceptable for v1.
4. Sum counts per canonical key. Return sorted by count desc.

This is a best-effort merge. Cases it does NOT handle (acceptable in v1):
- Two nicknames differing only by spacing / punctuation
  (`BillNye` vs `Bill Nye`) — counted separately.
- A nickname that doesn't appear in `slack_users.display_name` at all —
  counted as its own entity.
- Stale `slack_users` rows (Slack ID with no row) — token displayed as raw
  `U…`.

## UI design

### Layout

```
┌────────────────────────────────────────────────────────────┐
│ // § ADMIN · DASHBOARD                                      │
│ Region Ops.                                                 │
│ YTD analytics + management.                                 │
├────────────┬──────────────┬─────────────────────────────────┤
│ TOTAL POSTS│ NEW FNGS YTD │ UNIQUE PAX YTD                  │
│ 412        │ 23           │ 187                             │
├────────────┴──────────────┴─────────────────────────────────┤
│ ┌──────────────┬─────────────────────────────────────┐      │
│ │ POSTS BY AO  │ TOP POSTERS (top 20)                │      │
│ │ [pie chart]  │ [horizontal bars sorted desc]       │      │
│ └──────────────┴─────────────────────────────────────┘      │
├────────────────────────────────────────────────────────────┤
│ ACTIVE AOS │ REGIONS │ DRAFTS │ NEWSLETTER  (existing nav)  │
└────────────────────────────────────────────────────────────┘
```

- KPI row: 3 equal-width tiles (`grid-cols-3` at md+, `grid-cols-1`
  below).
- Charts row: pie tile = 5/12 width, bar tile = 7/12 (`grid-cols-12 col-span-5
  / col-span-7` at md+, stacked below). Bar gets more space because PAX
  labels need ≥130px.
- Nav row: unchanged from current `/admin/page.tsx`.

### Brand reuse

- All tiles use the existing `ClipFrame` component (or its underlying
  styles — see implementation plan for the call). No new chrome.
- Headers use `MonoTag` for the `// …` eyebrow and the existing display
  font (Anton) for the big numbers.
- Pie palette: `#d4a93c` (champagne gold), `#0a0a0a` (ink), `#7e6b3a`
  (bronze), `#b8a160` (sand), `#d4d0c2` (stone). All from the existing
  brand tokens; no new colors introduced.
- Bars use solid ink (`#0a0a0a`) on cream background — full-width bar = top
  poster, rest scale proportionally.

### Empty & error states

- **Zero events YTD** (e.g., January 1): KPI tiles show `0`; pie shows a
  single grey "No data yet" wedge; bar shows `// no posts yet this year`.
- **Zero FNGs YTD**: KPI shows `0` with subtext "no FNG lines found".
- **Query failure**: each metric is wrapped in its own try/catch inside
  `getDashboardStats`. Returns `{ ok: false, error: '...' }` for that
  metric. Page renders the other tiles plus an inline error message for the
  failed one. Mirrors the `try/catch` pattern in `getImpactStats.ts`.

## Performance

- Three SQL queries via `Promise.all`:
  1. `COUNT(*) + GROUP BY ao` — index-friendly, returns one row per AO.
  2. `SELECT content_text WHERE event_date >= …` — pulls ~1k rows × ~2KB
     each ≈ ~2MB.
  3. `SELECT slack_user_id, display_name FROM slack_users` — small (<1k
     rows).
- TypeScript work (parsing 1k content_text strings) is O(n) per parser,
  each parser is regex-based; benchmarked locally well under 200ms.
- Expected total p95: <500ms. If/when this gets slow, the upgrade path is
  a materialized view refreshed on Slack ingest — out of scope here.

## Testing

### Unit tests

`tests/parseFngLine.test.ts` (run via `node --test --import tsx`):

| Input | Expected |
| --- | --- |
| `"FNG: Nessie, Bill Nye"` | `{n:nessie, n:bill nye}` |
| `"*FNGs:* Nessie, @U01ABC123"` | `{n:nessie, U01ABC123}` |
| `"FNG: none"` | `{}` |
| `"FNG: 2"` | `{}` |
| `"FNG: 3 (no names)"` | `{}` |
| `"PAX: Foo\nFNG: Bar"` | `{n:bar}` |
| content with no FNG line | `{}` |

`tests/resolvePaxIdentity.test.ts`:

| Inputs | Expected |
| --- | --- |
| Slack ID + matching nickname → same person | one row with summed count |
| Slack ID with no `slack_users` row → raw fallback | one row keyed by `U…` |
| Two unrelated nicknames | two rows |
| Empty input | empty array |

### Integration test

`tests/admin-dashboard.spec.ts` (Playwright):

1. **Happy path** — admin logs in, navigates to `/admin`, asserts:
   - The h1 says "Region Ops."
   - Three KPI numbers are visible and parseable as integers.
   - Pie SVG with ≥2 `<path>` elements is rendered.
   - Top PAX list has ≥1 bar row.
   - Four nav tiles (Active AOs / Regions / Drafts / Newsletter) are
     present and clickable.
2. **Empty state** — with a stubbed-zero database (via a dev-only
   `?__empty=1` query-string flag honored by `getDashboardStats`), assert
   all three KPI tiles show `0` and the bar chart shows the placeholder
   message.

### Manual verification

Per CLAUDE.md UI Feature Verification rule: after implementation, load
`/admin` in a real browser, confirm the three new sections render with
real region data, and screenshot for the PR.

## Implementation order

A separate plan (created by `writing-plans`) will sequence the work. High
level:

1. Parsers (`parseFngLine`, `resolvePaxIdentity`) + unit tests.
2. `getDashboardStats` query helper.
3. Chart components (`DashboardStats`, `PostsByAoChart`, `TopPaxChart`).
4. Wire into `admin/page.tsx`.
5. Playwright test.
6. Manual browser verification on local dev.

## Risks & mitigations

| Risk | Mitigation |
| --- | --- |
| FNG line format varies more than expected | Log every line the regex matches but `parseFngLine` returns empty for; review logs after first deploy and tighten stopwords if needed. |
| PAX identity merge undercounts (multiple nicknames per person) | Accept v1 limitation. Add a small admin-only "PAX aliases" admin section later if it matters. |
| `content_text` pull > 5MB at some point | Add the materialized view upgrade path. Not a v1 concern. |
| Stale `slack_users` rows after a new join | Existing slack-user sync job runs daily; gap is at most 24h. |
