# F3 Marietta Website Redesign — Design Spec

**Date:** 2026-04-23
**Status:** Approved design, awaiting implementation plan
**Source handoff:** `docs/design_handoff_f3_marietta_redesign/` (README + HTML prototype + screenshots + logo-cannon.png)

---

## 1. Overview

Complete visual redesign of the F3 Marietta website. The current site is dark-navy themed with a simple 5-section home page and lightly styled sub-pages. The redesign introduces a bone-white / deep-ink military-editorial aesthetic anchored on the new cannon-emblem brand mark, with Marietta steel-blue as the sole accent (rust reserved for alerts). Every customer-facing page and the admin console receive bespoke editorial layouts.

The site remains a single Next.js App Router application with the existing data layer (Neon + Better Auth). No new API surface — one new server data function (`getImpactStats`) and two new Google Fonts are the only external additions.

## 2. Goals

- Pixel-faithful recreation of the home page from the handoff prototype.
- A shared design-primitive system (`ui/brand/`) that every page composes from.
- Every public page redesigned with a bespoke editorial layout while reusing the same primitives.
- Admin console fully editorialized — mono column headers, status chips, chamfer actions, ink edit drawers, editorial empty states — without sacrificing data density.
- Real data wired into the home page's workouts preview, backblasts preview, and impact stats.
- Playwright tests stay green throughout; each page rewrite lands with its updated spec in the same commit.

## 3. Non-goals

- No changes to the API surface (Slack ingestion, AI assistant, auth).
- No migration of data model, DB, or deployment target.
- No new authenticated experiences beyond what exists.
- No new PAX profiles, member directory, event RSVPs, or similar features.
- No Spanish/i18n, no dark-mode toggle (site is intentionally single-palette), no PWA shell.
- No replacement of the existing AssistantWidget's AI behavior — purely visual restyle.

## 4. Scope decisions (from brainstorming)

| Question | Decision |
|---|---|
| Scope phasing | **Everything at once** — home + global shell + all public sub-pages + admin in a single redesign effort, one feature branch, landed in waves for reviewability. |
| Sub-page fidelity | **Full bespoke layouts per page**, composed from shared primitives. |
| Home page Impact stats | **Live data** from Neon via a new `getImpactStats` server function. |
| Playwright tests | **Update as we go** — each page rewrite lands with its spec update in the same commit. |
| Admin treatment | **Full editorial** — chrome, typography, row accents, action buttons, chips, empty states, edit drawers all get the editorial treatment. Table density preserved via mono typography. |

## 5. Architecture & file structure

Two new component namespaces — `ui/brand/` for shared design primitives, `home/` for home-specific compositions. Home-page composition sits in `src/app/page.tsx` as a thin server assembly. Sub-pages compose `brand/` primitives directly — no per-page wrapper components.

