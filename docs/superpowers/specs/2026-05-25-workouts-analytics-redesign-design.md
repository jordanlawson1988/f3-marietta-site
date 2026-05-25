# Workouts + Analytics Redesign — Design Spec

**Date:** 2026-05-25
**Branch:** `feature/ao-channel-auto-join` (target)
**Author:** Jordan Lawson via Claude (Opus 4.7 1M)

## Goals

Four discrete changes, bundled because they share UI surfaces and the same admin filter component:

1. Show workout TYPE (Bootcamp / Run / Ruck / CSAUP / etc.) on every public workout card on `/workouts`.
2. Collapse the redundant `/admin` Dashboard into `/admin/analytics`. Preserve the FNG drill-down currently anchored on the Dashboard.
3. Replace the AO `<select>` dropdown on the analytics filter bar with a multi-select chip row whose dots match the colors used in the existing "Posts by AO" pie chart.
4. Fix the `topN=all` bug on the analytics page — selecting "All" must update both the chart heading text AND the underlying data, not just the heading.

## Non-goals

- New workout-type enum / DB constraint. The `workout_schedule.workout_type` column stays free-form text; admin form keeps its datalist suggestions.
- Drill-downs for Total Posts / Unique PAX / Avg Headcount metric tiles. Only the New FNGs tile becomes clickable in this change.
- Multi-AO routes for the nested `/admin/analytics/ao/[slug]` drill-down. That URL keeps single-AO semantics; multi-AO blends only live on the main `/admin/analytics` page.
- Net-new analytics queries or fact tables. We are reshaping inputs/outputs of existing queries, not adding new ones.
- Mobile-specific layout work beyond what natural Tailwind responsive utilities provide.

## Architecture overview

```
PUBLIC /workouts                          ADMIN /admin/analytics
─────────────────────────────             ────────────────────────────
src/app/workouts/page.tsx                 src/app/admin/page.tsx
  └ WorkoutsFilter                          └ redirect → /admin/analytics
      └ AOCard                            src/app/admin/layout.tsx
          ▲ adds rust accent strip          └ nav: drop "Dashboard",
                                              rename "Analytics" → "Dashboard"

                                          src/app/admin/analytics/page.tsx
                                            ├ FilterBar
                                            │   └ AO chip row (NEW)
                                            │       ▲ uses lib/stats/aoColors.ts
                                            ├ MetricCard × 4
                                            │   └ "// new fngs" wrapped in Link
                                            ├ PostsByAoChart
                                            │   └ imports lib/stats/aoColors.ts
                                            └ TopPaxChart
                                                ▲ topN sentinel fix
```

## § 1 — Workout-type accent strip

### Surface

`src/components/ui/AOCard.tsx` — single visual change inside the existing card. Both region groups (`Marietta Region`, `Nearby Regions`) on `/workouts` consume this card, so one edit covers both.

### Visual

A rust-accent strip rendered between the day/time row and the bottom (Peer-Led / Directions) row.

```
TUE  5:30am  · GLOOM
─────────────────────────
▎ // BOOTCAMP             ← bg-rust/10, border-l-4 border-rust, mono text-rust
─────────────────────────
PEER-LED         DIRECTIONS →
```

Concrete utilities:

```tsx
{workout.workout_type && (
  <div className="mt-3 border-l-[3px] border-rust bg-rust/10 px-3 py-2 font-mono text-[11px] tracking-[.12em] uppercase text-rust">
    // {workout.workout_type}
  </div>
)}
```

Placement: between the existing `<div className="mt-6 flex items-center justify-between pt-5 border-t border-line-soft">` (time row) and `<div className="mt-5 flex items-center justify-between">` (peer-led row). The strip lives outside both flex rows so the rule lines around them stay clean.

### Data

No DB or query change. `workout_schedule.workout_type` is already populated for every active row and threaded into `WorkoutScheduleRow` via `getWorkoutSchedule()`.

The conditional render guards against future nullability without altering the current type contract.

### Behavior with multiple workouts per AO

Each `AOCard` is rendered from exactly one `workout_schedule` row (see `src/components/home/WorkoutsFilter.tsx:188-196`). An AO that runs Bootcamp Tue and Ruck Thu already renders as two distinct cards — each will pick up its own correct workout-type strip.

### Acceptance

- Every visible AO card on `/workouts` (ALL view and every day filter) shows the rust accent strip with the workout type in mono uppercase.
- Visual matches the option-D mockup the user selected.
- No card layout regressions in the home-page `WorkoutsFilter` preview (`limit` prop path).
- `workout_type` value renders raw — no client-side normalization or title-casing.

---

## § 2 — Dashboard / Analytics merge

### Routing changes

