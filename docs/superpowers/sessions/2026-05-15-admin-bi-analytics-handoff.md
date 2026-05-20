# Admin BI Analytics — Session Handoff

**Date paused:** 2026-05-15
**Status:** Mid-brainstorm — 4 foundational scoping questions outstanding
**Next action when resuming:** Answer the 4 open questions in "Open Clarifying Questions" below, then continue brainstorming through to a spec.

---

## Resume Instructions (read this first)

To pick this up in a new session:

1. Open this file and the linked artifacts.
2. Re-invoke `superpowers:brainstorming` (we are still inside that skill — visual companion was offered but declined because user is on mobile, so proceed text-only).
3. Answer the 4 open questions in the section below. They are all multiple-choice — recommendations are noted.
4. After answers come in, proceed to: propose 2-3 approaches → present design sections → write spec to `docs/superpowers/specs/2026-05-15-admin-bi-analytics-design.md` → `superpowers:writing-plans`.
5. The `data-modeling` analysis is **complete** (summarized below). The `qc-testing` and `scenario-eval` skill triggers were deferred — invoke when designing remediation logic / test strategy, not during brainstorm.

---

## The Story So Far

### Phase 1 — Already shipped (this session, 2026-05-13/14)

The basic YTD admin dashboard is **merged to local `main`** but not pushed:

- 11 dashboard commits + 1 final-review fix + 1 dashboard-cleanup commit + 1 merge commit
- `main` is currently 13 commits ahead of `origin/main`
- Files: `src/lib/stats/{parseFngLine,resolvePaxIdentity,getDashboardStats}.ts`, `src/components/admin/{DashboardStats,PostsByAoChart,TopPaxChart}.tsx`, `src/app/admin/page.tsx` (rewritten as async RSC, analytics-only)
- Tests: 20 unit tests pass; Playwright spec at `tests/admin-dashboard.spec.ts`
- Spec: `docs/superpowers/specs/2026-05-13-admin-dashboard-analytics-design.md` (committed)
- Plan: `docs/superpowers/plans/2026-05-13-admin-dashboard-analytics.md` (**untracked — never committed**; flagged earlier as a loose end)
- Branch `feature/gemini-3.1-upgrade` preserved at `6f5d8a9` as safety net (not deleted)
- WIP newsletter changes restored to working tree, not staged

### Phase 2 — Now (this brainstorm)

User wants to turn the dashboard into a BI-style tool: pivot, dissect, drill down, download — equivalent to Tableau / PowerBI but for F3 region data.

**Concrete requests:**
1. AO-specific statistics + overall statistics
2. Drill-downs by PAX×month, AO×month, AO×YTD, or any selected time period
3. Use `data-modeling` skill to surface metrics they might be missing

---

## Scope Decisions Already Locked

1. **Scope-guardian override granted** (2026-05-15). The "Event attendance tracking / analytics" and "PAX leaderboard from backblast data" items in `feature-status.md`'s "Potential Future Work" section were intentionally lifted. `feature-status.md` was updated to reflect current reality (Beatdown Builder = Complete; Backblasts Newsfeed = Deprioritized; Upcoming Events = Deprioritized; Admin Dashboard Analytics = In Development). Override scope is bounded to this analytics work; no blanket pass.

2. **Phase 0 (data quality fixes) folded into the BI spec** — one spec, one plan. Phase 0 will be the first 1-2 tasks. (Recommended path; user chose this.)

3. **Unresolved Slack IDs → raw ID + manual alias map.** A small admin-editable alias table (~3 rows expected) handles the few stragglers who aren't in `slack_users` at all. (User chose this.)

---

## Data Quality Findings (root causes investigated against the live DB)

Probed via `scripts/profileAnalyticsData.ts` (one-off, **delete before final spec**).

### Gap 1: Name resolution — one-line fix