```
src/
  app/
    globals.css                   rewritten — new bone/ink token system, @theme inline mapping
    layout.tsx                    + Oswald, Inter, JetBrains Mono, DM Serif fonts;
                                  mounts <TopBar />, global ScrollReveal provider,
                                  wraps restyled <AssistantWidget />
    page.tsx                      home — assembles the 11 sections below
    {about, workouts, backblasts, new-here, contact,
     fng, glossary, community, what-to-expect}/page.tsx
                                  each rebuilt bespoke (see §9)
    backblasts/[id]/page.tsx      restyled editorial article layout
    admin/
      layout.tsx                  editorial chrome — ink top strip, mono breadcrumbs, chamfer actions
      page.tsx                    dashboard restyled — section-head + stat tiles
      login (if exists)           bespoke ink hero + chamfer form
      drafts/, kb/, newsletter/, regions/, workouts/
                                  list pages editorialized (§10)

  components/
    layout/
      TopBar.tsx                  NEW — gloom-status strip (global)
      Navbar.tsx                  rewritten — bone sticky, brand lockup, mobile drawer
      Footer.tsx                  rewritten — 4-col ink grid
      MarqueeRibbon.tsx           NEW — FITNESS · FELLOWSHIP · FAITH scroller

    ui/brand/                     NEW — shared design primitives
      SectionHead.tsx             § 0n · eyebrow + H2 + optional kicker
      EyebrowLabel.tsx            mono §/// labels
      ChamferButton.tsx           clip-path tactical CTA (variants: steel, ink, ghost, bone)
      StatusChip.tsx              ACTIVE / LAUNCH / FNG / DRAFT mono chips
      MeterBar.tsx                tick-mark rails w/ steel highlights
      CornerBracket.tsx           22×22 L-shape corner
      ScrollReveal.tsx            IntersectionObserver fade + translateY
      CreedQuote.tsx              DM Serif pull quote w/ steel italic slot
      MonoTag.tsx                 inline mono label (e.g. // F3.MAR.01)
      TopoBackground.tsx          SVG contour pattern overlay (light + dark variants)
      PulseDot.tsx                rust heartbeat dot
      ClipFrame.tsx               reusable chamfered frame for cards / admin drawers
      PageHeader.tsx              sub-page hero band pattern (eyebrow + H1 + kicker + optional meter)
      CTABand.tsx                 closing CTA band pattern (steel | ink | bone variants)

    home/                         NEW — home-specific sections
      HomeHero.tsx                full-viewport dark hero + emblem card
      ThreeFsSection.tsx          3-col F-cards with ink flip hover
      CreedPrinciplesSection.tsx  ink band + 5-col principles
      WorkoutsPreviewSection.tsx  day-chip filter + AO grid (live data, server-fetched)
      BackblastsPreviewSection.tsx  feature card + list (live data)
      ImpactSection.tsx           ink band + 2×2 live stats
      JoinCTASection.tsx          steel gradient + 05:15 watermark

    ui/
      AOCard.tsx                  rewritten to new card spec (used in home preview + /workouts)
      BackblastFeatureCard.tsx    NEW (used in home + /backblasts)
      BackblastListItem.tsx       NEW (used in home + /backblasts)
      AssistantWidget.tsx         restyled (chamfer trigger, bone/ink palette)
      FloatingAssistant.tsx       restyled
      Hero.tsx                    DELETED — replaced by HomeHero (home) + PageHeader (sub-pages)
      Section, Card, Button       retained but tokens-only restyle
      F3Icons                     repainted steel where appropriate
      StatusBadge                 replaced by StatusChip

  lib/
    stats/getImpactStats.ts       NEW — parallel counts with safe fallback
```

**Files deleted:**
- `src/components/ui/Hero.tsx` — replaced by HomeHero + PageHeader.
- `src/components/ui/StatusBadge.tsx` — replaced by `ui/brand/StatusChip.tsx`.

**Files retained as-is (tokens-only restyle):**
- AssistantWidget AI behavior.
- Backblast pagination + Slack ingestion logic.
- Better Auth + admin session handling.

## 6. Design system (tokens + fonts)

### 6.1 `globals.css`

Replace the `:root` block and remove the existing `.dark` theme defaults. New root:

```css
:root {
  /* Surfaces */
  --bone: #f1ece1;
  --bone-2: #e7e0d1;
  --bone-3: #d9d1bf;
  --ink: #0c0c0c;
  --ink-2: #171717;
  --ink-3: #1f1f1f;
  --line: #2b2a27;
  --line-soft: rgba(12,12,12,.12);
  --line-softer: rgba(12,12,12,.06);

  /* Accents */
  --steel: #2f6e89;
  --steel-2: #22476a;
  --rust: #b84a1a;
  --olive: #5a5a2e;
  --brass: #c9a24a;
  --muted: #6b655a;
}
```

Tokens exposed to Tailwind v4 via `@theme inline`:

```css
@theme inline {
  --color-bone: var(--bone);
  --color-bone-2: var(--bone-2);
  --color-bone-3: var(--bone-3);
  --color-ink: var(--ink);
  --color-ink-2: var(--ink-2);
  --color-ink-3: var(--ink-3);
  --color-steel: var(--steel);
  --color-steel-2: var(--steel-2);
  --color-rust: var(--rust);
  --color-brass: var(--brass);
  --color-olive: var(--olive);
  --color-muted: var(--muted);
  --color-line: var(--line);
  --color-line-soft: var(--line-soft);
  --color-line-softer: var(--line-softer);

  --font-display: var(--font-oswald);
  --font-sans: var(--font-inter);
  --font-mono: var(--font-jetbrains);
  --font-serif: var(--font-dm-serif);
}
```

