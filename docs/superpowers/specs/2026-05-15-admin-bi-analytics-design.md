# Admin BI Analytics — Design

**Status:** Draft
**Author:** Jordan Lawson (with Claude)
**Date:** 2026-05-15
**Supersedes / extends:** `docs/superpowers/specs/2026-05-13-admin-dashboard-analytics-design.md` (Phase 1, shipped)
**Related:** `src/app/admin/`, `src/lib/stats/`, `src/lib/admin/auth.ts`, `supabase/migrations/`

## Summary

Expand the F3 Marietta admin dashboard from a single at-a-glance YTD page into
a BI-style tool that lets region admins pivot, dissect, drill down, and
download workout data. Phase 1 stays in place as the at-a-glance view at
`/admin`; this work adds a new `/admin/analytics` route with overview and
click-through detail pages, URL-driven filters, and CSV export.

This spec covers an MVP scoped to be useful from day one and to land as one or
two phases of work, with a deferred Phase 2 backlog of cohort/retention
metrics that need more data and more design.

## Goals

1. Stand up `/admin/analytics` (overview) + `/admin/analytics/ao/[slug]` + `/admin/analytics/pax/[slug]` — three RSC pages with shared filter state in URL search params.
2. Provide 10 MVP metrics covering posts, AO distribution, top PAX, FNG count, Q rotation, and posting streaks — all drillable by time range and AO.
3. Support shareable, bookmarkable views via URL-encoded filters.
4. Export per-view CSV and a full raw fact-table dump.
5. Fix three data-quality gaps in Phase 0 so the BI module reads clean data.
6. Stay on the RSC + hand-rolled SVG/CSS grain established by Phase 1; no new chart library, no client-side data fetching, no client JS for charts.

## Non-goals (MVP)

- FNG retention / conversion math (needs cohort tracking — Phase 2).
- PAX cohort retention curves and MoM retention rates (Phase 2).
- AO health composite score (definitional work needed — Phase 2).
- First-time-Q events / "Q school" pipeline (Phase 2).
- Q diversity index per AO (Gini / HHI — Phase 2).
- Tableau-style custom pivot builder (Phase 2).
- Materialized views, caching layers, scheduled aggregations (data volume too small to justify).
- Multi-region — single region only, matches the rest of the app.
- Year-over-year comparisons (region data only starts Jan 2026; YoY impossible until 2027).
- Mobile-only "executive summary" mode — desktop and mobile share the same pages with responsive components.

## Decisions captured during brainstorming (2026-05-15)