| File | Change |
|---|---|
| `src/app/admin/page.tsx` | Replace entire file with `redirect('/admin/analytics')` using `next/navigation`. |
| `src/app/admin/layout.tsx` | In `ADMIN_NAV`: remove the `{ label: "Dashboard", href: "/admin" }` entry; rename `{ label: "Analytics", href: "/admin/analytics" }` → `{ label: "Dashboard", href: "/admin/analytics" }`. |

### FNG drill-down

`src/app/admin/analytics/page.tsx` — the existing `<MetricCard tag="// new fngs" value={stats.newFngs} ... />` (around line 100) renders the same shape across all four tiles. Wrap **only the New FNGs tile** in a `<Link>`:

```tsx
<Link href="/admin/analytics/fngs" className="block hover:opacity-90 transition-opacity">
  <MetricCard tag="// new fngs" value={stats.newFngs} ... />
</Link>
```

`/admin/analytics/fngs/page.tsx` already exists with the roster table and per-FNG backblast links — no changes needed there for this spec.

### Dead-code removal

- `src/lib/stats/getDashboardStats.ts` — only consumer was the deleted `/admin` page. Delete file.
- `src/components/admin/DashboardStats.tsx` — only consumer was the deleted `/admin` page. Delete file.

Both deletions verified by grep before removal; if anything still imports them post-removal, the build will fail and we fix.

### Acceptance

- Navigating to `/admin` lands on `/admin/analytics` (HTTP redirect, browser address bar updates).
- Admin top-nav shows `Dashboard` as the first item, pointing to `/admin/analytics`.
- Clicking the `// new fngs` tile navigates to `/admin/analytics/fngs` and opens with that range's roster.
- The other three tiles remain non-interactive (no link, no cursor change).
- `tsc --noEmit` and `npm run build` both pass after `getDashboardStats.ts` / `DashboardStats.tsx` removal.

---

## § 3 — AO chip multi-select with pie-color dots

### Color sharing module (new file)

`src/lib/stats/aoColors.ts`:

```ts
// Distinct colors for the top 4 AOs (these are the ones rendered as
// individual wedges in the pie chart). AOs ranked 5+ are aggregated
// into a single "Other" wedge in the pie, so they all share AO_OTHER_COLOR
// on the chip row to stay visually consistent.
export const AO_TOP_COLORS = ["#d4a93c", "#0a0a0a", "#7e6b3a", "#b8a160"] as const;
export const AO_OTHER_COLOR = "#d4d0c2";

export function getAoColor(rank: number): string {
  return rank < AO_TOP_COLORS.length ? AO_TOP_COLORS[rank] : AO_OTHER_COLOR;
}
```

Rationale: a naive `AO_COLORS[rank % length]` wraps and would give rank 0 and rank 5 the same dot color — visually confusing and breaks chip↔pie correspondence. The clamp-to-other approach mirrors the pie chart's existing top-4 + Other aggregation.

`src/components/admin/PostsByAoChart.tsx` deletes its local `const COLORS` (line 15) and imports from `lib/stats/aoColors.ts`. Its `buildArcs` already takes top 4 + Other; with the new module it now maps each of the first 4 to `getAoColor(i)` and the Other wedge to `AO_OTHER_COLOR`. Logic unchanged.

### Filter component changes

`src/app/admin/analytics/_components/FilterBar.tsx`:

- Replace the `<select>` block (lines 125-140) with a chip row.
- Ranking source: `stats.byAo` (already returned sorted by post count from `getOverviewStats`). The page builds an ordered options list from it so the chip dot ranks match the pie chart wedges. Ranking is range-aware — switching the date filter re-ranks AOs and re-paints dots, in lockstep with the pie chart.

FilterBar prop signature changes — the existing `aos: Array<{ aoSlug: string; aoName: string }>` becomes:

```ts
aoOptions: Array<{ aoSlug: string; aoName: string; rank: number }>;
// sorted by post count desc; rank = index in stats.byAo
```

`/admin/analytics/page.tsx` builds `aoOptions` by mapping `stats.byAo` (where each row is `{ ao: string; count: number; aoSlug?: string }`):

```ts
const aoOptions = stats.byAo.map((row, rank) => ({
  aoSlug: row.aoSlug ?? nameToSlug(row.ao),
  aoName: row.ao,
  rank,
}));
```

Any AO that exists in the DB but has zero posts in the current range will be absent from `aoOptions`, mirroring the pie chart's behavior. That's acceptable — you can't filter to an AO with no data.

Chip JSX (replaces the select block):