Global utilities added to `globals.css`:
- `.bg-topo-light` — SVG data-URI contour lines at 6% opacity (light sections)
- `.bg-topo-dark` — same pattern at 5% opacity for ink sections
- `.clip-chamfer` — `clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)`
- `.mono-eyebrow` — 11px / .1em / uppercase JetBrains Mono utility class
- `html { scroll-behavior: smooth }`

Keyframes defined at root: `pulse-dot`, `marquee-scroll`, `rotate-ring`, `float-logo`, `word-rise`, `reveal`.

### 6.2 Typography

`src/app/layout.tsx` loads fonts via `next/font/google`:

- **Oswald** 700 — existing, kept. CSS var `--font-oswald`.
- **Inter** 400/500 — existing, kept. CSS var `--font-inter`.
- **JetBrains Mono** 400/500 — **new**. CSS var `--font-jetbrains`.
- **DM Serif Display** 400 italic — **new**. CSS var `--font-dm-serif`.

All four applied to `<html>` / `<body>` via `className={`${oswald.variable} ${inter.variable} ${mono.variable} ${serif.variable} font-sans`}` so tokens are inherited globally.

### 6.3 Type scale

Codified as Tailwind classes in components — no new token variables needed:

- H1 hero: `clamp(56px, 9vw, 148px)` / line-height .86 / Oswald 700 uppercase
- H2 section: `clamp(42px, 6vw, 88px)` / line-height .9
- H3 card: 34–36px
- H4: 18–20px
- Body: 16–18px Inter
- Mono eyebrow: 10–12px / .1em–.2em / uppercase
- DM Serif pull quote: `clamp(36px, 5vw, 64px)` / italic

## 7. Global shell

### 7.1 TopBar (new, global)

Renders above navbar in `layout.tsx` on every page.

- Full-width `bg-ink` strip, `py-2` (8px)
- Left: `<PulseDot variant="rust" />` + `GLOOM STATUS: ACTIVE · NEXT MUSTER 05:15`
  - "NEXT MUSTER" string computed from today's day-of-week — next recurring workout day (M/W/F/Sat for typical F3 cadence). Server-rendered, acceptable to compute at build per page.
- Right (hidden below 720px): `MARIETTA, GA` · `EST. 2024 · REGION 2025` · `F3 NATION`
- Mono 11px / .08em / uppercase / bone 70%

### 7.2 Navbar (rewritten)

Replaces `src/components/layout/Navbar.tsx`.

- Sticky, `bg-bone/92 backdrop-blur`, 1px `border-line-soft` bottom border
- Brand lockup: 56×56 cannon-emblem circle (`border-radius: 50%`, 1.5px ink border) + stacked "F3 Marietta" (Oswald 20px) + "Fitness · Fellowship · Faith" (mono 10px .18em muted)
- Nav links: Oswald 13px / .06em / uppercase. Hover → steel. Active link → steel + 2px steel underline bar.
- Primary CTA: `<ChamferButton variant="ink" href="/workouts">Find a Workout →</ChamferButton>`, hover → steel.
- Mobile (below 960px): burger opens full-width ink drawer with stacked links, steel CTA at bottom.
- Client component (`"use client"`) — owns mobile menu open state and the scroll listener that sets active link based on `offsetTop ≤ scrollY + 120`.

### 7.3 Footer (rewritten)

Replaces `src/components/layout/Footer.tsx`.

- `bg-ink` text-bone, 80px top / 24px bottom padding
- 4-col grid `1.4 / 1 / 1 / 1`: Brand | Region | Resources | Connect
- Brand block: 72×72 logo on circular bone pad (so cannon reads on ink), Oswald 28px "F3 Marietta", 280px muted tagline
- Column headers: mono 11px .2em (e.g. `// Region`)
- Link items: Oswald 16px uppercase, hover → steel
- Bottom bar: flex `justify-between`, 1px top border, mono 11px .1em bone-40%:
  - Left: `// F3 MARIETTA · MARIETTA, GA · EST. 2024`
  - Right: `A REGION OF F3 NATION · PEER-LED · FREE OF CHARGE`

### 7.4 MarqueeRibbon (new, reusable)

Used between home sections and at page transitions on sub-pages.

