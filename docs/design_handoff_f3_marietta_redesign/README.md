# Handoff: F3 Marietta Website Redesign

## Overview

A complete visual redesign of the F3 Marietta website (Next.js app at `f3-marietta/`). The redesign anchors on the new cannon-emblem brand logo and introduces a military‑historic, editorial aesthetic — bone‑white background, deep ink typography, a Marietta steel‑blue accent, with restrained rust tones reserved for alert states. The site is a single marketing front door leading into the existing authenticated sections (workouts, backblasts, contact).

All existing information architecture from the current site is preserved: nav (Home, About, Workouts, Backblasts, New Here, Contact), the 3 F's mission framing, the 5 Core Principles, AO listings, backblast summaries, and the "Leave no man behind" credo.

## About the Design Files

The files in this bundle are **design references created in HTML** — a high-fidelity prototype showing intended look and behavior, **not production code to copy directly**.

Your task is to **recreate this design inside the existing F3 Marietta Next.js codebase** (`/f3-marietta`) — replacing the current home page and updating shared UI primitives (Navbar, Hero, Section, Card, Footer, Button) to match. Use the repo's existing stack:
- Next.js App Router + React
- TailwindCSS (v4, `@theme inline` tokens in `src/app/globals.css`)
- Existing component structure in `src/components/ui` and `src/components/layout`
- `next/font` for Oswald + Inter (already configured)
- `next/image` for images

Do NOT ship the HTML file as-is. Treat it as a pixel reference.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, and interaction behavior are all specified. Recreate pixel-perfectly where practical.

## Content Accuracy Note (from product owner)

The mock content in the prototype — particularly the backblast headlines, Q names, and AO details beyond The Battlefield and The Last Stand — is **placeholder copy** used to show structure. When implementing:
- **Keep all canonical content** from the existing codebase: the 3 F's definitions, 5 Core Principles, "Leave no man behind, but leave no man where you found him" credo, Mission statement, region launch dates, and real AO list.
- Source real backblast data from the existing Backblasts pipeline (`src/lib/backblast/getBackblastsPaginated.ts`) rather than the mock list.
- Source real workout schedule data from `src/lib/workouts/getWorkoutSchedule.ts` rather than the hardcoded AO list in the prototype.
- Placeholder stats in the "Impact" section (187 HIM, 412 workouts, etc.) should be either replaced with real numbers, driven from a data source, or removed.
- Double-check all verbiage against `data/f3-about.md`, `data/f3-mission-core-principles.md`, and `data/f3-marietta-region.md`.

## Design Tokens

Add these to `globals.css` (replacing/extending the current `:root` block). The current site is dark-navy themed; this redesign is **light (bone) themed** with dark sections for rhythm.

```css
:root {
  /* Surfaces */
  --bone: #f1ece1;        /* primary background */
  --bone-2: #e7e0d1;      /* alt section background */
  --bone-3: #d9d1bf;      /* deeper bone, rarely used */
  --ink: #0c0c0c;         /* primary text + dark sections */
  --ink-2: #171717;
  --ink-3: #1f1f1f;
  --line: #2b2a27;
  --line-soft: rgba(12,12,12,.12);
  --line-softer: rgba(12,12,12,.06);

  /* Accents */
  --steel: #2f6e89;       /* Marietta steel blue — primary accent */
  --steel-2: #22476a;     /* darker hover */
  --rust: #b84a1a;        /* restrained warm accent — alerts only */
  --olive: #5a5a2e;
  --brass: #c9a24a;
  --muted: #6b655a;
}
```

### Typography

Already configured via `next/font` in the repo — keep them:
- **Oswald** (700) — display, all UPPERCASE with .01em–.1em letter-spacing depending on size. Used for H1–H4, nav, CTA labels.
- **Inter** — body text, 15–18px.
- **JetBrains Mono** — tactical labels, eyebrows, metadata, status chips. 10–12px, .1em–.2em letter-spacing, UPPERCASE. **Add this to the existing `next/font` config**.
- **DM Serif Display** (italic) — only for the creed pull quote. **Add this**.

### Scale

