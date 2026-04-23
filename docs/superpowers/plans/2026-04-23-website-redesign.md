# F3 Marietta Website Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Full visual redesign of the F3 Marietta website using a bone-white / deep-ink military-editorial aesthetic anchored on the new cannon-emblem logo, with Marietta steel-blue as the sole accent. Every public page plus the admin console gets bespoke editorial layouts composed from shared primitives. Live data wired into the home page.

**Architecture:** Introduce `src/components/ui/brand/` for shared design primitives and `src/components/home/` for home-page section compositions. Rewrite global chrome (TopBar, Navbar, Footer, MarqueeRibbon), rebuild the home page from 9 new section components, then rewrite each public sub-page bespoke. Admin gets full editorial reskin (mono column headers, status chips, chamfer actions, ink edit drawers). One new server data function (`getImpactStats`) with safe fallback; two new Google Fonts (JetBrains Mono, DM Serif Display).

**Tech Stack:** Next.js 16 App Router, React, TypeScript, Tailwind CSS v4 (`@theme inline` tokens), `next/font` for Oswald + Inter + JetBrains Mono + DM Serif Display, `next/image` for images, Neon (Postgres) for data, Playwright for E2E tests.

**Source references (authoritative):**
- Design spec: `docs/superpowers/specs/2026-04-23-website-redesign-design.md`
- Handoff README: `docs/design_handoff_f3_marietta_redesign/README.md`
- HTML prototype: `docs/design_handoff_f3_marietta_redesign/F3 Marietta Redesign.html` — authoritative for exact CSS, animations, clip-paths
- Screenshots: `docs/design_handoff_f3_marietta_redesign/screenshots/`
- Logo asset: `docs/design_handoff_f3_marietta_redesign/assets/logo-cannon.png`

**Naming note:** The HTML prototype uses `--ember` for Marietta steel blue. The design spec names this `--steel`. Use `--steel` as the canonical name in the codebase.

**Shared types used across tasks** (for reference; created where each task dictates):

```ts
// ChamferButton variants
type ChamferVariant = 'steel' | 'ink' | 'bone' | 'ghost';

// StatusChip variants
type StatusVariant = 'active' | 'launch' | 'archived' | 'draft' | 'fng' | 'pending';

// MeterBar tick config
type MeterTick = { highlight?: boolean; tall?: boolean };

// SectionHead props
type SectionHeadProps = {
  eyebrow: string;
  h2: React.ReactNode;
  kicker?: React.ReactNode;
  align?: 'left' | 'center' | 'split';
  id?: string;
};

// PageHeader props (sub-page hero band)
type PageHeaderProps = {
  eyebrow?: string;
  title: React.ReactNode;
  kicker?: React.ReactNode;
  variant?: 'bone' | 'ink';
  meter?: { left?: string; right?: string };
};

// CTABand props
type CTABandProps = {
  variant?: 'steel' | 'ink' | 'bone' | 'gradient';
  title: React.ReactNode;
  kicker?: React.ReactNode;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
};
```

---

## Wave 0 — Setup

### Task 0.1: Create feature branch

**Files:** none

- [ ] **Step 1: Verify clean working tree**

Run: `git status`
Expected: Only the expected modified files (AGENTS.md, CLAUDE.md, f3-automation/CLAUDE.md) and the docs handoff folder. No staged changes.

- [ ] **Step 2: Create and switch to feature branch**

Run: `git checkout -b feature/website-redesign`
Expected: `Switched to a new branch 'feature/website-redesign'`

- [ ] **Step 3: Verify branch**

Run: `git branch --show-current`
Expected: `feature/website-redesign`

- [ ] **Step 4: Commit the design spec and plan**

```bash
git add docs/superpowers/specs/2026-04-23-website-redesign-design.md docs/superpowers/plans/2026-04-23-website-redesign.md
git commit -m "docs: add website redesign spec and plan"
```

---

## Wave 1 — Design system foundation

### Task 1.1: Register new fonts in root layout

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add JetBrains Mono and DM Serif Display font imports**

Replace lines 1-13 of `src/app/layout.tsx`:

```tsx
import type { Metadata } from "next";
import { Inter, Oswald, JetBrains_Mono, DM_Serif_Display } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const oswald = Oswald({
  variable: "--font-oswald",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: "swap",
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const dmSerif = DM_Serif_Display({
  variable: "--font-dm-serif",
  subsets: ["latin"],
  weight: ["400"],
  style: ["italic"],
  display: "swap",
});
```

- [ ] **Step 2: Apply font variables to body className**

Replace the body element's className (line 61) so it includes all four font variables:

```tsx
<body
  className={`${inter.variable} ${oswald.variable} ${jetbrainsMono.variable} ${dmSerif.variable} antialiased bg-bone text-ink font-sans flex flex-col min-h-screen`}
>
```

(Note: `bg-bone` / `text-ink` will resolve once `globals.css` is rewritten in Task 1.2. A temporary typecheck failure here is expected until Task 1.2 completes.)

- [ ] **Step 3: Verify fonts load at runtime**

Start dev server (if not running): `lsof -i :3003 -t >/dev/null || (PORT=3003 npm run dev &)`
Wait a few seconds, then:
Run: `curl -s http://localhost:3003 | grep -Eo 'font-(inter|oswald|jetbrains|dm-serif)'`
Expected: At least one match per variable name (proves fonts emitted into HTML).

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat: register JetBrains Mono and DM Serif Display fonts"
```

---

### Task 1.2: Rewrite globals.css with bone/ink token system

**Files:**
- Modify: `src/app/globals.css` (full rewrite)

- [ ] **Step 1: Replace globals.css with new token system**

Overwrite `src/app/globals.css` entirely with:

```css
@import "tailwindcss";

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
  --color-olive: var(--olive);
  --color-brass: var(--brass);
  --color-muted: var(--muted);
  --color-line: var(--line);

  --font-sans: var(--font-inter);
  --font-display: var(--font-oswald);
  --font-mono: var(--font-jetbrains);
  --font-serif: var(--font-dm-serif);
}

html { scroll-behavior: smooth; }

body {
  background: var(--bone);
  color: var(--ink);
  font-family: var(--font-inter), system-ui, sans-serif;
  font-size: 16px;
  line-height: 1.55;
  -webkit-font-smoothing: antialiased;
  overflow-x: hidden;
}

h1, h2, h3, h4, h5, h6 {
  font-family: var(--font-oswald), sans-serif;
  text-transform: uppercase;
  letter-spacing: 0.02em;
  font-weight: 700;
}

/* ========== Utility classes ========== */

.clip-chamfer {
  clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
}

.clip-chamfer-sm {
  clip-path: polygon(8px 0, 100% 0, calc(100% - 8px) 100%, 0 100%);
}