```tsx
<div className="md:col-span-7 flex flex-col gap-2">
  <div className="flex items-center gap-3">
    <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">
      // ao filter{selectedSlugs.length > 0 ? ` · ${selectedSlugs.length} selected` : ""}
    </span>
  </div>
  <div className="flex flex-wrap gap-2">
    <button
      type="button"
      onClick={() => setParam("ao", null)}
      className={chipClass(selectedSlugs.length === 0)}
    >
      All AOs
    </button>
    {aoOptions.map((a) => {
      const on = selectedSlugs.includes(a.aoSlug);
      return (
        <button
          key={a.aoSlug}
          type="button"
          onClick={() => toggleAo(a.aoSlug)}
          className={chipClass(on)}
          aria-pressed={on}
        >
          <span
            className="inline-block w-2 h-2 rounded-full mr-2"
            style={{ background: getAoColor(a.rank) }}
            aria-hidden="true"
          />
          {a.aoName}
        </button>
      );
    })}
  </div>
</div>
```

`chipClass`:
```ts
const chipClass = (on: boolean) =>
  `inline-flex items-center px-3 py-1.5 border font-mono text-[11px] tracking-[.12em] uppercase transition-colors ${
    on
      ? "bg-ink text-bone border-ink"
      : "bg-transparent text-ink border-line-soft hover:border-ink"
  }`;
```

### URL contract

- Single param `ao` — CSV of AO slugs.
- Empty / missing param = ALL.
- Single-AO links (`?ao=battlefield`) keep working — same CSV parser splits a single slug into `["battlefield"]`.

`toggleAo` mutates URL via existing `setParam` helper:
```ts
const toggleAo = (slug: string) => {
  const next = selectedSlugs.includes(slug)
    ? selectedSlugs.filter((s) => s !== slug)
    : [...selectedSlugs, slug];
  setParam("ao", next.length === 0 ? null : next.join(","));
};
```

`selectedSlugs` derived from `searchParams.get("ao")` — split by comma, filter blanks.

### Backend changes

#### `getOverviewStats`
`src/lib/stats/getOverviewStats.ts` — change signature from `aoSlug: string | null` to `aoSlugs: string[] | null`. Treat empty array as null (no filter).

Filter sites in this file (lines 32-44, 105-115):
```ts
// before
if (q.aoSlug && aoSlug !== q.aoSlug) continue;
// after
if (q.aoSlugs && q.aoSlugs.length > 0 && !q.aoSlugs.includes(aoSlug)) continue;
```

#### `getAttendanceFact`
`src/lib/stats/getAttendanceFact.ts` lines 36-77 — same shape change. Field renamed from `aoSlug` to `aoSlugs`. Same predicate update.

#### Page wiring
`src/app/admin/analytics/page.tsx`:
```ts
const aoSlugs = sp.ao
  ? sp.ao.split(",").map((s) => s.trim()).filter(Boolean)
  : null;
const stats = await getOverviewStats(range, aoSlugs, topN);
```

#### Other callers of the renamed functions

Grep found four additional sites that need the parameter rename (`aoSlug` → `aoSlugs` with array wrapping where applicable):

| Caller | Current usage | Update |
|---|---|---|
| `src/lib/stats/getAoStats.ts:25` | `getOverviewStats(range, aoSlug, topN)` (single AO drill-down) | `getOverviewStats(range, [aoSlug], topN)` |
| `src/app/admin/analytics/export/route.ts:59` | `getOverviewStats(range, null, Number.MAX_SAFE_INTEGER)` | `getOverviewStats(range, null, Number.MAX_SAFE_INTEGER)` (no change — null stays null) |
| `src/app/admin/analytics/export/route.ts:117` | `getAttendanceFact({ ... })` | Update field name `aoSlug` → `aoSlugs` if it sets one |
| `src/lib/stats/getPaxStats.ts:41, 66` | `getAttendanceFact({ from, to })` | No change — no AO filter passed |

The internal call inside `getOverviewStats` itself (line 77, passing `aoSlug: aoSlug ?? undefined` to `getAttendanceFact`) also gets the param rename.

### Acceptance

- Filter bar shows a horizontal chip row with `All AOs` first, then each AO ranked by post count, each with a colored dot.
- Clicking an AO chip selects/deselects it; URL updates to `?ao=...` CSV; "All AOs" chip activates when nothing else is selected.
- Selecting 2+ AOs scopes every chart (tiles, pie, top PAX, posts-over-time, day-of-week) to ONLY those AOs.
- Color dots on chips match the pie chart wedges for the same AO.
- Single-AO links from `PostsByAoChart` (`?ao=foo`) continue to work and pre-select that chip.
- `tsc --noEmit` + `npm run build` clean.

---

## § 4 — TopN = all bug fix

### Root cause

In `src/app/admin/analytics/page.tsx:121` (and identically in `src/app/admin/analytics/ao/[slug]/page.tsx:105`), `topN` is passed to `TopPaxChart` as `undefined` when the URL param is `"all"`. The chart's default parameter `topN = 20` then engages, and its truthy check `topN ? data.slice(0, topN) : data` slices to 20. Heading template `${topN ?? "all"}` evaluates `20 ?? "all"` → `"20"`. So both data and heading show 20 when the URL says all.

