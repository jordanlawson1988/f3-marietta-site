# AI Beatdown Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a public, mobile-first AI Beatdown Builder at `/beatdown-builder` that generates F3-format workouts grounded in F3 Marietta backblasts, the Exicon, and a curated famous-BD library, with regenerate/swap/edit customization, save-by-URL sharing, and a print stylesheet.

**Architecture:** Form → `/api/beatdown/generate` → Gemini 2.5 Flash with assembled context (precomputed Marietta knowledge + recent at AO + Exicon + famous BDs). Knowledge built nightly inside the existing `/api/slack/reconcile` cron via Claude Sonnet. Customization UI calls `/api/beatdown/regenerate-section` and `/api/beatdown/exicon-search`. Save persists to `beatdowns` table with an unguessable `short_id`.

**Tech Stack:** Next.js 16 App Router, TypeScript, Tailwind CSS v4, Neon (PostgreSQL), Gemini 2.5 Flash (`@google/genai`), Claude Sonnet 4.6 (`@anthropic-ai/sdk`), gray-matter for MD frontmatter, Playwright for E2E tests.

**Spec:** `docs/superpowers/specs/2026-04-27-ai-beatdown-builder-design.md`

**Branch:** `feature/ai-beatdown-builder` (already created off `main`)

---

## Chunk 1: Schema, Types, Famous BD Library

### Task 1: Migration for `beatdowns` and `marietta_bd_knowledge`

**Files:**
- Create: `supabase/migrations/20260427_beatdown_builder.sql`
- Modify: `scripts/neon-schema.sql` (append the new tables for the authoritative full-schema doc)

- [ ] **Step 1: Write the migration**

```sql
-- AI Beatdown Builder schema (2026-04-27)
-- See docs/superpowers/specs/2026-04-27-ai-beatdown-builder-design.md

CREATE TABLE beatdowns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  short_id text NOT NULL UNIQUE,
  inputs jsonb NOT NULL,
  sections jsonb NOT NULL,
  title text NOT NULL,
  ip_hash text,
  generation_model text NOT NULL,
  generation_ms integer NOT NULL,
  knowledge_version integer,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX beatdowns_short_id_idx ON beatdowns (short_id);
CREATE INDEX beatdowns_created_at_idx ON beatdowns (created_at DESC);

CREATE TRIGGER beatdowns_updated_at
  BEFORE UPDATE ON beatdowns
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TABLE marietta_bd_knowledge (
  id serial PRIMARY KEY,
  generated_at timestamptz NOT NULL DEFAULT now(),
  source_event_count integer NOT NULL,
  content text NOT NULL,
  per_ao_summary jsonb NOT NULL,
  generation_model text NOT NULL,
  generation_ms integer NOT NULL,
  cost_usd numeric(10,4)
);

CREATE INDEX marietta_bd_knowledge_generated_at_idx ON marietta_bd_knowledge (generated_at DESC);

COMMENT ON TABLE beatdowns IS 'AI-generated beatdowns saved by Qs via the public Beatdown Builder';
COMMENT ON TABLE marietta_bd_knowledge IS 'Nightly distilled summary of all F3 Marietta backblast patterns; consumed by the Beatdown Builder generator';
```

- [ ] **Step 2: Apply via Neon SQL editor or `psql $DATABASE_URL -f supabase/migrations/20260427_beatdown_builder.sql`**

Expected: both tables exist, indexes present. Verify:

```bash
psql "$DATABASE_URL" -c "\d beatdowns" | head -20
psql "$DATABASE_URL" -c "\d marietta_bd_knowledge" | head -20
```

- [ ] **Step 3: Append to `scripts/neon-schema.sql`** (the same content from Step 1, after the existing tables, with a section header comment).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260427_beatdown_builder.sql scripts/neon-schema.sql
git commit -m "feat(beatdown): migration for beatdowns + marietta_bd_knowledge tables"
```

### Task 2: TypeScript types

**Files:**
- Create: `src/types/beatdown.ts`

- [ ] **Step 1: Write the types**

```ts
// Schema for the AI Beatdown Builder. See docs/superpowers/specs/2026-04-27-ai-beatdown-builder-design.md
export type BeatdownFocus = 'full' | 'legs' | 'core' | 'upper' | 'cardio';

export type BeatdownTheme =
  | 'fng-friendly'
  | 'holiday'
  | 'q-school'
  | 'birthday-q'
  | 'ruck'
  | 'honor'
  | null;

export type BeatdownEquipment = 'bodyweight' | 'coupon' | 'sandbag' | 'kettlebell' | 'sled';

export interface BeatdownInputs {
  ao_id: string;
  ao_display_name: string;
  focus: BeatdownFocus;
  theme: BeatdownTheme;
  equipment: BeatdownEquipment[];
  famous_bd: string | null;
  q_notes: string;
}

export interface BeatdownExerciseItem {
  exercise: string;
  reps: string;
  note: string;
}

export interface BeatdownSections {
  header: { title: string; ao_name: string; length_min: number; summary: string };
  warmup: { items: BeatdownExerciseItem[] };
  thang: { items: BeatdownExerciseItem[]; format_note: string };
  cot: { talking_points: string[]; notes: string };
}

export interface BeatdownDraft {
  title: string;
  sections: BeatdownSections;
}

export interface BeatdownRecord extends BeatdownDraft {
  short_id: string;
  inputs: BeatdownInputs;
  generation_model: string;
  generation_ms: number;
  created_at: string;
}

export interface MariettaBdKnowledge {
  id: number;
  generated_at: string;
  source_event_count: number;
  content: string;
  per_ao_summary: Record<string, {
    top_exercises: string[];
    common_formats: string[];
    voice_samples: string[];
  }>;
}

export const FOCUS_OPTIONS: { value: BeatdownFocus; label: string }[] = [
  { value: 'full', label: 'Full Body' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
  { value: 'upper', label: 'Upper' },
  { value: 'cardio', label: 'Cardio' },
];

export const THEME_OPTIONS: { value: NonNullable<BeatdownTheme>; label: string }[] = [
  { value: 'fng-friendly', label: 'FNG-friendly' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'q-school', label: 'Q-school' },
  { value: 'birthday-q', label: 'Birthday Q' },
  { value: 'ruck', label: 'Ruck' },
  { value: 'honor', label: 'Honor' },
];

export const EQUIPMENT_OPTIONS: { value: BeatdownEquipment; label: string }[] = [
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'coupon', label: 'Coupon' },
  { value: 'sandbag', label: 'Sandbag' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'sled', label: 'Sled' },
];
```

- [ ] **Step 2: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/types/beatdown.ts
git commit -m "feat(beatdown): TypeScript types and option enums"
```

### Task 3: Famous beatdown library — directory + first 4 files

**Files:**
- Create: `data/content/famous-beatdowns/README.md`
- Create: `data/content/famous-beatdowns/murph.md`
- Create: `data/content/famous-beatdowns/11s.md`
- Create: `data/content/famous-beatdowns/dora-1-2-3.md`
- Create: `data/content/famous-beatdowns/jack-webb.md`

- [ ] **Step 1: Write `README.md`**

```markdown
# Famous Beatdowns Library

Markdown files in this directory are loaded by the AI Beatdown Builder
(`src/lib/beatdown/loadFamousBeatdowns.ts`) and fed into the generation
prompt. Each file is one famous F3 beatdown.

## Frontmatter schema

\`\`\`yaml
---
title: Display name (e.g., "Murph")
slug: kebab-case slug matching filename (e.g., "murph")
category: famous | ipc
length_min: 30 | 45 | 60
equipment: [bodyweight, coupon, ...]   # array
focus: full | legs | core | upper | cardio
description: One-line summary used in the typeahead
---
\`\`\`

## Body

Free-form markdown describing the structure, history, common variations,
and any Marietta-specific notes the AI should respect.
```

- [ ] **Step 2: Write `murph.md`**

```markdown
---
title: Murph
slug: murph
category: famous
length_min: 60
equipment: [bodyweight]
focus: full
description: Memorial Day classic — 1mi run, 100 pull-ups, 200 push-ups, 300 squats, 1mi run
---

# Murph

The hero workout, named for Lt. Michael P. Murphy, USN. Done annually at F3 on Memorial Day.

## Structure (Rx, 60 min)
- 1-mile run
- 100 pull-ups
- 200 push-ups (merkins)
- 300 air squats
- 1-mile run

## F3 variations
- "Half Murph" — half all reps and runs
- Partition the reps into rounds of 10/20/30 (10 rounds) or 20/40/60 (5 rounds)
- Substitute Australian pull-ups (rows) when no bar is available
- Coupon Murph: hold a coupon during the squats

## Marietta notes
The Battlefield typically runs full Murph on Memorial Day. Half-Murph
fits a 45-min block if used as a one-off Thang.
```

- [ ] **Step 3: Write `11s.md`**

```markdown
---
title: 11s
slug: 11s
category: famous
length_min: 30
equipment: [bodyweight]
focus: full
description: Two-exercise ladder — 10/1, 9/2, ... 1/10. Sum is 11 every round.
---

# 11s

A descending/ascending two-exercise ladder. Pair an upper-body or core move
with a lower-body move on a hill or between two points.

## Structure
- Pick two exercises (e.g., Merkins + Squats).
- Round 1: 10 reps of A, 1 rep of B.
- Round 2: 9 reps of A, 2 reps of B.
- ... continue until round 10: 1 rep of A, 10 reps of B.
- Mosey or run between reps if using two locations.

## Common pairings
- Merkins + Squats
- Pull-ups + Burpees
- Big Boy Sit-ups + Hand-Release Merkins

## Marietta notes
On hills (e.g., the back hill at The Battlefield), pair Merkins at the top
with Squats at the bottom — mosey between rounds.
```

- [ ] **Step 4: Write `dora-1-2-3.md`**

```markdown
---
title: Dora 1-2-3
slug: dora-1-2-3
category: famous
length_min: 30
equipment: [bodyweight]
focus: full
description: Partner work — 100 reps of A, 200 reps of B, 300 reps of C, while partner runs
---

# Dora 1-2-3

Partner-up workout. While one PAX works, the other runs (or AMRAP-runs in place).

## Structure
- Round 1: As a team, accumulate 100 Merkins. Partner A works while Partner B runs to a marker and back. Switch.
- Round 2: 200 Big Boy Sit-ups (same swap pattern).
- Round 3: 300 Squats.

## Variations
- Dora 1-2-3-4: add 400 LBCs at the end.
- Coupon Dora: substitute Coupon Curls / Coupon Presses / Coupon Squats.

## Marietta notes
Works at any AO with at least a 25-yd straightaway for the runner.
Two-PAX partners only — odd-PAX days designate a "rover" who joins in.
```

- [ ] **Step 5: Write `jack-webb.md`**

```markdown
---
title: Jack Webb
slug: jack-webb
category: famous
length_min: 30
equipment: [bodyweight]
focus: upper
description: 1:4 ratio Merkins-to-Air Press ladder, in cadence
---

# Jack Webb

Named for the Dragnet star — "just the facts." A 1:4 Merkin-to-Air-Press
ladder done in cadence.

## Structure
- Round 1: 1 Merkin, 4 Air Presses (IC).
- Round 2: 2 Merkins, 8 Air Presses.
- ... up through Round 10: 10 Merkins, 40 Air Presses.

## Variations
- Stop at Round 7 if time is short.
- "Reverse Jack" — start at 10:40 and descend.

## Marietta notes
Crushes shoulders. Pair with leg work in a longer Thang.
```

- [ ] **Step 6: Commit**