| Question | Decision |
| --- | --- |
| Phasing | MVP first, Phase 2 deferred (still one spec, one plan, internally phased) |
| Page structure | Overview + click-through detail pages |
| Location | New `/admin/analytics` route (Phase 1's `/admin` is preserved as the KPI dashboard) |
| Export | Per-view CSV + full raw-data dump |
| Architecture | RSC-first, URL-driven filters, file-based drill-down routes |
| Charting | Hand-rolled SVG + CSS, server-rendered (Phase 1 pattern) — no chart library, no client JS for charts |
| Data layer location | Extend `src/lib/stats/` (Phase 1's home for analytics code) |
| API routes for reads | None — RSC calls `lib/stats/` directly |
| Caching | `force-dynamic` on all analytics routes |
| Filter state | URL search params (shareable, bookmarkable) |
| Time-range source | Server parses `?range=` query param into Postgres-friendly bounds |
| Materialization | None. Live queries. ~80 backblasts × ~25 PAX = ~2000 fact rows max |
| `f3_event_attendees` | Not used (ingest broke early March, content_text parsing is system of record) |
| `f3_event_qs` | Used (85% coverage, current through May) |
| Unresolved Slack IDs | `pax_alias_map` table — admin-editable, ~3 rows expected |

## Phase 0 — Data Quality Fixes (lands first)

Three small fixes that retroactively improve Phase 1's `/admin` page at no
cost, plus housekeeping. These are tasks 1-4 of the implementation plan.

### Gap 1: Name-resolution fallback

Update `src/lib/stats/resolvePaxIdentity.ts` to use `COALESCE(display_name, real_name)`. Resolution order becomes:

```
slack_users.display_name → slack_users.real_name → pax_alias_map.display_name → raw <U…> ID
```

Of 28 distinct Slack IDs found in `content_text`, this lifts resolution from 17 (61%) to 25 (89%) for free. Unit test `tests/resolvePaxIdentity.test.ts` adds a case asserting the fallback order.

### Gap 2: One-time `event_date` backfill

Script `scripts/backfillEventDates.ts` — idempotent (`WHERE event_date IS NULL`), run locally once:

- 6 January 2026 backblasts have a parseable `DATE: YYYY-MM-DD` line in `content_text` — parse and set.
- 1 May 2026 backblast (Black Ops Trail Trial) has no `DATE:` line — fall back to `created_at::date`.

Script is deleted after running (one-off, like the other backfill scripts already in `scripts/`).

### Gap 3: `pax_alias_map` table for stragglers

Migration `supabase/migrations/20260516_pax_alias_map.sql`:

```sql
create table if not exists pax_alias_map (
  slack_id text primary key,
  display_name text not null,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function pax_alias_map_set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger pax_alias_map_updated_at
  before update on pax_alias_map
  for each row execute function pax_alias_map_set_updated_at();
```

Admin UI at `/admin/aliases` — tiny CRUD page (list, add, delete) since aliases will need occasional touching as new PAX appear who aren't in the Slack workspace yet. API at `/api/admin/aliases` (GET/POST/DELETE) gated by `validateAdminToken`.

`resolvePaxIdentity.ts` reads the alias map (one query, cached per request).

### Housekeeping (no code, just hygiene)

- Delete `scripts/profileAnalyticsData.ts` (one-off probe from brainstorming — already done before this spec was finalized).
- Commit the modified `.claude/context/feature-status.md`.
- Commit (or delete) the untracked Phase 1 plan doc `docs/superpowers/plans/2026-05-13-admin-dashboard-analytics.md`.

### Out of scope

The stale `f3_event_attendees` ingest bug is its own ticket. BI uses `content_text` parsing as system of record (decided 2026-05-15).

## Architecture

### File layout

```
NEW src/app/admin/analytics/page.tsx                     # Overview (async RSC)
NEW src/app/admin/analytics/ao/[slug]/page.tsx           # AO drill-down (async RSC)
NEW src/app/admin/analytics/pax/[slug]/page.tsx          # PAX drill-down (async RSC)
NEW src/app/admin/analytics/export/route.ts              # CSV export endpoint
NEW src/app/admin/analytics/loading.tsx                  # Skeleton for filter nav
NEW src/app/admin/analytics/error.tsx                    # RSC error boundary
NEW src/app/admin/analytics/_components/FilterBar.tsx    # client, URL-param driven
NEW src/app/admin/analytics/_components/MetricCard.tsx
NEW src/app/admin/analytics/_components/DrillTable.tsx
NEW src/app/admin/analytics/_components/ExportButton.tsx
NEW src/app/admin/analytics/_components/PostsOverTimeChart.tsx
NEW src/app/admin/analytics/_components/DayOfWeekChart.tsx
NEW src/app/admin/analytics/_components/AoDistributionPie.tsx
NEW src/app/admin/aliases/page.tsx                       # Tiny alias CRUD page
NEW src/app/admin/aliases/_components/AliasForm.tsx
NEW src/app/api/admin/aliases/route.ts                   # GET / POST
NEW src/app/api/admin/aliases/[id]/route.ts              # DELETE

NEW src/lib/stats/getAoStats.ts                          # per-AO aggregates
NEW src/lib/stats/getPaxStats.ts                         # per-PAX aggregates
NEW src/lib/stats/getAttendanceFact.ts                   # (PAX × backblast) fact rows
NEW src/lib/stats/getQStats.ts                           # uses f3_event_qs
NEW src/lib/stats/parseAttendance.ts                     # canonical content_text parser → { pax, headcount, fngNames }
NEW src/lib/stats/timeRange.ts                           # parse/serialize ?range= + bounds
NEW src/lib/stats/getOverviewStats.ts                    # filtered version of getDashboardStats
NEW src/lib/stats/computeStreak.ts                       # longest consecutive weeks helper
NEW src/lib/stats/aliasMap.ts                            # read pax_alias_map (request-cached)

EDIT src/lib/stats/resolvePaxIdentity.ts                 # adds COALESCE + alias map fallback

NEW supabase/migrations/20260516_pax_alias_map.sql
NEW scripts/backfillEventDates.ts                        # one-time, deleted after running

NEW tests/parseAttendance.test.ts                        # unit
NEW tests/timeRange.test.ts                              # unit (+ vocabulary contract test)
NEW tests/computeStreak.test.ts                          # unit
NEW tests/getAttendanceFact.test.ts                      # unit (with DB fixtures)
NEW tests/admin-analytics.spec.ts                        # Playwright E2E
EDIT tests/resolvePaxIdentity.test.ts                    # COALESCE + alias fallback cases
```

### Data flow (overview page)

```
GET /admin/analytics?range=ytd&ao=all
   └─ middleware: validateAdminToken (existing admin route guard)
   └─ admin/analytics/page.tsx (async RSC)
        ├─ timeRange.parse(searchParams.range) → { from, to, label }
        ├─ resolveAoSlug(searchParams.ao) → ao_slug | null
        ├─ Promise.all:
        │    ├─ getOverviewStats({ from, to, ao })    # KPI strip
        │    ├─ getAttendanceFact({ from, to, ao })   # raw fact rows
        │    └─ getQStats({ from, to, ao })           # Q list
        ├─ derive client-friendly view models
        └─ renders FilterBar + MetricCard×4 + AoDistributionPie + TopPaxChart
              + PostsOverTimeChart + DayOfWeekChart + ExportButton
```

Same pattern for AO and PAX detail pages — `params.slug` resolves to an entity,
`searchParams.range` provides the window, server fetches all aggregates in
parallel, page renders.

### Filter state in URL

All filters live in URL search params. The filter bar (a client component)
rewrites the URL via `useRouter().push()` — the route re-renders, server
re-queries, and the page updates. No client-side data state.

Search param contract (Phase 0 validated via `timeRange.ts`):

| Param | Values | Default | Notes |
|---|---|---|---|
| `range` | `ytd \| mtd \| last-30 \| last-90 \| custom` | `ytd` | invalid → redirect to default |
| `from` | `YYYY-MM-DD` | (none) | required when `range=custom`, ignored otherwise |
| `to` | `YYYY-MM-DD` | (none) | required when `range=custom`, ignored otherwise |
| `ao` | `all` or `ao_slug` from `ao_channels` | `all` | unknown slug → redirect to `all` |
| `topN` | `10 \| 20 \| all` | `20` | overview / AO detail only |

Time-range semantics, all `America/New_York`:

- `ytd` = `2026-01-01` through today inclusive
- `mtd` = first of current month through today inclusive
- `last-30` / `last-90` = rolling window ending today (inclusive)
- `custom` = `from..to` inclusive; validated `from <= to <= today` and span ≤ 2 years

### Drill-down navigation

Click an AO bar/slice → `<Link href={`/admin/analytics/ao/${slug}?range=${currentRange}`}>` — the time range is preserved across drills. Same for PAX: click a bar → `/admin/analytics/pax/${slug}?range=${currentRange}`.

PAX slug: lowercased, kebab-cased `display_name`. Slack IDs aren't slugs; the route accepts a slug and the page resolves it via `slack_users.display_name ILIKE` or `pax_alias_map.display_name ILIKE`. Unresolved → `notFound()`.

AO slug: derived at query time from `ao_channels.ao_display_name` as `lower(regexp_replace(ao_display_name, '[^a-zA-Z0-9]+', '-', 'g'))`. No column added, no migration. The slug ↔ AO resolution is a single `WHERE` clause on the derived expression. Examples: "Black Ops" → `black-ops`, "The Battlefield" → `the-battlefield`.

## MVP feature spec

### Overview page — `/admin/analytics`

**Filter bar (top, sticky on scroll):**
- Time range pill group: YTD · MTD · 30d · 90d · Custom
- AO dropdown: All AOs · Black Ops · CSAUP · The Battlefield · The Last Stand
- Top-N pill group: 10 · 20 · All (affects PAX bar)
- "Reset" link if any param differs from defaults

**KPI strip (4 tiles):**
- Total posts (in range, with AO filter applied)
- Unique PAX
- FNG count (parsed from `FNG:` lines)
- Avg headcount per workout (parsed from `COUNT:` lines)

**Charts:**
- Posts by AO — pie (reuses Phase 1 `PostsByAoChart`, accepts filtered data)
- Top-N PAX — horizontal bar (reuses Phase 1 `TopPaxChart`, accepts N + filtered data)
- Posts over time — monthly line (new `PostsOverTimeChart`)
- Day-of-week distribution — vertical bar (new `DayOfWeekChart`)

**Drill triggers:**
- Click an AO slice → AO detail page (preserves `?range`)
- Click a PAX bar → PAX detail page (preserves `?range`)

**Export buttons (bottom-right of page):**
- "Download CSV" → exports current filtered slice
- "Download all raw data" → exports full denormalized fact table

### AO detail — `/admin/analytics/ao/[slug]`

**Header strip:** AO name · total posts · unique PAX · avg headcount · FNG count (all respecting `?range`)

**Body:**
- Posts over time (monthly line)
- Top PAX at this AO (horizontal bar, defaults to top-20)
- Q rotation list (from `f3_event_qs`): for each Q, count of times Q'd in range; sorted desc
- Filter bar inherits time-range only (no AO filter — AO is the path)
- Export: "Download CSV (this AO)"

### PAX detail — `/admin/analytics/pax/[slug]`

**Header strip:** PAX name · total posts · AOs visited · first-seen month · longest streak (consecutive weeks)

**Body:**
- Posts over time (monthly line)
- AO distribution (pie — which AOs they visit, by post count)
- Q count + list of workouts they Q'd (date · AO · headcount)
- Filter bar inherits time-range only
- Export: "Download CSV (this PAX)"

### MVP metric set (10)

| Metric | Where it shows | Source |
|---|---|---|
| Total posts | All 3 pages, filtered | `f3_events` |
| Avg headcount | Overview, AO detail | `parseAttendance().headcount` (from `COUNT:` line) |
| FNG count | Overview, AO detail | `parseFngLine` (existing) |
| Unique PAX | Overview, AO detail | `getAttendanceFact` distinct |
| Top-N PAX | Overview, AO detail | `getAttendanceFact` group + sort |
| Posts by AO | Overview | `f3_events` group by `ao_display_name` |
| Posts over time | All 3 pages | `f3_events` group by month |
| Day-of-week distribution | Overview | `f3_events` group by `extract(dow)` |
| Q list (per AO) | AO detail | `f3_event_qs` |
| Posting streak | PAX detail | `computeStreak` over `getAttendanceFact` |

## Export contract

Single route: `/admin/analytics/export?scope=...&range=...&from=...&to=...&ao=...&pax=...`

Auth: `validateAdminToken` on every request (same admin-auth pattern as the rest of the admin API).

| `scope` | Output |
|---|---|
| `overview` | One row per AO, with totals: `ao_name, ao_slug, total_posts, unique_pax, fng_count, avg_headcount` (filtered by `range`) |
| `ao` | One row per backblast for `ao=<slug>`: `event_date, ao_name, q_names, headcount, fng_count, pax_count` |
| `pax` | One row per backblast `pax=<slug>` posted at: `event_date, ao_name, was_q, headcount` |
| `raw` | One row per (PAX × backblast) — full fact table: `event_date, ao_name, ao_slug, pax_slack_id, pax_display_name, is_q, headcount, fng_count` — no time filter applied for `raw` |

Format: UTF-8 CSV, header row, ISO dates (`YYYY-MM-DD`), `\n` line endings, RFC 4180 quoting.

Filename: `f3-analytics-{scope}-{range-or-ao-or-pax-slug}-{today}.csv`

Streamed via `Response` with `Content-Type: text/csv; charset=utf-8` and `Content-Disposition: attachment; filename=...`.

## Testing strategy

### Unit tests (`tsx --test`, the Phase 1 test runner — Node built-in `node:test`)

- `parseAttendance.test.ts` — content_text → `{ pax, headcount, fngNames }`. Covers Slack-ID PAX tokens, nickname PAX tokens, mixed; `COUNT:` line presence/absence/malformed; `FNG:` line presence/absence; FNGs excluded from PAX list; empty content.
- `timeRange.test.ts` — preset parsing, custom range validation, edge cases (DST, year boundaries, `to < from`, future dates). **Includes a vocabulary contract test** asserting every preset round-trips: `parse(preset).label` produces a valid display label, all 5 presets appear in the FilterBar source, and the type union matches.
- `computeStreak.test.ts` — longest consecutive-week run over a sorted date list.
- `getAttendanceFact.test.ts` — DB fixture: insert 3 backblasts, assert fact rows correct (with COUNT, FNG, Q parsing).
- `resolvePaxIdentity.test.ts` (extends existing) — COALESCE fallback, alias-map fallback, raw `<U…>` last resort.

### E2E (Playwright)

`tests/admin-analytics.spec.ts`:

1. **Overview happy path** — navigate to `/admin/analytics` after admin login, all 4 KPI tiles render with numeric values, all 4 charts render (SVG present).
2. **Filter change updates URL** — click "30d" range, URL contains `?range=last-30`, KPI tiles re-render with different values (or same — just assert no error).
3. **AO drill-down navigates** — click an AO slice, URL is `/admin/analytics/ao/<slug>?range=...`, AO detail page renders with header strip + charts.
4. **PAX drill-down navigates** — click a PAX bar on overview, URL is `/admin/analytics/pax/<slug>?range=...`, PAX detail renders.
5. **Drill-down preserves time range** — drill from `?range=mtd` overview, AO detail URL contains `?range=mtd`.
6. **Export download triggers** — click "Download CSV", browser receives a `text/csv` response with `Content-Disposition: attachment`.
7. **Invalid range redirects** — visit `/admin/analytics?range=banana`, end up at `/admin/analytics?range=ytd` (or just `/admin/analytics`).
8. **Unknown AO slug → 404** — visit `/admin/analytics/ao/nonexistent`, page returns 404.
9. **Empty state** — visit `/admin/analytics?range=custom&from=2025-01-01&to=2025-01-02` (pre-data window), KPI tiles read `0`, charts render empty-state cards.

Existing `tests/admin-dashboard.spec.ts` (Phase 1) is left alone.

## Error handling

| Failure mode | Behavior |
|---|---|
| Invalid `range` enum | Redirect to `/admin/analytics` (defaults applied) |
| `range=custom` missing `from`/`to` | Redirect to `/admin/analytics?range=ytd` |
| `from > to` or `to > today` | Redirect to `/admin/analytics?range=ytd` |
| Unknown `ao` slug in path | `notFound()` → 404 |
| Unknown PAX slug in path | `notFound()` → 404 |
| Empty result set | Empty-state card (no error) — "No posts in this range / for this AO / etc." |
| DB query throws | Bubbles to `app/admin/analytics/error.tsx` boundary; logs server-side |
| Admin auth fail | Existing middleware redirects to `/admin/login` |
| Export route hit without auth | 401 |

## Performance & freshness

- Live queries on every page load. Data ceiling: ~80 backblasts × ~25 PAX = ~2000 fact rows max. No materialization, no caching layer, no scheduled aggregation.
- `export const dynamic = 'force-dynamic'` on every analytics route (admin auth + freshness requirement).
- Suspense boundaries around the slower aggregates (`getAttendanceFact`) so KPI tiles can stream first.
- Charts are server-rendered SVG/CSS (Phase 1 pattern: see `PostsByAoChart`, `TopPaxChart`). No `'use client'` needed. The only client component is `FilterBar`.
- No new indexes required. Existing `f3_events(event_date)` index covers all range queries. `f3_event_qs(event_id)` covers Q lookups.

## Mobile

- All 3 pages target 375px minimum width.
- Filter bar collapses to a drawer/sheet on `< md` (Tailwind breakpoint).
- Charts use viewBox-based responsive SVG (Phase 1 pattern, already in use).
- Top-N tables become stacked cards on narrow viewports.
- KPI strip wraps 2×2 on narrow viewports.

## Loading states

- `app/admin/analytics/loading.tsx` provides a skeleton during filter-change navigations and drill-down navigations.
- Skeleton mirrors the structure of the page (filter-bar placeholder + 4 tile placeholders + 4 chart placeholders).
- Filter change = navigation = brief skeleton. Acceptable trade-off for shareable URLs.

## Implementation phasing summary

The plan that follows this spec breaks into rough phases. They land as one
continuous stream of work, but the phase markers exist so each commit/PR can
be a small, reviewable, working step.

### Phase 0 — Data quality (tasks 1-4)

1. Update `resolvePaxIdentity.ts` (COALESCE + alias map) + tests
2. Create `pax_alias_map` migration + `/admin/aliases` page + API
3. Write & run `scripts/backfillEventDates.ts`, then delete it
4. Commit modified `feature-status.md` + Phase 1 plan housekeeping

### Phase A — Foundation (tasks 5-8)

5. New `lib/stats` modules: `timeRange`, `parseAttendance`, `getAttendanceFact`, `computeStreak`, `aliasMap` (+ unit tests)
6. New `lib/stats` aggregators: `getOverviewStats`, `getAoStats`, `getPaxStats`, `getQStats` (+ unit tests)
7. Filter bar + URL-param plumbing (`_components/FilterBar.tsx`, `timeRange` integration)
8. Skeleton routes for `/admin/analytics`, `/admin/analytics/ao/[slug]`, `/admin/analytics/pax/[slug]` — empty pages that render filter bar only

### Phase B — Overview page (tasks 9-11)

9. KPI strip + reused PostsByAoChart + TopPaxChart on overview
10. New charts: `PostsOverTimeChart`, `DayOfWeekChart`
11. Drill-link wiring (clicking AO/PAX navigates with preserved range)

### Phase C — Detail pages (tasks 12-13)

12. AO detail page — header strip + charts + Q rotation
13. PAX detail page — header strip + charts + Q'd workouts list

### Phase D — Export + polish (tasks 14-16)

14. `/admin/analytics/export/route.ts` — 4 scopes (overview / ao / pax / raw)
15. `loading.tsx` + `error.tsx` + empty-state components
16. Mobile pass + accessibility polish

### Phase E — Tests + ship (tasks 17-18)

17. `tests/admin-analytics.spec.ts` — all 9 E2E scenarios
18. Final review pass + update `feature-status.md` to "Complete"

## Phase 2 backlog (deferred — separate spec when scoped)

The metrics list approved during brainstorming includes several that need more
design work, more data, or both. They are NOT in scope for this spec.

| Metric / feature | Why deferred |
|---|---|
| FNG retention (which FNGs came back) | Needs cohort tracking design — when does "retained" count? |
| PAX cohort retention curves | Needs cohort assignment rules + viz design |
| MoM retention rate | Same as above |
| AO health composite score | Needs definitional work (weighted formula across what dimensions?) |
| First-time-Q events / "Q school" pipeline | Needs Q-history index + design for what the pipeline view shows |
| Q diversity index per AO | Needs metric choice (Gini? HHI?) + viz |
| Custom pivot builder | Tableau-style — significant UI/state work |
| `f3_event_attendees` ingest fix | Out of scope here; separate ticket |

## Known risks

1. **Slack-ID parsing brittleness.** `parseAttendance.ts` consolidates regex logic that's currently scattered across Phase 1 files. Risk: a parser change subtly breaks Phase 1's KPI numbers. Mitigation: unit tests with fixtures pulled from real `content_text` rows; visual regression check on `/admin` after deploy.

2. **PAX slug collisions.** Two PAX with the same `display_name` would slug-collide. Mitigation: at first occurrence (none expected today), fall back to slug + `-2` etc. or use `slack_id` as slug. For MVP, assume uniqueness and `notFound()` on ambiguity.

3. **Hand-rolled SVG complexity.** Phase 1 keeps charts simple (pie + bar). Adding a monthly line chart and a DOW bar means writing slightly more SVG math. Mitigation: pattern-match Phase 1's approach; lines are just `<polyline>`/`<path>`; DOW bars are CSS widths like Top PAX. No new abstractions.

4. **Custom date range abuse.** Admin pastes `?from=1900-01-01&to=2100-01-01`. Mitigation: server-side validation caps span at 2 years.

5. **`f3_event_qs` coverage holes.** 85% coverage means some Q lists are incomplete. Mitigation: empty-state messaging on Q list ("Q data may be incomplete for older workouts").

6. **Cascading-fix risk.** Per CLAUDE.md, if this requires 3+ "fix:" commits in one day, stop. Mitigation: Phase 0 ships first as an isolated change; each subsequent phase ships behind a small commit that can be reverted cleanly.

## Open questions

None at spec time. All scoping decisions answered in brainstorming (see decision table above).