- `slack_users` synced cleanly today (06:00). Not a broken sync.
- 166 users, 58 have `display_name`, **all 166 have `real_name`**.
- 108 users have `real_name` but no `display_name`.
- Of 28 distinct Slack IDs in backblast `content_text`: 17 resolve via `display_name`, **+8 via `real_name` fallback → 25/28 (89%)**. 3 not in `slack_users` at all.

**Fix:** `COALESCE(display_name, real_name)` in `src/lib/stats/resolvePaxIdentity.ts`. Also retroactively improves the already-shipped dashboard.

### Gap 2: `event_date` nulls — one-time backfill

- 7 null-date backblasts:
  - 6 from January 2026 — all have a parseable `DATE: YYYY-MM-DD` line in `content_text`
  - 1 from May 2026 (Black Ops Trail Trial) — no `DATE:` line at all
- Feb–Apr: 0 nulls. The Jan ingest bug self-resolved.

**Fix:** One-time backfill script — parse `DATE:` line for the 6, fall back to `created_at::date` for the 1.

### Gap 3: Stale `f3_event_attendees` — a decision

- Coverage by event month: Jan 9/10, Feb 19/19, Mar 6/16, **Apr 0/19, May 0/9**. Ingest stopped early March.

**Decision:** Don't use the table. `content_text` PAX parsing is the system of record. (Worth a separate bug ticket for the ingest, but out of scope for this work.)

### Bonus: `f3_event_qs` is usable

- 85% coverage, current through May (May 9/9). Use it for Q-related metrics.

---

## Data-Modeling Analysis (Kimball lens, summary)

Applied the four-step dimensional process; full conversation history has the table. Key outputs:

### Grain — two fact tables

| Fact | Grain | Type |
|------|-------|------|
| `fact_backblast` | one row per backblast (one workout) | transaction |
| `fact_attendance` | one row per (PAX × backblast) | factless |

### Dimensions (= the pivot/slice axes the BI tool exposes)