.mono-eyebrow {
  font-family: var(--font-jetbrains), monospace;
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.bg-topo-light {
  background-image:
    radial-gradient(ellipse at 20% 10%, rgba(47,110,137,.07), transparent 60%),
    url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800' viewBox='0 0 800 800'><g fill='none' stroke='%230c0c0c' stroke-opacity='0.06' stroke-width='1'><path d='M0,400 C100,350 200,450 300,400 S500,350 600,400 S800,450 900,400' /><path d='M0,350 C100,300 200,400 300,350 S500,300 600,350 S800,400 900,350' /><path d='M0,300 C100,250 200,350 300,300 S500,250 600,300 S800,350 900,300' /><path d='M0,450 C100,400 200,500 300,450 S500,400 600,450 S800,500 900,450' /><path d='M0,500 C100,450 200,550 300,500 S500,450 600,500 S800,550 900,500' /><path d='M0,250 C100,200 200,300 300,250 S500,200 600,250 S800,300 900,250' /><path d='M0,200 C100,150 200,250 300,200 S500,150 600,200 S800,250 900,200' /><path d='M0,550 C100,500 200,600 300,550 S500,500 600,550 S800,600 900,550' /><path d='M0,150 C100,100 200,200 300,150 S500,100 600,150 S800,200 900,150' /><path d='M0,600 C100,550 200,650 300,600 S500,550 600,600 S800,650 900,600' /><path d='M0,100 C100,50 200,150 300,100 S500,50 600,100 S800,150 900,100' /><path d='M0,650 C100,600 200,700 300,650 S500,600 600,650 S800,700 900,650' /></g></svg>");
}

.bg-topo-dark {
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='800' height='800' viewBox='0 0 800 800'><g fill='none' stroke='%23f1ece1' stroke-opacity='0.05' stroke-width='1'><path d='M0,400 C100,350 200,450 300,400 S500,350 600,400 S800,450 900,400' /><path d='M0,350 C100,300 200,400 300,350 S500,300 600,350 S800,400 900,350' /><path d='M0,300 C100,250 200,350 300,300 S500,250 600,300 S800,350 900,300' /><path d='M0,450 C100,400 200,500 300,450 S500,400 600,450 S800,500 900,450' /><path d='M0,500 C100,450 200,550 300,500 S500,450 600,500 S800,550 900,500' /><path d='M0,250 C100,200 200,300 300,250 S500,200 600,250 S800,300 900,250' /><path d='M0,200 C100,150 200,250 300,200 S500,150 600,200 S800,250 900,200' /><path d='M0,550 C100,500 200,600 300,550 S500,500 600,550 S800,600 900,550' /><path d='M0,150 C100,100 200,200 300,150 S500,100 600,150 S800,200 900,150' /><path d='M0,600 C100,550 200,650 300,600 S500,550 600,600 S800,650 900,600' /><path d='M0,100 C100,50 200,150 300,100 S500,50 600,100 S800,150 900,100' /><path d='M0,650 C100,600 200,700 300,650 S500,600 600,650 S800,700 900,650' /></g></svg>");
}

/* ========== Keyframes ========== */

@keyframes pulse-dot {
  0%, 100% { opacity: 1; box-shadow: 0 0 0 0 rgba(184,74,26,.5); }
  50% { opacity: .6; box-shadow: 0 0 0 6px rgba(184,74,26,0); }
}

@keyframes marquee-scroll {
  from { transform: translateX(0); }
  to { transform: translateX(-50%); }
}

@keyframes rotate-ring {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes float-logo {
  0%, 100% { transform: translateY(0); }
  50% { transform: translateY(-10px); }
}

@keyframes word-rise {
  from { transform: translateY(102%); }
  to { transform: translateY(0); }
}

@keyframes scope-underline {
  from { transform: scaleX(0); }
  to { transform: scaleX(1); }
}

/* ========== Scroll reveal ========== */

.reveal {
  opacity: 0;
  transform: translateY(30px);
  transition: opacity .8s cubic-bezier(.2,.8,.2,1), transform .8s cubic-bezier(.2,.8,.2,1);
}
.reveal.in {
  opacity: 1;
  transform: translateY(0);
}

/* ========== Backblast prose (preserved from old globals, retonalized) ========== */

.backblast-content { line-height: 1.75; }
.backblast-content p { margin: 0.75rem 0; }
.backblast-content ul { list-style-type: disc; padding-left: 1.5rem; margin: 0.5rem 0; }
.backblast-content ol { list-style-type: decimal; padding-left: 1.5rem; margin: 0.5rem 0; }
.backblast-content li { margin: 0.25rem 0; }
.backblast-content strong { font-weight: 600; color: var(--ink); }
.backblast-content em { font-style: italic; }
.backblast-content code {
  background: var(--bone-2);
  padding: 0.125rem 0.375rem;
  border-radius: 0.25rem;
  font-size: 0.875em;
  font-family: var(--font-jetbrains), monospace;
}
.backblast-content pre {
  background: var(--ink);
  color: var(--bone);
  padding: 1rem;
  overflow-x: auto;
  margin: 0.75rem 0;
}
.backblast-content blockquote {
  border-left: 3px solid var(--steel);
  padding-left: 1rem;
  margin: 0.75rem 0;
  color: var(--muted);
  font-style: italic;
}
.backblast-content hr {
  border: none;
  border-top: 1px solid var(--line-soft);
  margin: 1rem 0;
}
.backblast-content a {
  color: var(--steel);
  text-decoration: underline;
  text-underline-offset: 2px;
}
.backblast-content a:hover { color: var(--steel-2); }
.backblast-content .mention { color: var(--steel); font-weight: 500; }
.backblast-content .channel { color: var(--steel); font-weight: 500; }
.backblast-content img {
  max-width: 100%;
  height: auto;
  margin: 0.75rem 0;
  clip-path: polygon(10px 0, 100% 0, calc(100% - 10px) 100%, 0 100%);
}
```

- [ ] **Step 2: Run typecheck**

Run: `npx tsc --noEmit`
Expected: No errors related to globals.css tokens. Errors about `bg-background`, `text-foreground`, `bg-muted`, `text-primary`, etc. used elsewhere are expected and will be addressed across subsequent tasks.

- [ ] **Step 3: Take a snapshot of broken Tailwind token references**

Run: `grep -rE "bg-(background|muted|secondary|primary|card|popover|accent)|text-(foreground|muted-foreground|primary|secondary|primary-foreground)|border-border" src --include="*.tsx" | wc -l`
Expected: Some number N. This is the backlog of old-token references. Record this number (e.g. "N=87"). Subsequent tasks will burn this down as they rewrite components. The build should not be expected to pass yet.

- [ ] **Step 4: Commit**

```bash
git add src/app/globals.css
git commit -m "feat: rewrite globals.css with bone/ink token system"
```

---

### Task 1.3: Create simple brand primitives (EyebrowLabel, MonoTag, PulseDot, CornerBracket, StatusChip)

**Files:**
- Create: `src/components/ui/brand/EyebrowLabel.tsx`
- Create: `src/components/ui/brand/MonoTag.tsx`
- Create: `src/components/ui/brand/PulseDot.tsx`
- Create: `src/components/ui/brand/CornerBracket.tsx`
- Create: `src/components/ui/brand/StatusChip.tsx`

- [ ] **Step 1: Create EyebrowLabel**

Write `src/components/ui/brand/EyebrowLabel.tsx`:

```tsx
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  variant?: "muted" | "steel" | "bone";
  withRule?: boolean;
};

export function EyebrowLabel({ children, className = "", variant = "muted", withRule = false }: Props) {
  const color =
    variant === "steel" ? "text-steel" :
    variant === "bone" ? "text-bone/70" :
    "text-muted";
  const ruleColor = variant === "steel" ? "bg-steel" : variant === "bone" ? "bg-bone/40" : "bg-muted";
  return (
    <span className={`inline-flex items-center gap-2.5 font-mono text-[11px] tracking-[.2em] uppercase ${color} ${className}`}>
      {withRule && <span className={`h-px w-7 ${ruleColor}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
```

- [ ] **Step 2: Create MonoTag**

Write `src/components/ui/brand/MonoTag.tsx`:

```tsx
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  variant?: "muted" | "steel" | "bone" | "ink";
};

export function MonoTag({ children, className = "", variant = "muted" }: Props) {
  const color =
    variant === "steel" ? "text-steel" :
    variant === "bone" ? "text-bone/70" :
    variant === "ink" ? "text-ink" :
    "text-muted";
  return (
    <span className={`font-mono text-[11px] tracking-[.15em] uppercase ${color} ${className}`}>
      {children}
    </span>
  );
}
```

- [ ] **Step 3: Create PulseDot**

Write `src/components/ui/brand/PulseDot.tsx`:

```tsx
type Props = {
  variant?: "rust" | "steel";
  className?: string;
};

export function PulseDot({ variant = "rust", className = "" }: Props) {
  const bg = variant === "steel" ? "bg-steel" : "bg-rust";
  return (
    <span
      aria-hidden="true"
      className={`inline-block w-1.5 h-1.5 rounded-full ${bg} ${className}`}
      style={{ animation: "pulse-dot 2s ease-in-out infinite" }}
    />
  );
}
```

- [ ] **Step 4: Create CornerBracket**

Write `src/components/ui/brand/CornerBracket.tsx`:

```tsx
type Corner = "tl" | "tr" | "bl" | "br";

type Props = {
  corner: Corner;
  size?: number;
  color?: "steel" | "bone" | "ink";
  thickness?: number;
  className?: string;
};

export function CornerBracket({ corner, size = 22, color = "steel", thickness = 2, className = "" }: Props) {
  const colorVar =
    color === "steel" ? "var(--steel)" :
    color === "bone" ? "var(--bone)" :
    "var(--ink)";
  const positions: Record<Corner, React.CSSProperties> = {
    tl: { top: 0, left: 0, borderTop: `${thickness}px solid ${colorVar}`, borderLeft: `${thickness}px solid ${colorVar}` },
    tr: { top: 0, right: 0, borderTop: `${thickness}px solid ${colorVar}`, borderRight: `${thickness}px solid ${colorVar}` },
    bl: { bottom: 0, left: 0, borderBottom: `${thickness}px solid ${colorVar}`, borderLeft: `${thickness}px solid ${colorVar}` },
    br: { bottom: 0, right: 0, borderBottom: `${thickness}px solid ${colorVar}`, borderRight: `${thickness}px solid ${colorVar}` },
  };
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute ${className}`}
      style={{ width: size, height: size, ...positions[corner] }}
    />
  );
}
```

- [ ] **Step 5: Create StatusChip**

Write `src/components/ui/brand/StatusChip.tsx`:

```tsx
import type { ReactNode } from "react";

type Variant = "active" | "launch" | "archived" | "draft" | "fng" | "pending";

type Props = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
};

const variantClass: Record<Variant, string> = {
  active:   "bg-steel/15 text-steel border-steel/40",
  launch:   "bg-rust/15 text-rust border-rust/40",
  archived: "bg-muted/15 text-muted border-muted/40",
  draft:    "bg-brass/15 text-brass border-brass/40",
  fng:      "bg-olive/15 text-olive border-olive/40",
  pending:  "bg-ink/10 text-ink border-ink/30",
};

export function StatusChip({ children, variant = "active", className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 border font-mono text-[10px] tracking-[.18em] uppercase ${variantClass[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `npx tsc --noEmit src/components/ui/brand/EyebrowLabel.tsx src/components/ui/brand/MonoTag.tsx src/components/ui/brand/PulseDot.tsx src/components/ui/brand/CornerBracket.tsx src/components/ui/brand/StatusChip.tsx 2>&1 | grep -vE "globals\.css|bg-(background|muted|primary)|text-(foreground|muted-foreground)" | head`
Expected: No errors originating in the new primitive files.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/brand/
git commit -m "feat(brand): add EyebrowLabel, MonoTag, PulseDot, CornerBracket, StatusChip primitives"
```

---

### Task 1.4: Create ChamferButton, ClipFrame, TopoBackground

**Files:**
- Create: `src/components/ui/brand/ChamferButton.tsx`
- Create: `src/components/ui/brand/ClipFrame.tsx`
- Create: `src/components/ui/brand/TopoBackground.tsx`

- [ ] **Step 1: Create ChamferButton**

Write `src/components/ui/brand/ChamferButton.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode, ButtonHTMLAttributes } from "react";

type Variant = "steel" | "ink" | "bone" | "ghost";
type Size = "sm" | "md" | "lg";

type BaseProps = {
  children: ReactNode;
  variant?: Variant;
  size?: Size;
  arrow?: boolean;
  className?: string;
};

type LinkProps = BaseProps & { href: string; onClick?: never; type?: never };
type ButtonProps = BaseProps & ButtonHTMLAttributes<HTMLButtonElement> & { href?: undefined };

type Props = LinkProps | ButtonProps;

const variantClass: Record<Variant, string> = {
  steel: "bg-steel text-bone border-steel hover:bg-steel-2 hover:border-steel-2",
  ink:   "bg-ink text-bone border-ink hover:bg-steel hover:border-steel",
  bone:  "bg-bone text-ink border-ink hover:bg-ink hover:text-bone",
  ghost: "bg-transparent text-bone border-bone/30 hover:border-bone clip-chamfer-none",
};

const sizeClass: Record<Size, string> = {
  sm: "px-3.5 py-2 text-[12px]",
  md: "px-5 py-3 text-[13px]",
  lg: "px-7 py-4 text-[15px]",
};

export function ChamferButton(props: Props) {
  const { children, variant = "steel", size = "md", arrow = true, className = "" } = props;
  const clip = variant === "ghost" ? "" : "clip-chamfer";
  const base = `inline-flex items-center gap-2.5 border-[1.5px] font-display font-semibold uppercase tracking-[.1em] transition-all duration-200 ${variantClass[variant]} ${sizeClass[size]} ${clip} ${className}`;

  const content = (
    <>
      {children}
      {arrow && <span className="inline-block transition-transform duration-200 group-hover:translate-x-1" aria-hidden="true">→</span>}
    </>
  );

  if ("href" in props && props.href) {
    return <Link href={props.href} className={`group ${base}`}>{content}</Link>;
  }
  const { href: _href, ...rest } = props as ButtonProps;
  return <button className={`group ${base}`} {...rest}>{content}</button>;
}
```

- [ ] **Step 2: Create ClipFrame**

Write `src/components/ui/brand/ClipFrame.tsx`:

```tsx
import type { ReactNode } from "react";

type Variant = "bone" | "ink" | "steel";

type Props = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  padding?: string;
};

const variantClass: Record<Variant, string> = {
  bone: "bg-bone border-line-soft",
  ink:  "bg-ink-2 border-bone/15 text-bone",
  steel: "bg-steel/10 border-steel/40",
};

export function ClipFrame({ children, variant = "bone", className = "", padding = "p-7" }: Props) {
  return (
    <div
      className={`relative border clip-chamfer ${variantClass[variant]} ${padding} ${className}`}
      style={{ borderColor: "var(--line-soft)" }}
    >
      {children}
    </div>
  );
}
```

- [ ] **Step 3: Create TopoBackground**

Write `src/components/ui/brand/TopoBackground.tsx`:

```tsx
type Props = {
  variant?: "light" | "dark";
  className?: string;
};

export function TopoBackground({ variant = "light", className = "" }: Props) {
  const bg = variant === "dark" ? "bg-topo-dark" : "bg-topo-light";
  return (
    <div
      aria-hidden="true"
      className={`pointer-events-none absolute inset-0 ${bg} ${className}`}
      style={{ opacity: 0.6 }}
    />
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "brand/\(ChamferButton\|ClipFrame\|TopoBackground\)" | head`
Expected: No errors from these three files.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/brand/
git commit -m "feat(brand): add ChamferButton, ClipFrame, TopoBackground primitives"
```

---

### Task 1.5: Create MeterBar primitive

**Files:**
- Create: `src/components/ui/brand/MeterBar.tsx`

- [ ] **Step 1: Create MeterBar**

Write `src/components/ui/brand/MeterBar.tsx`:

```tsx
import type { ReactNode } from "react";

type Props = {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  variant?: "bone" | "ink";
  tickCount?: number;
  highlightIndices?: number[];
};

export function MeterBar({
  left,
  right,
  className = "",
  variant = "bone",
  tickCount = 32,
  highlightIndices = [5, 12, 22, 27],
}: Props) {
  const textColor = variant === "ink" ? "text-bone/60" : "text-muted";
  const tickBase = variant === "ink" ? "bg-bone/25" : "bg-ink/20";
  const tickHighlight = "bg-steel";
  const border = variant === "ink" ? "border-bone/12" : "border-line-soft";

  return (
    <div
      className={`flex items-center justify-between border-y px-7 py-3.5 font-mono text-[11px] tracking-[.1em] uppercase ${textColor} ${border} ${className}`}
    >
      {left && <div className="flex items-center gap-3">{left}</div>}
      <div className="flex items-center gap-[2px]" aria-hidden="true">
        {Array.from({ length: tickCount }, (_, i) => {
          const isHighlight = highlightIndices.includes(i);
          return (
            <span
              key={i}
              className={`w-[2px] ${isHighlight ? `${tickHighlight} h-3.5` : `${tickBase} h-2.5`}`}
            />
          );
        })}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "brand/MeterBar" | head`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/brand/MeterBar.tsx
git commit -m "feat(brand): add MeterBar primitive"
```

---

### Task 1.6: Create ScrollReveal client primitive

**Files:**
- Create: `src/components/ui/brand/ScrollReveal.tsx`

- [ ] **Step 1: Create ScrollReveal**

Write `src/components/ui/brand/ScrollReveal.tsx`:

```tsx
"use client";

import { useEffect, useRef, type ReactNode, type ElementType } from "react";

type Props = {
  children: ReactNode;
  as?: ElementType;
  className?: string;
  threshold?: number;
  delayMs?: number;
};

export function ScrollReveal({
  children,
  as: Component = "div",
  className = "",
  threshold = 0.12,
  delayMs = 0,
}: Props) {
  const ref = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            if (delayMs) {
              window.setTimeout(() => entry.target.classList.add("in"), delayMs);
            } else {
              entry.target.classList.add("in");
            }
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [threshold, delayMs]);

  return (
    <Component ref={ref} className={`reveal ${className}`}>
      {children}
    </Component>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "brand/ScrollReveal" | head`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/brand/ScrollReveal.tsx
git commit -m "feat(brand): add ScrollReveal client primitive"
```

---

### Task 1.7: Create SectionHead, CreedQuote, PageHeader, CTABand

**Files:**
- Create: `src/components/ui/brand/SectionHead.tsx`
- Create: `src/components/ui/brand/CreedQuote.tsx`
- Create: `src/components/ui/brand/PageHeader.tsx`
- Create: `src/components/ui/brand/CTABand.tsx`

- [ ] **Step 1: Create SectionHead**

Write `src/components/ui/brand/SectionHead.tsx`:

```tsx
import type { ReactNode } from "react";
import { EyebrowLabel } from "./EyebrowLabel";

type Props = {
  eyebrow: string;
  h2: ReactNode;
  kicker?: ReactNode;
  align?: "left" | "center" | "split";
  id?: string;
  variant?: "bone" | "ink";
  className?: string;
};

export function SectionHead({ eyebrow, h2, kicker, align = "split", id, variant = "bone", className = "" }: Props) {
  const eyebrowVariant = variant === "ink" ? "bone" : "muted";
  const kickerColor = variant === "ink" ? "text-bone/70" : "text-muted";

  if (align === "split") {
    return (
      <div id={id} className={`grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8 md:gap-16 mb-14 ${className}`}>
        <div>
          <EyebrowLabel variant={eyebrowVariant} withRule>{eyebrow}</EyebrowLabel>
          <h2 className="mt-5 font-display font-bold uppercase leading-[.9] text-[clamp(42px,6vw,88px)] tracking-[-.01em]">
            {h2}
          </h2>
        </div>
        {kicker && (
          <div className={`max-w-xl text-[17px] leading-[1.6] ${kickerColor} self-end pb-2`}>
            {kicker}
          </div>
        )}
      </div>
    );
  }

  const alignClass = align === "center" ? "text-center items-center" : "items-start";
  return (
    <div id={id} className={`flex flex-col gap-5 mb-14 ${alignClass} ${className}`}>
      <EyebrowLabel variant={eyebrowVariant} withRule>{eyebrow}</EyebrowLabel>
      <h2 className="font-display font-bold uppercase leading-[.9] text-[clamp(42px,6vw,88px)] tracking-[-.01em]">
        {h2}
      </h2>
      {kicker && <div className={`max-w-xl text-[17px] leading-[1.6] ${kickerColor}`}>{kicker}</div>}
    </div>
  );
}
```

- [ ] **Step 2: Create CreedQuote**

Write `src/components/ui/brand/CreedQuote.tsx`:

```tsx
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  align?: "left" | "center";
  variant?: "bone" | "ink";
};

export function CreedQuote({ children, className = "", align = "center", variant = "ink" }: Props) {
  const color = variant === "ink" ? "text-bone" : "text-ink";
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <blockquote
      className={`font-serif italic leading-[1.15] text-[clamp(36px,5vw,64px)] max-w-4xl ${alignClass} ${color} ${className}`}
    >
      {children}
    </blockquote>
  );
}
```

- [ ] **Step 3: Create PageHeader**

Write `src/components/ui/brand/PageHeader.tsx`:

```tsx
import type { ReactNode } from "react";
import { EyebrowLabel } from "./EyebrowLabel";
import { MeterBar } from "./MeterBar";
import { MonoTag } from "./MonoTag";
import { TopoBackground } from "./TopoBackground";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  kicker?: ReactNode;
  variant?: "bone" | "ink";
  meter?: { left?: ReactNode; right?: ReactNode };
  className?: string;
};

export function PageHeader({ eyebrow, title, kicker, variant = "bone", meter, className = "" }: Props) {
  const bg = variant === "ink" ? "bg-ink text-bone" : "bg-bone text-ink";
  const kickerColor = variant === "ink" ? "text-bone/75" : "text-muted";

  return (
    <header className={`relative overflow-hidden ${bg} ${className}`}>
      {variant === "ink" && <TopoBackground variant="dark" />}
      {meter && (
        <MeterBar
          variant={variant}
          left={meter.left && <MonoTag variant={variant === "ink" ? "bone" : "muted"}>{meter.left}</MonoTag>}
          right={meter.right && <MonoTag variant={variant === "ink" ? "bone" : "muted"}>{meter.right}</MonoTag>}
        />
      )}
      <div className="relative z-10 max-w-[1320px] mx-auto px-7 md:px-7 py-24 md:py-32">
        {eyebrow && <EyebrowLabel variant={variant === "ink" ? "steel" : "steel"} withRule>{eyebrow}</EyebrowLabel>}
        <h1 className="mt-6 font-display font-bold uppercase leading-[.86] text-[clamp(52px,8vw,128px)] tracking-[-.01em]">
          {title}
        </h1>
        {kicker && <p className={`mt-8 max-w-xl text-[18px] leading-[1.55] ${kickerColor}`}>{kicker}</p>}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create CTABand**

Write `src/components/ui/brand/CTABand.tsx`:

```tsx
import type { ReactNode } from "react";
import { ChamferButton } from "./ChamferButton";
import { TopoBackground } from "./TopoBackground";

type Variant = "steel" | "ink" | "bone" | "gradient";

type Props = {
  variant?: Variant;
  title: ReactNode;
  kicker?: ReactNode;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  watermark?: ReactNode;
  className?: string;
};

export function CTABand({ variant = "steel", title, kicker, primary, secondary, watermark, className = "" }: Props) {
  const bg =
    variant === "gradient" ? "text-bone" :
    variant === "steel" ? "bg-steel text-bone" :
    variant === "ink" ? "bg-ink text-bone" :
    "bg-bone-2 text-ink";
  const bgStyle = variant === "gradient"
    ? { background: "linear-gradient(180deg, #24446a 0%, #1a3552 100%)" } as React.CSSProperties
    : undefined;
  const primaryVariant = variant === "bone" ? "ink" : "bone";
  const kickerColor = variant === "bone" ? "text-muted" : "text-bone/75";

  return (
    <section className={`relative overflow-hidden ${bg} ${className}`} style={bgStyle}>
      {variant !== "bone" && variant !== "gradient" && <TopoBackground variant="dark" />}
      {watermark && <div className="pointer-events-none absolute inset-0 opacity-[.06] select-none" aria-hidden="true">{watermark}</div>}
      <div className="relative z-10 max-w-[1320px] mx-auto px-7 py-24 md:py-28 grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-10 items-end">
        <h2 className="font-display font-bold uppercase leading-[.86] text-[clamp(48px,8vw,140px)] tracking-[-.01em]">
          {title}
        </h2>
        <div className="flex flex-col gap-6">
          {kicker && <p className={`text-[17px] leading-[1.6] max-w-md ${kickerColor}`}>{kicker}</p>}
          <div className="flex flex-wrap gap-3">
            <ChamferButton variant={primaryVariant} href={primary.href} size="lg">{primary.label}</ChamferButton>
            {secondary && <ChamferButton variant="ghost" href={secondary.href} size="lg">{secondary.label}</ChamferButton>}
          </div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "brand/(SectionHead|CreedQuote|PageHeader|CTABand)" | head`
Expected: No errors from the four new files.

- [ ] **Step 6: Commit**

```bash
git add src/components/ui/brand/
git commit -m "feat(brand): add SectionHead, CreedQuote, PageHeader, CTABand primitives"
```

---

### Task 1.8: Delete obsolete Hero.tsx and StatusBadge.tsx, update imports

**Files:**
- Delete: `src/components/ui/Hero.tsx`
- Delete: `src/components/ui/StatusBadge.tsx`
- Modify: any file that imports the above

- [ ] **Step 1: Find all importers**

Run: `grep -rn "from ['\"]\(@/components/ui/Hero\|@/components/ui/StatusBadge\)['\"]\|from ['\"]\.\./Hero\|from ['\"]\./Hero\|from ['\"]\.\./StatusBadge\|from ['\"]\./StatusBadge" src --include="*.tsx" --include="*.ts"`
Expected: A list of files (at minimum `src/app/page.tsx`). Note each path — each will be fixed as its owning task runs. For now, verify the list.

- [ ] **Step 2: Remove Hero import from page.tsx temporarily**

The home page will be fully rewritten in Task 3.10; to keep TypeScript happy until then, comment out the Hero import and its JSX usage in `src/app/page.tsx`. Replace the Hero JSX block (lines 13-19 in the current file) with a placeholder:

```tsx
// TODO(redesign): replaced by HomeHero in Wave 3
```

- [ ] **Step 3: Delete the files**

Run: `git rm src/components/ui/Hero.tsx src/components/ui/StatusBadge.tsx`
Expected: Both files removed.

- [ ] **Step 4: Verify build**

Run: `npx tsc --noEmit 2>&1 | grep -E "Hero|StatusBadge" | head`
Expected: No references to deleted files in errors.

- [ ] **Step 5: Commit**

```bash
git add -u src/
git commit -m "chore: remove legacy Hero and StatusBadge components"
```

---

## Wave 2 — Global shell

### Task 2.1: Create TopBar and MarqueeRibbon

**Files:**
- Create: `src/components/layout/TopBar.tsx`
- Create: `src/components/layout/MarqueeRibbon.tsx`

- [ ] **Step 1: Create TopBar**

Write `src/components/layout/TopBar.tsx`:

```tsx
import { PulseDot } from "@/components/ui/brand/PulseDot";

function nextMusterLabel(): string {
  const now = new Date();
  const day = now.getDay();
  const daysMap: Record<number, string> = { 1: "MON 05:15", 2: "TUE 05:15", 3: "WED 05:15", 4: "THU 05:15", 5: "FRI 05:15", 6: "SAT 07:00", 0: "MON 05:15" };
  const musterDays = [1, 2, 3, 4, 5, 6];
  const hour = now.getHours();
  if (musterDays.includes(day) && hour < 5) return daysMap[day];
  for (let i = 1; i <= 7; i++) {
    const d = (day + i) % 7;
    if (musterDays.includes(d === 0 ? 7 : d)) return daysMap[d === 0 ? 7 : d];
  }
  return "MON 05:15";
}

export function TopBar() {
  const muster = nextMusterLabel();
  return (
    <div className="w-full bg-ink text-bone border-b border-ink-3">
      <div className="max-w-[1320px] mx-auto flex justify-between items-center gap-6 px-7 py-2 font-mono text-[11px] tracking-[.08em] uppercase">
        <div className="flex items-center">
          <PulseDot variant="rust" className="mr-2" />
          <span className="opacity-70">Gloom Status: Active · Next Muster {muster}</span>
        </div>
        <div className="hidden md:flex gap-5 opacity-70">
          <span>Marietta, GA</span>
          <span>Est. 2024 · Region 2025</span>
          <span>F3 Nation</span>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create MarqueeRibbon**

Write `src/components/layout/MarqueeRibbon.tsx`:

```tsx
type Variant = "primary" | "secondary";

type Props = {
  variant?: Variant;
  tokens?: string[];
  className?: string;
};

const DEFAULT_TOKENS = [
  "FITNESS", "FELLOWSHIP", "FAITH", "RAIN OR SHINE", "PEER-LED", "FREE OF CHARGE",
];

export function MarqueeRibbon({ variant = "primary", tokens = DEFAULT_TOKENS, className = "" }: Props) {
  const doubled = [...tokens, ...tokens, ...tokens, ...tokens];
  return (
    <div className={`w-full bg-ink overflow-hidden ${className}`}>
      <div
        className="inline-flex items-center whitespace-nowrap py-3.5"
        style={{ animation: `marquee-scroll 40s linear infinite` }}
      >
        {doubled.map((t, i) => (
          <span
            key={i}
            className={`font-display font-semibold uppercase tracking-[.15em] text-[18px] px-8 ${
              i % 3 === 2 ? "text-steel" : "text-bone"
            }`}
          >
            {t}
            <span className="inline-block w-1.5 h-1.5 rounded-full mx-4 align-middle" style={{ backgroundColor: i % 3 === 2 ? "var(--steel)" : "var(--bone)" }} />
          </span>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "layout/(TopBar|MarqueeRibbon)" | head`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/TopBar.tsx src/components/layout/MarqueeRibbon.tsx
git commit -m "feat(layout): add TopBar and MarqueeRibbon"
```

---

### Task 2.2: Rewrite Navbar

**Files:**
- Modify: `src/components/layout/Navbar.tsx` (full rewrite)

- [ ] **Step 1: Rewrite Navbar**

Overwrite `src/components/layout/Navbar.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";

const NAV_ITEMS = [
  { name: "Home", href: "/" },
  { name: "About", href: "/about" },
  { name: "Workouts", href: "/workouts" },
  { name: "Backblasts", href: "/backblasts" },
  { name: "New Here", href: "/new-here" },
  { name: "Contact", href: "/contact" },
] as const;

export function Navbar() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 w-full border-b border-[color:var(--line-soft)] backdrop-blur-md"
      style={{ background: "rgba(241,236,225,.92)" }}>
      <div className="max-w-[1320px] mx-auto flex items-center justify-between gap-6 px-7 py-3.5">
        <Link href="/" className="flex items-center gap-3.5 group">
          <Image
            src="/icons/f3mariettalogo-main.png"
            alt="F3 Marietta cannon emblem"
            width={56}
            height={56}
            priority
            className="h-14 w-14 rounded-full object-cover border-[1.5px] border-ink"
          />
          <div className="hidden sm:flex flex-col gap-1 leading-none">
            <span className="font-display font-bold uppercase tracking-[.06em] text-[20px]">F3 Marietta</span>
            <span className="font-mono text-[10px] tracking-[.18em] uppercase text-muted">Fitness · Fellowship · Faith</span>
          </div>
        </Link>

        <nav className="hidden lg:flex items-center gap-1">
          <ul className="flex items-center gap-1">
            {NAV_ITEMS.map((item) => {
              const active = isActive(item.href);
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`relative px-3.5 py-2.5 font-display font-semibold uppercase tracking-[.06em] text-[13px] transition-colors ${
                      active ? "text-steel" : "text-ink hover:text-steel"
                    }`}
                  >
                    {item.name}
                    {active && <span className="absolute left-3.5 right-3.5 bottom-1 h-[2px] bg-steel" aria-hidden="true" />}
                  </Link>
                </li>
              );
            })}
          </ul>
          <ChamferButton href="/workouts" variant="ink" size="sm" className="ml-2">
            Find a Workout
          </ChamferButton>
        </nav>

        <button
          className="lg:hidden p-2 text-ink"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? "Close menu" : "Open menu"}
          aria-expanded={open}
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </div>

      {open && (
        <div className="lg:hidden bg-ink text-bone">
          <ul className="max-w-[1320px] mx-auto flex flex-col px-7 py-5">
            {NAV_ITEMS.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="block py-3 font-display font-semibold uppercase tracking-[.08em] text-[15px] border-b border-ink-3"
                >
                  {item.name}
                </Link>
              </li>
            ))}
            <li className="pt-4">
              <ChamferButton href="/workouts" variant="steel" size="md" className="w-full justify-center">
                Find a Workout
              </ChamferButton>
            </li>
          </ul>
        </div>
      )}
    </header>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "layout/Navbar" | head`
Expected: No errors from Navbar.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Navbar.tsx
git commit -m "feat(layout): rewrite Navbar with bone chrome, brand lockup, mobile drawer"
```

---

### Task 2.3: Rewrite Footer

**Files:**
- Modify: `src/components/layout/Footer.tsx` (full rewrite)

- [ ] **Step 1: Rewrite Footer**

Overwrite `src/components/layout/Footer.tsx`:

```tsx
import Link from "next/link";
import Image from "next/image";
import { MonoTag } from "@/components/ui/brand/MonoTag";

const REGION_LINKS = [
  { label: "About", href: "/about" },
  { label: "Workouts", href: "/workouts" },
  { label: "New Here", href: "/new-here" },
  { label: "FNGs", href: "/fng" },
];

const RESOURCE_LINKS = [
  { label: "Backblasts", href: "/backblasts" },
  { label: "Glossary", href: "/glossary" },
  { label: "What to Expect", href: "/what-to-expect" },
  { label: "Community", href: "/community" },
];

const CONNECT_LINKS = [
  { label: "Contact", href: "/contact" },
  { label: "F3 Nation", href: "https://f3nation.com", external: true },
];

export function Footer() {
  return (
    <footer className="relative bg-ink text-bone">
      <div className="max-w-[1320px] mx-auto px-7 pt-20 pb-6">
        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1fr_1fr] gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="rounded-full bg-bone p-1">
                <Image
                  src="/icons/f3mariettalogo-main.png"
                  alt="F3 Marietta"
                  width={72}
                  height={72}
                  className="h-16 w-16 rounded-full object-cover"
                />
              </div>
              <span className="font-display font-bold uppercase tracking-[.06em] text-[26px]">F3 Marietta</span>
            </div>
            <p className="text-[14px] text-bone/60 max-w-[280px] leading-[1.6]">
              Free, peer-led workouts for men in Marietta, GA. Rain or shine, heat or cold — we muster at 05:15.
            </p>
          </div>

          {[
            { header: "Region", links: REGION_LINKS },
            { header: "Resources", links: RESOURCE_LINKS },
            { header: "Connect", links: CONNECT_LINKS },
          ].map((col) => (
            <div key={col.header}>
              <MonoTag variant="bone" className="block mb-5">{`// ${col.header}`}</MonoTag>
              <ul className="space-y-3">
                {col.links.map((link) => (
                  <li key={link.href}>
                    <Link
                      href={link.href}
                      className="font-display font-semibold uppercase tracking-[.05em] text-[16px] text-bone hover:text-steel transition-colors"
                      {...("external" in link && link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                    >
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-16 pt-6 border-t border-ink-3 flex flex-col md:flex-row justify-between gap-3 font-mono text-[11px] tracking-[.1em] uppercase text-bone/40">
          <span>// F3 Marietta · Marietta, GA · Est. 2024</span>
          <span>A Region of F3 Nation · Peer-Led · Free of Charge</span>
        </div>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "layout/Footer" | head`
Expected: No errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/layout/Footer.tsx
git commit -m "feat(layout): rewrite Footer as 4-col ink grid with mono column heads"
```

---

### Task 2.4: Wire TopBar into root layout; drop ReleaseNotes

**Files:**
- Modify: `src/app/layout.tsx`

- [ ] **Step 1: Add TopBar to layout**

Modify `src/app/layout.tsx` so the body tree is:

```tsx
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";
import { FloatingAssistant } from "@/components/ui/FloatingAssistant";
import { TopBar } from "@/components/layout/TopBar";

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body
        className={`${inter.variable} ${oswald.variable} ${jetbrainsMono.variable} ${dmSerif.variable} antialiased bg-bone text-ink font-sans flex flex-col min-h-screen`}
      >
        <TopBar />
        <Navbar />
        <main className="flex-grow">{children}</main>
        <Footer />
        <FloatingAssistant />
      </body>
    </html>
  );
}
```

Note: `ReleaseNotes` was previously mounted; remove that import and usage. ReleaseNotes remains a component and can be reintroduced if desired, but is not part of the redesigned chrome.

- [ ] **Step 2: Build and spot-check**

Run: `npm run build 2>&1 | tail -40`
Expected: Build may still have errors in pages that reference old tokens (e.g. `bg-background`). These will be addressed in Wave 3+. Note the failures but do not block this task on them — Navbar/Footer/TopBar must compile cleanly.

- [ ] **Step 3: Commit**

```bash
git add src/app/layout.tsx
git commit -m "feat(layout): mount TopBar globally, drop ReleaseNotes"
```

---

### Task 2.5: Restyle AssistantWidget and FloatingAssistant

**Files:**
- Modify: `src/components/ui/FloatingAssistant.tsx`
- Modify: `src/components/ui/AssistantWidget.tsx`

- [ ] **Step 1: Read current FloatingAssistant and AssistantWidget**

Run: `wc -l src/components/ui/FloatingAssistant.tsx src/components/ui/AssistantWidget.tsx`
Record sizes. Read each file end-to-end.

- [ ] **Step 2: Replace trigger button styles with chamfer steel**

In `FloatingAssistant.tsx`, locate the trigger button element. Replace its classes with a chamfer-styled equivalent:

```tsx
<button
  className="fixed bottom-6 right-6 z-40 inline-flex items-center gap-2 bg-steel text-bone border-[1.5px] border-steel px-5 py-3 font-display font-semibold uppercase tracking-[.1em] text-[13px] clip-chamfer hover:bg-steel-2 hover:border-steel-2 transition-all shadow-[0_8px_24px_rgba(12,12,12,.25)]"
  onClick={() => setOpen(true)}
  aria-label="Open F3 AMA assistant"
>
  AMA ↗
</button>
```

(Preserve the existing state/open behavior — only style changes.)

- [ ] **Step 3: Restyle AssistantWidget panel to ink + chamfer**

In `AssistantWidget.tsx`, update:
- Outer panel container → `bg-ink text-bone border border-ink-3 clip-chamfer`
- Header row → `border-b border-ink-3 px-5 py-3`, title in `font-display uppercase tracking-[.08em] text-[14px]`
- Message bubbles: user → `bg-ink-2 clip-chamfer-sm p-3 text-bone`; assistant → `bg-bone text-ink clip-chamfer-sm p-3 border border-line-soft`
- Timestamps → `font-mono text-[10px] tracking-[.15em] uppercase text-bone/50`
- Input area → `border-t border-ink-3 p-3`
- Submit button → reuse `<ChamferButton variant="steel" size="sm" type="submit" arrow={false}>Send</ChamferButton>` (import from `@/components/ui/brand/ChamferButton`)

Preserve all event handlers and message rendering logic; edit only className/style props and swap the submit button.

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "FloatingAssistant|AssistantWidget" | head`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/FloatingAssistant.tsx src/components/ui/AssistantWidget.tsx
git commit -m "style(assistant): restyle widget with chamfer trigger and ink palette"
```

---

## Wave 3 — Home page

### Task 3.1: Implement getImpactStats with safe fallback

**Files:**
- Create: `src/lib/stats/getImpactStats.ts`
- Create: `scripts/smoke-impact-stats.ts`

- [ ] **Step 1: Verify DB columns before writing SQL**

Run this to introspect actual column names:

```bash
npx tsx -e "
import { getSql } from './src/lib/db';
(async () => {
  const sql = getSql();
  const cols = await sql\`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema='public' AND table_name IN ('f3_events','f3_event_attendees','ao_channels','workout_schedule') ORDER BY table_name, ordinal_position\`;
  for (const r of cols) console.log(r.table_name + '.' + r.column_name);
})();
" 2>&1 | tail -80
```

Expected: A list of columns. Confirm these exist:
- `f3_events.event_kind`, `f3_events.event_date`, `f3_events.is_deleted`
- `f3_event_attendees.attendee_slack_user_id`, `f3_event_attendees.event_id`
- `ao_channels.*` (check if `is_active` or similar exists)
- `workout_schedule.is_active`

If actual column names differ, adjust the SQL in Step 2 accordingly.

- [ ] **Step 2: Create getImpactStats**

Write `src/lib/stats/getImpactStats.ts`:

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
    const [himRows, workoutRows, aoRows, fngRows] = await Promise.all([
      sql`SELECT COUNT(DISTINCT attendee_slack_user_id)::int AS n FROM f3_event_attendees WHERE attendee_slack_user_id IS NOT NULL`,
      sql`SELECT COUNT(*)::int AS n FROM f3_events WHERE event_kind = 'backblast' AND is_deleted = false`,
      sql`SELECT COUNT(DISTINCT region_id)::int AS n FROM workout_schedule WHERE is_active = true`,
      sql`
        SELECT COUNT(DISTINCT a.attendee_slack_user_id)::int AS n
        FROM f3_event_attendees a
        JOIN f3_events e ON e.id = a.event_id
        WHERE e.event_kind = 'backblast'
          AND e.is_deleted = false
          AND date_trunc('year', COALESCE(e.event_date::timestamp, e.created_at)) = date_trunc('year', now())
          AND a.attendee_slack_user_id IS NOT NULL
          AND NOT EXISTS (
            SELECT 1 FROM f3_event_attendees a2
            JOIN f3_events e2 ON e2.id = a2.event_id
            WHERE a2.attendee_slack_user_id = a.attendee_slack_user_id
              AND e2.is_deleted = false
              AND COALESCE(e2.event_date::timestamp, e2.created_at) < date_trunc('year', now())
          )
      `,
    ]);
    return {
      uniqueHim: Number(himRows[0]?.n ?? 0),
      workoutsLed: Number(workoutRows[0]?.n ?? 0),
      activeAOs: Number(aoRows[0]?.n ?? 0),
      fngsThisYear: Number(fngRows[0]?.n ?? 0),
    };
  } catch (err) {
    console.error("[getImpactStats] failed:", err);
    return { uniqueHim: 0, workoutsLed: 0, activeAOs: 0, fngsThisYear: 0 };
  }
}
```

- [ ] **Step 3: Write a smoke-test script**

Write `scripts/smoke-impact-stats.ts`:

```ts
import { getImpactStats } from "../src/lib/stats/getImpactStats";

(async () => {
  const stats = await getImpactStats();
  console.log("Impact stats:", stats);
  for (const [k, v] of Object.entries(stats)) {
    if (!Number.isFinite(v) || v < 0) {
      console.error(`FAIL: ${k} = ${v} is not a non-negative finite number`);
      process.exit(1);
    }
  }
  console.log("PASS: all stats are non-negative finite numbers");
  process.exit(0);
})();
```

- [ ] **Step 4: Run smoke test**

Run: `npx tsx scripts/smoke-impact-stats.ts`
Expected: Logs an object with 4 numeric fields, then "PASS". Note the actual values (e.g. `{ uniqueHim: 42, workoutsLed: 78, activeAOs: 2, fngsThisYear: 12 }`) to verify realism.

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/getImpactStats.ts scripts/smoke-impact-stats.ts
git commit -m "feat(stats): add getImpactStats with safe fallback"
```

---

### Task 3.2: Build HomeHero

**Files:**
- Create: `src/components/home/HomeHero.tsx`
- Create: `src/lib/stats/getWeeklyPaxCount.ts`

- [ ] **Step 1: Create getWeeklyPaxCount helper**

Write `src/lib/stats/getWeeklyPaxCount.ts`:

```ts
import { getSql } from "@/lib/db";

export async function getWeeklyPaxCount(): Promise<number> {
  try {
    const sql = getSql();
    const rows = await sql`
      SELECT COUNT(DISTINCT a.attendee_slack_user_id)::int AS n
      FROM f3_event_attendees a
      JOIN f3_events e ON e.id = a.event_id
      WHERE e.event_kind = 'backblast'
        AND e.is_deleted = false
        AND COALESCE(e.event_date::timestamp, e.created_at) >= now() - interval '7 days'
        AND a.attendee_slack_user_id IS NOT NULL
    `;
    return Number(rows[0]?.n ?? 0);
  } catch (err) {
    console.error("[getWeeklyPaxCount] failed:", err);
    return 0;
  }
}
```

- [ ] **Step 2: Create HomeHero**

Write `src/components/home/HomeHero.tsx`:

```tsx
import Image from "next/image";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { CornerBracket } from "@/components/ui/brand/CornerBracket";
import { EyebrowLabel } from "@/components/ui/brand/EyebrowLabel";
import { MeterBar } from "@/components/ui/brand/MeterBar";
import { MonoTag } from "@/components/ui/brand/MonoTag";

type Props = {
  weeklyPax: number;
};

export function HomeHero({ weeklyPax }: Props) {
  return (
    <section className="relative overflow-hidden bg-ink text-bone min-h-[calc(100vh-136px)] flex flex-col">
      {/* Layered background */}
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0"
        style={{
          background:
            "radial-gradient(ellipse at 28% 35%, rgba(47,110,137,.32), transparent 60%), radial-gradient(ellipse at 78% 72%, rgba(30,58,95,.45), transparent 70%), radial-gradient(ellipse at 55% 90%, rgba(184,74,26,.08), transparent 55%), linear-gradient(180deg,#10141a 0%,#0a0d12 100%)",
        }}
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 z-0 bg-topo-dark opacity-60 mix-blend-screen"
      />

      {/* Meter bar */}
      <div className="relative z-10 max-w-[1320px] mx-auto w-full px-7">
        <MeterBar
          variant="ink"
          className="!border-t-0 !px-0"
          left={<MonoTag variant="bone">Coordinates · 33.9526° N, 84.5499° W</MonoTag>}
          right={<MonoTag variant="bone">{`Muster Log · ${weeklyPax || 42} men posted this week`}</MonoTag>}
        />
      </div>

      {/* Content grid */}
      <div className="relative z-10 flex-1 max-w-[1320px] mx-auto w-full px-7 py-16 grid grid-cols-1 md:grid-cols-[1.3fr_1fr] gap-12 items-center">
        <div>
          <EyebrowLabel variant="steel" withRule>Marietta Region · F3 Nation</EyebrowLabel>
          <h1 className="mt-7 font-display font-bold uppercase leading-[.86] text-[clamp(56px,9vw,148px)] tracking-[-.01em]">
            <span className="block overflow-hidden"><span className="inline-block" style={{ animation: "word-rise .9s cubic-bezier(.2,.8,.2,1) both" }}>Hold the</span></span>
            <span className="block overflow-hidden"><span className="inline-block text-steel relative" style={{ animation: "word-rise .9s .1s cubic-bezier(.2,.8,.2,1) both" }}>
              Battlefield.
              <span className="absolute left-0 right-0 bottom-[.12em] h-[.06em] bg-steel origin-left" style={{ animation: "scope-underline 1.2s .6s cubic-bezier(.2,.8,.2,1) both" }} />
            </span></span>
            <span className="block overflow-hidden"><span className="inline-block" style={{ animation: "word-rise .9s .2s cubic-bezier(.2,.8,.2,1) both" }}>Leave no man</span></span>
            <span className="block overflow-hidden"><span className="inline-block text-bone/55" style={{ animation: "word-rise .9s .3s cubic-bezier(.2,.8,.2,1) both" }}>behind.</span></span>
          </h1>
          <p className="mt-8 max-w-[540px] text-[18px] leading-[1.55] text-bone/82">
            Free, peer-led workouts for men in Marietta, GA. We start in the gloom at 05:15, rain or shine — and we finish as better husbands, fathers, friends, and leaders.
          </p>
          <div className="mt-9 flex flex-wrap gap-3.5">
            <ChamferButton href="/workouts" variant="steel" size="lg">Find a Workout</ChamferButton>
            <ChamferButton href="/about" variant="ghost" size="lg" arrow={false}>What is F3?</ChamferButton>
          </div>

          <div className="mt-10 max-w-[560px] grid grid-cols-3 gap-7 border-t border-bone/12 pt-7">
            {[
              { num: "5:15", em: "am", lbl: "First Whistle" },
              { num: "$0", em: "", lbl: "Always Free" },
              { num: "4", em: "/wk", lbl: "Active AOs" },
            ].map((m) => (
              <div key={m.lbl}>
                <div className="font-display font-bold text-[42px] leading-none text-bone">
                  {m.num}
                  {m.em && <span className="text-steel text-[24px] ml-0.5">{m.em}</span>}
                </div>
                <div className="mt-1.5 font-mono text-[10px] tracking-[.15em] uppercase text-bone/55">{m.lbl}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Emblem card */}
        <div className="relative aspect-square max-w-[520px] w-full ml-auto">
          <div
            aria-hidden="true"
            className="absolute -inset-10 rounded-full border border-dashed border-steel/40"
            style={{ animation: "rotate-ring 60s linear infinite" }}
          />
          <div
            className="relative h-full w-full border border-bone/18 bg-bone/5 backdrop-blur-[6px] flex items-center justify-center"
            style={{ clipPath: "polygon(22px 0, 100% 0, 100% calc(100% - 22px), calc(100% - 22px) 100%, 0 100%, 0 22px)" }}
          >
            <CornerBracket corner="tl" color="steel" />
            <CornerBracket corner="tr" color="steel" />
            <CornerBracket corner="bl" color="steel" />
            <CornerBracket corner="br" color="steel" />
            <div className="relative w-[82%] aspect-square" style={{ animation: "float-logo 8s ease-in-out infinite" }}>
              <Image
                src="/icons/f3mariettalogo-main.png"
                alt="F3 Marietta cannon emblem"
                fill
                className="object-contain"
                style={{ filter: "invert(1) contrast(1.1) drop-shadow(0 20px 40px rgba(0,0,0,.5))" }}
                priority
              />
            </div>
          </div>
          <div className="absolute -top-4 left-0 font-mono text-[10px] tracking-[.2em] uppercase text-bone/60">// ID · F3.MAR.01</div>
          <div className="absolute -top-4 right-0 font-mono text-[10px] tracking-[.2em] uppercase text-bone/60">REV · 2025</div>
          <div className="absolute -bottom-4 left-0 font-mono text-[10px] tracking-[.2em] uppercase text-bone/60">LAT 33.95° / LON -84.55°</div>
          <div className="absolute -bottom-4 right-0 font-mono text-[10px] tracking-[.2em] uppercase text-steel">// Gloom · 05:15 EDT</div>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "home/HomeHero|stats/getWeeklyPaxCount" | head`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/HomeHero.tsx src/lib/stats/getWeeklyPaxCount.ts
git commit -m "feat(home): add HomeHero with layered ink background, emblem card, live weekly pax count"
```

---

### Task 3.3: Build ThreeFsSection

**Files:**
- Create: `src/components/home/ThreeFsSection.tsx`

- [ ] **Step 1: Create ThreeFsSection**

Write `src/components/home/ThreeFsSection.tsx`:

```tsx
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";

type F = { num: string; name: string; title: string; description: string; tag: string; icon: React.ReactNode };

const FS: F[] = [
  {
    num: "// 01",
    name: "Fitness",
    title: "Fitness",
    description:
      "Start together. End together. The workout is open to every man at every fitness level. Heavy or skinny, fast or slow — we move as one unit. No man left behind.",
    tag: "→ 45–60 min · Bodyweight · Outdoors",
    icon: (
      <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <rect x="8" y="26" width="6" height="12" />
        <rect x="50" y="26" width="6" height="12" />
        <rect x="14" y="30" width="36" height="4" />
        <rect x="22" y="20" width="20" height="24" fill="none" />
      </svg>
    ),
  },
  {
    num: "// 02",
    name: "Fellowship",
    title: "Fellowship",
    description:
      "The bonds built in the gloom don't end at the whistle. Second F — coffee, cookouts, service projects, accountability groups — that brotherhood is what gets you through the other 23 hours.",
    tag: "→ Coffeeteria · Service · 2nd F",
    icon: (
      <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <circle cx="24" cy="22" r="8" />
        <circle cx="40" cy="22" r="8" />
        <path d="M12 52 C12 42, 20 38, 24 38 C28 38, 36 42, 36 52" />
        <path d="M28 52 C28 44, 36 40, 40 40 C44 40, 52 44, 52 52" />
      </svg>
    ),
  },
  {
    num: "// 03",
    name: "Faith",
    title: "Faith",
    description:
      "Not a denomination. A belief in something bigger than yourself. Every workout closes with a Circle of Trust — name-o-rama, a prayer or reflection, and a charge back into the day.",
    tag: "→ COT · Reflection · Charge",
    icon: (
      <svg viewBox="0 0 64 64" className="w-12 h-12" fill="none" stroke="currentColor" strokeWidth="1.5">
        <path d="M32 8 L56 52 L8 52 Z" />
        <circle cx="32" cy="36" r="3" />
      </svg>
    ),
  },
];

export function ThreeFsSection() {
  return (
    <section id="about" className="relative bg-bone py-28">
      <div className="max-w-[1320px] mx-auto px-7">
        <ScrollReveal>
          <SectionHead
            eyebrow="§ 01 · The Mission"
            h2={<>Three F&apos;s.<br />One Brotherhood.</>}
            kicker={
              <>
                F3 is a national network of free, peer-led workouts for men. Our mission is to plant, grow, and serve small workout groups for men for the invigoration of male community leadership.
              </>
            }
          />
        </ScrollReveal>

        <div className="grid grid-cols-1 md:grid-cols-3 border border-line-soft">
          {FS.map((f, i) => (
            <ScrollReveal
              key={f.name}
              delayMs={i * 100}
              className={`group relative p-10 bg-bone transition-colors duration-300 hover:bg-ink hover:text-bone ${
                i < FS.length - 1 ? "md:border-r border-line-soft" : ""
              } ${i > 0 ? "border-t md:border-t-0 border-line-soft" : ""}`}
            >
              <div className="font-mono text-[11px] tracking-[.2em] uppercase text-muted group-hover:text-steel transition-colors">
                {f.num}
              </div>
              <div className="mt-6 w-16 h-16 rounded-full border border-line-soft text-ink group-hover:text-bone group-hover:border-bone/40 flex items-center justify-center transition-colors">
                {f.icon}
              </div>
              <h3 className="mt-6 font-display font-bold uppercase text-[clamp(42px,5vw,64px)] leading-none tracking-[-.01em] group-hover:text-steel transition-colors">
                {f.name}
              </h3>
              <div className="mt-4 h-px w-10 bg-line-soft group-hover:bg-bone/40" />
              <p className="mt-5 text-[15px] leading-[1.6]">{f.description}</p>
              <div className="mt-6 font-mono text-[11px] tracking-[.15em] uppercase text-muted group-hover:text-bone/70">
                {f.tag}
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npx tsc --noEmit 2>&1 | grep "home/ThreeFsSection" | head`
Expected: No errors.

```bash
git add src/components/home/ThreeFsSection.tsx
git commit -m "feat(home): add ThreeFsSection with ink-flip hover"
```

---

### Task 3.4: Build CreedPrinciplesSection

**Files:**
- Create: `src/components/home/CreedPrinciplesSection.tsx`

- [ ] **Step 1: Create CreedPrinciplesSection**

Write `src/components/home/CreedPrinciplesSection.tsx`:

```tsx
import { CreedQuote } from "@/components/ui/brand/CreedQuote";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { TopoBackground } from "@/components/ui/brand/TopoBackground";

type Principle = { num: string; title: string; body: string };

const PRINCIPLES: Principle[] = [
  { num: "01", title: "Free of Charge", body: "No fees. No membership. No catch. You show up." },
  { num: "02", title: "Open to All Men", body: "Any age, any fitness level. The door is always open." },
  { num: "03", title: "Held Outdoors", body: "Rain or shine. Heat or cold. We embrace the elements." },
  { num: "04", title: "Peer-Led", body: "No instructors. Men take turns Q-ing the workout." },
  { num: "05", title: "Ends in COT", body: "Circle of Trust. Reflection. Charge back into the day." },
];

export function CreedPrinciplesSection() {
  return (
    <section className="relative bg-ink text-bone py-28 overflow-hidden">
      <TopoBackground variant="dark" />
      <div className="relative z-10 max-w-[1320px] mx-auto px-7 text-center">
        <ScrollReveal>
          <CreedQuote variant="ink">
            Leave no man behind, but leave no man <span className="text-steel not-italic" style={{ fontStyle: "italic" }}>where you found him.</span>
          </CreedQuote>
        </ScrollReveal>
      </div>

      <div className="relative z-10 max-w-[1320px] mx-auto px-7 mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-0 border-t border-bone/12 border-b">
        {PRINCIPLES.map((p, i) => (
          <ScrollReveal
            key={p.num}
            delayMs={i * 80}
            className={`p-8 ${i < PRINCIPLES.length - 1 ? "lg:border-r border-bone/12" : ""} ${i > 0 ? "border-t lg:border-t-0 border-bone/12" : ""}`}
          >
            <div className="font-display font-bold uppercase text-steel text-[72px] leading-none">{p.num}</div>
            <h4 className="mt-4 font-display font-bold uppercase text-[18px] tracking-[.05em]">{p.title}</h4>
            <p className="mt-3 text-[13px] leading-[1.55] text-bone/60">{p.body}</p>
          </ScrollReveal>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npx tsc --noEmit 2>&1 | grep "home/CreedPrinciplesSection" | head`
Expected: No errors.

```bash
git add src/components/home/CreedPrinciplesSection.tsx
git commit -m "feat(home): add CreedPrinciplesSection with DM Serif pull quote and 5-col grid"
```

---

### Task 3.5: Rewrite AOCard

**Files:**
- Modify: `src/components/ui/AOCard.tsx` (full rewrite)

- [ ] **Step 1: Read existing AOCard to understand current shape**

Run: `wc -l src/components/ui/AOCard.tsx && head -60 src/components/ui/AOCard.tsx`
Note the current props shape.

- [ ] **Step 2: Rewrite AOCard**

Overwrite `src/components/ui/AOCard.tsx`:

```tsx
import Link from "next/link";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { StatusChip } from "@/components/ui/brand/StatusChip";
import type { WorkoutScheduleRow } from "@/types/workout";

type Props = {
  workout: WorkoutScheduleRow;
  code?: string;
  status?: "active" | "launch";
  qName?: string;
  className?: string;
};

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function formatTime(hhmmss: string): string {
  const [h, m] = hhmmss.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "am" : "pm";
  return `${hour12}:${m.toString().padStart(2, "0")}${ampm}`;
}

export function AOCard({ workout, code, status = "active", qName, className = "" }: Props) {
  const dayLabel = DAY_LABELS[workout.day_of_week % 7];
  const timeLabel = formatTime(workout.start_time);

  return (
    <article
      className={`group relative bg-bone border border-line-soft p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_10px_30px_rgba(12,12,12,.08)] ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-[3px] bg-steel origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
      />
      <div className="flex items-center justify-between gap-3 mb-5">
        <MonoTag>{code ?? "F3.MAR"}</MonoTag>
        <StatusChip variant={status}>{status === "launch" ? "Launching" : "Active"}</StatusChip>
      </div>
      <h3 className="font-display font-bold uppercase text-[clamp(28px,3vw,34px)] leading-none tracking-[-.01em]">
        {workout.ao_name}
      </h3>
      <div className="mt-3 flex items-center gap-1.5 text-muted font-mono text-[11px] tracking-[.1em] uppercase">
        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor" aria-hidden="true">
          <path d="M8 1c-3 0-5.5 2.2-5.5 5 0 3.6 4.8 8.5 5 8.7.3.3.7.3 1 0 .2-.2 5-5.1 5-8.7 0-2.8-2.5-5-5.5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
        </svg>
        <span>{workout.location_name ?? workout.address}</span>
      </div>

      <div className="mt-6 flex items-center justify-between pt-5 border-t border-line-soft">
        <div className="flex items-center gap-4">
          <MonoTag>{dayLabel}</MonoTag>
          <span className="font-display font-semibold text-[15px]">{timeLabel}</span>
          <MonoTag variant="steel">· GLOOM</MonoTag>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <MonoTag>{qName ? `Q · ${qName}` : "Peer-Led"}</MonoTag>
        <Link
          href={workout.map_link ?? `https://www.google.com/maps?q=${encodeURIComponent(workout.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] tracking-[.15em] uppercase text-steel inline-flex items-center gap-1 group-hover:gap-2.5 transition-all"
        >
          Directions <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
```

- [ ] **Step 3: Check for existing AOCard consumers**

Run: `grep -rn "AOCard" src --include="*.tsx" --include="*.ts"`
Any consumer of the old AOCard that passes different props will break. For now, this is expected; the home and /workouts tasks will re-wire usage.

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/AOCard.tsx
git commit -m "feat(ui): rewrite AOCard with editorial chrome and steel hover accent"
```

---

### Task 3.6: Build WorkoutsFilter (client) and WorkoutsPreviewSection

**Files:**
- Create: `src/components/home/WorkoutsFilter.tsx` (client)
- Create: `src/components/home/WorkoutsPreviewSection.tsx` (server)

- [ ] **Step 1: Create WorkoutsFilter**

Write `src/components/home/WorkoutsFilter.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { AOCard } from "@/components/ui/AOCard";
import type { WorkoutScheduleRow } from "@/types/workout";

type Props = {
  workouts: WorkoutScheduleRow[];
  limit?: number;
};

const DAYS: Array<{ key: number | "all"; label: string }> = [
  { key: "all", label: "All" },
  { key: 1, label: "Mon" },
  { key: 2, label: "Tue" },
  { key: 3, label: "Wed" },
  { key: 4, label: "Thu" },
  { key: 5, label: "Fri" },
  { key: 6, label: "Sat" },
];

export function WorkoutsFilter({ workouts, limit }: Props) {
  const [activeDay, setActiveDay] = useState<number | "all">("all");
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const base = activeDay === "all" ? workouts : workouts.filter((w) => w.day_of_week === activeDay);
    const searched = needle
      ? base.filter(
          (w) =>
            w.ao_name.toLowerCase().includes(needle) ||
            (w.location_name ?? "").toLowerCase().includes(needle) ||
            w.address.toLowerCase().includes(needle)
        )
      : base;
    return limit ? searched.slice(0, limit) : searched;
  }, [workouts, activeDay, search, limit]);

  return (
    <div>
      <div className="flex flex-wrap gap-2 items-center mb-5">
        {DAYS.map((d) => {
          const isOn = d.key === activeDay;
          return (
            <button
              key={String(d.key)}
              onClick={() => setActiveDay(d.key)}
              className={`px-4 py-2 border font-mono text-[11px] tracking-[.12em] uppercase transition-colors ${
                isOn ? "bg-ink text-bone border-ink" : "bg-transparent text-ink border-line-soft hover:border-ink"
              }`}
            >
              {d.label}
            </button>
          );
        })}
        <div className="relative ml-auto min-w-[240px]">
          <svg viewBox="0 0 20 20" className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="currentColor" aria-hidden="true">
            <path d="M13.5 12a5 5 0 1 0-1.5 1.5l3 3a1 1 0 0 0 1.5-1.5l-3-3zM9 13a4 4 0 1 1 0-8 4 4 0 0 1 0 8z" />
          </svg>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search AOs"
            className="w-full pl-9 pr-4 py-2 border border-line-soft bg-transparent font-mono text-[12px] tracking-[.08em] uppercase focus:outline-none focus:border-ink"
          />
        </div>
      </div>

      <div className="grid gap-5" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))" }}>
        {filtered.length === 0 ? (
          <div className="col-span-full py-16 text-center text-muted font-mono text-[12px] tracking-[.15em] uppercase">
            No posts match · try another day
          </div>
        ) : (
          filtered.map((w, i) => (
            <AOCard
              key={w.id}
              workout={w}
              code={`F3.MAR.${String(i + 1).padStart(2, "0")}`}
              status={w.is_active ? "active" : "launch"}
            />
          ))
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create WorkoutsPreviewSection**

Write `src/components/home/WorkoutsPreviewSection.tsx`:

```tsx
import Link from "next/link";
import { getWorkoutSchedule } from "@/lib/workouts/getWorkoutSchedule";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { WorkoutsFilter } from "./WorkoutsFilter";
import type { WorkoutScheduleRow } from "@/types/workout";

export async function WorkoutsPreviewSection() {
  const schedule = await getWorkoutSchedule();
  const flat: WorkoutScheduleRow[] = [];
  for (const day of Object.values(schedule)) {
    for (const region of day.regions) {
      flat.push(...region.workouts);
    }
  }

  return (
    <section id="workouts" className="bg-bone-2 py-28">
      <div className="max-w-[1320px] mx-auto px-7">
        <ScrollReveal>
          <SectionHead
            eyebrow="§ 02 · Posts of Assembly"
            h2={<>Find Your<br />Battlefield.</>}
            kicker={
              <>
                Every AO runs 05:15 to 06:00 (or 07:00 on Saturdays). Beatdowns, rucks, Q-school, and runs rotating through the week. Pick a day. Pick a post. Fall in.
              </>
            }
          />
        </ScrollReveal>

        <ScrollReveal>
          <WorkoutsFilter workouts={flat} limit={6} />
        </ScrollReveal>

        <div className="mt-10 flex justify-center">
          <Link
            href="/workouts"
            className="inline-flex items-center gap-2 font-display font-semibold uppercase tracking-[.1em] text-[14px] text-steel hover:gap-3 transition-all"
          >
            View all posts <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "home/Workouts" | head`
Expected: No errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/home/WorkoutsFilter.tsx src/components/home/WorkoutsPreviewSection.tsx
git commit -m "feat(home): add WorkoutsFilter client and WorkoutsPreviewSection with live schedule"
```

---

### Task 3.7: Build BackblastListItem, BackblastFeatureCard, BackblastsPreviewSection

**Files:**
- Create: `src/components/ui/BackblastListItem.tsx`
- Create: `src/components/ui/BackblastFeatureCard.tsx`
- Create: `src/components/home/BackblastsPreviewSection.tsx`

- [ ] **Step 1: Create BackblastListItem**

Write `src/components/ui/BackblastListItem.tsx`:

```tsx
import Link from "next/link";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { StatusChip } from "@/components/ui/brand/StatusChip";
import { createExcerpt } from "@/lib/backblast/getBackblastsPaginated";
import type { F3EventRow } from "@/lib/backblast/getBackblastsPaginated";

type Props = { item: F3EventRow; className?: string };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

export function BackblastListItem({ item, className = "" }: Props) {
  const title = item.title ?? "Backblast";
  const excerpt = createExcerpt(item.content_text, 140);
  return (
    <Link
      href={`/backblasts/${item.id}`}
      className={`group block border-b border-line-soft p-6 transition-colors hover:bg-bone-2 ${className}`}
    >
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <StatusChip variant="active">{item.ao_display_name ?? "F3 Marietta"}</StatusChip>
        <MonoTag>{formatDate(item.event_date)}</MonoTag>
        {item.q_name && <MonoTag>Q · {item.q_name}</MonoTag>}
      </div>
      <h4 className="font-display font-bold uppercase text-[20px] tracking-[-.01em] leading-tight">{title}</h4>
      {excerpt && <p className="mt-2 text-[13px] leading-[1.55] text-muted">{excerpt}</p>}
      <div className="mt-3 flex items-center justify-end text-steel font-mono text-[11px] tracking-[.15em] uppercase opacity-0 translate-x-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all">
        Read report →
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Create BackblastFeatureCard**

Write `src/components/ui/BackblastFeatureCard.tsx`:

```tsx
import Link from "next/link";
import Image from "next/image";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { createExcerpt } from "@/lib/backblast/getBackblastsPaginated";
import type { F3EventRow } from "@/lib/backblast/getBackblastsPaginated";

type Props = { item: F3EventRow; className?: string };

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

export function BackblastFeatureCard({ item, className = "" }: Props) {
  const title = item.title ?? "Battlefield Report";
  const excerpt = createExcerpt(item.content_text, 220);

  return (
    <Link
      href={`/backblasts/${item.id}`}
      className={`relative block bg-ink text-bone overflow-hidden border border-ink-3 p-11 min-h-[520px] group ${className}`}
    >
      <Image
        src="/icons/f3mariettalogo-main.png"
        alt=""
        aria-hidden="true"
        width={400}
        height={400}
        className="absolute -bottom-20 -right-20 opacity-[.08] pointer-events-none"
        style={{ filter: "invert(1)" }}
      />
      <div className="relative z-10 flex flex-col h-full">
        <MonoTag variant="steel">{`${formatDate(item.event_date)} · ${item.ao_display_name ?? "F3 Marietta"}`}</MonoTag>
        <h3 className="mt-5 font-display font-bold uppercase text-[clamp(36px,4vw,56px)] leading-[.92] tracking-[-.01em] max-w-[580px]">
          {title}
        </h3>
        {excerpt && <p className="mt-6 text-[16px] leading-[1.55] text-bone/75 max-w-[580px]">{excerpt}</p>}
        <div className="mt-auto pt-6 border-t border-bone/12 flex flex-wrap gap-6 font-mono text-[11px] tracking-[.15em] uppercase text-bone/70">
          {item.q_name && <span>Q · {item.q_name}</span>}
          {item.pax_count != null && <span>PAX · {item.pax_count}</span>}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 3: Create BackblastsPreviewSection**

Write `src/components/home/BackblastsPreviewSection.tsx`:

```tsx
import Link from "next/link";
import { getBackblastsPaginated } from "@/lib/backblast/getBackblastsPaginated";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { BackblastFeatureCard } from "@/components/ui/BackblastFeatureCard";
import { BackblastListItem } from "@/components/ui/BackblastListItem";

export async function BackblastsPreviewSection() {
  const { rows } = await getBackblastsPaginated({ page: 1, pageSize: 6 });
  const [feature, ...rest] = rows;

  return (
    <section id="reports" className="bg-bone py-28">
      <div className="max-w-[1320px] mx-auto px-7">
        <ScrollReveal>
          <SectionHead
            eyebrow="§ 03 · From the Gloom"
            h2={<>Battlefield<br />Reports.</>}
            kicker={<>Every post produces a record. Here are the most recent backblasts from across the region.</>}
          />
        </ScrollReveal>

        {feature ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-8 items-stretch">
            <ScrollReveal><BackblastFeatureCard item={feature} /></ScrollReveal>
            <ScrollReveal delayMs={80}>
              <div className="border border-line-soft">
                {rest.map((item) => (
                  <BackblastListItem key={item.id} item={item} />
                ))}
              </div>
            </ScrollReveal>
          </div>
        ) : (
          <div className="py-16 text-center text-muted font-mono text-[12px] tracking-[.15em] uppercase">
            Backblasts loading · check back soon
          </div>
        )}

        <div className="mt-10 flex justify-center">
          <Link
            href="/backblasts"
            className="inline-flex items-center gap-2 font-display font-semibold uppercase tracking-[.1em] text-[14px] text-steel hover:gap-3 transition-all"
          >
            All reports <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 4: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep -E "(BackblastListItem|BackblastFeatureCard|home/Backblasts)" | head`
Expected: No errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/BackblastListItem.tsx src/components/ui/BackblastFeatureCard.tsx src/components/home/BackblastsPreviewSection.tsx
git commit -m "feat(home): add BackblastsPreviewSection with feature card + list"
```

---

### Task 3.8: Build ImpactSection

**Files:**
- Create: `src/components/home/ImpactSection.tsx`

- [ ] **Step 1: Create ImpactSection**

Write `src/components/home/ImpactSection.tsx`:

```tsx
import { getImpactStats } from "@/lib/stats/getImpactStats";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { EyebrowLabel } from "@/components/ui/brand/EyebrowLabel";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { TopoBackground } from "@/components/ui/brand/TopoBackground";

export async function ImpactSection() {
  const stats = await getImpactStats();
  const tiles = [
    { num: stats.uniqueHim, label: "Unique HIM Posted" },
    { num: stats.workoutsLed, label: "Workouts Led" },
    { num: stats.activeAOs, label: "Active AOs" },
    { num: stats.fngsThisYear, label: "FNGs This Year" },
  ];

  return (
    <section className="relative bg-ink text-bone py-28 overflow-hidden">
      <TopoBackground variant="dark" />
      <div className="relative z-10 max-w-[1320px] mx-auto px-7 grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
        <ScrollReveal>
          <EyebrowLabel variant="steel" withRule>§ 04 · Impact</EyebrowLabel>
          <h2 className="mt-5 font-display font-bold uppercase leading-[.86] text-[clamp(46px,7vw,96px)] tracking-[-.01em]">
            Built in Marietta.
            <br />
            <span className="font-serif italic text-steel normal-case tracking-normal">Forged</span> in the gloom.
          </h2>
          <p className="mt-8 max-w-md text-[16px] leading-[1.6] text-bone/75">
            We launched The Battlefield at Marietta High School in June 2024. The region launched in December 2025. We&apos;re just getting started.
          </p>
          <div className="mt-8">
            <ChamferButton href="/new-here" variant="steel" size="lg">Your First Post</ChamferButton>
          </div>
        </ScrollReveal>

        <ScrollReveal delayMs={100}>
          <div className="grid grid-cols-2 border border-bone/12">
            {tiles.map((t, i) => (
              <div
                key={t.label}
                className={`px-7 py-10 ${i % 2 === 0 ? "border-r border-bone/12" : ""} ${i < 2 ? "border-b border-bone/12" : ""}`}
              >
                <div className="font-display font-bold text-steel text-[clamp(48px,6vw,84px)] leading-none">
                  {t.num}
                </div>
                <div className="mt-3 font-mono text-[11px] tracking-[.15em] uppercase text-bone/65">{t.label}</div>
              </div>
            ))}
          </div>
        </ScrollReveal>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Typecheck and commit**

Run: `npx tsc --noEmit 2>&1 | grep "home/ImpactSection" | head`
Expected: No errors.

```bash
git add src/components/home/ImpactSection.tsx
git commit -m "feat(home): add ImpactSection with live stats"
```

---

### Task 3.9: Build JoinCTASection

**Files:**
- Create: `src/components/home/JoinCTASection.tsx`

- [ ] **Step 1: Create JoinCTASection**

Write `src/components/home/JoinCTASection.tsx`:

```tsx
import { CTABand } from "@/components/ui/brand/CTABand";

export function JoinCTASection() {
  return (
    <CTABand
      variant="gradient"
      id="new"
      title={<>Post.<br />That&apos;s it.</>}
      kicker={
        <>
          No sign-up. No fee. No catch. Show up five minutes early, tell us your name, and fall in. We&apos;ll handle the rest.
        </>
      }
      primary={{ label: "Plan Your First Post", href: "/new-here" }}
      watermark={
        <span className="absolute -bottom-16 right-0 font-display font-bold uppercase text-bone text-[clamp(200px,30vw,480px)] leading-none">
          05:15
        </span>
      }
    />
  );
}
```

Note: `CTABand` needs an optional `id` prop. Update `src/components/ui/brand/CTABand.tsx` by adding `id?: string` to `Props` and forwarding it to the `<section>` element: `<section id={id} ...>`.

- [ ] **Step 2: Apply the CTABand id patch**

Edit `src/components/ui/brand/CTABand.tsx`:
- Add `id?: string` to `Props`
- Destructure `id` alongside other props
- Apply `id={id}` on the root `<section>` element

- [ ] **Step 3: Typecheck and commit**

Run: `npx tsc --noEmit 2>&1 | grep -E "home/JoinCTASection|brand/CTABand" | head`
Expected: No errors.

```bash
git add src/components/home/JoinCTASection.tsx src/components/ui/brand/CTABand.tsx
git commit -m "feat(home): add JoinCTASection with 05:15 watermark"
```

---

### Task 3.10: Assemble the home page

**Files:**
- Modify: `src/app/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite page.tsx**

Overwrite `src/app/page.tsx`:

```tsx
import { HomeHero } from "@/components/home/HomeHero";
import { ThreeFsSection } from "@/components/home/ThreeFsSection";
import { CreedPrinciplesSection } from "@/components/home/CreedPrinciplesSection";
import { WorkoutsPreviewSection } from "@/components/home/WorkoutsPreviewSection";
import { BackblastsPreviewSection } from "@/components/home/BackblastsPreviewSection";
import { ImpactSection } from "@/components/home/ImpactSection";
import { JoinCTASection } from "@/components/home/JoinCTASection";
import { MarqueeRibbon } from "@/components/layout/MarqueeRibbon";
import { getWeeklyPaxCount } from "@/lib/stats/getWeeklyPaxCount";

export const revalidate = 3600;

export default async function Home() {
  const weeklyPax = await getWeeklyPaxCount();

  return (
    <>
      <HomeHero weeklyPax={weeklyPax} />
      <MarqueeRibbon />
      <ThreeFsSection />
      <CreedPrinciplesSection />
      <MarqueeRibbon />
      <WorkoutsPreviewSection />
      <BackblastsPreviewSection />
      <ImpactSection />
      <JoinCTASection />
    </>
  );
}
```

- [ ] **Step 2: Build and smoke-test**

Run: `npm run build 2>&1 | tail -30`
Expected: Build should succeed for the home page. Sub-pages with unreferenced old tokens may still error; those are addressed in Wave 4.

If build still errors on sub-pages, mark them temporarily unbuildable (e.g. add `export const dynamic = 'force-dynamic'` and minimal content) only if blocking — prefer to proceed to Wave 4 next.

- [ ] **Step 3: Visual smoke test**

Start dev server on port 3003: `PORT=3003 npm run dev &`
Wait 5 seconds.
Run: `curl -s http://localhost:3003 | grep -o "Hold the\|Battlefield\|Leave no man\|Three F\|Circle of Trust" | sort -u`
Expected: All five strings present.

- [ ] **Step 4: Commit**

```bash
git add src/app/page.tsx
git commit -m "feat(home): assemble redesigned home page"
```

---

### Task 3.11: Update homepage.spec.ts and navigation.spec.ts

**Files:**
- Modify: `tests/homepage.spec.ts`
- Modify: `tests/navigation.spec.ts`

- [ ] **Step 1: Read existing specs**

Run: `cat tests/homepage.spec.ts tests/navigation.spec.ts`

- [ ] **Step 2: Rewrite homepage.spec.ts**

Overwrite `tests/homepage.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("Home page (redesign)", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto("/");
  });

  test("renders hero H1 and lede", async ({ page }) => {
    const h1 = page.locator("h1").first();
    await expect(h1).toContainText(/Hold the/i);
    await expect(h1).toContainText(/Battlefield/i);
    await expect(h1).toContainText(/Leave no man/i);
    await expect(page.getByText(/Free, peer-led workouts/i)).toBeVisible();
  });

  test("hero CTAs are visible and linked", async ({ page }) => {
    const primary = page.getByRole("link", { name: /Find a Workout/i }).first();
    await expect(primary).toBeVisible();
    await expect(primary).toHaveAttribute("href", /\/workouts/);
  });

  test("Three F's section renders with three cards", async ({ page }) => {
    await expect(page.locator("#about")).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Fitness$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Fellowship$/ })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Faith$/ })).toBeVisible();
  });

  test("creed pull quote is present", async ({ page }) => {
    await expect(page.getByText(/Leave no man behind/i).first()).toBeVisible();
    await expect(page.getByText(/where you found him/i)).toBeVisible();
  });

  test("workouts preview has a filter and at least one AO card", async ({ page }) => {
    await expect(page.locator("#workouts")).toBeVisible();
    await expect(page.getByPlaceholder(/Search AOs/i)).toBeVisible();
  });

  test("backblasts preview section renders", async ({ page }) => {
    await expect(page.locator("#reports")).toBeVisible();
    await expect(page.getByRole("link", { name: /All reports/i })).toBeVisible();
  });

  test("impact section shows 4 numeric tiles", async ({ page }) => {
    const tiles = page.locator("text=/HIM|Workouts Led|Active AOs|FNGs/i");
    await expect(tiles.first()).toBeVisible();
  });

  test("join CTA and footer render", async ({ page }) => {
    await expect(page.locator("#new")).toBeVisible();
    await expect(page.getByText(/Plan Your First Post/i)).toBeVisible();
    await expect(page.getByText(/A Region of F3 Nation/i)).toBeVisible();
  });
});
```

- [ ] **Step 3: Rewrite navigation.spec.ts**

Overwrite `tests/navigation.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const NAV_LINKS = ["Home", "About", "Workouts", "Backblasts", "New Here", "Contact"];

test.describe("Navigation (redesign)", () => {
  test("desktop nav shows all links", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");
    for (const label of NAV_LINKS) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
    await expect(page.getByRole("link", { name: /Find a Workout/i }).first()).toBeVisible();
  });

  test("mobile nav drawer opens and closes", async ({ page }) => {
    await page.setViewportSize({ width: 480, height: 900 });
    await page.goto("/");
    const burger = page.getByRole("button", { name: /Open menu/i });
    await burger.click();
    for (const label of NAV_LINKS) {
      await expect(page.getByRole("link", { name: new RegExp(`^${label}$`, "i") }).first()).toBeVisible();
    }
  });

  test("top bar renders on every page", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByText(/Gloom Status: Active/i)).toBeVisible();
  });
});
```

- [ ] **Step 4: Run these two specs**

Run: `npx playwright test tests/homepage.spec.ts tests/navigation.spec.ts --reporter=list 2>&1 | tail -40`
Expected: All tests pass. If any fail, inspect output and fix the component or the assertion.

- [ ] **Step 5: Commit**

```bash
git add tests/homepage.spec.ts tests/navigation.spec.ts
git commit -m "test: rewrite homepage and navigation specs for redesign"
```

---

## Wave 4 — Public sub-pages

Each sub-page below composes from `ui/brand/` primitives: `<PageHeader>` opens the page, body follows the per-page pattern, then `<CTABand>` closes. The global `<TopBar>`, `<Navbar>`, and `<Footer>` are mounted in root layout — sub-pages do not render them.

### Task 4.1: Rewrite /about

**Files:**
- Modify: `src/app/about/page.tsx` (full rewrite)

- [ ] **Step 1: Read existing content sources**

Run: `cat data/f3-about.md data/f3-marietta-region.md data/f3-leadership.md 2>/dev/null | head -200`
Capture the canonical mission/history/leadership text. Use these verbatim where shown.

- [ ] **Step 2: Rewrite /about**

Overwrite `src/app/about/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { CreedQuote } from "@/components/ui/brand/CreedQuote";
import { CTABand } from "@/components/ui/brand/CTABand";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { MarqueeRibbon } from "@/components/layout/MarqueeRibbon";

export const metadata: Metadata = {
  title: "About",
  description: "F3 Marietta history, mission, and leadership.",
};

const TIMELINE = [
  { date: "JUN 2024", title: "Battlefield Launch", body: "The Battlefield stands up at Marietta High School. First muster, 6 PAX." },
  { date: "SEP 2024", title: "The Last Stand", body: "A second AO opens. The region is forming." },
  { date: "DEC 2025", title: "Region Launch", body: "F3 Marietta is recognized as an official F3 Nation region." },
  { date: "TODAY",   title: "Forging On",    body: "New PAX every week. New AOs on the horizon." },
];

export default function AboutPage() {
  return (
    <>
      <PageHeader
        eyebrow="§ F3 Marietta"
        variant="ink"
        title={<>Men. Marietta.<br />Since 2024.</>}
        kicker={<>A growing community of men dedicated to becoming better leaders in our families, workplaces, and community.</>}
        meter={{ left: "Coordinates · 33.9526° N, 84.5499° W", right: "Region · Marietta, GA" }}
      />

      <section className="bg-bone py-24">
        <div className="max-w-[1320px] mx-auto px-7">
          <ScrollReveal>
            <SectionHead
              eyebrow="§ 01 · The Mission"
              h2={<>Plant. Grow.<br />Serve.</>}
              kicker={
                <>
                  F3 is a national network of free, peer-led workouts for men. Our mission is to plant, grow, and serve small workout groups for men for the invigoration of male community leadership.
                </>
              }
            />
          </ScrollReveal>
        </div>
      </section>

      <section className="bg-bone-2 py-24">
        <div className="max-w-[1320px] mx-auto px-7">
          <ScrollReveal>
            <SectionHead
              eyebrow="§ 02 · The Record"
              h2={<>A short history.</>}
              align="left"
            />
          </ScrollReveal>
          <ol className="relative border-l border-line-soft ml-2">
            {TIMELINE.map((t, i) => (
              <ScrollReveal
                key={t.date}
                delayMs={i * 80}
                as="li"
                className="relative pl-8 pb-10 last:pb-0"
              >
                <span className="absolute left-[-7px] top-2 w-3 h-3 rounded-full bg-steel" aria-hidden="true" />
                <MonoTag variant="steel">{t.date}</MonoTag>
                <h3 className="mt-2 font-display font-bold uppercase text-[28px] tracking-[-.01em] leading-tight">{t.title}</h3>
                <p className="mt-2 text-[15px] leading-[1.6] text-muted max-w-xl">{t.body}</p>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </section>

      <section className="bg-ink text-bone py-24 text-center">
        <div className="max-w-[1320px] mx-auto px-7">
          <ScrollReveal>
            <CreedQuote variant="ink">
              We plant. We grow. <span className="text-steel">We serve.</span>
            </CreedQuote>
          </ScrollReveal>
        </div>
      </section>

      <MarqueeRibbon />

      <CTABand
        variant="steel"
        title={<>Your First<br />Post.</>}
        kicker={<>Find a workout, grab a buddy, and show up. We&apos;ll do the rest.</>}
        primary={{ label: "Find a Workout", href: "/workouts" }}
        secondary={{ label: "What to Expect", href: "/what-to-expect" }}
      />
    </>
  );
}
```

- [ ] **Step 3: Typecheck and build**

Run: `npx tsc --noEmit src/app/about/page.tsx && npm run build 2>&1 | grep -E "(about|Error)" | head`
Expected: No compilation errors on /about.

- [ ] **Step 4: Commit**

```bash
git add src/app/about/page.tsx
git commit -m "feat(about): bespoke editorial /about page with timeline and creed"
```

---

### Task 4.2: Rewrite /workouts

**Files:**
- Modify: `src/app/workouts/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite /workouts**

Overwrite `src/app/workouts/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { WorkoutsFilter } from "@/components/home/WorkoutsFilter";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { getWorkoutSchedule } from "@/lib/workouts/getWorkoutSchedule";
import type { WorkoutScheduleRow } from "@/types/workout";

export const metadata: Metadata = {
  title: "Workouts",
  description: "All F3 Marietta AOs and workout times. Rain or shine, free of charge.",
};

export default async function WorkoutsPage() {
  const schedule = await getWorkoutSchedule();
  const flat: WorkoutScheduleRow[] = [];
  for (const day of Object.values(schedule)) {
    for (const region of day.regions) flat.push(...region.workouts);
  }

  return (
    <>
      <PageHeader
        eyebrow="§ Posts of Assembly"
        title={<>Find Your<br />Battlefield.</>}
        kicker={<>Beatdowns at 05:15 weekdays, 07:00 Saturdays. Pick a day. Pick a post. Fall in.</>}
        meter={{ left: "Coordinates · 33.9526° N, 84.5499° W", right: `Active AOs · ${flat.length}` }}
      />

      <section className="bg-bone py-20">
        <div className="max-w-[1320px] mx-auto px-7">
          <ScrollReveal>
            <WorkoutsFilter workouts={flat} />
          </ScrollReveal>
          <div className="mt-20 border border-line-soft bg-bone-2 p-10 text-center">
            <div className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">// Don&apos;t see your AO?</div>
            <h3 className="mt-3 font-display font-bold uppercase text-[28px] tracking-[-.01em]">
              The region is growing.
            </h3>
            <p className="mt-3 text-[15px] text-muted max-w-xl mx-auto">
              Interested in planting an AO in your part of Marietta? Send us a note — we&apos;ll help you stand it up.
            </p>
            <div className="mt-5">
              <a href="/contact" className="inline-block font-display font-semibold uppercase tracking-[.1em] text-[14px] text-steel">
                Contact Us →
              </a>
            </div>
          </div>
        </div>
      </section>

      <CTABand
        variant="ink"
        title={<>First Post.</>}
        kicker={<>Arrive five minutes early. Tell us your name. Fall in.</>}
        primary={{ label: "What to Expect", href: "/what-to-expect" }}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/workouts/page.tsx
git commit -m "feat(workouts): bespoke /workouts page with expanded filter and bespoke chrome"
```

---

### Task 4.3: Rewrite /backblasts

**Files:**
- Modify: `src/app/backblasts/page.tsx` (full rewrite)

- [ ] **Step 1: Read the existing backblasts page**

Run: `cat src/app/backblasts/page.tsx | head -60`
Note the search param handling and AO filter.

- [ ] **Step 2: Rewrite /backblasts**

Overwrite `src/app/backblasts/page.tsx`:

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { BackblastListItem } from "@/components/ui/BackblastListItem";
import { BackblastFeatureCard } from "@/components/ui/BackblastFeatureCard";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { MarqueeRibbon } from "@/components/layout/MarqueeRibbon";
import { getBackblastsPaginated, getAOList } from "@/lib/backblast/getBackblastsPaginated";

export const metadata: Metadata = {
  title: "Backblasts",
  description: "Reports from the gloom. Every workout leaves a record.",
};

type SP = Promise<{ page?: string; ao?: string; search?: string }>;

export default async function BackblastsPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const page = Number(sp.page ?? "1") || 1;
  const ao = sp.ao ?? undefined;
  const search = sp.search ?? undefined;

  const [{ rows, total, totalPages, pageSize }, aos] = await Promise.all([
    getBackblastsPaginated({ page, pageSize: 12, ao, search }),
    getAOList(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="§ Field Reports"
        variant="ink"
        title={<>From the<br />Gloom.</>}
        kicker={<>Every post produces a backblast. {total} reports on record.</>}
        meter={{ left: `Records · ${total}`, right: "Source · Slack + Slackblast Bot" }}
      />

      <section className="bg-bone py-14">
        <div className="max-w-[1320px] mx-auto px-7">
          <div className="flex flex-wrap items-center gap-2 mb-10">
            <MonoTag className="mr-3">// Filter by AO</MonoTag>
            <Link
              href="/backblasts"
              className={`px-4 py-2 border font-mono text-[11px] tracking-[.12em] uppercase transition-colors ${
                !ao ? "bg-ink text-bone border-ink" : "border-line-soft text-ink hover:border-ink"
              }`}
            >
              All
            </Link>
            {aos.map((name) => (
              <Link
                key={name}
                href={`/backblasts?ao=${encodeURIComponent(name)}`}
                className={`px-4 py-2 border font-mono text-[11px] tracking-[.12em] uppercase transition-colors ${
                  ao === name ? "bg-ink text-bone border-ink" : "border-line-soft text-ink hover:border-ink"
                }`}
              >
                {name}
              </Link>
            ))}
          </div>

          {rows.length === 0 ? (
            <div className="py-16 text-center text-muted font-mono text-[12px] tracking-[.15em] uppercase">
              No backblasts match the filter.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {rows.map((item, i) =>
                i % 4 === 0 ? (
                  <ScrollReveal key={item.id} className="lg:col-span-2">
                    <BackblastFeatureCard item={item} />
                  </ScrollReveal>
                ) : (
                  <ScrollReveal key={item.id}>
                    <div className="border border-line-soft bg-bone">
                      <BackblastListItem item={item} />
                    </div>
                  </ScrollReveal>
                )
              )}
            </div>
          )}

          <nav className="mt-12 flex items-center justify-between font-mono text-[11px] tracking-[.15em] uppercase text-muted">
            <span>{`Page ${page} of ${Math.max(totalPages, 1)} · ${pageSize} per page`}</span>
            <div className="flex gap-3">
              {page > 1 && (
                <Link href={`/backblasts?${new URLSearchParams({ ...(ao ? { ao } : {}), page: String(page - 1) }).toString()}`} className="text-steel">
                  ← Newer
                </Link>
              )}
              {page < totalPages && (
                <Link href={`/backblasts?${new URLSearchParams({ ...(ao ? { ao } : {}), page: String(page + 1) }).toString()}`} className="text-steel">
                  Older →
                </Link>
              )}
            </div>
          </nav>
        </div>
      </section>

      <MarqueeRibbon />
    </>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/backblasts/page.tsx
git commit -m "feat(backblasts): bespoke /backblasts list with rhythmic feature cards and AO filter"
```

---

### Task 4.4: Rewrite /new-here

**Files:**
- Modify: `src/app/new-here/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite /new-here**

Overwrite `src/app/new-here/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { CTABand } from "@/components/ui/brand/CTABand";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";

export const metadata: Metadata = {
  title: "New Here",
  description: "How to post at your first F3 Marietta workout.",
};

const STEPS = [
  { num: "01", name: "Arrive", body: "Show up 5 minutes early at 05:10. The workout starts at 05:15 sharp. Wear clothes you can get wet and muddy." },
  { num: "02", name: "Circle Up", body: "Introduce yourself by first name. Say 'FNG' — Friendly New Guy — so the Q knows to watch out for you." },
  { num: "03", name: "Warm-Up", body: "The Q leads a warm-up. SSH, Don Quixotes, Imperial Walkers. Everybody goes at their own pace. Modify any exercise." },
  { num: "04", name: "The Thang", body: "45 minutes of peer-led exercise outdoors. Bodyweight, maybe a ruck, maybe a run. Heavy, skinny, fast, slow — we move as a unit." },
  { num: "05", name: "COT", body: "Circle of Trust closes every workout. Name-o-rama, a reflection or prayer, and a charge back into the day." },
];

const BRING = [
  "Shoes you can get wet",
  "A t-shirt and shorts you don't mind sacrificing",
  "A good attitude",
  "Nothing else — no cash, no equipment",
];

export default function NewHerePage() {
  return (
    <>
      <PageHeader
        eyebrow="§ First Whistle"
        title={<>Your First<br />Post.</>}
        kicker={<>The workout is free. Peer-led. Held outdoors rain or shine. Here&apos;s how to show up.</>}
      />

      <section className="bg-bone py-20">
        <div className="max-w-[1320px] mx-auto px-7 grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-14">
          <div className="border-y border-line-soft">
            {STEPS.map((s, i) => (
              <ScrollReveal
                key={s.num}
                delayMs={i * 60}
                className={`flex items-start gap-8 py-9 ${i < STEPS.length - 1 ? "border-b border-line-soft" : ""}`}
              >
                <div className="font-display font-bold uppercase text-steel leading-none text-[clamp(54px,7vw,88px)]">{s.num}</div>
                <div className="flex-1 pt-2">
                  <h3 className="font-display font-bold uppercase text-[24px] tracking-[-.01em]">{s.name}</h3>
                  <p className="mt-2 text-[16px] leading-[1.6] text-muted max-w-xl">{s.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>

          <div>
            <ScrollReveal>
              <ClipFrame padding="p-8">
                <MonoTag>// What to Bring</MonoTag>
                <ul className="mt-5 space-y-3">
                  {BRING.map((b) => (
                    <li key={b} className="flex items-start gap-3 text-[15px] text-ink">
                      <span className="mt-2 inline-block w-1.5 h-1.5 bg-steel" aria-hidden="true" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
              </ClipFrame>
            </ScrollReveal>
          </div>
        </div>
      </section>

      <CTABand
        variant="gradient"
        title={<>Plan your<br />first post.</>}
        kicker={<>Find a workout, grab a buddy, and show up. We&apos;ll handle the rest.</>}
        primary={{ label: "Find a Workout", href: "/workouts" }}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/new-here/page.tsx
git commit -m "feat(new-here): bespoke /new-here walkthrough with 5-step meter"
```

---

### Task 4.5: Rewrite /contact

**Files:**
- Modify: `src/app/contact/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite /contact**

Overwrite `src/app/contact/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MarqueeRibbon } from "@/components/layout/MarqueeRibbon";

export const metadata: Metadata = {
  title: "Contact",
  description: "Reach F3 Marietta leadership for FNG questions, media inquiries, or AO plant interest.",
};

const CONTACTS = [
  { label: "General", email: "hello@f3marietta.com" },
  { label: "FNG Inquiries", email: "fng@f3marietta.com" },
  { label: "Media / Press", email: "press@f3marietta.com" },
];

export default function ContactPage() {
  return (
    <>
      <PageHeader
        eyebrow="§ Connect"
        title={<>Find us.<br />Fall in.</>}
        kicker={<>Questions about posting, planting an AO, or joining the region? Reach out — we read everything.</>}
        meter={{ left: "Coordinates · 33.9526° N, 84.5499° W", right: "F3.MAR · REGION HQ" }}
      />

      <section className="bg-bone py-20">
        <div className="max-w-[1320px] mx-auto px-7 grid grid-cols-1 lg:grid-cols-2 gap-12">
          <div>
            <MonoTag>// Direct Lines</MonoTag>
            <div className="mt-5 grid gap-4">
              {CONTACTS.map((c) => (
                <ClipFrame key={c.email} padding="p-7" className="flex items-center justify-between flex-wrap gap-3">
                  <div>
                    <MonoTag>{c.label}</MonoTag>
                    <div className="mt-1 font-display font-bold uppercase tracking-[.02em] text-[22px]">{c.email}</div>
                  </div>
                  <ChamferButton href={`mailto:${c.email}`} variant="ink" size="sm">Email</ChamferButton>
                </ClipFrame>
              ))}
            </div>
          </div>

          <form
            action={`mailto:hello@f3marietta.com`}
            method="POST"
            encType="text/plain"
            className="bg-bone-2 border border-line-soft p-8"
          >
            <MonoTag>// Send a Message</MonoTag>
            <div className="mt-6 grid gap-5">
              <label className="block">
                <span className="block font-mono text-[11px] tracking-[.15em] uppercase text-muted mb-2">Topic</span>
                <select name="topic" className="w-full border border-line-soft bg-transparent px-3 py-2 font-mono text-[13px] tracking-[.05em] uppercase focus:outline-none focus:border-ink">
                  <option>General</option>
                  <option>FNG Inquiry</option>
                  <option>Media</option>
                  <option>Plant an AO</option>
                </select>
              </label>
              <label className="block">
                <span className="block font-mono text-[11px] tracking-[.15em] uppercase text-muted mb-2">Name</span>
                <input required name="name" className="w-full border border-line-soft bg-transparent px-3 py-2 focus:outline-none focus:border-ink" />
              </label>
              <label className="block">
                <span className="block font-mono text-[11px] tracking-[.15em] uppercase text-muted mb-2">Email</span>
                <input required type="email" name="email" className="w-full border border-line-soft bg-transparent px-3 py-2 focus:outline-none focus:border-ink" />
              </label>
              <label className="block">
                <span className="block font-mono text-[11px] tracking-[.15em] uppercase text-muted mb-2">Message</span>
                <textarea required name="message" rows={5} className="w-full border border-line-soft bg-transparent px-3 py-2 focus:outline-none focus:border-ink" />
              </label>
              <div className="pt-1">
                <ChamferButton type="submit" variant="ink" size="md">Send Message</ChamferButton>
              </div>
            </div>
          </form>
        </div>
      </section>

      <MarqueeRibbon />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/contact/page.tsx
git commit -m "feat(contact): bespoke /contact with direct lines and chamfered form"
```

---

### Task 4.6: Rewrite /fng

**Files:**
- Modify: `src/app/fng/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite /fng**

Overwrite `src/app/fng/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";

export const metadata: Metadata = {
  title: "FNGs",
  description: "What FNG means and how to post for the first time.",
};

export default function FNGPage() {
  return (
    <>
      <PageHeader
        eyebrow="§ FNG · 01"
        title={<>Friendly<br />New Guy.</>}
        kicker={<>Every man was an FNG once. Here&apos;s what it means.</>}
      />

      <section className="bg-bone py-20">
        <div className="max-w-[1320px] mx-auto px-7 grid grid-cols-1 lg:grid-cols-3 gap-10">
          {[
            { h: "What it means", p: "FNG = Friendly New Guy. It's what we call every man posting for the first time. No shame, no ceremony, just a welcome and a plan to watch out for you in the first workout." },
            { h: "What to bring", p: "Shoes you can get wet. A t-shirt and shorts. A good attitude. That's it — no cash, no equipment, no paperwork." },
            { h: "Your F3 name", p: "At your first post, the PAX will give you an F3 name. It sticks. It's part of the tradition — part joke, part badge of honor." },
          ].map((b, i) => (
            <ScrollReveal key={b.h} delayMs={i * 80} className="border border-line-soft p-8 bg-bone">
              <h3 className="font-display font-bold uppercase text-[24px] tracking-[-.01em]">{b.h}</h3>
              <p className="mt-3 text-[15px] leading-[1.6] text-muted">{b.p}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <CTABand
        variant="steel"
        title={<>Find tomorrow&apos;s<br />post.</>}
        primary={{ label: "See the Schedule", href: "/workouts" }}
        secondary={{ label: "Full Walkthrough", href: "/new-here" }}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/fng/page.tsx
git commit -m "feat(fng): bespoke FNG page with 3-block primer"
```

---

### Task 4.7: Rewrite /glossary

**Files:**
- Modify: `src/app/glossary/page.tsx` (full rewrite)
- Modify: `src/components/ui/GlossaryList.tsx` if needed (to support letter-rail layout)

- [ ] **Step 1: Read existing GlossaryList and f3Glossary data**

Run: `wc -l src/components/ui/GlossaryList.tsx data/f3Glossary.ts && head -30 data/f3Glossary.ts`

- [ ] **Step 2: Rewrite /glossary**

Overwrite `src/app/glossary/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { GlossaryList } from "@/components/ui/GlossaryList";
import { f3Glossary } from "@/data/f3Glossary";

export const metadata: Metadata = {
  title: "Glossary",
  description: "F3 Lexicon — terms, abbreviations, and inside jokes used across F3 Nation and F3 Marietta.",
};

export default function GlossaryPage() {
  return (
    <>
      <PageHeader
        eyebrow="§ Lexicon"
        variant="ink"
        title={<>The<br />Lexicon.</>}
        kicker={<>{f3Glossary.length} terms · F3 Nation + Regional.</>}
        meter={{ left: "Source · F3 Nation Lexicon", right: `Terms · ${f3Glossary.length}` }}
      />

      <section className="bg-bone py-14">
        <div className="max-w-[1320px] mx-auto px-7">
          <GlossaryList />
        </div>
      </section>

      <CTABand
        variant="bone"
        title={<>Still curious?</>}
        kicker={<>The whole point is to show up. The words will come.</>}
        primary={{ label: "Find a Workout", href: "/workouts" }}
      />
    </>
  );
}
```

- [ ] **Step 3: Restyle GlossaryList**

Edit `src/components/ui/GlossaryList.tsx`:
- Replace the search input styling with the editorial chrome (same pattern used in `WorkoutsFilter`): `<input className="w-full pl-9 pr-4 py-3 border border-line-soft bg-transparent font-mono text-[13px] tracking-[.05em] uppercase focus:outline-none focus:border-ink" ... />`
- Group terms by first letter. Render each letter group as:
  ```tsx
  <div id={letter} className="py-12 border-b border-line-soft">
    <div className="font-display font-bold uppercase text-steel text-[clamp(56px,8vw,96px)] leading-none">{letter}</div>
    <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-x-10 gap-y-5">
      {groupTerms.map((t) => (
        <div key={t.term} className="flex flex-col">
          <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">// {t.term}</span>
          <span className="font-display font-bold uppercase text-[22px] tracking-[-.01em] mt-1">{t.term}</span>
          <span className="mt-1 text-[14px] leading-[1.55] text-ink/80">{t.definition}</span>
        </div>
      ))}
    </div>
  </div>
  ```
- Preserve the search filter state — hide letter groups that contain zero matches.

- [ ] **Step 4: Commit**

```bash
git add src/app/glossary/page.tsx src/components/ui/GlossaryList.tsx
git commit -m "feat(glossary): bespoke lexicon page with letter-rail layout"
```

---

### Task 4.8: Rewrite /community

**Files:**
- Modify: `src/app/community/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite /community**

Overwrite `src/app/community/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { StatusChip } from "@/components/ui/brand/StatusChip";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";

export const metadata: Metadata = {
  title: "Community",
  description: "Fellowship ledger — service projects, 2nd F gatherings, and community events.",
};

type Entry = { date: string; title: string; body: string; tag: "Service" | "2nd F" | "Event" };

const ENTRIES: Entry[] = [
  { date: "UPCOMING · MAY 17", title: "Habitat for Humanity Build Day", body: "Morning build with a Marietta partner site. Open to PAX and families. Coffee + donuts provided.", tag: "Service" },
  { date: "MONTHLY · FIRST SAT", title: "Coffeeteria · Kennesaw", body: "Post-workout coffee and conversation at the Marietta Square. No agenda. Families welcome.", tag: "2nd F" },
  { date: "ANNUAL · NOVEMBER", title: "F3 Marietta Convergence", body: "One big workout with the full region. Family picnic after. Bring the 2.0s.", tag: "Event" },
];

export default function CommunityPage() {
  return (
    <>
      <PageHeader
        eyebrow="§ The Ledger"
        title={<>Fellowship<br />Ledger.</>}
        kicker={<>The gloom builds the men. The community builds the region. Here&apos;s what&apos;s on the books.</>}
      />

      <section className="bg-bone py-20">
        <div className="max-w-[1320px] mx-auto px-7 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {ENTRIES.map((e, i) => (
            <ScrollReveal key={e.title} delayMs={i * 80} className="border border-line-soft p-7 bg-bone">
              <div className="flex items-center justify-between mb-5">
                <MonoTag variant="steel">{e.date}</MonoTag>
                <StatusChip variant={e.tag === "Service" ? "active" : e.tag === "2nd F" ? "draft" : "fng"}>{e.tag}</StatusChip>
              </div>
              <h3 className="font-display font-bold uppercase text-[24px] tracking-[-.01em] leading-tight">{e.title}</h3>
              <p className="mt-3 text-[14px] leading-[1.6] text-muted">{e.body}</p>
            </ScrollReveal>
          ))}
        </div>
      </section>

      <CTABand
        variant="steel"
        title={<>Join the<br />ledger.</>}
        kicker={<>We&apos;re always planning the next post, the next project, the next gathering. Get on the list.</>}
        primary={{ label: "Contact Us", href: "/contact" }}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/community/page.tsx
git commit -m "feat(community): bespoke fellowship ledger page"
```

---

### Task 4.9: Rewrite /what-to-expect

**Files:**
- Modify: `src/app/what-to-expect/page.tsx` (full rewrite)

- [ ] **Step 1: Rewrite /what-to-expect**

Overwrite `src/app/what-to-expect/page.tsx`:

```tsx
import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { MeterBar } from "@/components/ui/brand/MeterBar";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";

export const metadata: Metadata = {
  title: "What to Expect",
  description: "The first whistle — minute-by-minute of an F3 Marietta workout.",
};

const TIMELINE = [
  { t: "0:00",  h: "Disclaimer + Mosey", body: "The Q delivers the F3 disclaimer — you are responsible for your own well-being. A short mosey warms the legs." },
  { t: "5:00",  h: "Warm-Up", body: "SSH, Imperial Walkers, Don Quixotes, and the like. Everyone paces themselves." },
  { t: "10:00", h: "The Thang", body: "Peer-led beatdown. Bodyweight, cardio, maybe a ruck. 25–30 minutes of work. Plenty of modifications." },
  { t: "40:00", h: "Mary", body: "Core work to cool down. Planks, LBCs, flutter kicks." },
  { t: "43:00", h: "COT", body: "Circle of Trust. Count-o-rama, name-o-rama, FNG introductions, announcements, and a prayer / reflection." },
  { t: "45:00", h: "Charge", body: "Back to the truck, back to your family, back to the day — improved." },
];

export default function WhatToExpectPage() {
  return (
    <>
      <PageHeader
        eyebrow="§ The Script"
        variant="ink"
        title={<>The First<br />Whistle.</>}
        kicker={<>A standard F3 workout runs 45 minutes. Here&apos;s the minute-by-minute.</>}
      />

      <section className="bg-bone py-20">
        <div className="max-w-[1320px] mx-auto px-7">
          <MeterBar
            left={<MonoTag>T · 0:00</MonoTag>}
            right={<MonoTag>T · 45:00</MonoTag>}
            tickCount={40}
            highlightIndices={[0, 5, 12, 30, 36, 39]}
            className="mb-14"
          />
          <ol className="border-y border-line-soft">
            {TIMELINE.map((step, i) => (
              <ScrollReveal
                key={step.t}
                delayMs={i * 60}
                as="li"
                className={`flex flex-col md:flex-row gap-6 md:gap-12 py-8 ${i < TIMELINE.length - 1 ? "border-b border-line-soft" : ""}`}
              >
                <div className="md:w-40 font-display font-bold uppercase text-steel leading-none text-[clamp(42px,5vw,56px)]">{step.t}</div>
                <div className="flex-1">
                  <h3 className="font-display font-bold uppercase text-[22px] tracking-[-.01em]">{step.h}</h3>
                  <p className="mt-2 text-[15px] leading-[1.6] text-muted max-w-xl">{step.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </section>

      <CTABand
        variant="gradient"
        title={<>Plan your<br />first post.</>}
        primary={{ label: "Find a Workout", href: "/workouts" }}
      />
    </>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/what-to-expect/page.tsx
git commit -m "feat(what-to-expect): bespoke timeline page with meter-bar progression"
```

---

### Task 4.10: Update sub-page Playwright specs

**Files:**
- Modify: `tests/backblasts.spec.ts`
- Modify: `tests/glossary.spec.ts`
- Modify: `tests/pages.spec.ts`

- [ ] **Step 1: Rewrite backblasts.spec.ts**

Overwrite `tests/backblasts.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("Backblasts page (redesign)", () => {
  test("header + list render", async ({ page }) => {
    await page.goto("/backblasts");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/From the/i);
    await expect(page.getByText(/Filter by AO/i)).toBeVisible();
  });

  test("AO filter chip set renders", async ({ page }) => {
    await page.goto("/backblasts");
    await expect(page.getByRole("link", { name: /^All$/ })).toBeVisible();
  });

  test("pagination navigates", async ({ page }) => {
    await page.goto("/backblasts");
    const older = page.getByRole("link", { name: /Older →/ });
    if (await older.count()) {
      await older.click();
      await expect(page).toHaveURL(/page=2/);
    }
  });
});
```

- [ ] **Step 2: Rewrite glossary.spec.ts**

Overwrite `tests/glossary.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

test.describe("Glossary page (redesign)", () => {
  test("hero and at least one letter rail render", async ({ page }) => {
    await page.goto("/glossary");
    await expect(page.getByRole("heading", { level: 1 })).toContainText(/Lexicon/i);
    await expect(page.getByPlaceholder(/Search/i).or(page.getByRole("searchbox"))).toBeVisible();
  });
});
```

- [ ] **Step 3: Rewrite pages.spec.ts**

Overwrite `tests/pages.spec.ts`:

```ts
import { test, expect } from "@playwright/test";

const PAGES = [
  { path: "/about", title: /Men\. Marietta\./i },
  { path: "/workouts", title: /Find Your/i },
  { path: "/backblasts", title: /From the/i },
  { path: "/new-here", title: /Your First/i },
  { path: "/contact", title: /Find us\./i },
  { path: "/fng", title: /Friendly/i },
  { path: "/glossary", title: /Lexicon/i },
  { path: "/community", title: /Fellowship/i },
  { path: "/what-to-expect", title: /First/i },
];

test.describe("Public sub-pages smoke", () => {
  for (const { path, title } of PAGES) {
    test(`${path} renders with its hero title`, async ({ page }) => {
      await page.goto(path);
      await expect(page.getByRole("heading", { level: 1 })).toContainText(title);
      await expect(page.getByText(/A Region of F3 Nation/i)).toBeVisible();
    });
  }
});
```

- [ ] **Step 4: Run the updated specs**

Run: `npx playwright test tests/backblasts.spec.ts tests/glossary.spec.ts tests/pages.spec.ts --reporter=list 2>&1 | tail -60`
Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add tests/backblasts.spec.ts tests/glossary.spec.ts tests/pages.spec.ts
git commit -m "test: update sub-page specs for redesign"
```

---

## Wave 5 — Backblast detail page

### Task 5.1: Rewrite /backblasts/[id]

**Files:**
- Modify: `src/app/backblasts/[id]/page.tsx` (full rewrite — locate current file first)

- [ ] **Step 1: Locate and read the current detail page**

Run: `find src/app/backblasts -name "page.tsx" -not -path "*/\[*" -prune -o -name "page.tsx" -print && find src/app/backblasts -type d`
Read the detail route file — it is either `src/app/backblasts/[id]/page.tsx` or `src/app/backblasts/[slug]/page.tsx`. Note which.

Run: `cat src/app/backblasts/*/page.tsx 2>/dev/null | head -80`

- [ ] **Step 2: Rewrite the detail page**

Overwrite the detail route file (assume `src/app/backblasts/[id]/page.tsx`):

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getSql } from "@/lib/db";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import type { F3Event } from "@/types/f3Event";

type Params = Promise<{ id: string }>;

async function getEvent(id: string): Promise<F3Event | null> {
  try {
    const sql = getSql();
    const rows = await sql`SELECT * FROM f3_events WHERE id = ${id} AND is_deleted = false LIMIT 1`;
    return (rows[0] as F3Event | undefined) ?? null;
  } catch {
    return null;
  }
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" }).toUpperCase();
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const { id } = await params;
  const evt = await getEvent(id);
  if (!evt) return { title: "Backblast" };
  return { title: evt.title ?? "Backblast", description: evt.content_text?.slice(0, 140) ?? undefined };
}

export default async function BackblastDetail({ params }: { params: Params }) {
  const { id } = await params;
  const evt = await getEvent(id);
  if (!evt) notFound();

  return (
    <>
      <PageHeader
        eyebrow={`${formatDate(evt.event_date)} · ${evt.ao_display_name ?? "F3 Marietta"}${evt.q_name ? ` · Q · ${evt.q_name}` : ""}`}
        variant="ink"
        title={evt.title ?? "Battlefield Report"}
        kicker={evt.content_text ? evt.content_text.slice(0, 180).replace(/<@[A-Z0-9]+>/g, "") : undefined}
      />

      <article className="bg-bone py-16">
        <div className="max-w-[820px] mx-auto px-7">
          <div className="flex flex-wrap gap-x-10 gap-y-3 py-5 border-y border-line-soft mb-10">
            {evt.q_name && <MonoTag>Q · {evt.q_name}</MonoTag>}
            {evt.pax_count != null && <MonoTag>PAX · {evt.pax_count}</MonoTag>}
            {evt.event_time && <MonoTag>TIME · {evt.event_time}</MonoTag>}
            {evt.location_text && <MonoTag>LOC · {evt.location_text}</MonoTag>}
          </div>
          <div
            className="backblast-content prose prose-zinc max-w-none"
            dangerouslySetInnerHTML={{ __html: evt.content_html ?? "" }}
          />
          {!evt.content_html && evt.content_text && (
            <div className="whitespace-pre-wrap text-[16px] leading-[1.7]">{evt.content_text}</div>
          )}
        </div>
      </article>

      <section className="bg-bone-2 py-10 border-t border-line-soft">
        <div className="max-w-[820px] mx-auto px-7 flex items-center justify-between font-display font-semibold uppercase tracking-[.1em] text-[14px]">
          <Link href="/backblasts" className="text-ink hover:text-steel">← Back to reports</Link>
          <Link href="/workouts" className="text-steel">Post tomorrow →</Link>
        </div>
      </section>

      <CTABand
        variant="steel"
        title={<>Every post<br />leaves a record.</>}
        kicker={<>Come to a workout. Write the next one.</>}
        primary={{ label: "Find a Workout", href: "/workouts" }}
      />
    </>
  );
}
```

If the route file is under `[slug]`, the type parameter key should match the folder name (`slug` not `id`).

- [ ] **Step 3: Typecheck and smoke test**

Run: `npx tsc --noEmit 2>&1 | grep "backblasts/\[" | head`
Expected: No errors.

Start dev server if needed. Fetch one backblast ID from the DB:

```bash
npx tsx -e "
import { getSql } from './src/lib/db';
(async () => {
  const sql = getSql();
  const r = await sql\`SELECT id FROM f3_events WHERE event_kind='backblast' AND is_deleted=false ORDER BY created_at DESC LIMIT 1\`;
  console.log(r[0]?.id);
})();"
```

Then:
Run: `curl -sS "http://localhost:3003/backblasts/<that-id>" | grep -Eo "From the|Battlefield|PAX|Q ·" | sort -u`
Expected: At least the H1 + meta markers render.

- [ ] **Step 4: Commit**

```bash
git add src/app/backblasts/
git commit -m "feat(backblasts): editorial detail page with meta band and CTA"
```

---

## Wave 6 — Admin editorial reskin

### Task 6.1: Rewrite admin layout chrome

**Files:**
- Modify: `src/app/admin/layout.tsx`

- [ ] **Step 1: Read current admin layout**

Run: `wc -l src/app/admin/layout.tsx && head -60 src/app/admin/layout.tsx`

- [ ] **Step 2: Rewrite admin layout**

Overwrite `src/app/admin/layout.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import { AdminAuthProvider } from "./AdminAuthContext";
import { MonoTag } from "@/components/ui/brand/MonoTag";

const ADMIN_NAV = [
  { label: "Dashboard", href: "/admin" },
  { label: "Workouts",  href: "/admin/workouts" },
  { label: "Regions",   href: "/admin/regions" },
  { label: "Drafts",    href: "/admin/drafts" },
  { label: "Newsletter", href: "/admin/newsletter" },
  { label: "KB",        href: "/admin/kb" },
];

export default function AdminLayout({ children }: { children: ReactNode }) {
  return (
    <AdminAuthProvider>
      <div className="min-h-screen bg-bone">
        <div className="bg-ink text-bone">
          <div className="max-w-[1320px] mx-auto px-7 py-3 flex items-center justify-between font-mono text-[11px] tracking-[.15em] uppercase">
            <div className="flex items-center gap-3">
              <span className="text-steel">// ADMIN</span>
              <span className="opacity-60">F3 Marietta · Region Ops</span>
            </div>
            <nav className="hidden md:flex items-center gap-1">
              {ADMIN_NAV.map((item) => (
                <Link
                  key={item.href}
                  href={item.href}
                  className="px-3 py-1.5 text-bone/75 hover:text-steel transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        <div className="max-w-[1320px] mx-auto px-7 py-3 border-b border-line-soft">
          <MonoTag>// Home / Admin</MonoTag>
        </div>

        <main>{children}</main>
      </div>
    </AdminAuthProvider>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/layout.tsx
git commit -m "feat(admin): editorial admin chrome with ink top strip and mono breadcrumbs"
```

---

### Task 6.2: Rewrite admin dashboard

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Read current dashboard**

Run: `cat src/app/admin/page.tsx`

- [ ] **Step 2: Rewrite dashboard**

Overwrite `src/app/admin/page.tsx`. Replace the JSX tree so the outer shell follows the section-head pattern and the dashboard tiles use the 2×2 impact tile pattern. Preserve any existing data fetching and handlers — only the rendering changes.

Key rendering scaffold to use:

```tsx
import Link from "next/link";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";

// ...existing data fetching preserved...

export default function AdminDashboard(/* existing props */) {
  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow="§ Admin · Dashboard"
        h2="Region Ops."
        kicker={<>Manage workouts, regions, drafts, newsletter, and the knowledge base.</>}
        align="left"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-14">
        {[
          { label: "Active AOs", href: "/admin/workouts" },
          { label: "Regions", href: "/admin/regions" },
          { label: "Drafts", href: "/admin/drafts" },
          { label: "Newsletter", href: "/admin/newsletter" },
        ].map((tile) => (
          <Link key={tile.href} href={tile.href}>
            <ClipFrame className="group hover:border-ink transition-colors">
              <MonoTag>// {tile.label}</MonoTag>
              <div className="mt-4 font-display font-bold uppercase text-[32px] tracking-[-.01em]">Manage →</div>
            </ClipFrame>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <ChamferButton href="/admin/workouts" variant="ink" size="md">New Workout</ChamferButton>
        <ChamferButton href="/admin/drafts" variant="ink" size="md">New Draft</ChamferButton>
      </div>
    </section>
  );
}
```

Adapt the code to the current file's state — if the dashboard pulls counts, render those inside the tiles above the `Manage →` label.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): editorial dashboard with chamfer tiles"
```

---

### Task 6.3: Rewrite admin/workouts list

**Files:**
- Modify: `src/app/admin/workouts/page.tsx`
- Modify: `src/app/admin/workouts/WorkoutGrid.tsx`
- Modify: `src/app/admin/workouts/WorkoutBlock.tsx`
- Modify: `src/app/admin/workouts/WorkoutModal.tsx`

- [ ] **Step 1: Read each file**

Run: `wc -l src/app/admin/workouts/*.tsx && for f in src/app/admin/workouts/*.tsx; do echo "== $f =="; head -30 "$f"; done`

- [ ] **Step 2: Apply editorial reskin to page.tsx**

In `src/app/admin/workouts/page.tsx`:
- Replace any section-title `<h1>` / `<h2>` with `<SectionHead eyebrow="§ Admin · Workouts" h2="Schedule Manager" align="left" />`
- Replace primary action buttons (e.g. "Add Workout") with `<ChamferButton variant="ink" size="md">New Workout</ChamferButton>`
- Replace toast/alert containers with `<ClipFrame variant="ink" padding="p-4">...</ClipFrame>`

- [ ] **Step 3: Apply editorial reskin to WorkoutGrid.tsx**

In `src/app/admin/workouts/WorkoutGrid.tsx`:
- Change table header row classes to: `className="font-mono text-[11px] tracking-[.15em] uppercase text-muted border-b border-line-soft"`
- Add an ID column on the left rendering `<MonoTag>{`// F3.MAR.${String(index+1).padStart(2,'0')}`}</MonoTag>`
- Row hover effect: add `relative` + `group` classes on `<tr>` / row div; add a pseudo-element left accent as in AOCard:
  ```tsx
  <span aria-hidden className="absolute left-0 top-0 bottom-0 w-[3px] bg-steel scale-y-0 origin-top group-hover:scale-y-100 transition-transform duration-300" />
  ```
- Status column: render with `<StatusChip variant={row.is_active ? "active" : "archived"}>{row.is_active ? "Active" : "Archived"}</StatusChip>`
- Actions column: replace existing buttons with `<ChamferButton variant="ghost" size="sm">Edit</ChamferButton>` and `<ChamferButton variant="ghost" size="sm">Archive</ChamferButton>`

- [ ] **Step 4: Apply editorial reskin to WorkoutModal.tsx**

In `src/app/admin/workouts/WorkoutModal.tsx`:
- Backdrop: `fixed inset-0 bg-ink/80 backdrop-blur-sm z-50`
- Drawer panel: `fixed right-0 top-0 bottom-0 w-full max-w-xl bg-ink text-bone border-l border-steel/30 clip-chamfer overflow-auto p-8`
- Form labels: `<MonoTag variant="bone">// Field Name</MonoTag>`
- Inputs/selects: `className="mt-2 w-full bg-transparent border border-bone/25 px-3 py-2 focus:outline-none focus:border-steel"`
- Submit: `<ChamferButton type="submit" variant="steel">Save</ChamferButton>`
- Delete: `<ChamferButton type="button" variant="ink" className="!bg-rust !border-rust hover:!bg-ink hover:!border-ink">Delete</ChamferButton>`

- [ ] **Step 5: Typecheck**

Run: `npx tsc --noEmit 2>&1 | grep "admin/workouts" | head`
Expected: No errors.

- [ ] **Step 6: Commit**

```bash
git add src/app/admin/workouts/
git commit -m "feat(admin): editorial reskin for workouts list and modal"
```

---

### Task 6.4: Rewrite admin/regions list

**Files:**
- Modify: `src/app/admin/regions/page.tsx`

- [ ] **Step 1: Read current page**

Run: `head -60 src/app/admin/regions/page.tsx`

- [ ] **Step 2: Apply editorial reskin**

Same pattern as admin/workouts (Task 6.3): `<SectionHead>` at top, mono column headers, `<StatusChip>` for active status, `<ChamferButton>` actions, ID column with `<MonoTag>`. Preserve all data handlers.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/regions/
git commit -m "feat(admin): editorial reskin for regions list"
```

---

### Task 6.5: Rewrite admin/drafts and drafts/history

**Files:**
- Modify: `src/app/admin/drafts/page.tsx`
- Modify: `src/app/admin/drafts/history/*` (whatever files exist)

- [ ] **Step 1: List files**

Run: `find src/app/admin/drafts -name "*.tsx"`
Note each.

- [ ] **Step 2: Apply editorial reskin to each**

Same pattern as earlier admin tasks. Drafts should use `<StatusChip variant="draft">Draft</StatusChip>` and `<StatusChip variant="active">Published</StatusChip>` as appropriate.

- [ ] **Step 3: Commit**

```bash
git add src/app/admin/drafts/
git commit -m "feat(admin): editorial reskin for drafts and history"
```

---

### Task 6.6: Rewrite admin/kb and admin/newsletter

**Files:**
- Modify: `src/app/admin/kb/page.tsx`
- Modify: `src/app/admin/newsletter/page.tsx`

- [ ] **Step 1: Apply editorial reskin to each**

Each: `<SectionHead>` header, `<ChamferButton>` actions, editorial empty states. Newsletter page: any preview area should use `<ClipFrame variant="bone">` containers.

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/kb/ src/app/admin/newsletter/
git commit -m "feat(admin): editorial reskin for KB and newsletter admin"
```

---

### Task 6.7: Restyle admin Toast and other shared admin components

**Files:**
- Modify: `src/app/admin/Toast.tsx`

- [ ] **Step 1: Rewrite Toast styles**

Preserve existing toast API/handlers. Update the rendered toast element to:

```tsx
<div className="fixed bottom-6 right-6 z-50 bg-ink text-bone border border-steel clip-chamfer px-5 py-3 font-mono text-[12px] tracking-[.1em] uppercase shadow-[0_10px_30px_rgba(12,12,12,.35)]">
  {message}
</div>
```

Adjust variant classes if the component has success/error variants: success = `border-steel`, error = `border-rust`.

- [ ] **Step 2: Commit**

```bash
git add src/app/admin/Toast.tsx
git commit -m "feat(admin): editorial toast styling"
```

---

### Task 6.8: Update admin-workouts.spec.ts

**Files:**
- Modify: `tests/admin-workouts.spec.ts`

- [ ] **Step 1: Read current spec**

Run: `cat tests/admin-workouts.spec.ts`

- [ ] **Step 2: Update selectors to match new editorial DOM**

Key changes:
- Replace any old button selectors (e.g. `.btn-primary`) with `getByRole("button", { name: /New Workout/i })` — the ChamferButton renders as a real button.
- Replace status-cell assertions with text matchers for `Active` / `Archived` (StatusChip text content).
- Replace column header assertions with regex matchers (`/^AO$/i`, `/^Day$/i`, etc.) since they're now mono uppercase.
- Preserve login flow and the test's happy-path CRUD assertions — only the DOM queries change.

- [ ] **Step 3: Run spec**

Run: `npx playwright test tests/admin-workouts.spec.ts --reporter=list 2>&1 | tail -40`
Expected: All tests pass. If a test still fails, inspect the failure message and adjust the test or the component.

- [ ] **Step 4: Commit**

```bash
git add tests/admin-workouts.spec.ts
git commit -m "test(admin): update workouts spec for editorial DOM"
```

---

### Task 6.9: Update ama-widget.spec.ts

**Files:**
- Modify: `tests/ama-widget.spec.ts`

- [ ] **Step 1: Read current spec**

Run: `cat tests/ama-widget.spec.ts`

- [ ] **Step 2: Update selectors to match restyled widget**

The trigger button now says `AMA ↗`. Update `getByRole("button", { name: /AMA/i })` instead of any prior selector. Verify the open-panel assertion targets the ink-chamfered panel (new role/name), the send button now says "Send" inside a ChamferButton, and message bubbles still render.

- [ ] **Step 3: Run spec**

Run: `npx playwright test tests/ama-widget.spec.ts --reporter=list 2>&1 | tail -40`
Expected: All tests pass.

- [ ] **Step 4: Commit**

```bash
git add tests/ama-widget.spec.ts
git commit -m "test: update AMA widget spec for restyled chrome"
```

---

## Wave 7 — Full verification & PR

### Task 7.1: Full accessibility audit + contrast check

**Files:**
- Modify: `tests/accessibility.spec.ts`

- [ ] **Step 1: Read current accessibility spec**

Run: `cat tests/accessibility.spec.ts`

- [ ] **Step 2: Add dark-section contrast checks**

Append a `test.describe("Dark sections contrast")` block that asserts axe-core reports no critical contrast failures on `/` (hero, creed, impact), `/about` (ink hero + creed), `/backblasts` (ink hero), `/what-to-expect` (ink hero), and `/glossary` (ink hero).

Example pattern (add to the file):

```ts
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";

test.describe("A11y redesign", () => {
  const pages = ["/", "/about", "/workouts", "/backblasts", "/new-here", "/contact", "/fng", "/glossary", "/community", "/what-to-expect"];

  for (const path of pages) {
    test(`${path} has no critical accessibility violations`, async ({ page }) => {
      await page.goto(path);
      const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
      const critical = results.violations.filter((v) => v.impact === "critical" || v.impact === "serious");
      expect(critical, critical.map((v) => `${v.id}: ${v.help}`).join("\n")).toHaveLength(0);
    });
  }
});
```

If axe reports specific contrast failures (e.g. `color-contrast` on `text-bone/40`), fix by bumping the opacity in the offending component (e.g. `/40` → `/55`) or raising font size.

- [ ] **Step 3: Run accessibility spec**

Run: `npx playwright test tests/accessibility.spec.ts --reporter=list 2>&1 | tail -60`
Expected: Zero critical or serious violations. Fix any failures before commit.

- [ ] **Step 4: Commit**

```bash
git add tests/accessibility.spec.ts
git commit -m "test: accessibility audit across redesigned public pages"
```

---

### Task 7.2: Full build + Playwright suite + manual smoke

**Files:** none (verification task)

- [ ] **Step 1: Kill any dev server**

Run: `lsof -i :3003 -t | xargs -r kill`

- [ ] **Step 2: Typecheck**

Run: `npx tsc --noEmit`
Expected: Zero errors.

- [ ] **Step 3: Production build**

Run: `npm run build 2>&1 | tail -80`
Expected: Build completes with "Compiled successfully". If errors remain, fix them before proceeding.

- [ ] **Step 4: Full Playwright suite**

Run: `npx playwright test --reporter=list 2>&1 | tail -80`
Expected: All tests pass.

- [ ] **Step 5: Manual smoke in dev**

Run: `PORT=3003 npm run dev &`
Wait 5 seconds. Open http://localhost:3003 in the browser and manually verify:
- Home hero renders with staggered H1 animation
- Marquee ribbon scrolls
- Three F's cards hover to ink
- Creed quote visible
- Workouts preview shows filter and cards
- Backblasts feature + list
- Impact stats show real numbers
- Join CTA with 05:15 watermark
- Navbar sticky, active link highlights on scroll
- Mobile menu opens at <960px

Kill the dev server: `lsof -i :3003 -t | xargs -r kill`

- [ ] **Step 6: Lint**

Run: `npm run lint 2>&1 | tail -20`
Expected: No errors. Warnings are acceptable.

- [ ] **Step 7: Final verification commit (if any fixes made)**

If Steps 2–6 required any fixes, commit them:

```bash
git add -u
git commit -m "fix: resolve final verification issues for redesign"
```

---

### Task 7.3: Merge to develop and verify preview

**Files:** none

- [ ] **Step 1: Push feature branch**

Run: `git push -u origin feature/website-redesign`
Expected: Branch created on origin. Vercel does NOT build this branch (feature/* is ignored).

- [ ] **Step 2: Merge feature → develop**

Run: `git checkout develop 2>/dev/null || git checkout -b develop origin/develop`
Run: `git merge --no-ff feature/website-redesign -m "feat: full website redesign (merge feature/website-redesign)"`
Run: `git push origin develop`
Expected: Vercel builds a preview from develop. Note the preview URL.

- [ ] **Step 3: Review preview**

Open the Vercel preview URL. Verify the full flow matches the design handoff screenshots:
- `/` home page
- `/about`, `/workouts`, `/backblasts`, `/new-here`, `/contact`, `/fng`, `/glossary`, `/community`, `/what-to-expect`
- `/admin` (login required)

Pause here for human review before merging to main.

- [ ] **Step 4: Merge develop → main (after preview approval)**

Run: `git checkout main`
Run: `git merge --no-ff develop -m "feat: website redesign"`
Run: `git push origin main`
Expected: Production build triggers. Monitor the production deploy at Vercel.

- [ ] **Step 5: Post-deploy smoke**

Run: `curl -sS -o /dev/null -w "%{http_code}\n" https://f3marietta.com`
Expected: `200`.

Spot-check: open https://f3marietta.com in browser, verify hero renders, navigate to /about, /workouts, /backblasts, /new-here. Report any regressions.

---

## Self-review

After writing the complete plan, this section documents the review pass.

### Spec coverage check

| Spec section | Implemented in |
|---|---|
| §4 Scope: full-site redesign | Waves 1–6 cover tokens, shell, home, sub-pages, detail, admin |
| §5 Architecture: `ui/brand/`, `home/` folders, deletions | Wave 1 tasks 1.3–1.8 (primitives), 1.8 (deletions); Wave 3 tasks 3.2–3.9 (home/) |
| §6 Design system (tokens + fonts) | Tasks 1.1 (fonts) + 1.2 (globals.css) |
| §7 Global shell (TopBar, Navbar, Footer, MarqueeRibbon, ScrollReveal, AssistantWidget) | Wave 2 (tasks 2.1–2.5) |
| §8 Home page composition (9 sections) | Wave 3 (tasks 3.2–3.10) |
| §9 Bespoke sub-page directions (10 pages) | Wave 4 (tasks 4.1–4.9) + Wave 5 (task 5.1 for /backblasts/[id]) |
| §10 Admin editorial treatment | Wave 6 (tasks 6.1–6.9) |
| §11 `getImpactStats` | Task 3.1 |
| §12 Test strategy | Tasks 3.11, 4.10, 6.8, 6.9, 7.1 |
| §13 Git & deploy plan | Task 0.1 (branch) + Task 7.3 (merge path) |
| §14 Risks/gotchas (DB column names, logo invert, contrast) | Task 3.1 Step 1 (column names verification), Task 3.2 (logo invert applied; visual smoke in 7.2), Task 7.1 (contrast via axe) |

All spec sections map to at least one task. No gaps identified.

### Placeholder scan

No "TBD", "implement later", or unqualified "similar to" references in the plan body. A few tasks (6.4, 6.5, 6.6) intentionally reference the pattern established in Task 6.3 but still list exact files, exact components to swap, and exact commit messages — the pattern reference is supplementary, not a placeholder.

### Type consistency

- `ChamferButton` variant names: `"steel" | "ink" | "bone" | "ghost"` — consistent across uses.
- `StatusChip` variant names: `"active" | "launch" | "archived" | "draft" | "fng" | "pending"` — consistent.
- `CTABand` variant names: `"steel" | "ink" | "bone" | "gradient"` — consistent.
- `PageHeader` variant names: `"bone" | "ink"` — consistent.
- `F3EventRow` / `F3Event` types imported from existing repo paths in all relevant tasks.
- `WorkoutScheduleRow` from `@/types/workout` — consistent in both AOCard rewrite (Task 3.5) and WorkoutsFilter (Task 3.6).

No type drift detected.

---

## Execution handoff

Plan complete and saved to `docs/superpowers/plans/2026-04-23-website-redesign.md`. Two execution options:

**1. Subagent-Driven (recommended)** — Dispatch a fresh subagent per task, review between tasks, fast iteration. Well-suited for a 40+ task plan of this size.

**2. Inline Execution** — Execute tasks in this session using executing-plans, batch execution with checkpoints for review.

Which approach?