- Full-width `bg-ink`, `py-3.5` (14px)
- Inline-flex track, 40s linear infinite horizontal scroll (`translateX(0) → translateX(-50%)`)
- Content duplicated twice for seamless loop: `FITNESS · FELLOWSHIP · FAITH · RAIN OR SHINE · PEER-LED · FREE OF CHARGE` separated by small filled circles
- Every 3rd item in steel, rest in bone

### 7.5 ScrollReveal (new, global client primitive)

Tiny client component wrapping children.

- Adds `.reveal` class initially
- IntersectionObserver fires once at 12% threshold → adds `.in` class
- CSS transitions opacity 0→1 and translateY(30px→0) over 800ms cubic-bezier(.2,.8,.2,1)
- Unobserves after firing so it's cheap

Usable directly on any server component as `<ScrollReveal>...</ScrollReveal>` — the child becomes revealing content.

### 7.6 AssistantWidget restyle

- Floating bubble trigger → clip-chamfer tactical button (steel bg, bone text, `AMA ↗` label)
- Expanded panel → ink bg, bone text, mono timestamps, chamfer submit button
- Message bubbles → chamfered frames (ink for user, bone for assistant)
- No behavioral changes. AI pipeline untouched.

## 8. Home page composition

`src/app/page.tsx` becomes a thin server component:

```
<HomeHero />                       live: count of unique PAX in last 7 days for meter-bar
<MarqueeRibbon />
<ThreeFsSection />                 static content from data/f3-about.md
<CreedPrinciplesSection />         static content from data/f3-mission-core-principles.md
<MarqueeRibbon variant="secondary" />
<WorkoutsPreviewSection />         live: getWorkoutSchedule() → first 6 AOs + link to /workouts
<BackblastsPreviewSection />       live: getBackblastsPaginated({limit: 6}) → [0] feature, [1..5] list
<ImpactSection />                  live: getImpactStats()
<JoinCTASection />
<Footer />                         already global
```

Details per section per the handoff README §3–§10. Every section wrapped in `<ScrollReveal>`.

Client components for interactivity:
- **`<WorkoutsFilter />`** — day-chip + search. Server passes the full schedule; client filters in memory. Debouncing not needed at current data size.
- **`<NavbarClient />`** — mobile menu + active-link scroll listener (already in §7.2).
- **`<AssistantWidget />`** — existing client, restyled.

All other home interactivity (scroll reveal, marquee scroll, emblem ring rotation, logo float, H1 word rise, pulse dot) is pure CSS — no JS needed.

## 9. Bespoke sub-page directions

Each page gets a custom layout composed from `ui/brand/` primitives. Shared pattern: `<PageHeader>` band → body composition → `<CTABand>` closing → global `<Footer>`.

### 9.1 `/about`

- **Hero band (ink):** Oswald "Men. Marietta.<br/>Since 2024." with cannon-emblem watermark at bottom-right 8% opacity. Meter bar above: `COORDINATES · 33.9526° N, 84.5499° W`.
- **Body:**
  - Mission section — sourced from `data/f3-about.md`. 1fr/2fr grid: eyebrow `§ 01 · The Mission` / H2 + kicker.
  - Timeline rail — three ink dot markers connected by a 1px steel line: `JUN 2024 · BATTLEFIELD LAUNCH`, `DEC 2025 · REGION LAUNCH`, `TODAY · N AOS ACTIVE`.
  - CreedQuote pull-quote — `*We plant, we grow, we serve.*` (italic fragment in steel).
  - Leadership grid — 2×N of clip-chamfer frame portraits + Oswald name + mono role (pulled from `data/f3-leadership.md`).
- **Closing:** Steel-gradient `<CTABand>` — "Your First Post →"

### 9.2 `/workouts`

- **Hero band (bone):** "Find Your<br/>Battlefield." with meter bar `ACTIVE AOS · N` (live from workout_schedule).
- **Body:**
  - Expanded `<WorkoutsFilter />` (server-fetched, client-filtered) with all 7 day chips + search + region filter if multiple regions.
  - Full AO grid (not truncated to 6 like home preview).
  - "Don't see your AO?" inline card at bottom linking to `/contact`.
- **Closing:** Ink `<CTABand>` — "What to expect on your first post →" linking to `/what-to-expect`.