- `dim_date` — day, ISO week, month, quarter, year, day-of-week (conformed)
- `dim_ao` — AO name, slack channel, region, is_enabled
- `dim_pax` — slack_id, display_name (COALESCE'd), first_seen_month (cohort), is_name_resolved
- `dim_q` — role-playing `dim_pax`

### Metrics surfaced (user approved this entire list as "looks good")

| Metric | Source |
|---|---|
| Total posts (YTD, AO, month, custom range) | fact_backblast |
| Avg headcount per workout | `COUNT:` line in content_text |
| FNG count + FNG retention/conversion | FNG line + later attendance |
| PAX retention rate (MoM) | fact_attendance |
| PAX cohort retention curves | dim_pax.first_seen_month |
| Q load distribution | f3_event_qs + dim_q |
| Q diversity per AO | f3_event_qs + dim_ao |
| Posting streaks (longest consecutive weeks) | fact_attendance |
| First-time-Q events ("Q school" pipeline) | f3_event_qs |
| Day-of-week patterns | dim_date |
| PAX breadth (distinct AOs visited) | fact_attendance |
| AO health composite score | weighted combination of above |

**Slices beyond the obvious AO/PAX/month:** day-of-week, ISO week, PAX tenure cohort, Q-as-filter.

### Data ceiling

- Region's data starts Jan 2026 → ~5 months total. YoY impossible. MoM within 2026 is the max time depth.
- Volume is small (80 backblasts to date) → live queries fine, no materialized views needed.

---

## Open Clarifying Questions (next session — answer these to resume)

Four foundational scoping questions. The user is on mobile, so multiple-choice answers preferred.

### Q1 — Phasing

How to scope the build given the feature is large?

| Option | Description |
|---|---|
| **A. Phase it — MVP first (Recommended)** | Phase 0 (data fixes) + MVP (AO + overall stats, the 4 core drill-downs, time presets) ships first. Phase 2 adds extra metrics, export, pivot, alias map. Each phase = working software. |
| B. Full build, one spec/plan | Design and build everything at once. Longer to first usable result, no phase seams. |
| C. MVP only, decide on Phase 2 later | Build just the MVP. Park advanced BI features until user has used the MVP. |

### Q2 — Structure

| Option | Description |
|---|---|
| **A. Overview + click-through detail pages (Recommended)** | Overview page (region-wide), then click an AO or PAX to drill into a dedicated detail page. Mobile-friendly. |
| B. Single page, everything driven by filters | One page; filter/pivot controls reshape charts in place. More Tableau-like, heavier on mobile. |
| C. Separate routes per fixed view | `/analytics/overview`, `/analytics/ao`, `/analytics/pax`, `/analytics/q` — each a fixed report. Simpler, less interactive. |

### Q3 — Location

| Option | Description |
|---|---|
| **A. New `/admin/analytics` route (Recommended)** | Keep current `/admin` as the at-a-glance KPI dashboard; `/admin/analytics` is the deep BI tool. Clear separation. |
| B. Replace `/admin` entirely | Dashboard becomes the BI tool. One place for everything. |

### Q4 — Export

| Option | Description |
|---|---|
| **A. CSV of whatever's currently on screen (Recommended)** | Each view has a "Download CSV" exporting that filtered slice. |
| B. CSV current view + full raw-data dump | Per-view CSV plus a "download all data" option. |
| C. Defer export to Phase 2 | No export in MVP. |

---

## Artifacts Inventory

### Files this session created or modified (uncommitted to `main`)

| Path | State | Notes |
|---|---|---|
| `docs/superpowers/sessions/2026-05-15-admin-bi-analytics-handoff.md` | this file (untracked) | Resume from here |
| `scripts/profileAnalyticsData.ts` | untracked | One-off probe; **delete before final spec** |
| `.claude/context/feature-status.md` | modified, uncommitted | Updated to reflect Phase 1 reality + scope override note |
| `docs/superpowers/plans/2026-05-13-admin-dashboard-analytics.md` | untracked, **never committed** | The Phase 1 plan — pre-existing loose end |
| (WIP newsletter changes) | working tree | Unrelated to this work, leave alone |

### Phase 1 artifacts already on `main`

- `docs/superpowers/specs/2026-05-13-admin-dashboard-analytics-design.md` — committed
- `src/lib/stats/{parseFngLine,resolvePaxIdentity,getDashboardStats}.ts` — committed
- `src/components/admin/{DashboardStats,PostsByAoChart,TopPaxChart}.tsx` — committed
- `tests/{parseFngLine,resolvePaxIdentity}.test.ts` — committed (20 unit tests, all passing)
- `tests/admin-dashboard.spec.ts` — committed
- `src/app/admin/page.tsx` — rewritten and committed

### Git state

- Currently on branch `main`, 13 commits ahead of `origin/main`, **not pushed**
- `feature/gemini-3.1-upgrade` branch preserved at `6f5d8a9` as safety net
- WIP newsletter changes uncommitted in working tree

### Live services

- Dev server: `PORT=3001 npm run dev` running on port 3001 (`/tmp/f3-marietta-dev.log`). May or may not still be alive when you resume — restart if needed: `lsof -ti :3001 | xargs kill 2>/dev/null; PORT=3001 npm run dev > /tmp/f3-marietta-dev.log 2>&1 &`
- Brainstorm visual companion server: was started earlier on a random port (auto-exits after 30 min idle). Likely dead by now.

### Database state (profiled 2026-05-15)

- 80 non-deleted backblasts, 7 with NULL `event_date`, date range Jan 7 – May 14
- 166 `slack_users` (58 display_name, 108 real_name only, 4 bots, 46 deleted)
- 4 AOs in `ao_channels`: Black Ops, CSAUP, The Battlefield, The Last Stand (all enabled)
- `f3_event_attendees`: 412 rows but stale after early March (don't use)
- `f3_event_qs`: 144 rows, 85% coverage, current

---

## Why This Doc Exists

User asked for a summary so they can continue in a new session. The brainstorming `HARD-GATE` says no implementation until a design is approved — this doc captures the state of brainstorming so the next session can resume mid-flow without losing context or re-asking decided questions.