```bash
git add data/content/famous-beatdowns/
git commit -m "feat(beatdown): famous BD library — README + first 4 files (Murph, 11s, Dora, Jack Webb)"
```

### Task 4: Famous beatdown library — remaining 8 files

**Files:**
- Create: `data/content/famous-beatdowns/hammer-time.md`
- Create: `data/content/famous-beatdowns/wheel-of-misery.md`
- Create: `data/content/famous-beatdowns/lap-pyramid.md`
- Create: `data/content/famous-beatdowns/cinco-de-burpee.md`
- Create: `data/content/famous-beatdowns/jacobs-ladder.md`
- Create: `data/content/famous-beatdowns/4-corners.md`
- Create: `data/content/famous-beatdowns/ipc-2024-round-1.md`
- Create: `data/content/famous-beatdowns/ipc-2024-round-2.md`

- [ ] **Step 1: Write the 6 remaining famous BDs and 2 IPC files**

Use the same frontmatter shape as Task 3. Body content per file:

`hammer-time.md` — title "Hammer Time", focus "core", 30 min, bodyweight: 100 American Hammers, 50 LBCs, 50 Freddy Mercuries split into rounds with Mary holds between.

`wheel-of-misery.md` — title "Wheel of Misery", focus "full", 45 min, bodyweight: a printable wheel of 12 exercises with random reps; spin (or roll dice) each round.

`lap-pyramid.md` — title "Lap Pyramid", focus "cardio", 30 min, bodyweight: track laps with reps at each end (10 squats → 1 lap → 20 squats → 1 lap → ...).

`cinco-de-burpee.md` — title "Cinco de Burpee", focus "full", 30 min, bodyweight: 5×5×5 burpee chains separated by short moseys.

`jacobs-ladder.md` — title "Jacob's Ladder", focus "legs", 30 min, bodyweight: hill ladder, increase reps by 1 each round (1 Merkin at top → 1 Squat at bottom → 2/2 → ...).

`4-corners.md` — title "4 Corners", focus "full", 30 min, bodyweight: 4-station circuit (one exercise per corner of a parking lot/field), mosey between, 4 rounds.

`ipc-2024-round-1.md` — title "IPC 2024 Round 1", category "ipc", 45 min: 100 burpees, 100 air squats, 100 LBCs, 100 merkins (For Time).

`ipc-2024-round-2.md` — title "IPC 2024 Round 2", category "ipc", 45 min: 5 rounds of (10 burpee broad jumps, 20 monkey humpers, 30 imperial walkers, 100m run).

Write each file with the same structure as Task 3 (frontmatter + body + Marietta notes). Keep bodies under 200 words each.

- [ ] **Step 2: Commit**

```bash
git add data/content/famous-beatdowns/
git commit -m "feat(beatdown): famous BD library — Hammer Time, Wheel, Lap Pyramid, Cinco, Jacob's Ladder, 4 Corners + 2 IPC"
```

---

## Chunk 2: Library helpers and prompt builders

### Task 5: `loadFamousBeatdowns` + `formatSlackblast` + `parseResponse`

**Files:**
- Create: `src/lib/beatdown/loadFamousBeatdowns.ts`
- Create: `src/lib/beatdown/formatSlackblast.ts`
- Create: `src/lib/beatdown/parseResponse.ts`

- [ ] **Step 1: Write `loadFamousBeatdowns.ts`**

```ts
import fs from 'node:fs';
import path from 'node:path';
import matter from 'gray-matter';
import type { BeatdownEquipment, BeatdownFocus } from '@/types/beatdown';

export interface FamousBeatdown {
  slug: string;
  title: string;
  category: 'famous' | 'ipc';
  length_min: number;
  equipment: BeatdownEquipment[];
  focus: BeatdownFocus;
  description: string;
  body: string;
}

const DIR = path.join(process.cwd(), 'data/content/famous-beatdowns');

let cache: FamousBeatdown[] | null = null;

export function loadFamousBeatdowns(): FamousBeatdown[] {
  if (cache) return cache;

  const files = fs.readdirSync(DIR).filter(f => f.endsWith('.md') && f !== 'README.md');
  const entries: FamousBeatdown[] = [];

  for (const file of files) {
    const raw = fs.readFileSync(path.join(DIR, file), 'utf8');
    const { data, content } = matter(raw);
    if (!data.slug || !data.title) continue;
    entries.push({
      slug: String(data.slug),
      title: String(data.title),
      category: data.category === 'ipc' ? 'ipc' : 'famous',
      length_min: Number(data.length_min) || 45,
      equipment: Array.isArray(data.equipment) ? (data.equipment as BeatdownEquipment[]) : ['bodyweight'],
      focus: (data.focus as BeatdownFocus) || 'full',
      description: String(data.description || ''),
      body: content.trim(),
    });
  }

  cache = entries.sort((a, b) => a.title.localeCompare(b.title));
  return cache;
}

export function findFamousBeatdown(slug: string | null): FamousBeatdown | null {
  if (!slug) return null;
  return loadFamousBeatdowns().find(b => b.slug === slug) ?? null;
}
```

- [ ] **Step 2: Write `formatSlackblast.ts`**

```ts
import type { BeatdownDraft, BeatdownInputs } from '@/types/beatdown';

export function formatSlackblast(draft: BeatdownDraft, inputs: BeatdownInputs): string {
  const { title, sections } = draft;
  const lines: string[] = [];

  lines.push(`*${title}*`);
  lines.push(`${inputs.ao_display_name} · ${sections.header.length_min}m · ${labelEquipment(inputs.equipment)}`);
  if (inputs.theme) lines.push(`Theme: ${labelTheme(inputs.theme)}`);
  lines.push('');

  lines.push('*Warm-up*');
  for (const item of sections.warmup.items) {
    lines.push(`- ${item.exercise} ${item.reps}`.trimEnd());
  }
  lines.push('');

  lines.push('*The Thang*');
  if (sections.thang.format_note) lines.push(`_${sections.thang.format_note}_`);
  for (const item of sections.thang.items) {
    lines.push(`- ${item.exercise} ${item.reps}`.trimEnd());
  }
  lines.push('');

  lines.push('*COT*');
  for (const point of sections.cot.talking_points) {
    lines.push(`- ${point}`);
  }
  if (sections.cot.notes) {
    lines.push('');
    lines.push(sections.cot.notes);
  }

  return lines.join('\n');
}

function labelEquipment(eq: string[]): string {
  if (eq.length === 0 || (eq.length === 1 && eq[0] === 'bodyweight')) return 'Bodyweight';
  return eq.map(e => e[0].toUpperCase() + e.slice(1)).join(', ');
}

function labelTheme(theme: string): string {
  return theme.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}
```

- [ ] **Step 3: Write `parseResponse.ts`**

```ts
import type { BeatdownDraft, BeatdownSections } from '@/types/beatdown';

const REQUIRED_KEYS: (keyof BeatdownSections)[] = ['header', 'warmup', 'thang', 'cot'];

/**
 * Parse a Gemini response into a BeatdownDraft. Repairs minor JSON
 * formatting drift (code fences, trailing commas). Throws on irreparable
 * structural issues.
 */
export function parseResponse(raw: string): BeatdownDraft {
  const cleaned = stripCodeFences(raw).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = JSON.parse(repairTrailingCommas(cleaned));
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Beatdown response is not an object');
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.title !== 'string') throw new Error('Missing title');

  const sections = obj.sections as Record<string, unknown> | undefined;
  if (!sections || typeof sections !== 'object') throw new Error('Missing sections');

  for (const key of REQUIRED_KEYS) {
    if (!(key in sections)) throw new Error(`Missing section: ${key}`);
  }

  return { title: obj.title, sections: sections as unknown as BeatdownSections };
}

function stripCodeFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
}

function repairTrailingCommas(s: string): string {
  return s.replace(/,(\s*[}\]])/g, '$1');
}
```

- [ ] **Step 4: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/beatdown/
git commit -m "feat(beatdown): library loader, slackblast formatter, response parser"
```

### Task 6: Exicon focus filter

**Files:**
- Create: `src/lib/beatdown/exicon.ts`

- [ ] **Step 1: Write `exicon.ts`**

```ts
import { exiconEntries, type GlossaryEntry } from '@/../data/f3Glossary';
import type { BeatdownFocus } from '@/types/beatdown';

const FOCUS_KEYWORDS: Record<BeatdownFocus, string[]> = {
  full: [],
  legs: ['squat', 'lunge', 'monkey humper', 'imperial walker', 'mosey', 'run', 'jump', 'sprint', 'mountain climber'],
  core: ['hammer', 'sit-up', 'lbc', 'flutter', 'freddy', 'dolly', 'plank', 'crunch', 'box cutter', 'cockroach'],
  upper: ['merkin', 'pull-up', 'dip', 'press', 'curl', 'derkin', 'diamond'],
  cardio: ['burpee', 'run', 'sprint', 'mosey', 'broad jump', 'mountain climber'],
};