Note: per-AO detail page (`/workouts/[slug]`) deferred to a follow-up. For now AO cards link out to map directions only.

### 9.3 `/backblasts`

- **Hero band (ink):** "From the<br/>Gloom." with cannon watermark at bottom-left 10% opacity.
- **Body:**
  - AO-filter chip row at top (`All`, then each AO from `ao_channels`).
  - Server-paginated feed using `getBackblastsPaginated`. Render as list of `<BackblastListItem>`, with every 4th item rendered as `<BackblastFeatureCard>` (large ink card) for visual rhythm.
  - Page nav at bottom (Previous / Next / page N of M).
- **Closing:** `<MarqueeRibbon variant="secondary" />` separator + inline newsletter signup card (optional — only if newsletter endpoint already exists; otherwise skip).

### 9.4 `/backblasts/[id]`

Restyled editorial article layout, same route signature.

- **Header band (ink):** mono tag `YYYY-MM-DD · F3.MAR.0N · Q · NAME`, Oswald `clamp(36px, 4vw, 56px)` headline, 16px excerpt.
- **Body (bone):**
  - DM Serif drop-cap on first paragraph.
  - Meta row with 1px top + bottom borders: Q · PAX count · FNGs · Time, all mono 11px.
  - Embedded images in clip-chamfer frames.
  - Attendee list at bottom as mono chip grid.
- **Closing:** Flex `<CTABand>` — ghost "Back to reports ←" + steel "Post tomorrow →" linking to /workouts.

### 9.5 `/new-here`

- **Hero band (bone):** "Your First<br/>Post." numbered meter-bar visual underneath showing the 5 steps.
- **Body:**
  - 5-row walkthrough: `01 · Arrive`, `02 · Circle Up`, `03 · Warm-up`, `04 · The Thang`, `05 · COT`. Each row: Oswald 72px steel step number + H3 + 16px kicker. 1px soft separators.
  - "What to bring" side-card: mono bullet list.
- **Closing:** Steel-gradient `<CTABand>` — "Plan Your First Post →"

### 9.6 `/contact`

- **Hero band (bone):** "Find us.<br/>Fall in." with map coordinate meter bar.
- **Body (1fr/1fr split):**
  - Left: office mailing info + direct emails rendered as clip-chamfer cards with mono labels.
  - Right: contact form (topic select: General / FNG Inquiry / Media) with mono labels above each field, ink chamfer submit. Form posts to existing contact endpoint if present; otherwise `mailto:` fallback.
- **Closing:** `<MarqueeRibbon />`.

### 9.7 `/fng`

- **Hero band (bone):** "FNG · 01.<br/>Friendly New Guy."
- **Body:** 3 short editorial paragraphs — what FNG means, what to bring, F3 tradition. Callback link to `/new-here` for longer walkthrough.
- **Closing:** Steel `<CTABand>` — "Find tomorrow's post →"

### 9.8 `/glossary`

- **Hero band (ink):** "The Lexicon." with mono sub-kicker `N TERMS · F3 NATION + REGIONAL`.
- **Body:**
  - Live search input (existing GlossaryList behavior, restyled).
  - Alphabetical letter rails: each letter rendered as Oswald 72px steel-blue anchor (A–Z skipping empty letters). Terms under each letter in a 2-column grid: mono code + Oswald term + inline Inter definition.
- **Closing:** Ghost link back to `/about`.

### 9.9 `/community`

- **Hero band (bone):** "Fellowship<br/>Ledger."
- **Body:** Grid of community events / service projects / 2nd F gatherings. Each card: date mono code + AO status chip + Oswald title + short recap. Content sourced from existing content files / markdown.
- **Closing:** Steel `<CTABand>` — "Join the ledger →" linking to `/contact`.

### 9.10 `/what-to-expect`

- **Hero band (ink):** "The First<br/>Whistle."
- **Body:** Horizontal timeline 0:00 → 45:00 using `<MeterBar />` primitive. Below the timeline: 5 stacked rows, each with Oswald minute marker + H4 event name + 15px description.
- **Closing:** Steel `<CTABand>` — "Plan your first post →"

## 10. Admin editorial treatment

Every admin surface gets the editorial treatment without sacrificing density.

### 10.1 Admin chrome (`src/app/admin/layout.tsx`)