### Fix

`src/components/admin/TopPaxChart.tsx`:
```ts
export function TopPaxChart({
  data,
  topN,           // remove default; undefined means "show all"
  href,
}: {
  data: PaxRanking[];
  topN?: number;
  href?: (paxKey: string) => string;
}) {
  const visible = topN === undefined ? data : data.slice(0, topN);
  const label = topN === undefined ? "all" : String(topN);
  // ...
  // replace: <MonoTag>{`// top posters · top ${topN ?? "all"}`}</MonoTag>
  // with:    <MonoTag>{`// top posters · top ${label}`}</MonoTag>
}
```

`src/app/admin/analytics/page.tsx`:
```ts
const topNValue = topNParam === "all" ? undefined : (parseInt(topNParam, 10) || 20);
<TopPaxChart data={stats.topPax} topN={topNValue} href={paxHref} />
```

`src/app/admin/analytics/ao/[slug]/page.tsx` — same change at line 105.

`getOverviewStats` already correctly returns `stats.topPax` sliced to `Number.MAX_SAFE_INTEGER` when `topN === Number.MAX_SAFE_INTEGER` is passed to it, so the full ranked list is available for the chart to render.

### Acceptance

- Choosing `top: 10` → chart heading `// top posters · top 10`, exactly 10 rows.
- Choosing `top: 20` → heading `top 20`, 20 rows.
- Choosing `top: all` → heading `top all`, every PAX with at least one post in the range.
- All three behaviors hold on both `/admin/analytics` and `/admin/analytics/ao/[slug]`.

---

## Cross-cutting concerns

### Testing

- Unit test for `getAoColor(rank)` deterministic mapping + wrap behavior.
- Manual UI verification (browser, dev server) for:
  - Workout card strip appears on every `/workouts` card.
  - `/admin` redirects to `/admin/analytics`; nav label says "Dashboard".
  - FNG tile is clickable and navigates to `/admin/analytics/fngs`.
  - AO chip selection — single, multiple, clear-via-all, browser back/forward preserves filter state via URL.
  - `topN=all` shows full list with `// top posters · top all` heading; `topN=10` shows 10; `topN=20` shows 20.

### Migration / rollback

No DB migration. Pure code change. Rollback = revert the commit(s).

### Performance

- AO multi-select adds a `Array.includes()` check per event row in the existing client-side filter loops. Linear, dominated by event count (currently low thousands). No measurable impact expected.
- Color module is a small constant array import. No runtime cost vs. inline literal.

### Accessibility

- AO chip buttons get `aria-pressed={on}` for screen reader state announcement.
- Color dots are decorative (`aria-hidden="true"`); AO name remains in the accessible label.
- Workout-type accent strip relies on the rust token (#b84a1a) on bone (#f1ece1) — 5.4:1 contrast, AA-compliant.
- Redirect at `/admin` is server-side, no flash of unstyled content.

### Out-of-scope items the design touches but doesn't fix

- `PostsByAoChart` still hard-caps to top 4 + "Other" — orthogonal to the AO multi-select work.
- Date-range custom picker UX is unchanged.
- Workout-type field remains free-form text; admins could still enter `Bootcamp ` (trailing space) or inconsistent casing. Future SSoT cleanup is its own ticket.

## File-change summary

**Modified**
- `src/components/ui/AOCard.tsx` (§1)
- `src/app/admin/page.tsx` (§2 — full rewrite to redirect)
- `src/app/admin/layout.tsx` (§2 — nav array)
- `src/app/admin/analytics/page.tsx` (§2 FNG link, §3 multi-AO parse + aoOptions build, §4 topN sentinel)
- `src/app/admin/analytics/_components/FilterBar.tsx` (§3 — chip row replacing select)
- `src/app/admin/analytics/ao/[slug]/page.tsx` (§4 topN sentinel)
- `src/app/admin/analytics/export/route.ts` (§3 param rename — passthrough)
- `src/components/admin/TopPaxChart.tsx` (§4 sentinel logic)
- `src/components/admin/PostsByAoChart.tsx` (§3 color import)
- `src/lib/stats/getOverviewStats.ts` (§3 multi-AO signature)
- `src/lib/stats/getAttendanceFact.ts` (§3 multi-AO signature)
- `src/lib/stats/getAoStats.ts` (§3 param rename — wraps single slug in array)

**New**
- `src/lib/stats/aoColors.ts` (§3)

**Deleted**
- `src/lib/stats/getDashboardStats.ts` (§2)
- `src/components/admin/DashboardStats.tsx` (§2)