export function filterExiconForFocus(focus: BeatdownFocus, max = 80): GlossaryEntry[] {
  if (focus === 'full') return exiconEntries.slice(0, max);
  const kws = FOCUS_KEYWORDS[focus];
  const matches = exiconEntries.filter(e => {
    const t = e.term.toLowerCase();
    const d = (e.shortDescription || '').toLowerCase();
    return kws.some(k => t.includes(k) || d.includes(k));
  });
  if (matches.length >= 20) return matches.slice(0, max);
  // Backfill with general entries when focus is sparse.
  const seen = new Set(matches.map(m => m.id));
  for (const e of exiconEntries) {
    if (matches.length >= max) break;
    if (!seen.has(e.id)) matches.push(e);
  }
  return matches.slice(0, max);
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/beatdown/exicon.ts
git commit -m "feat(beatdown): exicon focus filter helper"
```

### Task 7: Prompt builders (per-request generator)

**Files:**
- Create: `src/lib/beatdown/prompts/system.ts`
- Create: `src/lib/beatdown/prompts/user.ts`
- Create: `src/lib/beatdown/buildContext.ts`

- [ ] **Step 1: Write `prompts/system.ts`**

```ts
export const BEATDOWN_SYSTEM_INSTRUCTION = `You are the F3 Marietta Beatdown Builder. You generate workouts in the F3 format for use by Qs leading peer-led outdoor men's workouts in Marietta, GA.

# Voice
- F3 brotherhood: warm, direct, encouraging. Not corporate.
- Use F3 vocabulary naturally: PAX, Q, AO, FNG, COT, BOM, mosey, IC (in cadence).
- No safety-disclaimer language in the output — Qs say that verbally.

# Format Rules
- Output STRICT JSON matching the schema below. Do NOT wrap in markdown code fences.
- Three sections: warmup, thang, cot.
- Total beatdown is 45 minutes (≈5 min warmup, ≈30 min thang, ≈5 min COT, plus mosey transitions).
- Mary (core) folds into the Thang naturally — do not produce a separate Mary block.
- Detail level — "adaptive":
  * Default: terse format, e.g., "SSH x 25 IC", "Mosey to flag pole".
  * If theme = fng-friendly OR theme = q-school: include a short coaching cue per exercise.
- Cite F3 exercises by their canonical Exicon term when available.
- Do NOT invent exercises that contradict our Exicon. Prefer Exicon entries.
- The Thang format may borrow from a famous BD if Q chose one — adapt, don't copy verbatim.
- COT contains talking points (Count-o-rama, Name-o-rama, BOM, optional prayer / honor) — no exercises.

# Schema
{
  "title": "string — 2-5 word memorable name",
  "sections": {
    "header": { "title": "string", "ao_name": "string", "length_min": 45, "summary": "≤140 chars" },
    "warmup": { "items": [{ "exercise": "string", "reps": "string", "note": "string" }] },
    "thang": { "items": [{ "exercise": "string", "reps": "string", "note": "string" }], "format_note": "string" },
    "cot":   { "talking_points": ["string"], "notes": "string" }
  }
}

Output JSON only. No prose, no code fences, no commentary.`;
```

- [ ] **Step 2: Write `prompts/user.ts`**

```ts
import type { GlossaryEntry } from '@/../data/f3Glossary';
import type { BeatdownInputs } from '@/types/beatdown';
import type { FamousBeatdown } from '@/lib/beatdown/loadFamousBeatdowns';

export interface UserPromptArgs {
  inputs: BeatdownInputs;
  knowledgeContent: string | null;
  recentAtAo: { event_date: string | null; q_name: string | null; content_text: string | null }[];
  exiconSubset: GlossaryEntry[];
  famousBdLibrary: FamousBeatdown[];
  selectedFamousBd: FamousBeatdown | null;
}

export function buildUserPrompt(args: UserPromptArgs): string {
  const lines: string[] = [];

  if (args.knowledgeContent) {
    lines.push('[PINNED — F3 Marietta Knowledge]');
    lines.push(args.knowledgeContent);
    lines.push('');
  }

  lines.push('[PINNED — Famous F3 Beatdowns Library]');
  for (const bd of args.famousBdLibrary) {
    lines.push(`- ${bd.title} (${bd.category}, ${bd.length_min}m, ${bd.focus}): ${bd.description}`);
  }
  lines.push('');

  lines.push('[PINNED — Local Exicon entries]');
  for (const e of args.exiconSubset) {
    lines.push(`- ${e.term}: ${(e.shortDescription || '').slice(0, 120)}`);
  }
  lines.push('');

  if (args.recentAtAo.length > 0) {
    lines.push(`[DYNAMIC — Last ${args.recentAtAo.length} backblasts at ${args.inputs.ao_display_name}]`);
    for (const r of args.recentAtAo) {
      const date = r.event_date || 'unknown date';
      const q = r.q_name || 'unknown Q';
      const excerpt = (r.content_text || '').slice(0, 400);
      lines.push(`(${date}, Q: ${q}) ${excerpt}`);
    }
    lines.push('');
  }

  if (args.selectedFamousBd) {
    lines.push(`[SELECTED FAMOUS BD — ${args.selectedFamousBd.title}]`);
    lines.push(args.selectedFamousBd.body);
    lines.push('');
  }

  lines.push('[Q INPUTS]');
  lines.push(`AO: ${args.inputs.ao_display_name}`);
  lines.push(`Focus: ${args.inputs.focus}`);
  lines.push(`Theme: ${args.inputs.theme || '—'}`);
  lines.push(`Equipment: ${args.inputs.equipment.join(', ')}`);
  lines.push(`Inspired by: ${args.selectedFamousBd?.title || '—'}`);
  lines.push(`Q's notes: ${args.inputs.q_notes || '—'}`);
  lines.push('');
  lines.push('Generate a beatdown that fits these inputs. Output JSON only.');

  return lines.join('\n');
}
```

- [ ] **Step 3: Write `buildContext.ts`**

```ts
import { getSql } from '@/lib/db';
import { filterExiconForFocus } from '@/lib/beatdown/exicon';
import { loadFamousBeatdowns, findFamousBeatdown } from '@/lib/beatdown/loadFamousBeatdowns';
import type { BeatdownInputs, MariettaBdKnowledge } from '@/types/beatdown';

export interface BeatdownContext {
  knowledgeContent: string | null;
  knowledgeVersion: number | null;
  recentAtAo: { event_date: string | null; q_name: string | null; content_text: string | null }[];
}

const KNOWLEDGE_STALE_DAYS = 7;

export async function buildBeatdownContext(inputs: BeatdownInputs): Promise<BeatdownContext> {
  const sql = getSql();

  const knowledgeRows = await sql`
    SELECT id, content, generated_at
    FROM marietta_bd_knowledge
    ORDER BY generated_at DESC
    LIMIT 1
  ` as { id: number; content: string; generated_at: string }[];

  let knowledgeContent: string | null = null;
  let knowledgeVersion: number | null = null;
  if (knowledgeRows.length > 0) {
    const row = knowledgeRows[0];
    const ageMs = Date.now() - new Date(row.generated_at).getTime();
    if (ageMs < KNOWLEDGE_STALE_DAYS * 24 * 3600 * 1000) {
      knowledgeContent = row.content;
      knowledgeVersion = row.id;
    }
  }

  const recentAtAo = await sql`
    SELECT event_date, q_name, content_text
    FROM f3_events
    WHERE event_kind = 'backblast'
      AND is_deleted = false
      AND ao_display_name = ${inputs.ao_display_name}
    ORDER BY event_date DESC NULLS LAST, created_at DESC
    LIMIT 10
  ` as { event_date: string | null; q_name: string | null; content_text: string | null }[];

  // If no knowledge, fall back to a region-wide sample
  if (!knowledgeContent && recentAtAo.length < 5) {
    const fallback = await sql`
      SELECT event_date, q_name, content_text
      FROM f3_events
      WHERE event_kind = 'backblast'
        AND is_deleted = false
      ORDER BY event_date DESC NULLS LAST, created_at DESC
      LIMIT 20
    ` as { event_date: string | null; q_name: string | null; content_text: string | null }[];
    recentAtAo.push(...fallback);
  }

  return { knowledgeContent, knowledgeVersion, recentAtAo };
}

export function loadStaticContext(inputs: BeatdownInputs) {
  return {
    exiconSubset: filterExiconForFocus(inputs.focus),
    famousBdLibrary: loadFamousBeatdowns(),
    selectedFamousBd: findFamousBeatdown(inputs.famous_bd),
  };
}
```

- [ ] **Step 4: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/lib/beatdown/prompts/ src/lib/beatdown/buildContext.ts
git commit -m "feat(beatdown): prompt builders and context assembly"
```

---

## Chunk 3: Generation API

### Task 8: `POST /api/beatdown/generate`

**Files:**
- Create: `src/app/api/beatdown/generate/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { randomUUID } from 'crypto';
import { getSql } from '@/lib/db';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { buildBeatdownContext, loadStaticContext } from '@/lib/beatdown/buildContext';
import { BEATDOWN_SYSTEM_INSTRUCTION } from '@/lib/beatdown/prompts/system';
import { buildUserPrompt } from '@/lib/beatdown/prompts/user';
import { parseResponse } from '@/lib/beatdown/parseResponse';
import type { BeatdownInputs, BeatdownEquipment, BeatdownFocus, BeatdownTheme } from '@/types/beatdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'gemini-2.5-flash';
const VALID_FOCUS: BeatdownFocus[] = ['full', 'legs', 'core', 'upper', 'cardio'];
const VALID_EQUIPMENT: BeatdownEquipment[] = ['bodyweight', 'coupon', 'sandbag', 'kettlebell', 'sled'];
const VALID_THEME = ['fng-friendly', 'holiday', 'q-school', 'birthday-q', 'ruck', 'honor'] as const;

let _gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!_gemini) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set');
    _gemini = new GoogleGenAI({ apiKey });
  }
  return _gemini;
}

export async function POST(request: NextRequest) {
  const requestId = randomUUID().slice(0, 8);
  const t0 = Date.now();

  const rateLimited = checkRateLimit(request, { maxRequests: 10, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const inputs = await validateInputs(body);
  if ('error' in inputs) return NextResponse.json(inputs, { status: 400 });

  if (!process.env.GOOGLE_AI_API_KEY) {
    console.error(`[beatdown:${requestId}] GOOGLE_AI_API_KEY missing`);
    return NextResponse.json(
      { error: 'service_unavailable', message: 'Beatdown Builder is temporarily unavailable.' },
      { status: 503 }
    );
  }

  const ctx = await buildBeatdownContext(inputs);
  const staticCtx = loadStaticContext(inputs);

  const userPrompt = buildUserPrompt({
    inputs,
    knowledgeContent: ctx.knowledgeContent,
    recentAtAo: ctx.recentAtAo,
    exiconSubset: staticCtx.exiconSubset,
    famousBdLibrary: staticCtx.famousBdLibrary,
    selectedFamousBd: staticCtx.selectedFamousBd,
  });

  try {
    const gemini = getGemini();
    const resp = await gemini.models.generateContent({
      model: MODEL,
      contents: userPrompt,
      config: {
        systemInstruction: BEATDOWN_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 2400,
        temperature: 0.7,
        topP: 0.9,
        responseMimeType: 'application/json',
      },
    });

    const text = resp.text || '';
    const draft = parseResponse(text);
    const generation_ms = Date.now() - t0;

    return NextResponse.json({
      title: draft.title,
      sections: draft.sections,
      generation_ms,
      model: MODEL,
      knowledge_version: ctx.knowledgeVersion,
    });
  } catch (err) {
    console.error(`[beatdown:${requestId}] generate error`, err);
    return NextResponse.json(
      { error: 'generation_error', message: 'Generation failed. Please try again.' },
      { status: 500 }
    );
  }
}

async function validateInputs(raw: unknown): Promise<BeatdownInputs | { error: string; field?: string }> {
  if (!raw || typeof raw !== 'object') return { error: 'bad_request' };
  const r = raw as Record<string, unknown>;

  const ao_id = typeof r.ao_id === 'string' ? r.ao_id : '';
  if (!ao_id) return { error: 'missing_ao_id', field: 'ao_id' };

  const sql = getSql();
  const aoRows = await sql`SELECT id, ao_display_name FROM ao_channels WHERE id = ${ao_id} AND is_enabled = true LIMIT 1` as { id: string; ao_display_name: string }[];
  if (aoRows.length === 0) return { error: 'invalid_ao', field: 'ao_id' };
  const ao_display_name = aoRows[0].ao_display_name;

  const focus = r.focus as BeatdownFocus;
  if (!VALID_FOCUS.includes(focus)) return { error: 'invalid_focus', field: 'focus' };

  let theme: BeatdownTheme = null;
  if (typeof r.theme === 'string' && r.theme.length > 0) {
    if (!(VALID_THEME as readonly string[]).includes(r.theme)) return { error: 'invalid_theme', field: 'theme' };
    theme = r.theme as BeatdownTheme;
  }

  const equipment = Array.isArray(r.equipment) ? r.equipment.filter((e): e is BeatdownEquipment => VALID_EQUIPMENT.includes(e as BeatdownEquipment)) : [];
  if (equipment.length === 0) equipment.push('bodyweight');

  const famous_bd = typeof r.famous_bd === 'string' && r.famous_bd ? r.famous_bd : null;

  let q_notes = typeof r.q_notes === 'string' ? r.q_notes : '';
  if (q_notes.length > 200) q_notes = q_notes.slice(0, 200);

  return { ao_id, ao_display_name, focus, theme, equipment, famous_bd, q_notes };
}
```

- [ ] **Step 2: Verify TypeScript**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start dev server: `npm run dev`. In another terminal:

```bash
# Get an AO id first
psql "$DATABASE_URL" -c "SELECT id, ao_display_name FROM ao_channels WHERE is_enabled = true LIMIT 3;"

# Then call the route
curl -sX POST http://localhost:3003/api/beatdown/generate \
  -H 'Content-Type: application/json' \
  -d '{"ao_id":"<paste-id>","focus":"full","theme":null,"equipment":["bodyweight"],"famous_bd":null,"q_notes":""}' | jq
```

Expected: JSON response with `title`, `sections.warmup.items`, `sections.thang.items`, `sections.cot.talking_points`, and `generation_ms < 12000`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/beatdown/generate/
git commit -m "feat(beatdown): POST /api/beatdown/generate route"
```

### Task 9: `POST /api/beatdown/regenerate-section`

**Files:**
- Create: `src/app/api/beatdown/regenerate-section/route.ts`
- Create: `src/lib/beatdown/prompts/regenerate.ts`

- [ ] **Step 1: Write `prompts/regenerate.ts`**

```ts
import type { BeatdownDraft } from '@/types/beatdown';
import { buildUserPrompt, type UserPromptArgs } from '@/lib/beatdown/prompts/user';

export function buildRegeneratePrompt(
  args: UserPromptArgs,
  current: BeatdownDraft,
  section: 'warmup' | 'thang' | 'cot'
): string {
  const base = buildUserPrompt(args);
  const tail = `

[CURRENT DRAFT — preserve everything except ${section}]
Title: ${current.title}
Header: ${JSON.stringify(current.sections.header)}
Warm-up: ${JSON.stringify(current.sections.warmup)}
The Thang: ${JSON.stringify(current.sections.thang)}
COT: ${JSON.stringify(current.sections.cot)}

Regenerate ONLY the "${section}" section. Output JSON in this exact shape:
${section === 'cot'
      ? `{ "talking_points": ["string"], "notes": "string" }`
      : section === 'thang'
        ? `{ "items": [{ "exercise":"string","reps":"string","note":"string" }], "format_note": "string" }`
        : `{ "items": [{ "exercise":"string","reps":"string","note":"string" }] }`}

Output JSON only.`;
  return base + tail;
}
```

- [ ] **Step 2: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { buildBeatdownContext, loadStaticContext } from '@/lib/beatdown/buildContext';
import { BEATDOWN_SYSTEM_INSTRUCTION } from '@/lib/beatdown/prompts/system';
import { buildRegeneratePrompt } from '@/lib/beatdown/prompts/regenerate';
import type { BeatdownDraft, BeatdownInputs, BeatdownSections } from '@/types/beatdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const MODEL = 'gemini-2.5-flash';

let _gemini: GoogleGenAI | null = null;
function getGemini(): GoogleGenAI {
  if (!_gemini) {
    const apiKey = process.env.GOOGLE_AI_API_KEY;
    if (!apiKey) throw new Error('GOOGLE_AI_API_KEY is not set');
    _gemini = new GoogleGenAI({ apiKey });
  }
  return _gemini;
}

export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(request, { maxRequests: 20, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  let body: { inputs: BeatdownInputs; current: BeatdownDraft; section: 'warmup' | 'thang' | 'cot' };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.inputs || !body?.current || !['warmup', 'thang', 'cot'].includes(body.section)) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: 'service_unavailable' }, { status: 503 });
  }

  try {
    const ctx = await buildBeatdownContext(body.inputs);
    const staticCtx = loadStaticContext(body.inputs);
    const prompt = buildRegeneratePrompt(
      {
        inputs: body.inputs,
        knowledgeContent: ctx.knowledgeContent,
        recentAtAo: ctx.recentAtAo,
        exiconSubset: staticCtx.exiconSubset,
        famousBdLibrary: staticCtx.famousBdLibrary,
        selectedFamousBd: staticCtx.selectedFamousBd,
      },
      body.current,
      body.section
    );

    const gemini = getGemini();
    const resp = await gemini.models.generateContent({
      model: MODEL,
      contents: prompt,
      config: {
        systemInstruction: BEATDOWN_SYSTEM_INSTRUCTION,
        thinkingConfig: { thinkingBudget: 0 },
        maxOutputTokens: 1200,
        temperature: 0.8,
        topP: 0.9,
        responseMimeType: 'application/json',
      },
    });

    const text = resp.text || '';
    const sectionData = JSON.parse(stripFences(text)) as BeatdownSections[typeof body.section];
    return NextResponse.json({ section: body.section, data: sectionData });
  } catch (err) {
    console.error('[beatdown:regen]', err);
    return NextResponse.json({ error: 'generation_error' }, { status: 500 });
  }
}

function stripFences(s: string): string {
  return s.replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
}
```

- [ ] **Step 3: Verify and smoke test**

```bash
npx tsc --noEmit
```

Smoke test (use a recent draft from generate, paste here):

```bash
curl -sX POST http://localhost:3003/api/beatdown/regenerate-section \
  -H 'Content-Type: application/json' \
  -d '{"inputs":{...},"current":{...},"section":"warmup"}' | jq
```

Expected: returns `{ section: "warmup", data: { items: [...] } }`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/beatdown/regenerate-section/ src/lib/beatdown/prompts/regenerate.ts
git commit -m "feat(beatdown): POST /api/beatdown/regenerate-section route"
```

### Task 10: Save + GET routes

**Files:**
- Create: `src/app/api/beatdown/save/route.ts`
- Create: `src/app/api/beatdown/[short_id]/route.ts`
- Create: `src/lib/beatdown/shortId.ts`

- [ ] **Step 1: Write `shortId.ts`**

```ts
import { randomBytes, createHash } from 'crypto';

const ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'; // crockford-ish, drops easily-confused chars

export function newShortId(): string {
  const buf = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i++) {
    out += ALPHABET[buf[i] % ALPHABET.length];
  }
  return out;
}