- H1 hero: `clamp(56px, 9vw, 148px)`, line-height .86
- H2 section: `clamp(42px, 6vw, 88px)`, line-height .9
- H3 card: 34–36px
- H4: 18–20px
- Body: 16–18px
- Small caps labels: 10–12px mono, .1–.2em tracking
- Container max-width: 1320px, horizontal padding 28px (18px on mobile)

### Effects

- **Clip-path buttons**: primary CTAs use `clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%)` for a chamfered/tactical shape.
- **Topo pattern backgrounds**: subtle SVG data-URI contour lines at 6% opacity overlay on light sections, 5% on dark.
- **Grain overlay**: fractal-noise SVG filter at 15% multiply opacity (optional).
- **Corner brackets**: 22×22px L-shaped corners in steel blue on the hero emblem frame.

## Screens / Views

There is one page in the prototype (the home page), but the design introduces patterns that should be rolled out across the whole site.

### 1. Top Bar (global)

- Full-width strip on `--ink`, 8px vertical padding.
- Left: pulsing rust dot (keyframe: opacity 1→.6 with expanding box-shadow ring) + "GLOOM STATUS: ACTIVE · NEXT MUSTER 05:15"
- Right (hidden <720px): "MARIETTA, GA" · "EST. 2024 · REGION 2025" · "F3 NATION"
- Mono 11px, `.08em` tracking, UPPERCASE, `--bone` text at 70% opacity.

### 2. Nav (global — replaces `src/components/layout/Navbar.tsx`)

- Sticky, `rgba(241,236,225,.92)` background with `backdrop-filter: blur(12px)`, 1px `--line-soft` bottom border.
- Brand: 56×56 circular logo (`border-radius: 50%`, 1.5px ink border) + stacked title "F3 Marietta" (Oswald 20px) + subtitle "Fitness · Fellowship · Faith" (mono 10px, .18em tracking, `--muted`).
- Links: Oswald‑ish 13px, .06em tracking, UPPERCASE. Hover → `--steel`. Active link → `--steel` + 2px underline bar beneath.
- CTA button "Find a Workout →": ink background, bone text, clip-path chamfer. Hover → steel blue.
- Mobile burger at <960px opens a full-width ink drawer with stacked nav links.

### 3. Hero (home)

Full-viewport (min-height: `calc(100vh - 98px)`) dark section. Layered background:
1. Base: `linear-gradient(180deg, #10141a 0%, #0a0d12 100%)`
2. Radial glow at 28% 35% → `rgba(47,93,136,.32)` steel
3. Radial glow at 78% 72% → `rgba(30,58,95,.45)` deeper steel
4. Subtle rust glow at 55% 90% → `rgba(184,74,26,.08)` for warmth
5. Mountain SVG contour lines at 6% opacity along the bottom
6. Dark vignette overlay

**Meter bar** (top of hero): "COORDINATES · 33.9526° N, 84.5499° W" | tick marks (mix of neutral and steel-blue tall ticks) | "MUSTER LOG · 42 MEN POSTED THIS WEEK". Mono 11px.

**Content grid**: 1.3fr / 1fr on desktop, stacked on mobile.

Left column:
- Eyebrow: 28px dash rule + "Marietta Region · F3 Nation" in steel mono 11px .2em.
- H1: four stacked lines, each wrapped in `.line` with `overflow: hidden`, inner `.word` animates `translateY(102%)→0` in .9s cubic‑bezier(.2,.8,.2,1), with .1s and .2s staggered delays.
  - Default lines: "Hold the" / "Battlefield." (steel blue, with underline scope animation) / "Leave no man" / "behind." (55% opacity bone)
  - Oswald 700, `clamp(56px,9vw,148px)`, line-height .86.
- Lede: 18px bone at 82% opacity, max-width 540px. "Free, peer-led workouts for men in Marietta, GA. We start in the gloom at 05:15, rain or shine — and we finish as better husbands, fathers, friends, and leaders."
- CTAs: primary "Find a Workout →" (steel blue, clip-path chamfer, 18/28 padding) + ghost "What is F3?" (1.5px bone-30% border, no clip).
- Metrics row: 3-col grid, 1px top border, 28px gap. "5:15am" / "$0" / "4/wk" with UPPERCASE mono labels (First Whistle, Always Free, Active AOs). Steel‑blue small text for the em suffix.

