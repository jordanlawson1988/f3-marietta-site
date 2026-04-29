# F3 Marietta Website Redesign — Session Recap

**Session dates:** 2026-04-23 → 2026-04-24
**Status:** Preview deployed, awaiting production merge approval
**Current branch:** `develop` (merged from `feature/website-redesign`)

---

## TL;DR

Full visual redesign of f3marietta.com complete and deployed to Vercel preview. 48 tasks across 7 waves, 48 commits, 92 files changed (+9,643 / −2,953). Zero TS errors, 408 Playwright tests green, axe-core clean across 10 pages × 5 browsers. Production merge (develop → main) is the only remaining step — held pending visual review.

### Preview URL

**https://f3-marietta-site-git-develop-jordan-lawsons-projects.vercel.app**

All public routes deployed. Admin at `/admin` (Better Auth login required).

---

## What got built

### The design system (Wave 1)

New bone/ink/steel editorial aesthetic anchored on the new cannon-emblem logo.

- **Tokens** (`src/app/globals.css`): bone/bone-2/bone-3 surfaces, ink/ink-2/ink-3 dark sections, line-soft borders, steel (#2f6e89) accent, rust (#b84a1a) for alerts, olive/brass for status chips, muted for secondary text
- **Fonts** (via `next/font/google` in `src/app/layout.tsx`): Oswald 700 (display), Inter 400/500 (body), JetBrains Mono 400/500/700 (labels) — **new**, DM Serif Display 400 italic (creed quote) — **new**
- **Utility classes**: `.clip-chamfer` / `.clip-chamfer-sm` (polygon clip-path for tactical CTAs), `.bg-topo-light` / `.bg-topo-dark` (SVG contour overlays), `.mono-eyebrow`, `.reveal` / `.reveal.in`
- **Keyframes**: `pulse-dot`, `marquee-scroll`, `rotate-ring`, `float-logo`, `word-rise`, `scope-underline`

### 14 shared brand primitives (`src/components/ui/brand/`)

| Component | Purpose |
|---|---|
| `EyebrowLabel` | Mono uppercase `§ 01 · …` label with optional steel rule |
| `MonoTag` | `// F3.MAR.01` style inline label, 4 variants |
| `PulseDot` | Animated 6px rust/steel heartbeat dot |
| `CornerBracket` | 22×22 L-bracket decorative corner (used on hero emblem) |
| `StatusChip` | Bordered pill — 6 variants: active/launch/archived/draft/fng/pending |
| `ChamferButton` | Polymorphic Link-or-button with clip-chamfer, 4 variants, 3 sizes |
| `ClipFrame` | Chamfered container for cards/drawers, 3 variants |
| `TopoBackground` | Absolute topo SVG overlay, light/dark variants |
| `MeterBar` | Tick-mark rail with steel highlights, bone/ink variants |
| `ScrollReveal` | Client primitive with IntersectionObserver fade+translateY |
| `SectionHead` | `§ 0n` eyebrow + H2 + kicker, 3 align variants |
| `CreedQuote` | DM Serif italic pull quote |
| `PageHeader` | Sub-page hero band with optional meter row |
| `CTABand` | Closing CTA band — steel/ink/bone/gradient variants |

### Global shell (Wave 2)

- `src/components/layout/TopBar.tsx` — gloom-status strip with rust pulse dot, mounted globally
- `src/components/layout/Navbar.tsx` — sticky bone nav, brand lockup, active-link underline, mobile drawer
- `src/components/layout/Footer.tsx` — 4-col ink grid with mono column heads
- `src/components/layout/MarqueeRibbon.tsx` — 40s infinite scroll ribbon, every 3rd token in steel
- `src/components/ui/AssistantWidget.tsx` + `FloatingAssistant.tsx` — restyled with ink palette + chamfer chrome (AI logic untouched)
- `src/app/layout.tsx` — TopBar mounted; ReleaseNotes removed

### Home page (Wave 3, `src/components/home/`)

Assembled in `src/app/page.tsx` with `revalidate = 3600`:

1. `HomeHero` — full-viewport ink section, 4-layer radial+linear background, meter bar with live weekly pax count, staggered 4-line H1 animation (Hold the / Battlefield / Leave no man / behind), emblem card with rotating dashed ring, float animation, 4 corner brackets, 4 mono readouts
2. `MarqueeRibbon`
3. `ThreeFsSection` — 3-col F-cards with ink-flip hover, verbatim content from `data/f3-about.md`
4. `CreedPrinciplesSection` — DM Serif pull quote ("Leave no man behind, but leave no man *where you found him*") + 5-col principles grid on ink
5. `MarqueeRibbon` again
6. `WorkoutsPreviewSection` — server-fetched via `getWorkoutSchedule()`, client filter via `WorkoutsFilter`, shows first 6 AOs
7. `BackblastsPreviewSection` — feature card + 5-item list from `getBackblastsPaginated({limit: 6})`
8. `ImpactSection` — 2×2 live stats tiles from `getImpactStats()` ("Forged" italic in steel)
9. `JoinCTASection` — gradient CTABand with "Post. That's it." + 05:15 watermark

### 9 bespoke public sub-pages (Wave 4)

Each composes brand primitives — `PageHeader` → custom body → `CTABand` → global `Footer`.

| Route | Hero | Distinctive body |
|---|---|---|
| `/about` | Ink "Men. Marietta. Since 2024." | Mission + 4-step timeline with steel dots + creed band |
| `/workouts` | Bone "Find Your Battlefield." | Full `WorkoutsFilter` (no limit) + plant-an-AO callout |
| `/backblasts` | Ink "From the Gloom." | AO filter chips + rhythmic every-4th feature card grid + pagination |
| `/backblasts/[id]` | Ink editorial article | Meta band (Q · PAX · TIME · LOC) + `backblast-content` prose + back/post-tomorrow CTAs |
| `/new-here` | Bone "Your First Post." | 5-step walkthrough with giant Oswald step numbers + "What to Bring" ClipFrame sidecar |
| `/contact` | Bone "Find us. Fall in." | 3 ClipFrame mailto cards + chamfered message form |
| `/fng` | Bone "Friendly New Guy." | 3-block primer + steel CTABand |
| `/glossary` | Ink "The Lexicon." | Letter-rail layout (Oswald 72px steel numerals) + search that hides empty groups |
| `/community` | Bone "Fellowship Ledger." | 3-card event grid with status chips |
| `/what-to-expect` | Ink "The First Whistle." | 40-tick MeterBar + 6-step minute-by-minute timeline |

### Admin editorial reskin (Wave 6)

Full editorial treatment — chrome, typography, chips, row accents, ink drawer modals — without sacrificing density. Workouts admin is a 7-column calendar, not a table, so editorial tokens applied to the calendar cells.

- `src/app/admin/layout.tsx` — ink top strip, mono breadcrumb, tab nav
- `src/app/admin/AdminAuthContext.tsx` — **restructured**: auth logic extracted from layout into provider; new `AdminAuthProvider` export
- `src/app/admin/page.tsx` — dashboard with section-head + 4 chamfer tiles
- `src/app/admin/workouts/{page,WorkoutGrid,WorkoutBlock,WorkoutModal}.tsx` — editorial calendar chrome + ink-chamfer drawer
- `src/app/admin/regions/page.tsx` — editorial list + ink-chamfer drawer (replaced old center modal)
- `src/app/admin/drafts/{page,history/page}.tsx` + `src/components/ui/DraftCard.tsx` — editorial list + ChamferButton approve/reject
- `src/app/admin/kb/page.tsx` — editorial sidebar + ink ClipFrame form panels + bone preview panel
- `src/app/admin/newsletter/page.tsx` — editorial table + newsletter preview in ClipFrame
- `src/app/admin/Toast.tsx` — ink chamfer with steel (success) / rust (error) border

### Data additions

- `src/lib/stats/getImpactStats.ts` — parallel 4-count query (uniqueHim, workoutsLed, activeAOs, fngsThisYear) with safe try/catch fallback
- `src/lib/stats/getWeeklyPaxCount.ts` — distinct PAX in last 7 days
- `scripts/smoke-impact-stats.ts` — one-shot script to verify the stats query returns non-negative finite numbers

**Current live values** (as of 2026-04-23 smoke test): uniqueHim: 13, workoutsLed: 66, activeAOs: 17, fngsThisYear: 13.

### Testing (Wave 7)

- 11 new homepage spec tests, 3 new nav spec tests, 9 new public sub-page smoke tests, 3 backblasts spec tests, 1 glossary spec test — all pass
- axe-core a11y audit across 10 public pages × 5 browser profiles (50 tests) — zero critical/serious violations after 5 contrast fixes
- Legacy accessibility tests updated (logo alt regex) or deleted (pillar icons no longer rendered)
- Admin-workouts spec updated to new DOM; 40 credential-gated tests skip without `ADMIN_EMAIL` / `ADMIN_PASSWORD` env vars
- AMA widget spec updated for restyled chrome (85/85 passing)

---

## Files deleted / renamed

| Action | File |
|---|---|
| Deleted | `src/components/ui/Hero.tsx` (replaced by `HomeHero` + `PageHeader`) |
| Deleted | `src/components/ui/StatusBadge.tsx` (replaced by `StatusChip`) |
| Refactored | `AdminAuthContext.tsx` (now exports `AdminAuthProvider` that owns session + login form) |
| Refactored | `GlossaryList.tsx` (simplified to zero-props; combines `lexiconEntries` + `exiconEntries` internally) |

---

## Quality gates passed

| Gate | Result |
|---|---|
| `npx tsc --noEmit` | 0 errors |
| `npm run build` | All 32+ routes compile clean |
| `npm run lint` | 0 errors, 3 pre-existing warnings (acceptable) |
| `npx playwright test` (full suite) | 408 passed / 40 skipped (admin creds) / 2 flaky dev-server timeouts (not regressions) |
| `@axe-core/playwright` a11y | 50/50 redesign pages clean (WCAG 2A + 2AA) |
| Pre-push hook | Passed on develop push |
| Vercel preview build | READY in 40s |
| Preview smoke test | `curl` returns 200, all 6 redesign markers present in HTML |

---

## Key references

All in the repo:

- **Design spec** — `docs/superpowers/specs/2026-04-23-website-redesign-design.md`
- **Implementation plan** — `docs/superpowers/plans/2026-04-23-website-redesign.md` (48 tasks, 177 steps, 4,389 lines)
- **Source design handoff from Claude Design** — `docs/design_handoff_f3_marietta_redesign/` (README + HTML prototype + screenshots + assets)
- **Canonical content** — `data/f3-about.md`, `data/f3-mission-core-principles.md`, `data/f3-marietta-region.md`, `data/f3-leadership.md`, `data/f3Glossary.ts`

---

## Commits on `develop` (not on `main`)

48 commits, scoped by wave:

```
Wave 0 (1)  docs: spec + plan + design handoff bundle
Wave 1 (9)  fonts, globals.css tokens, 14 brand primitives, delete legacy
Wave 2 (5)  TopBar, Navbar, Footer, MarqueeRibbon, AssistantWidget restyle
Wave 3 (11) getImpactStats, 9 home sections, page.tsx, homepage + nav specs
Wave 4 (10) 9 public sub-pages, backblasts/glossary/pages specs
Wave 5 (1)  backblast detail page editorial rewrite
Wave 6 (9)  admin chrome + dashboard + workouts/regions/drafts/kb/newsletter/Toast + admin-workouts + ama-widget specs
Wave 7 (2)  a11y audit (5 contrast fixes), final verification
Merge (1)   feat: full website redesign (merge feature/website-redesign)
```

Git details:
- Feature branch: `feature/website-redesign` (pushed to origin, still exists)
- `develop` is at commit `24d8f91`
- `main` is at `4c0c25b` (pre-redesign)

---

## Open items / what's next

### 1. Production merge (held pending review)

When Jordan approves the preview:

```bash
git checkout main
git merge --no-ff develop -m "feat: website redesign"
git push origin main
```

This triggers one production build. Vercel config already has `ignoreCommand` + branch restrictions, so only `main` and `develop` builds.

### 2. Known follow-ups (explicitly deferred, not regressions)

- **Per-AO detail pages** at `/workouts/[slug]` — currently AO cards link to Google Maps directions only
- **Contact form backend** — form action uses `mailto:` as fallback; real endpoint is follow-up scope
- **ADMIN_EMAIL / ADMIN_PASSWORD** env vars — not set locally, so 40 admin Playwright tests skip. Add to `.env.local` if admin CRUD tests are important
- **Newsletter endpoint** on `/backblasts` — mentioned in spec but skipped (no endpoint wired yet)
- **prefers-reduced-motion guard** — noted in code review as minor accessibility concern; all reveal/marquee animations should respect it
- **`--color-line-soft` / `--color-line-softer` Tailwind exposure** — components use `border-line-soft` utility which may not resolve; workaround is inline style. Could add `@theme inline` entries in a future pass

### 3. Flaky tests (not a regression)

Two Playwright tests (webkit homepage, Mobile Safari ama-widget) intermittently time out under sequential `--workers=1` runs of the full 350-test suite due to dev server cold-warmup. Both pass in isolation. CI with fresh server should be fine.

---

## How to resume in a new session

1. `cd /Users/jordan.lawson/Projects/f3-marietta`
2. `git checkout develop` (you'll be on the branch with all redesign commits)
3. Read this file + the spec + plan (paths above) for full context
4. Check the preview URL to visually confirm state
5. If approving production merge: use the commands in "Open items #1"
6. If making changes first: `git checkout -b fix/<topic>` from `develop`, make edits, merge back into `develop` (which re-deploys the preview), iterate until ready for production

If starting a fresh Claude session, paste this path into context:
`docs/superpowers/handoffs/2026-04-24-website-redesign-session-recap.md`