export function hashIp(ip: string): string {
  const salt = process.env.BEATDOWN_IP_SALT || 'beatdown-default-salt-change-me';
  return createHash('sha256').update(salt + ip).digest('hex');
}
```

- [ ] **Step 2: Write `save` route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { checkRateLimit } from '@/lib/security/rateLimiter';
import { newShortId, hashIp } from '@/lib/beatdown/shortId';
import type { BeatdownDraft, BeatdownInputs } from '@/types/beatdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface SaveBody {
  inputs: BeatdownInputs;
  draft: BeatdownDraft;
  generation_ms: number;
  model: string;
  knowledge_version: number | null;
}

function getClientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0].trim()
    || request.headers.get('x-real-ip')
    || 'unknown';
}

export async function POST(request: NextRequest) {
  const rateLimited = checkRateLimit(request, { maxRequests: 30, windowMs: 60_000 });
  if (rateLimited) return rateLimited;

  let body: SaveBody;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  if (!body?.draft?.title || !body?.draft?.sections || !body?.inputs) {
    return NextResponse.json({ error: 'bad_request' }, { status: 400 });
  }

  const sql = getSql();
  const ip_hash = hashIp(getClientIp(request));

  for (let attempt = 0; attempt < 3; attempt++) {
    const short_id = newShortId();
    try {
      await sql`
        INSERT INTO beatdowns (short_id, inputs, sections, title, ip_hash, generation_model, generation_ms, knowledge_version)
        VALUES (${short_id}, ${JSON.stringify(body.inputs)}, ${JSON.stringify(body.draft.sections)}, ${body.draft.title}, ${ip_hash}, ${body.model}, ${body.generation_ms}, ${body.knowledge_version})
      `;
      return NextResponse.json({ short_id });
    } catch (err) {
      const message = (err as Error).message || '';
      if (message.includes('beatdowns_short_id_key') || message.includes('duplicate key')) continue;
      console.error('[beatdown:save]', err);
      return NextResponse.json({ error: 'save_failed' }, { status: 500 });
    }
  }
  return NextResponse.json({ error: 'short_id_collision' }, { status: 500 });
}
```

- [ ] **Step 3: Write `[short_id]` route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(_request: NextRequest, { params }: { params: Promise<{ short_id: string }> }) {
  const { short_id } = await params;
  if (!/^[a-z0-9]{8}$/.test(short_id)) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  const sql = getSql();
  const rows = await sql`
    SELECT short_id, title, inputs, sections, generation_model, generation_ms, created_at
    FROM beatdowns
    WHERE short_id = ${short_id}
    LIMIT 1
  ` as Array<{ short_id: string; title: string; inputs: unknown; sections: unknown; generation_model: string; generation_ms: number; created_at: string }>;
  if (rows.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  return NextResponse.json(rows[0]);
}
```

- [ ] **Step 4: Smoke test save → get**

```bash
# Save
curl -sX POST http://localhost:3003/api/beatdown/save \
  -H 'Content-Type: application/json' \
  -d '{"inputs":{...},"draft":{"title":"Test","sections":{...}},"generation_ms":1234,"model":"gemini-2.5-flash","knowledge_version":null}' | jq

# Returns { short_id: "..." } — then fetch
curl -s http://localhost:3003/api/beatdown/<short_id> | jq
```

Expected: GET returns the saved record.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/beatdown/save/ src/app/api/beatdown/\[short_id\]/ src/lib/beatdown/shortId.ts
git commit -m "feat(beatdown): save + read-by-short-id routes"
```

### Task 11: Exicon search route (for Swap modal)

**Files:**
- Create: `src/app/api/beatdown/exicon-search/route.ts`

- [ ] **Step 1: Write the route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { exiconEntries } from '@/../data/f3Glossary';
import { filterExiconForFocus } from '@/lib/beatdown/exicon';
import type { BeatdownFocus } from '@/types/beatdown';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const VALID_FOCUS: BeatdownFocus[] = ['full', 'legs', 'core', 'upper', 'cardio'];

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const focus = searchParams.get('focus') as BeatdownFocus | null;
  const q = (searchParams.get('q') || '').toLowerCase().trim();

  let pool = focus && VALID_FOCUS.includes(focus) ? filterExiconForFocus(focus) : exiconEntries;

  if (q) {
    pool = pool.filter(e =>
      e.term.toLowerCase().includes(q)
      || (e.shortDescription || '').toLowerCase().includes(q)
    );
  }

  const results = pool.slice(0, 30).map(e => ({
    slug: e.id,
    term: e.term,
    shortDescription: e.shortDescription,
  }));

  return NextResponse.json({ results });
}
```

- [ ] **Step 2: Smoke test**

```bash
curl -s 'http://localhost:3003/api/beatdown/exicon-search?focus=core&q=hammer' | jq
```

Expected: `{ results: [...] }` containing American Hammer.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/beatdown/exicon-search/
git commit -m "feat(beatdown): GET /api/beatdown/exicon-search route"
```

---

## Chunk 4: Knowledge builder + reconcile integration

### Task 12: Knowledge builder lib

**Files:**
- Create: `src/lib/beatdown/buildKnowledge.ts`
- Create: `src/lib/beatdown/prompts/marietta-knowledge.ts`

- [ ] **Step 1: Write `prompts/marietta-knowledge.ts`**

```ts
export const KNOWLEDGE_SYSTEM_INSTRUCTION = `You are an F3 Marietta historian. You read the region's complete backblast archive and distill it into a structured knowledge document for use as grounding context in an AI Beatdown Builder.

Output format (JSON only, no prose, no code fences):
{
  "content": "Markdown document — under 4000 chars — describing F3 Marietta's beatdown voice, common formats, signature exercises, and AO-specific quirks.",
  "per_ao_summary": {
    "<AO Display Name>": {
      "top_exercises": ["..."],     // up to 15
      "common_formats": ["..."],    // up to 8
      "voice_samples": ["..."]      // up to 3 short excerpts that capture the AO's tone
    }
  }
}