Right column — **Emblem card** (aspect-ratio 1, max-width 520px):
- Outer dashed steel-blue ring, inset -40px, rotating slowly (60s linear infinite).
- Frame: 1px bone‑18% border, bone‑2% fill, backdrop‑blur 6px.
- Corner brackets: 22×22px steel-blue L shapes at all four corners (see `.emblem .corner` in prototype).
- Logo image: 82% width, `filter: invert(1) contrast(1.1) drop-shadow(0 20px 40px rgba(0,0,0,.5))`, float animation 8s (translateY 0 ↔ -10px).
- Four mono readouts at corners outside the frame: "// ID · F3.MAR.01" (tl), "REV · 2025" (tr), "LAT 33.95° / LON -84.55°" (bl), "// GLOOM · 05:15 EDT" (br, steel).

### 4. Marquee Ribbon (global separator)

- Full-width strip on `--ink`, 14px vertical padding.
- Inline-flex track, 40s linear infinite horizontal scroll (`translateX(0)→translateX(-50%)`).
- Content duplicated twice for seamless loop: "FITNESS · FELLOWSHIP · FAITH · RAIN OR SHINE · PEER-LED · FREE OF CHARGE" separated by small filled circles.
- Every 3rd item in steel blue, rest in bone.

### 5. "Three F's" Section (`#about`)

- 120px top, 100px bottom padding, `--bone` background.
- Section head: 1fr/2fr grid. Left: eyebrow "§ 01 · The Mission" + H2 "Three F's.<br/>One Brotherhood." Right: 560px kicker copy paraphrasing F3 mission from `data/f3-about.md`.
- 3-col grid of `.f-card`, 1px soft borders between, no outer gap. Each card:
  - `// 01/02/03` mono label
  - 64×64 circular outline icon (barbell, two silhouettes, triangle/compass)
  - Name: Oswald 64px uppercase
  - Hairline rule
  - Description paragraph
  - Mono tag line (e.g. "→ 45–60 min · Bodyweight · Outdoors")
  - **Hover**: whole card flips to `--ink` background with bone text, num + name turn steel blue. 300ms transition.

Content (verbatim):
- **Fitness**: "Start together. End together. The workout is open to every man at every fitness level. Heavy or skinny, fast or slow — we move as one unit. No man left behind."
- **Fellowship**: "The bonds built in the gloom don't end at the whistle. Second F — coffee, cookouts, service projects, accountability groups — that brotherhood is what gets you through the other 23 hours."
- **Faith**: "Not a denomination. A belief in something bigger than yourself. Every workout closes with a Circle of Trust — name-o-rama, a prayer or reflection, and a charge back into the day."

### 6. Creed + 5 Principles Section

- `--ink` background, bone text, 100px vertical padding, dark topo overlay.
- Centered serif pull quote: DM Serif Display italic, `clamp(36px, 5vw, 64px)`, two lines, "but leave no man *where you found him.*" in steel blue italic. Max-width 960px.
- Below: 5-col grid (2‑col at <900px, 1‑col at <500px) with 1px separators. Each cell:
  - Oswald 72px steel‑blue numeral
  - H4 Oswald 18px title
  - 13px bone‑60% description
- Content from `data/f3-mission-core-principles.md`:
  1. Free of Charge — No fees. No membership. No catch. You show up.
  2. Open to All Men — Any age, any fitness level. The door is always open.
  3. Held Outdoors — Rain or shine. Heat or cold. We embrace the elements.
  4. Peer-Led — No instructors. Men take turns Q-ing the workout.
  5. Ends in COT — Circle of Trust. Reflection. Charge back into the day.

### 7. Workouts Section (`#workouts`)

- `--bone-2` background, 120/100 padding.
- Section head: "§ 02 · Posts of Assembly" / "Find Your Battlefield."
- **Control bar**: day chips (All / Mon / Tue / Wed / Thu / Fri / Sat) + live search input with magnifier glyph.
  - Chip: 10/16 padding, 1px soft border, mono 11px .1em UPPERCASE. `.on` → ink bg, bone text.
  - Search input: 12/16 padding, icon left, 1px soft border, focus ring = ink.