- TopBar variant: ink strip, `// ADMIN` mono badge left, admin user name + logout right
- Breadcrumbs: mono 11px .15em uppercase, steel separator `·`
- Sidebar (if exists) or top tabs: Oswald 13px uppercase, active = steel + 2px steel underline
- Primary action buttons: chamfer steel ("New Workout →", "New Draft →")
- Secondary actions: ghost chamfer
- Tokens inherited from global — admin reads as bone/ink like the public site

### 10.2 Admin list pages

For every admin list (`workouts`, `regions`, `drafts`, `kb`, `newsletter`):

- Section head: `<SectionHead eyebrow="§ 01 · Workouts" h2="Schedule Manager" />`
- Filter bar: day-chip + search pattern from home workouts filter (reused)
- Table:
  - Column headers: mono 11px .15em uppercase, 1px bottom border
  - `// ID` mono column on left for any entity with a code
  - Status cells: `<StatusChip>` with steel (active), rust (archived), brass (draft), olive (pending)
  - Actions column: ghost chamfer buttons ("Edit →" / "Archive →")
  - Row hover: 3px steel scaleX left accent (same animation as AO cards on home)
  - Empty state: centered Oswald headline + `<ChamferButton>` CTA
- Pagination: mono `01 / 10 · Next →` bottom right

### 10.3 Admin edit drawers / modals

- Backdrop: `bg-ink/80 backdrop-blur`
- Drawer: `bg-ink` ink text-bone with 1px steel top border, clip-chamfer on top-right corner
- Form labels: mono 11px .15em uppercase
- Inputs: 1px bone-20% border, transparent bg, focus ring steel
- Primary submit: chamfer steel
- Destructive (delete): chamfer rust

### 10.4 Admin login

If `/admin` has a login page: bespoke ink hero band with "Admin · Access." H1, centered clip-chamfer form card on bone, chamfer steel submit.

## 11. Data additions

### `src/lib/stats/getImpactStats.ts`

```ts
import { getSql } from "@/lib/db";

export type ImpactStats = {
  uniqueHim: number;
  workoutsLed: number;
  activeAOs: number;
  fngsThisYear: number;
};

export async function getImpactStats(): Promise<ImpactStats> {
  try {
    const sql = getSql();
    const [himRow, workoutRow, aoRow, fngRow] = await Promise.all([
      sql`SELECT COUNT(DISTINCT slack_user_id) AS n FROM f3_event_attendees`,
      sql`SELECT COUNT(*) AS n FROM f3_events WHERE event_type = 'backblast'`,
      sql`SELECT COUNT(*) AS n FROM ao_channels WHERE is_active = true`,
      sql`SELECT COUNT(DISTINCT a.slack_user_id) AS n
          FROM f3_event_attendees a
          JOIN f3_events e ON e.id = a.event_id
          WHERE a.is_fng = true
            AND date_trunc('year', e.event_date) = date_trunc('year', now())`,
    ]);
    return {
      uniqueHim: Number(himRow[0]?.n ?? 0),
      workoutsLed: Number(workoutRow[0]?.n ?? 0),
      activeAOs: Number(aoRow[0]?.n ?? 0),
      fngsThisYear: Number(fngRow[0]?.n ?? 0),
    };
  } catch (err) {
    console.error("[getImpactStats] failed:", err);
    return { uniqueHim: 0, workoutsLed: 0, activeAOs: 0, fngsThisYear: 0 };
  }
}
```

Column/table names above are placeholders based on the CLAUDE.md schema summary. Implementation plan will verify against the actual DB schema and adjust the SQL if the real column names differ. The function contract (parallel counts, safe fallback) doesn't change.

Caching: function called from `ImpactSection` server component. Next.js App Router caches the route render per deploy unless `dynamic = 'force-dynamic'` is set. Default behavior is fine — stats update on redeploy or ISR revalidation. If live updates become important later, add `revalidate = 3600` to the Impact section.

## 12. Test strategy

Every page rewrite lands with its spec update in the same commit. No test disabled at any point.

Specs to update:

- **`homepage.spec.ts`** — Assert new H1 text ("Hold the" / "Battlefield." / "Leave no man" / "behind."), hero CTAs exist, marquee ribbon rendered, Three-F card count = 3, creed quote present, workouts preview shows ≥1 AO, backblasts preview shows ≥1 item, impact section shows 4 numbers, join CTA present, footer 4-column.
- **`navigation.spec.ts`** — Nav links (Home / About / Workouts / Backblasts / New Here / Contact), active-state underline on current route, mobile drawer opens at <960px, CTA "Find a Workout" visible.
- **`accessibility.spec.ts`** — Run existing axe-core pass against new pages. Add contrast checks for the new ink sections (mono 11px bone-70% on ink could fail at small sizes — may need to bump opacity or size).
- **`backblasts.spec.ts`** — Backblasts list renders, pagination works, feature-card pattern every 4th item, detail page links work.
- **`glossary.spec.ts`** — Letter rails render, search filters terms, term count > 0.
- **`pages.spec.ts`** — Smoke: every public page loads with 200 + has PageHeader + Footer.
- **`admin-workouts.spec.ts`** — Admin login, list renders with editorial chrome, new/edit drawers open, chamfer submit works, status chips render.
- **`ama-widget.spec.ts`** — Restyled widget still opens, submits, renders response.

Playwright config unchanged. `npm run test:e2e` runs against dev server as today.

## 13. Git & deploy plan

- Feature branch: `feature/website-redesign` off `main`
- Commit waves (reviewable sequential commits, all on the same branch):
  1. Tokens + fonts + globals.css + `ui/brand/` primitives + delete old `Hero.tsx` / `StatusBadge.tsx`
  2. Global shell — TopBar, Navbar, Footer, MarqueeRibbon, AssistantWidget restyle
  3. Home page sections + `page.tsx` + `getImpactStats` + updated `homepage.spec.ts` + `navigation.spec.ts`
  4. Public sub-pages (about, workouts, backblasts, new-here, contact, fng, glossary, community, what-to-expect) + updated `backblasts.spec.ts` / `glossary.spec.ts` / `pages.spec.ts`
  5. `/backblasts/[id]` detail restyle
  6. Admin reskin + updated `admin-workouts.spec.ts`
- Pre-push gate after each wave: `npx tsc --noEmit && npm run build && npx playwright test`
- Merge `feature/website-redesign` → `develop` after wave 3 for first Vercel preview
- Push remaining waves to same feature branch, re-merge to `develop` once when complete
- Merge `develop` → `main` after preview sign-off
- Target: 2 develop previews + 1 production build across the whole redesign (respects deploy discipline from global CLAUDE.md)

## 14. Risks & open questions

- **DB column names for `getImpactStats`** — the spec uses placeholder column names (`slack_user_id`, `is_fng`, `event_date`, `event_type`, `is_active`). Implementation plan will verify against schema and adjust if needed. Safe-fallback catch ensures the page renders regardless.
- **Hero "MUSTER LOG · N MEN POSTED THIS WEEK"** — depends on `event_date` being populated correctly, which was the subject of recent backblast reconciliation work. If counts are inaccurate, fallback to a static number is acceptable for launch.
- **Logo inversion in hero** — the cannon emblem's color palette may not invert cleanly to pure white. If `filter: invert(1)` produces artefacts, swap to a dedicated bone-on-transparent PNG export. Implementation will check visually and decide.
- **Mono text readability at 10–11px on bone** — contrast against `--muted` may fail WCAG AA at tiny sizes. Accessibility spec will catch; may need to push muted darker or ticks up to 12px in some contexts.
- **Admin mobile** — admin currently not optimized for mobile; not a goal to change here, but the new editorial chrome will inherit responsive behavior from the layout. Acceptable if the admin is effectively desktop-only.
- **Playwright DOM churn** — every page rewrite potentially churns selectors. Mitigated by updating specs in the same commit as the page rewrite.
- **AssistantWidget animation performance** — if the restyled widget adds expensive backdrop-blur on mobile, consider feature-detecting and falling back to solid ink.

## 15. Follow-up candidates (explicitly out of scope)

- Per-AO detail pages at `/workouts/[slug]` with map, Q rotation, and historical backblasts filtered by AO.
- Newsletter inline capture on `/backblasts`.
- Admin mobile optimization.
- Dark-mode toggle (site is intentionally single-palette).
- PAX profile pages, member directory, event RSVPs.