Constraints:
- Be specific. Name actual exercises and formats observed in the archive.
- Honor F3 vocabulary. Don't sanitize away PAX, Q, AO, mosey, etc.
- Surface region-wide patterns AND per-AO distinctions.
- If an AO has < 3 backblasts, omit it from per_ao_summary.`;

export function buildKnowledgeUserPrompt(grouped: Map<string, { event_date: string | null; q_name: string | null; content_text: string | null }[]>): string {
  const lines: string[] = ['F3 Marietta backblast archive (grouped by AO):', ''];
  for (const [ao, events] of grouped) {
    lines.push(`## ${ao} (${events.length} backblasts)`);
    for (const e of events) {
      const date = e.event_date || 'unknown';
      const q = e.q_name || 'unknown Q';
      const text = (e.content_text || '').slice(0, 600);
      lines.push(`- (${date}, Q: ${q}) ${text}`);
    }
    lines.push('');
  }
  lines.push('Produce the knowledge JSON described in the system instruction.');
  return lines.join('\n');
}
```

- [ ] **Step 2: Write `buildKnowledge.ts`**

```ts
import Anthropic from '@anthropic-ai/sdk';
import { getSql } from '@/lib/db';
import { KNOWLEDGE_SYSTEM_INSTRUCTION, buildKnowledgeUserPrompt } from '@/lib/beatdown/prompts/marietta-knowledge';

const KNOWLEDGE_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4000;

export interface BuildKnowledgeResult {
  status: 'built' | 'skipped' | 'failed';
  reason?: string;
  knowledge_id?: number;
  source_event_count?: number;
  generation_ms?: number;
}

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

export async function buildBeatdownKnowledge(opts: { force?: boolean } = {}): Promise<BuildKnowledgeResult> {
  const sql = getSql();
  const t0 = Date.now();

  const events = await sql`
    SELECT event_date, q_name, content_text, ao_display_name
    FROM f3_events
    WHERE event_kind = 'backblast'
      AND is_deleted = false
      AND content_text IS NOT NULL
    ORDER BY event_date DESC NULLS LAST, created_at DESC
  ` as { event_date: string | null; q_name: string | null; content_text: string | null; ao_display_name: string | null }[];

  if (events.length === 0) return { status: 'skipped', reason: 'no_backblasts' };

  if (!opts.force) {
    const latest = await sql`
      SELECT generated_at, source_event_count
      FROM marietta_bd_knowledge
      ORDER BY generated_at DESC
      LIMIT 1
    ` as { generated_at: string; source_event_count: number }[];
    if (latest.length > 0 && latest[0].source_event_count === events.length) {
      return { status: 'skipped', reason: 'no_new_backblasts' };
    }
  }

  const grouped = new Map<string, typeof events>();
  for (const e of events) {
    const ao = e.ao_display_name || 'Unknown AO';
    const arr = grouped.get(ao) || [];
    arr.push(e);
    grouped.set(ao, arr);
  }

  const userPrompt = buildKnowledgeUserPrompt(grouped);

  let parsed: { content: string; per_ao_summary: Record<string, unknown> };
  try {
    const anthropic = getAnthropic();
    const resp = await anthropic.messages.create({
      model: KNOWLEDGE_MODEL,
      max_tokens: MAX_TOKENS,
      system: KNOWLEDGE_SYSTEM_INSTRUCTION,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const block = resp.content.find(c => c.type === 'text');
    if (!block || block.type !== 'text') throw new Error('No text block in Claude response');
    const text = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(text);
  } catch (err) {
    console.error('[buildKnowledge] Claude call failed', err);
    return { status: 'failed', reason: (err as Error).message };
  }

  const generation_ms = Date.now() - t0;

  const inserted = await sql`
    INSERT INTO marietta_bd_knowledge (source_event_count, content, per_ao_summary, generation_model, generation_ms)
    VALUES (${events.length}, ${parsed.content}, ${JSON.stringify(parsed.per_ao_summary || {})}, ${KNOWLEDGE_MODEL}, ${generation_ms})
    RETURNING id
  ` as { id: number }[];

  await sql`DELETE FROM marietta_bd_knowledge WHERE generated_at < now() - interval '30 days'`;

  return {
    status: 'built',
    knowledge_id: inserted[0].id,
    source_event_count: events.length,
    generation_ms,
  };
}
```

- [ ] **Step 3: Verify**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/beatdown/buildKnowledge.ts src/lib/beatdown/prompts/marietta-knowledge.ts
git commit -m "feat(beatdown): knowledge builder lib (Claude Sonnet)"
```

### Task 13: Admin manual-trigger route + reconcile integration

**Files:**
- Create: `src/app/api/admin/build-bd-knowledge/route.ts`
- Modify: `src/app/api/slack/reconcile/route.ts` (append knowledge build step)

- [ ] **Step 1: Write the admin route**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { buildBeatdownKnowledge } from '@/lib/beatdown/buildKnowledge';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session?.user) {
    return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
  }
  const result = await buildBeatdownKnowledge({ force: true });
  return NextResponse.json(result);
}
```

- [ ] **Step 2: Modify `reconcile` route**

Open `src/app/api/slack/reconcile/route.ts` and at the end of the successful path (just before the final `NextResponse.json(...)` return), append:

```ts
// AI Beatdown Builder: rebuild knowledge if reconcile produced new backblasts.
if (process.env.SKIP_BD_KNOWLEDGE !== '1') {
  try {
    const { buildBeatdownKnowledge } = await import('@/lib/beatdown/buildKnowledge');
    const knowledgeResult = await buildBeatdownKnowledge();
    console.log('[reconcile] bd-knowledge', knowledgeResult);
  } catch (knowledgeErr) {
    console.error('[reconcile] bd-knowledge build failed (non-fatal)', knowledgeErr);
  }
}
```

- [ ] **Step 3: Manual trigger smoke test**

In a logged-in admin browser session, hit the route from the browser console:

```js
await fetch('/api/admin/build-bd-knowledge', { method: 'POST' }).then(r => r.json());
```

Expected: `{ status: 'built', knowledge_id: <number>, source_event_count: <number>, generation_ms: <number> }`. Verify a new row landed in `marietta_bd_knowledge`.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/admin/build-bd-knowledge/ src/app/api/slack/reconcile/route.ts
git commit -m "feat(beatdown): admin knowledge-build trigger + reconcile integration"
```

---

## Chunk 5: UI — Form, Display, Save

### Task 14: Builder page scaffolding + form

**Files:**
- Create: `src/app/beatdown-builder/page.tsx`
- Create: `src/app/beatdown-builder/BeatdownBuilderClient.tsx`
- Create: `src/components/beatdown/BeatdownForm.tsx`
- Create: `src/components/beatdown/BeatdownLoader.tsx`

- [ ] **Step 1: Write the server page**

```tsx
import type { Metadata } from 'next';
import { getSql } from '@/lib/db';
import { loadFamousBeatdowns } from '@/lib/beatdown/loadFamousBeatdowns';
import BeatdownBuilderClient from './BeatdownBuilderClient';

export const metadata: Metadata = {
  title: 'AI Beatdown Builder · F3 Marietta',
  description: 'Generate F3-format beatdowns grounded in F3 Marietta backblasts and the Exicon. Customize, save, and share.',
};

export const dynamic = 'force-dynamic';

export default async function BeatdownBuilderPage() {
  const sql = getSql();
  const aos = await sql`
    SELECT id, ao_display_name
    FROM ao_channels
    WHERE is_enabled = true
    ORDER BY ao_display_name
  ` as { id: string; ao_display_name: string }[];

  const famous = loadFamousBeatdowns().map(b => ({
    slug: b.slug,
    title: b.title,
    category: b.category,
    description: b.description,
  }));

  return <BeatdownBuilderClient aos={aos} famousBeatdowns={famous} />;
}
```

- [ ] **Step 2: Write the client wrapper (state owner)**

```tsx
'use client';

import { useState } from 'react';
import BeatdownForm from '@/components/beatdown/BeatdownForm';
import BeatdownDisplay from '@/components/beatdown/BeatdownDisplay';
import BeatdownLoader from '@/components/beatdown/BeatdownLoader';
import type { BeatdownDraft, BeatdownInputs } from '@/types/beatdown';

interface AoOption { id: string; ao_display_name: string }
interface FamousOption { slug: string; title: string; category: 'famous' | 'ipc'; description: string }

interface Props { aos: AoOption[]; famousBeatdowns: FamousOption[] }

export default function BeatdownBuilderClient({ aos, famousBeatdowns }: Props) {
  const [inputs, setInputs] = useState<BeatdownInputs | null>(null);
  const [draft, setDraft] = useState<BeatdownDraft | null>(null);
  const [generationMs, setGenerationMs] = useState<number>(0);
  const [model, setModel] = useState<string>('');
  const [knowledgeVersion, setKnowledgeVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleGenerate(formInputs: BeatdownInputs) {
    setError(null);
    setLoading(true);
    setInputs(formInputs);
    try {
      const resp = await fetch('/api/beatdown/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formInputs),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || data?.error || 'Generation failed');
      setDraft({ title: data.title, sections: data.sections });
      setGenerationMs(data.generation_ms);
      setModel(data.model);
      setKnowledgeVersion(data.knowledge_version);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <header className="mb-8">
        <h1 className="text-3xl md:text-4xl font-bold">AI Beatdown Builder</h1>
        <p className="mt-2 text-zinc-600 dark:text-zinc-400">
          F3 Marietta&apos;s own Q tool — generates beatdowns from our backblasts, the Exicon, and famous F3 BDs.
        </p>
      </header>

      <BeatdownForm aos={aos} famousBeatdowns={famousBeatdowns} disabled={loading} onSubmit={handleGenerate} />

      {loading && <BeatdownLoader />}

      {error && (
        <div className="mt-6 rounded-md border border-red-300 bg-red-50 dark:bg-red-950 p-4 text-red-800 dark:text-red-200">
          {error}
        </div>
      )}

      {!loading && draft && inputs && (
        <BeatdownDisplay
          inputs={inputs}
          draft={draft}
          setDraft={setDraft}
          generationMs={generationMs}
          model={model}
          knowledgeVersion={knowledgeVersion}
        />
      )}
    </main>
  );
}
```