- **AO grid**: `grid-template-columns: repeat(auto-fill, minmax(320px, 1fr))`, 20px gap.
- Each `.ao` card:
  - 1px soft border, 28px padding, `--bone` background
  - Top-of-card 3px steel-blue scale-X accent line (scaleX 0→1 on hover, transform-origin left, 300ms)
  - Top row: mono code "F3.MAR.01" + status chip (`.active` steel blue, `.launch` rust)
  - H3 Oswald 34px name
  - Location row with pin icon, mono 11px, `--muted`
  - Day/time rows: each row has mono day label left, Oswald 15px time right with steel mono "· GLOOM" suffix
  - Footer: "Q · <Name>" left, "Directions →" in steel blue right (gap expands on hover)
  - Hover: translateY(-2px) + ink border + elevation shadow
- **Real data source**: wire this to `getWorkoutSchedule.ts`. Pull live data in a server component, pass to a client filter/search component.

### 8. Backblasts Section (`#reports`)

- `--bone` background, 120/100 padding.
- Section head: "§ 03 · From the Gloom" / "Battlefield Reports."
- 1.3fr / 1fr grid (stack on <900px):
  - **Feature card** (ink bg, bone text, 44px padding, min-height 520px):
    - Steel-blue mono tag with date + AO
    - Oswald `clamp(36px, 4vw, 56px)` title, max 580px
    - 16px excerpt at 75% opacity, max 580px
    - Meta row: Q · PAX · FNGs · Time, mono 11px, 1px top border
    - Background cannon logo at 8% opacity, bottom-right -80px offset
  - **Report list**: 1px soft border, each item 24px padding, bottom border:
    - Row 1: AO tag chip (ink bg bone text) + date + Q name, all mono 10px .15em
    - H4 Oswald 20px headline
    - 13px muted excerpt
    - Right arrow appears on hover, slides 4px
- **Real data source**: pull from `getBackblastsPaginated.ts` — show 1 featured (most recent) + up to 5 in the list, clickable through to existing `/backblasts/[id]` detail pages.

### 9. Impact Section

- `--ink` bg, bone text, 100px padding, dark topo overlay.
- 1fr/1fr grid:
  - Left: H2 with mixed Oswald + DM Serif italic "Built in Marietta. *Forged* in the gloom." (the italic word in steel blue). 500px lede paragraph about the June 2024 Battlefield launch and December 2025 region launch. Primary steel-blue CTA "Your First Post →".
  - Right: 2×2 impact stats grid, 1px internal borders, 36/28 padding per cell. Oswald 64px steel-blue numbers. Labels: Unique HIM Posted, Workouts Led, Active AOs, FNGs This Year.
- **Replace stats with real data or remove** — current numbers are placeholders.

### 10. Join CTA Section (`#new`)

- Background: `linear-gradient(180deg, #24446a 0%, #1a3552 100%)`, bone text. 120px padding.
- 1.5fr/1fr grid, aligned `end`:
  - Giant H2 "Post.<br/>That's it." — Oswald `clamp(56px, 9vw, 160px)`, line-height .86.
  - Right: "No sign-up. No fee. No catch. Show up five minutes early, tell us your name, and fall in. We'll handle the rest." + bone-filled "Plan Your First Post →" CTA.
- Background watermark: "05:15" in Oswald 480px at 6% bone opacity, anchored bottom-right, pointer-events none.

### 11. Footer (`#contact` — replaces `src/components/layout/Footer.tsx`)

- `--ink` bg, bone text, 80px top / 24px bottom padding.
- 4-col grid (1.4 / 1 / 1 / 1): Brand block + three link columns (Region, Resources, Connect).
- Brand: 72×72 circular logo with bone border + bone padding (shows logo against light bg), Oswald 28 title, muted 280px tagline.
- Link column headers: mono 11px .2em "// Region" etc.
- Link items: Oswald 16 uppercase, hover → steel blue.
- Bottom bar: flex justify-between, 1px top border, mono 11px .1em at 40% opacity. Left: "// F3 MARIETTA · MARIETTA, GA · EST. 2024", right: "A REGION OF F3 NATION · PEER-LED · FREE OF CHARGE".

## Interactions & Behavior