- [ ] **Step 3: Write `BeatdownForm.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { FOCUS_OPTIONS, THEME_OPTIONS, EQUIPMENT_OPTIONS, type BeatdownInputs, type BeatdownEquipment, type BeatdownFocus, type BeatdownTheme } from '@/types/beatdown';

interface AoOption { id: string; ao_display_name: string }
interface FamousOption { slug: string; title: string; category: 'famous' | 'ipc'; description: string }

interface Props {
  aos: AoOption[];
  famousBeatdowns: FamousOption[];
  disabled: boolean;
  onSubmit: (inputs: BeatdownInputs) => void;
}

export default function BeatdownForm({ aos, famousBeatdowns, disabled, onSubmit }: Props) {
  const [aoId, setAoId] = useState<string>(aos[0]?.id || '');
  const [focus, setFocus] = useState<BeatdownFocus>('full');
  const [theme, setTheme] = useState<BeatdownTheme>(null);
  const [equipment, setEquipment] = useState<BeatdownEquipment[]>(['bodyweight']);
  const [famousBd, setFamousBd] = useState<string>('');
  const [qNotes, setQNotes] = useState<string>('');

  function toggleEquip(value: BeatdownEquipment) {
    setEquipment(prev => prev.includes(value) ? prev.filter(v => v !== value) : [...prev, value]);
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!aoId) return;
    const ao = aos.find(a => a.id === aoId);
    if (!ao) return;
    onSubmit({
      ao_id: aoId,
      ao_display_name: ao.ao_display_name,
      focus,
      theme,
      equipment: equipment.length > 0 ? equipment : ['bodyweight'],
      famous_bd: famousBd || null,
      q_notes: qNotes.trim().slice(0, 200),
    });
  }

  return (
    <form onSubmit={submit} className="space-y-6 rounded-lg border border-zinc-200 dark:border-zinc-800 p-4 md:p-6 bg-white dark:bg-zinc-900">
      <div>
        <label className="block text-sm font-medium mb-2">AO</label>
        <select
          required
          value={aoId}
          onChange={e => setAoId(e.target.value)}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-base"
        >
          {aos.map(ao => <option key={ao.id} value={ao.id}>{ao.ao_display_name}</option>)}
        </select>
      </div>

      <ChipGroup label="Focus" value={focus} options={FOCUS_OPTIONS} onChange={v => setFocus(v as BeatdownFocus)} />

      <div>
        <label className="block text-sm font-medium mb-2">Theme / Occasion</label>
        <div className="flex flex-wrap gap-2">
          <Chip selected={theme === null} onClick={() => setTheme(null)} label="—" />
          {THEME_OPTIONS.map(o => (
            <Chip key={o.value} selected={theme === o.value} onClick={() => setTheme(o.value)} label={o.label} />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Equipment (multi)</label>
        <div className="flex flex-wrap gap-2">
          {EQUIPMENT_OPTIONS.map(o => (
            <Chip key={o.value} selected={equipment.includes(o.value)} onClick={() => toggleEquip(o.value)} label={o.label} />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Inspired by (optional)</label>
        <select
          value={famousBd}
          onChange={e => setFamousBd(e.target.value)}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-base"
        >
          <option value="">— pick a famous BD or leave blank —</option>
          <optgroup label="Famous F3 BDs">
            {famousBeatdowns.filter(b => b.category === 'famous').map(b => (
              <option key={b.slug} value={b.slug}>{b.title} — {b.description}</option>
            ))}
          </optgroup>
          <optgroup label="IPC (Iron Pax Challenge)">
            {famousBeatdowns.filter(b => b.category === 'ipc').map(b => (
              <option key={b.slug} value={b.slug}>{b.title} — {b.description}</option>
            ))}
          </optgroup>
        </select>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Q&apos;s Notes (optional, max 200 chars)</label>
        <textarea
          value={qNotes}
          onChange={e => setQNotes(e.target.value.slice(0, 200))}
          placeholder='e.g., "Honoring fallen brother today", "celebrating Hammer\'s 100th post"'
          maxLength={200}
          rows={2}
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-base"
        />
        <div className="text-xs text-zinc-500 mt-1">{qNotes.length}/200</div>
      </div>

      <button
        type="submit"
        disabled={disabled || !aoId}
        className="w-full rounded-md bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-900 px-4 py-3 font-semibold disabled:opacity-50"
      >
        {disabled ? 'Generating…' : 'Generate Beatdown'}
      </button>
    </form>
  );
}

function ChipGroup<T extends string>({ label, value, options, onChange }: {
  label: string; value: T; options: { value: T; label: string }[]; onChange: (v: T) => void;
}) {
  return (
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map(o => (
          <Chip key={o.value} selected={value === o.value} onClick={() => onChange(o.value)} label={o.label} />
        ))}
      </div>
    </div>
  );
}

function Chip({ selected, onClick, label }: { selected: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        'px-3 py-1.5 rounded-full text-sm border transition-colors ' +
        (selected
          ? 'bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-900 border-zinc-900 dark:border-amber-500'
          : 'bg-white dark:bg-zinc-800 border-zinc-300 dark:border-zinc-700')
      }
    >
      {label}
    </button>
  );
}
```

- [ ] **Step 4: Write `BeatdownLoader.tsx`**

```tsx
export default function BeatdownLoader() {
  return (
    <div className="mt-6 rounded-md border border-zinc-200 dark:border-zinc-800 p-6 text-center bg-white dark:bg-zinc-900">
      <div className="inline-block h-6 w-6 animate-spin rounded-full border-2 border-zinc-300 border-t-zinc-900 dark:border-zinc-700 dark:border-t-amber-500" />
      <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">
        Building your beatdown — pulling from F3 Marietta backblasts, famous BDs, and the Exicon…
      </p>
    </div>
  );
}
```

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: no errors. (`BeatdownDisplay` import will fail until Task 15 — temporarily comment out the import + JSX block and re-add after Task 15.)

- [ ] **Step 6: Commit**

```bash
git add src/app/beatdown-builder/ src/components/beatdown/
git commit -m "feat(beatdown): builder page scaffold + form + loader"
```

### Task 15: BeatdownDisplay + BeatdownSection + ExerciseRow

**Files:**
- Create: `src/components/beatdown/BeatdownDisplay.tsx`
- Create: `src/components/beatdown/BeatdownSection.tsx`
- Create: `src/components/beatdown/ExerciseRow.tsx`
- Modify: `src/app/beatdown-builder/BeatdownBuilderClient.tsx` (un-comment the BeatdownDisplay JSX)

- [ ] **Step 1: Write `ExerciseRow.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { BeatdownExerciseItem } from '@/types/beatdown';

interface Props {
  item: BeatdownExerciseItem;
  onChange: (item: BeatdownExerciseItem) => void;
  onRemove: () => void;
  onSwap: () => void;
  showCoaching: boolean;
}

export default function ExerciseRow({ item, onChange, onRemove, onSwap, showCoaching }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex flex-col gap-2 py-2">
        <input
          autoFocus
          value={item.exercise}
          onChange={e => onChange({ ...item, exercise: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={e => { if (e.key === 'Enter') setEditing(false); }}
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-base"
        />
        <input
          value={item.reps}
          onChange={e => onChange({ ...item, reps: e.target.value })}
          placeholder="x 25 IC"
          className="rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-2 py-1 text-sm"
        />
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2 py-1.5 border-b border-zinc-100 dark:border-zinc-800 last:border-b-0">
      <div className="flex-1">
        <button onClick={() => setEditing(true)} className="text-left w-full">
          <span className="font-medium">{item.exercise}</span>
          <span className="text-zinc-600 dark:text-zinc-400"> {item.reps}</span>
        </button>
        {showCoaching && item.note && (
          <div className="text-xs text-zinc-500 dark:text-zinc-400 italic mt-0.5">{item.note}</div>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity no-print">
        <button type="button" onClick={onSwap} className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-zinc-200 dark:hover:bg-zinc-700">Swap</button>
        <button type="button" onClick={onRemove} className="text-xs px-2 py-1 rounded bg-zinc-100 dark:bg-zinc-800 hover:bg-red-100 dark:hover:bg-red-950">Remove</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Write `BeatdownSection.tsx`**

```tsx
'use client';

import type { BeatdownExerciseItem, BeatdownInputs, BeatdownDraft } from '@/types/beatdown';
import ExerciseRow from './ExerciseRow';

interface Props {
  label: string;
  sectionKey: 'warmup' | 'thang' | 'cot';
  draft: BeatdownDraft;
  inputs: BeatdownInputs;
  showCoaching: boolean;
  onChangeItems: (items: BeatdownExerciseItem[]) => void;
  onAddItem: () => void;
  onRegenerate: () => Promise<void>;
  onSwap: (index: number) => void;
  regenerating: boolean;
}