- **Scroll reveal**: elements with `.reveal` fade + translateY(30→0) over 800ms cubic-bezier(.2,.8,.2,1) when 12% in viewport. Use IntersectionObserver; unobserve after firing.
- **Active nav link**: scroll listener (passive) picks the section whose `offsetTop` ≤ `scrollY + 120` and toggles `.active` on matching nav anchor.
- **AO filter + search**: client-side filter by day-of-week tag; substring match on name + location. Debounce search input if data is large (currently fine without).
- **Mobile menu**: burger toggles `.open` on nav drawer.
- **Smooth scroll**: `html { scroll-behavior: smooth }` for anchor links.

## State Management

Page is primarily server-rendered. Two small client islands:
1. **Nav** — `useState` for mobile menu open/closed and a scroll listener for active link.
2. **Workouts filter** — `useState` for active day chip and search string; filter the server-fetched workouts list in-memory.

Backblasts list is server-rendered (paginated via existing lib).

## Assets

Located in `/assets/`:
- `logo-cannon.png` — **primary new brand mark** (cannon, mountain, "F3 Marietta / Fitness · Fellowship · Faith / Est. 2025" in a circular badge). Used in nav, hero emblem, footer, and as backdrop in the featured backblast card.
- `logo-primary.png` / `logo-alt-1.png` / `logo-alt-2.png` — existing brand files from the repo, kept for reference.

All other visuals are CSS/SVG (topographic contour patterns, corner brackets, tick marks, icon glyphs).

## Files in This Bundle

- `F3 Marietta Redesign.html` — the full interactive prototype (open in a browser to interact with nav, AO filters, hover states, scroll animations, and the Tweaks panel).
- `assets/logo-cannon.png` + the three existing logo PNGs.
- `screenshots/` — pixel references of every section, captured at design resolution:
  - `01-hero.png` — hero with emblem, meter bar, metrics
  - `02-three-f-section.png` — 3 F's grid
  - `03-creed-five-principles.png` — serif pull quote + 5 principles row
  - `04-workouts-ao-grid.png` — AO filter + card grid
  - `05-backblasts-reports.png` — feature card + list
  - `06-impact-stats.png` — stats block on ink
  - `07-join-cta.png` — steel-gradient post CTA
  - `08-footer.png` — footer grid + bottom bar
- `README.md` — this document.

Use the screenshots for pixel‑perfect reference alongside the HTML. The HTML is authoritative for interactions (hover states, animations, scroll behavior).

## Implementation Checklist

- [ ] Add Google Fonts (JetBrains Mono + DM Serif Display) via `next/font`
- [ ] Rewrite `src/app/globals.css` `:root` with new token set; remove dark-theme defaults
- [ ] Rebuild `src/components/layout/Navbar.tsx` with new brand lockup + sticky bone nav
- [ ] Rebuild `src/components/layout/Footer.tsx` with new 4-col ink layout
- [ ] Rebuild `src/components/ui/Hero.tsx` as a dedicated home hero with layered background + emblem
- [ ] Rewrite `src/app/page.tsx` with new section order (top bar, hero, marquee, 3 F's, creed, workouts preview, backblasts preview, impact, join, footer)
- [ ] Create new `AOCard` component (or replace existing) matching new AO card spec
- [ ] Create `BackblastFeatureCard` + `BackblastListItem` components
- [ ] Wire workouts section to `getWorkoutSchedule.ts`
- [ ] Wire backblasts section to `getBackblastsPaginated.ts`
- [ ] Replace Impact stats with real values or a live data source (or remove section)
- [ ] Audit all copy against `data/f3-about.md`, `f3-mission-core-principles.md`, `f3-marietta-region.md`
- [ ] Update `/about`, `/workouts`, `/backblasts`, `/new-here`, `/contact` sub-pages to match the new look (new section header pattern, new CTA style, new card style)
- [ ] Verify existing Playwright tests in `tests/` still pass (update selectors where needed)

## Logo Usage Notes

The new cannon emblem reads best:
- At 56–72px in nav/footer (circular crop with 1–1.5px border)
- At ~82% of a square frame in the hero (inverted to white via CSS filter so it reads on dark)
- Never below 32px — detail is lost

Keep 0.5× the logo's width of clear space around it in all uses.