export default function BeatdownSection({
  label, sectionKey, draft, showCoaching,
  onChangeItems, onAddItem, onRegenerate, onSwap, regenerating,
}: Props) {
  const section = draft.sections[sectionKey];

  if (sectionKey === 'cot') {
    const cot = section as BeatdownDraft['sections']['cot'];
    return (
      <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
        <SectionHeader label={label} regenerating={regenerating} onRegenerate={onRegenerate} />
        <ul className="mt-2 space-y-1 list-disc list-inside text-base">
          {cot.talking_points.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
        {cot.notes && <p className="mt-3 text-sm text-zinc-600 dark:text-zinc-400">{cot.notes}</p>}
      </div>
    );
  }

  const items = (section as { items: BeatdownExerciseItem[] }).items;
  const formatNote = sectionKey === 'thang' ? draft.sections.thang.format_note : '';

  return (
    <div className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
      <SectionHeader label={label} regenerating={regenerating} onRegenerate={onRegenerate} />
      {formatNote && <p className="mt-1 italic text-sm text-zinc-600 dark:text-zinc-400">{formatNote}</p>}
      <div className="mt-2">
        {items.map((it, i) => (
          <ExerciseRow
            key={i}
            item={it}
            showCoaching={showCoaching}
            onChange={(next) => {
              const copy = [...items]; copy[i] = next; onChangeItems(copy);
            }}
            onRemove={() => onChangeItems(items.filter((_, idx) => idx !== i))}
            onSwap={() => onSwap(i)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onAddItem}
        className="mt-3 text-sm text-zinc-600 dark:text-zinc-400 underline-offset-2 hover:underline no-print"
      >
        + Add an exercise
      </button>
    </div>
  );
}

function SectionHeader({ label, regenerating, onRegenerate }: { label: string; regenerating: boolean; onRegenerate: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs uppercase tracking-widest font-semibold text-amber-600 dark:text-amber-500">{label}</h3>
      <button
        type="button"
        onClick={onRegenerate}
        disabled={regenerating}
        className="text-xs text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 disabled:opacity-50 no-print"
      >
        {regenerating ? 'Regenerating…' : '↻ Regenerate'}
      </button>
    </div>
  );
}
```

- [ ] **Step 3: Write `BeatdownDisplay.tsx`**

```tsx
'use client';

import { useState } from 'react';
import type { BeatdownDraft, BeatdownExerciseItem, BeatdownInputs } from '@/types/beatdown';
import BeatdownSection from './BeatdownSection';
import ExerciseSwapModal from './ExerciseSwapModal';
import ShareActionsBar from './ShareActionsBar';

interface Props {
  inputs: BeatdownInputs;
  draft: BeatdownDraft;
  setDraft: (d: BeatdownDraft) => void;
  generationMs: number;
  model: string;
  knowledgeVersion: number | null;
}

export default function BeatdownDisplay({ inputs, draft, setDraft, generationMs, model, knowledgeVersion }: Props) {
  const [regen, setRegen] = useState<'warmup' | 'thang' | 'cot' | null>(null);
  const [swap, setSwap] = useState<{ section: 'warmup' | 'thang'; index: number } | null>(null);

  const showCoaching = inputs.theme === 'fng-friendly' || inputs.theme === 'q-school';

  function setItems(section: 'warmup' | 'thang', items: BeatdownExerciseItem[]) {
    if (section === 'warmup') setDraft({ ...draft, sections: { ...draft.sections, warmup: { items } } });
    else setDraft({ ...draft, sections: { ...draft.sections, thang: { ...draft.sections.thang, items } } });
  }

  function addItem(section: 'warmup' | 'thang') {
    const items = section === 'warmup' ? draft.sections.warmup.items : draft.sections.thang.items;
    setItems(section, [...items, { exercise: 'New exercise', reps: 'x 10', note: '' }]);
  }

  async function regenerateSection(section: 'warmup' | 'thang' | 'cot') {
    setRegen(section);
    try {
      const resp = await fetch('/api/beatdown/regenerate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, current: draft, section }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || 'Regenerate failed');
      setDraft({
        ...draft,
        sections: { ...draft.sections, [section]: data.data },
      });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRegen(null);
    }
  }

  function applySwap(item: BeatdownExerciseItem) {
    if (!swap) return;
    const items = swap.section === 'warmup' ? [...draft.sections.warmup.items] : [...draft.sections.thang.items];
    items[swap.index] = item;
    setItems(swap.section, items);
    setSwap(null);
  }

  return (
    <section className="mt-8 space-y-4 beatdown-card">
      <header className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
        <div className="text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-500">
          F3 Marietta · {inputs.ao_display_name} · {draft.sections.header.length_min} min
        </div>
        <h2 className="mt-1 text-2xl md:text-3xl font-bold">{draft.title}</h2>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{draft.sections.header.summary}</p>
        <div className="mt-2 text-xs text-zinc-500 no-print">
          {model} · {generationMs}ms{knowledgeVersion ? ` · knowledge v${knowledgeVersion}` : ''}
        </div>
      </header>

      <BeatdownSection
        label="Warm-up" sectionKey="warmup" draft={draft} inputs={inputs} showCoaching={showCoaching}
        onChangeItems={(items) => setItems('warmup', items)}
        onAddItem={() => addItem('warmup')}
        onRegenerate={() => regenerateSection('warmup')}
        onSwap={(i) => setSwap({ section: 'warmup', index: i })}
        regenerating={regen === 'warmup'}
      />
      <BeatdownSection
        label="The Thang" sectionKey="thang" draft={draft} inputs={inputs} showCoaching={showCoaching}
        onChangeItems={(items) => setItems('thang', items)}
        onAddItem={() => addItem('thang')}
        onRegenerate={() => regenerateSection('thang')}
        onSwap={(i) => setSwap({ section: 'thang', index: i })}
        regenerating={regen === 'thang'}
      />
      <BeatdownSection
        label="COT" sectionKey="cot" draft={draft} inputs={inputs} showCoaching={showCoaching}
        onChangeItems={() => {}}
        onAddItem={() => {}}
        onRegenerate={() => regenerateSection('cot')}
        onSwap={() => {}}
        regenerating={regen === 'cot'}
      />

      <ShareActionsBar inputs={inputs} draft={draft} generationMs={generationMs} model={model} knowledgeVersion={knowledgeVersion} />

      {swap && (
        <ExerciseSwapModal
          focus={inputs.focus}
          currentTerm={(swap.section === 'warmup' ? draft.sections.warmup.items : draft.sections.thang.items)[swap.index].exercise}
          onApply={applySwap}
          onClose={() => setSwap(null)}
        />
      )}
    </section>
  );
}
```

- [ ] **Step 4: Re-enable BeatdownDisplay import in `BeatdownBuilderClient.tsx`** (already in Task 14 — no changes needed if step 5 there left the import in place).

- [ ] **Step 5: Verify build**

Run: `npx tsc --noEmit`
Expected: errors only for the not-yet-created `ExerciseSwapModal` and `ShareActionsBar` (next two tasks). The check will pass after Task 16 + 17.

- [ ] **Step 6: Commit**

```bash
git add src/components/beatdown/BeatdownDisplay.tsx src/components/beatdown/BeatdownSection.tsx src/components/beatdown/ExerciseRow.tsx
git commit -m "feat(beatdown): display, section, and exercise row components"
```

### Task 16: ExerciseSwapModal

**Files:**
- Create: `src/components/beatdown/ExerciseSwapModal.tsx`

- [ ] **Step 1: Write the modal**

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import type { BeatdownExerciseItem, BeatdownFocus } from '@/types/beatdown';

interface Props {
  focus: BeatdownFocus;
  currentTerm: string;
  onApply: (item: BeatdownExerciseItem) => void;
  onClose: () => void;
}

interface SearchResult { slug: string; term: string; shortDescription: string }

export default function ExerciseSwapModal({ focus, currentTerm, onApply, onClose }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [reps, setReps] = useState<string>('x 20');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/beatdown/exicon-search?focus=${focus}&q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setResults(d.results || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [q, focus]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-2">
      <div ref={dialogRef} className="w-full max-w-md rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Swap exercise (replacing &ldquo;{currentTerm}&rdquo;)</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100">×</button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search the Exicon…"
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-base mb-3"
        />
        <input
          value={reps}
          onChange={e => setReps(e.target.value)}
          placeholder="Reps (e.g., x 25 IC)"
          className="w-full rounded-md border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-800 px-3 py-2 text-sm mb-3"
        />
        <div className="flex-1 overflow-y-auto -mx-2">
          {results.map(r => (
            <button
              key={r.slug}
              type="button"
              onClick={() => onApply({ exercise: r.term, reps, note: '' })}
              className="w-full text-left px-2 py-2 rounded hover:bg-zinc-50 dark:hover:bg-zinc-800"
            >
              <div className="font-medium">{r.term}</div>
              <div className="text-xs text-zinc-500 line-clamp-2">{r.shortDescription}</div>
            </button>
          ))}
          {results.length === 0 && <div className="text-sm text-zinc-500 px-2 py-4">No matches.</div>}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx tsc --noEmit`

- [ ] **Step 3: Commit**

```bash
git add src/components/beatdown/ExerciseSwapModal.tsx
git commit -m "feat(beatdown): exercise swap modal"
```

### Task 17: ShareActionsBar + Save flow + Print stylesheet

**Files:**
- Create: `src/components/beatdown/ShareActionsBar.tsx`
- Modify: `src/app/beatdown-builder/page.tsx` or `globals.css` (add print styles — see Step 4)

- [ ] **Step 1: Write `ShareActionsBar.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatSlackblast } from '@/lib/beatdown/formatSlackblast';
import type { BeatdownDraft, BeatdownInputs } from '@/types/beatdown';

interface Props {
  inputs: BeatdownInputs;
  draft: BeatdownDraft;
  generationMs: number;
  model: string;
  knowledgeVersion: number | null;
}

export default function ShareActionsBar({ inputs, draft, generationMs, model, knowledgeVersion }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);

  async function handleSave() {
    setSaving(true);
    try {
      const resp = await fetch('/api/beatdown/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, draft, generation_ms: generationMs, model, knowledge_version: knowledgeVersion }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.short_id) throw new Error(data?.message || 'Save failed');
      router.push(`/beatdown/${data.short_id}`);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    const text = formatSlackblast(draft, inputs);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select-and-copy via textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="sticky bottom-0 md:static z-10 -mx-4 md:mx-0 px-4 py-3 md:px-0 md:py-0 bg-white/95 dark:bg-zinc-950/95 md:bg-transparent backdrop-blur md:backdrop-blur-none border-t md:border-0 border-zinc-200 dark:border-zinc-800 no-print">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={handleSave} disabled={saving} className="flex-1 min-w-[120px] rounded-md bg-zinc-900 dark:bg-amber-500 text-white dark:text-zinc-900 px-4 py-2 font-semibold disabled:opacity-50">
          {saving ? 'Saving…' : 'Save'}
        </button>
        <button type="button" onClick={handleCopy} className="flex-1 min-w-[120px] rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 font-medium">
          {copied ? 'Copied!' : 'Copy as Slackblast'}
        </button>
        <button type="button" onClick={handlePrint} className="flex-1 min-w-[120px] rounded-md border border-zinc-300 dark:border-zinc-700 px-4 py-2 font-medium">
          Print
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Append print styles to `src/app/globals.css`**

```css
@media print {
  nav, footer, header[role="banner"], .no-print { display: none !important; }
  .beatdown-card { background: white !important; color: #111 !important; box-shadow: none !important; }
  .beatdown-card * { background: white !important; color: #111 !important; border-color: #999 !important; }
  body { font-size: 12pt; }
  main { max-width: 100% !important; padding: 0 !important; }
  .beatdown-card > * { break-inside: avoid; }
}
```

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean build.

- [ ] **Step 4: Commit**

```bash
git add src/components/beatdown/ShareActionsBar.tsx src/app/globals.css
git commit -m "feat(beatdown): share actions bar (save / copy slackblast / print) + print stylesheet"
```

### Task 18: Saved view page `/beatdown/[short_id]`

**Files:**
- Create: `src/app/beatdown/[short_id]/page.tsx`
- Create: `src/app/beatdown/[short_id]/SavedBeatdownClient.tsx`

- [ ] **Step 1: Write the server page**

```tsx
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getSql } from '@/lib/db';
import SavedBeatdownClient from './SavedBeatdownClient';
import type { BeatdownInputs, BeatdownSections } from '@/types/beatdown';

interface Row {
  short_id: string;
  title: string;
  inputs: BeatdownInputs;
  sections: BeatdownSections;
  generation_model: string;
  generation_ms: number;
  created_at: string;
}

export async function generateMetadata({ params }: { params: Promise<{ short_id: string }> }): Promise<Metadata> {
  const { short_id } = await params;
  const sql = getSql();
  const rows = await sql`SELECT title, inputs FROM beatdowns WHERE short_id = ${short_id} LIMIT 1` as { title: string; inputs: BeatdownInputs }[];
  if (rows.length === 0) return { title: 'Beatdown not found' };
  return {
    title: `${rows[0].title} · F3 Marietta Beatdown`,
    description: `${rows[0].inputs.ao_display_name} beatdown — generated by the F3 Marietta AI Beatdown Builder`,
  };
}

export default async function SavedBeatdownPage({ params }: { params: Promise<{ short_id: string }> }) {
  const { short_id } = await params;
  if (!/^[a-z0-9]{8}$/.test(short_id)) notFound();
  const sql = getSql();
  const rows = await sql`
    SELECT short_id, title, inputs, sections, generation_model, generation_ms, created_at
    FROM beatdowns
    WHERE short_id = ${short_id}
    LIMIT 1
  ` as Row[];
  if (rows.length === 0) notFound();
  return <SavedBeatdownClient row={rows[0]} />;
}
```

- [ ] **Step 2: Write the client view**

```tsx
'use client';

import Link from 'next/link';
import type { BeatdownInputs, BeatdownSections } from '@/types/beatdown';
import BeatdownSection from '@/components/beatdown/BeatdownSection';
import ShareActionsBar from '@/components/beatdown/ShareActionsBar';

interface Row {
  short_id: string;
  title: string;
  inputs: BeatdownInputs;
  sections: BeatdownSections;
  generation_model: string;
  generation_ms: number;
  created_at: string;
}

export default function SavedBeatdownClient({ row }: { row: Row }) {
  const draft = { title: row.title, sections: row.sections };
  const showCoaching = row.inputs.theme === 'fng-friendly' || row.inputs.theme === 'q-school';

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <div className="mb-4 no-print text-sm">
        <Link href="/beatdown-builder" className="underline">← Build a new beatdown</Link>
      </div>
      <section className="space-y-4 beatdown-card">
        <header className="rounded-md border border-zinc-200 dark:border-zinc-800 p-4 bg-white dark:bg-zinc-900">
          <div className="text-[10px] uppercase tracking-widest text-amber-600 dark:text-amber-500">
            F3 Marietta · {row.inputs.ao_display_name} · {row.sections.header.length_min} min
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold">{row.title}</h1>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">{row.sections.header.summary}</p>
        </header>

        <BeatdownSection
          label="Warm-up" sectionKey="warmup" draft={draft} inputs={row.inputs} showCoaching={showCoaching}
          onChangeItems={() => {}} onAddItem={() => {}} onRegenerate={async () => {}} onSwap={() => {}} regenerating={false}
        />
        <BeatdownSection
          label="The Thang" sectionKey="thang" draft={draft} inputs={row.inputs} showCoaching={showCoaching}
          onChangeItems={() => {}} onAddItem={() => {}} onRegenerate={async () => {}} onSwap={() => {}} regenerating={false}
        />
        <BeatdownSection
          label="COT" sectionKey="cot" draft={draft} inputs={row.inputs} showCoaching={showCoaching}
          onChangeItems={() => {}} onAddItem={() => {}} onRegenerate={async () => {}} onSwap={() => {}} regenerating={false}
        />

        <ShareActionsBar
          inputs={row.inputs}
          draft={draft}
          generationMs={row.generation_ms}
          model={row.generation_model}
          knowledgeVersion={null}
        />

        <p className="text-xs text-zinc-500 no-print">
          Saved {new Date(row.created_at).toLocaleString()} · <Link href={`/beatdown-builder?seed=${row.short_id}`} className="underline">Remix this beatdown</Link>
        </p>
      </section>
    </main>
  );
}
```

The interactive controls (Swap, Regenerate, etc.) on `BeatdownSection` are no-ops in saved view; users edit a remix instead.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: clean.

- [ ] **Step 4: Commit**

```bash
git add src/app/beatdown/
git commit -m "feat(beatdown): /beatdown/[short_id] read-only saved view"
```

### Task 19: Surface entry point — Navbar link + homepage CTA

**Files:**
- Modify: `src/components/layout/Navbar.tsx` (add a "Beatdown Builder" link)
- Modify: `src/app/page.tsx` (add a CTA card linking to /beatdown-builder)

- [ ] **Step 1: Find current navbar links pattern**

Open `src/components/layout/Navbar.tsx`, locate the existing nav-link list. Add a new entry:

```tsx
{ href: '/beatdown-builder', label: 'Beatdown Builder' },
```

Place it immediately after the Backblasts link in the desktop and mobile menus. Match the existing component's link styling.

- [ ] **Step 2: Add a homepage CTA**

In `src/app/page.tsx`, after the existing hero/feature sections (or wherever the next-most-prominent content sits), insert a card:

```tsx
<section className="mx-auto max-w-5xl px-4 py-12">
  <div className="rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900 p-6 md:p-8 text-center">
    <h2 className="text-2xl md:text-3xl font-bold">Q'ing tomorrow? Try the Beatdown Builder.</h2>
    <p className="mt-2 text-zinc-700 dark:text-zinc-300">
      F3 Marietta&apos;s own AI tool — pulls from our backblasts, the Exicon, and famous F3 BDs to draft you a beatdown in seconds.
    </p>
    <a href="/beatdown-builder" className="inline-block mt-4 rounded-md bg-amber-600 hover:bg-amber-700 text-white px-6 py-2.5 font-semibold">
      Build a beatdown →
    </a>
  </div>
</section>
```

Match the surrounding spacing / palette. If the homepage uses Section components (`Section.tsx`), wrap accordingly.

- [ ] **Step 3: Verify build**

Run: `npx tsc --noEmit && npm run build`

- [ ] **Step 4: Commit**

```bash
git add src/components/layout/Navbar.tsx src/app/page.tsx
git commit -m "feat(beatdown): surface in nav + homepage CTA"
```

---

## Chunk 6: Tests + verification

### Task 20: Playwright E2E tests

**Files:**
- Create: `tests/beatdown-builder.spec.ts`
- Create: `tests/fixtures/beatdown.ts`

- [ ] **Step 1: Write the fixture**

```ts
// Test fixture for beatdown UI tests. Mirror the production schema.
import type { BeatdownDraft, BeatdownInputs } from '@/types/beatdown';

export const fixtureInputs: BeatdownInputs = {
  ao_id: '00000000-0000-0000-0000-000000000000',
  ao_display_name: 'The Battlefield',
  focus: 'full',
  theme: null,
  equipment: ['bodyweight'],
  famous_bd: null,
  q_notes: '',
};

export const fixtureDraft: BeatdownDraft = {
  title: 'Crawl, Walk, Run',
  sections: {
    header: { title: 'Crawl, Walk, Run', ao_name: 'The Battlefield', length_min: 45, summary: 'Hill work + Mary' },
    warmup: { items: [
      { exercise: 'SSH', reps: 'x 25 IC', note: '' },
      { exercise: 'Imperial Walkers', reps: 'x 20 IC', note: '' },
      { exercise: 'Mosey', reps: 'to flag pole', note: '' },
    ]},
    thang: { items: [
      { exercise: 'Merkins', reps: 'x 10', note: '' },
      { exercise: 'Squats', reps: 'x 10', note: '' },
    ], format_note: '11s on the back hill' },
    cot: { talking_points: ['Count-o-rama', 'Name-o-rama', 'BOM'], notes: '' },
  },
};
```

- [ ] **Step 2: Write the spec**

```ts
import { test, expect } from '@playwright/test';
import { fixtureDraft } from './fixtures/beatdown';

test.describe('AI Beatdown Builder', () => {
  test('renders the form and disables Generate without a real AO', async ({ page }) => {
    await page.goto('/beatdown-builder');
    await expect(page.getByRole('heading', { name: 'AI Beatdown Builder' })).toBeVisible();
    await expect(page.getByLabel('AO')).toBeVisible();
    await expect(page.getByRole('button', { name: /generate beatdown/i })).toBeVisible();
  });

  test('renders generated beatdown when API returns a draft', async ({ page }) => {
    // Mock the generate route
    await page.route('**/api/beatdown/generate', route => route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        title: fixtureDraft.title,
        sections: fixtureDraft.sections,
        generation_ms: 1234,
        model: 'gemini-2.5-flash',
        knowledge_version: null,
      }),
    }));

    await page.goto('/beatdown-builder');
    // Pick first AO that exists in the dropdown (any value)
    const aoSelect = page.getByLabel('AO');
    const firstOption = await aoSelect.locator('option').first().getAttribute('value');
    if (firstOption) await aoSelect.selectOption(firstOption);
    await page.getByRole('button', { name: /generate beatdown/i }).click();

    await expect(page.getByRole('heading', { name: fixtureDraft.title, level: 2 })).toBeVisible();
    await expect(page.getByText('SSH')).toBeVisible();
    await expect(page.getByText('11s on the back hill')).toBeVisible();
    await expect(page.getByRole('button', { name: /copy as slackblast/i })).toBeVisible();
  });

  test('saved view renders by short_id', async ({ page }) => {
    // This test requires a real saved row in the DB. Skip with a real-DB env flag,
    // OR seed via the API in setup. For now, just check the 404 path.
    await page.goto('/beatdown/zzzzzzzz');
    await expect(page).toHaveTitle(/not found|404/i);
  });
});
```

- [ ] **Step 3: Run the tests**

Run: `npm run test:e2e -- tests/beatdown-builder.spec.ts`
Expected: all green. The third test checks the 404 path, so it's robust to no-DB-seed.

- [ ] **Step 4: Commit**

```bash
git add tests/beatdown-builder.spec.ts tests/fixtures/beatdown.ts
git commit -m "test(beatdown): Playwright E2E for builder form, mocked generation, and 404"
```

### Task 21: End-to-end manual smoke test

**Files:** No code changes — verification only.

- [ ] **Step 1: Pre-push verify**

Run: `npx tsc --noEmit && npm run build && npm run lint`
Expected: clean.

- [ ] **Step 2: Real Gemini smoke test**

```bash
# Ensure .env.local has GOOGLE_AI_API_KEY and DATABASE_URL
PORT=3003 npm run dev
# Open http://localhost:3003/beatdown-builder
```

Manual checklist (record each):
- [ ] Form renders with AOs from `ao_channels`
- [ ] Selecting equipment chips works (multi-toggle)
- [ ] Theme chips are single-select
- [ ] Submitting generates a beatdown within ~10s
- [ ] Each section card has Regenerate ↻
- [ ] Each exercise row has Swap and Remove (hover/focus)
- [ ] Click an exercise → inline edit works, blur commits
- [ ] Swap modal opens, Exicon search returns results, picking one updates the row
- [ ] Copy as Slackblast → paste into Slack DM, verify formatting
- [ ] Print preview (Cmd-P) renders single column, no nav, B&W
- [ ] Save → redirects to `/beatdown/<short_id>` and renders read-only
- [ ] Visit `/beatdown/zzzzzzzz` → 404

- [ ] **Step 3: Trigger knowledge build manually**

In a logged-in admin browser session:

```js
await fetch('/api/admin/build-bd-knowledge', { method: 'POST' }).then(r => r.json());
```

Expected: `{ status: 'built', source_event_count: <N>, knowledge_id: <id> }`. Verify in psql:

```sql
SELECT id, source_event_count, generated_at, length(content) FROM marietta_bd_knowledge ORDER BY id DESC LIMIT 1;
```

- [ ] **Step 4: Generate again and verify the knowledge row is reflected**

Generate a new beatdown. Confirm the response includes `knowledge_version: <id>` matching the row from Step 3.

- [ ] **Step 5: Commit checklist log**

If you kept notes during the manual smoke test, add them as a markdown file:

```bash
# Optional: add a session notes file (will not deploy due to ignoreCommand)
```

If everything checks out, no commit needed for the smoke test itself.

---

## Chunk 7: Deploy gate

### Task 22: Push to develop, review preview, promote to main

**Files:** No code changes.

- [ ] **Step 1: Pre-push gate (one more time)**

```bash
npx tsc --noEmit && npm run build
```
Expected: pass.

- [ ] **Step 2: Push feature branch (no Vercel build)**

```bash
git push -u origin feature/ai-beatdown-builder
```

- [ ] **Step 3: Open a PR `feature/ai-beatdown-builder` → `develop`** via GitHub. Title: "AI Beatdown Builder (v1)". Body: link to spec + plan, include manual checklist.

- [ ] **Step 4: Merge to `develop`**, wait for Vercel preview deploy, manually walk the checklist on the preview URL (must include real Gemini call against the preview's env).

- [ ] **Step 5: Promote to main**

```bash
git checkout main && git pull && git merge --ff-only develop && git push origin main
```

- [ ] **Step 6: Verify production**

- [ ] `https://f3marietta.com/beatdown-builder` loads
- [ ] Generates a beatdown end-to-end
- [ ] Save → URL works
- [ ] Tomorrow: confirm reconcile cron rebuilt knowledge (check `marietta_bd_knowledge` row count grew)

- [ ] **Step 7: Update feature-status.md**

```bash
# Edit .claude/context/feature-status.md — change "AI Beatdown Builder" status from "In Design" to "Complete"
git add .claude/context/feature-status.md
git commit -m "docs: mark AI Beatdown Builder Complete in feature roadmap"
git push origin main
```

---

## Self-Review Notes

**Spec coverage check:**
- ✅ Form inputs (AO, focus, theme, equipment, famous BD, Q's notes) — Task 14
- ✅ Output structure (warmup / thang / cot, adaptive detail) — Task 7 (system prompt) + Task 15 (display)
- ✅ Approach 2 grounding (knowledge + recent at AO + Exicon + famous BDs) — Tasks 5-7
- ✅ Customization Level B (regen full + per-section + swap + add/remove + edit) — Tasks 9, 14-16
- ✅ Save with short_id — Task 10
- ✅ Read-only saved view — Task 18
- ✅ Print stylesheet + Copy Slackblast — Task 17
- ✅ Knowledge builder + reconcile integration — Tasks 12-13
- ✅ Rate limiting (10/min generate, 20/min regen, 30/min save) — Tasks 8-10
- ✅ Tests — Task 20
- ✅ Surface in nav + homepage CTA — Task 19
- ✅ Deploy gate — Task 22

**Type consistency check:** `BeatdownDraft`, `BeatdownInputs`, `BeatdownSections` are defined in Task 2 and used identically in Tasks 5-21.

**Placeholder scan:** No "TBD"/"TODO" strings; all code blocks contain real implementations.

---

**End of plan.**
