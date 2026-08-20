# Beatdown Builder v3 — Intel on the Surface

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Beatdown Builder show a Q what it learned from the backblast archive, let him overrule it, and put the whole page back on the F3 Marietta brand.

**Architecture:** v2 already reads history (`marietta_bd_knowledge.per_ao_summary` + `extractRecentExercises()`) but the Q never sees it. v3 adds a read-only intel endpoint so the rail can populate on AO select before generation, threads the Q's repeat-lock overrides back into the prompt, and asks the model to attribute each exercise so the draft carries receipts. Along the way it repairs the beatdown components, which are still written against shadcn tokens (`bg-card`, `border-border`, `text-muted-foreground`, `text-primary`) that `@theme` never defines and Tailwind silently drops.

**Tech Stack:** Next.js 16 (App Router), Neon serverless (`getSql()`), Tailwind v4 `@theme inline`, `@google/genai` (gemini-3.1-pro-preview), `node:test` via `tsx --test`, Playwright.

**Spec:** `docs/design/beatdown-builder/` (`Main.dc.html`, `Mobile.dc.html`, `Ledger.dc.html`) — published canvas at https://claude.ai/code/artifact/24d739ec-4470-4cde-b6f8-ed6047515b2e

## Global Constraints

- Gemini 3.x only per region policy — never reintroduce `thinkingBudget` on a 3.x request; `buildModelConfig()` owns per-family config and must not be bypassed.
- Neon compute hygiene: the intel endpoint must not turn `/beatdown-builder` into a per-keystroke query source. One fetch per AO change, `runtime = 'nodejs'`, no ISR change to the page.
- Colour, type and spacing come from `src/app/globals.css` and `src/components/ui/brand/*`. No new colour values. Brand tokens only: `bone bone-2 bone-3 ink ink-2 ink-3 steel steel-2 rust olive brass muted line line-soft line-softer`.
- Every value list used by more than one module is declared once in `src/types/beatdown.ts` and imported (single-source-of-truth gate).
- Sample data never ships: the UI renders whatever the API returns, including empty.
- Unit tests: `npm run test:unit`. Types: `npx tsc --noEmit`.

---

### Task 1: Repair the token vocabulary

**Files:**
- Modify: `src/app/globals.css` (`@theme inline` block)
- Modify: `src/components/beatdown/BeatdownDisplay.tsx`, `BeatdownSection.tsx`, `ExerciseRow.tsx`, `EditableText.tsx`, `BeatdownLoader.tsx`, `ExerciseSwapModal.tsx`
- Modify: `src/app/beatdown/[short_id]/SavedBeatdownClient.tsx`
- Test: `tests/brandTokens.test.ts`

**Interfaces:**
- Produces: `--color-line-soft`, `--color-line-softer` registered in `@theme`, so `border-line-soft` (already used by `Navbar`, `MeterBar`, `WorkoutsPage`) resolves for the first time.

**Replacement map** — apply exactly:

| undefined | brand |
|---|---|
| `bg-card` | `bg-bone-2` |
| `border-border` | `border-line-soft` |
| `text-muted-foreground` | `text-muted` |
| `text-foreground` | `text-ink` |
| `text-primary` | `text-steel` |
| `bg-muted` | `bg-bone-3` |
| `bg-muted/40` | `bg-bone-3/40` |
| `bg-muted/70` | `bg-bone-3/70` |

- [ ] **Step 1: Write the failing contract test**

```ts
// tests/brandTokens.test.ts
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

const SHADCN_TOKENS = [
  "card", "border", "foreground", "muted-foreground", "primary",
  "primary-foreground", "background", "ring", "accent", "accent-foreground",
  "destructive", "destructive-foreground", "secondary", "secondary-foreground",
];
const PREFIXES = ["bg", "text", "border", "ring", "fill", "stroke", "divide", "outline"];

function walk(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(p)) out.push(p);
  }
  return out;
}

function themeColors(): Set<string> {
  const css = readFileSync("src/app/globals.css", "utf8");
  const block = css.slice(css.indexOf("@theme inline"), css.indexOf("}", css.indexOf("@theme inline")));
  return new Set([...block.matchAll(/--color-([a-z0-9-]+)\s*:/g)].map((m) => m[1]));
}

test("beatdown surface uses no shadcn tokens that @theme never defines", () => {
  const files = [...walk("src/components/beatdown"), ...walk("src/app/beatdown-builder"), ...walk("src/app/beatdown")];
  const offenders: string[] = [];
  for (const f of files) {
    const src = readFileSync(f, "utf8");
    for (const prefix of PREFIXES) {
      for (const token of SHADCN_TOKENS) {
        const re = new RegExp(`(^|[\\s"'\`])${prefix}-${token}(?![\\w-])`, "g");
        if (re.test(src)) offenders.push(`${f}: ${prefix}-${token}`);
      }
    }
  }
  assert.deepEqual(offenders, [], `undefined Tailwind colour tokens silently no-op:\n${offenders.join("\n")}`);
});

test("every soft line token the app already uses is registered in @theme", () => {
  const colors = themeColors();
  for (const name of ["line-soft", "line-softer"]) {
    assert.ok(colors.has(name), `--color-${name} missing from @theme — border-${name} silently no-ops`);
  }
});
```

- [ ] **Step 2: Run it and watch both cases fail**

Run: `npx tsx --test tests/brandTokens.test.ts`
Expected: FAIL — offenders list is non-empty, and `line-soft` is missing from `@theme`.

- [ ] **Step 3: Register the two missing tokens**

In `src/app/globals.css`, inside `@theme inline`, after `--color-line: var(--line);`:

```css
  --color-line-soft: var(--line-soft);
  --color-line-softer: var(--line-softer);
```

- [ ] **Step 4: Apply the replacement map across the beatdown components**

- [ ] **Step 5: Run tests + types**

Run: `npm run test:unit && npx tsc --noEmit`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/app/globals.css src/components/beatdown src/app/beatdown tests/brandTokens.test.ts
git commit -m "fix(beatdown): replace undefined shadcn tokens with brand tokens"
```

---

### Task 2: Intel types and shaping

**Files:**
- Modify: `src/types/beatdown.ts`
- Create: `src/lib/beatdown/intel.ts`
- Test: `tests/beatdownIntel.test.ts`

**Interfaces:**
- Produces:
```ts
export type IntelConfidence = 'strong' | 'thin' | 'region';
export interface LedgerEntry { term: string; used: number; window: number; last_used: string | null; }
export interface BeatdownIntel {
  ao_display_name: string | null;
  confidence: IntelConfidence;
  window: number;          // backblasts actually read
  on_file: number;         // backblasts for this AO in the archive
  knowledge_version: number | null;
  knowledge_generated_at: string | null;
  source_event_count: number | null;
  ao_intel: AoIntel | null;
  ledger: LedgerEntry[];
  sources: { event_date: string | null; q_name: string | null; title: string | null }[];
}
```
```ts
// src/lib/beatdown/intel.ts
export const THIN_HISTORY_THRESHOLD = 5;
export function shapeIntel(args: {
  aoDisplayName: string | null; onFile: number;
  knowledge: { id: number; generated_at: string; source_event_count: number } | null;
  aoIntel: AoIntel | null;
  recentExercises: RecentExerciseStat[];
  recent: { event_date: string | null; q_name: string | null; title: string | null }[];
}): BeatdownIntel;
```
- Confidence rule (mirrors `buildContext.ts`): no AO → `region`; AO with `onFile < THIN_HISTORY_THRESHOLD` or no `ao_intel` → `thin`; otherwise `strong`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/beatdownIntel.test.ts
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { shapeIntel, THIN_HISTORY_THRESHOLD } from "../src/lib/beatdown/intel";

const KNOWLEDGE = { id: 37, generated_at: "2026-08-20T07:02:00.000Z", source_event_count: 124 };
const AO_INTEL = { top_exercises: ["Merkin"], common_formats: ["11s"], voice_samples: ["The gloom delivered."] };

test("region scope when no AO is selected", () => {
  const intel = shapeIntel({ aoDisplayName: null, onFile: 124, knowledge: KNOWLEDGE, aoIntel: null, recentExercises: [], recent: [] });
  assert.equal(intel.confidence, "region");
  assert.equal(intel.ao_display_name, null);
});

test("thin history when the AO is under the threshold", () => {
  const intel = shapeIntel({
    aoDisplayName: "CSAUP", onFile: THIN_HISTORY_THRESHOLD - 1,
    knowledge: KNOWLEDGE, aoIntel: AO_INTEL, recentExercises: [], recent: [],
  });
  assert.equal(intel.confidence, "thin");
});

test("thin history when the AO has no intel block even with events on file", () => {
  const intel = shapeIntel({ aoDisplayName: "Black Ops", onFile: 22, knowledge: KNOWLEDGE, aoIntel: null, recentExercises: [], recent: [] });
  assert.equal(intel.confidence, "thin");
});

test("strong history carries knowledge provenance and a windowed ledger", () => {
  const intel = shapeIntel({
    aoDisplayName: "The Battlefield", onFile: 41, knowledge: KNOWLEDGE, aoIntel: AO_INTEL,
    recentExercises: [{ term: "Merkin", count: 8, lastUsed: "2026-08-15" }],
    recent: [{ event_date: "2026-08-15", q_name: "Hammer", title: "11s on the back hill" }],
  });
  assert.equal(intel.confidence, "strong");
  assert.equal(intel.knowledge_version, 37);
  assert.equal(intel.source_event_count, 124);
  assert.equal(intel.window, 1);
  assert.deepEqual(intel.ledger[0], { term: "Merkin", used: 8, window: 1, last_used: "2026-08-15" });
});

test("window reflects backblasts actually read, not the archive size", () => {
  const recent = Array.from({ length: 10 }, (_, i) => ({ event_date: `2026-08-0${i % 9 + 1}`, q_name: "Q", title: "t" }));
  const intel = shapeIntel({ aoDisplayName: "The Battlefield", onFile: 41, knowledge: KNOWLEDGE, aoIntel: AO_INTEL, recentExercises: [], recent });
  assert.equal(intel.window, 10);
  assert.equal(intel.on_file, 41);
});

test("missing knowledge row degrades without throwing", () => {
  const intel = shapeIntel({ aoDisplayName: "The Battlefield", onFile: 41, knowledge: null, aoIntel: null, recentExercises: [], recent: [] });
  assert.equal(intel.knowledge_version, null);
  assert.equal(intel.confidence, "thin");
});
```

- [ ] **Step 2: Run and verify failure** — `npx tsx --test tests/beatdownIntel.test.ts` → module not found.
- [ ] **Step 3: Add the types to `src/types/beatdown.ts` and implement `shapeIntel`.**
- [ ] **Step 4: Run tests** → PASS.
- [ ] **Step 5: Commit** — `feat(beatdown): add intel shaping for the builder rail`

---

### Task 3: Intel endpoint

**Files:**
- Create: `src/app/api/beatdown/intel/route.ts`
- Modify: `src/lib/beatdown/buildContext.ts` (export an `onFile` count + `title` on recent rows)

**Interfaces:**
- Consumes: `shapeIntel`, `BeatdownIntel` from Task 2.
- Produces: `GET /api/beatdown/intel?ao_id=<uuid|empty>` → `BeatdownIntel` (200), `{ error: 'invalid_ao' }` (400), `{ error: 'unavailable' }` (503 on DB failure).

- [ ] **Step 1** Add `runtime = 'nodejs'`, `dynamic = 'force-dynamic'`, and `checkRateLimit(request, { maxRequests: 30, windowMs: 60_000 })` — the rail fires on every AO change, so it needs a looser limit than generate.
- [ ] **Step 2** Reuse `buildBeatdownContext` rather than re-querying; add a `COUNT(*)` for `on_file` in the same `Promise.all` so the endpoint costs one Neon round trip.
- [ ] **Step 3** On any DB throw, return 503 with an empty-safe body — the page must still render (matches the graceful-degradation contract in `beatdown-builder/page.tsx`).
- [ ] **Step 4** `npx tsc --noEmit` → PASS.
- [ ] **Step 5: Commit** — `feat(beatdown): add /api/beatdown/intel for the live rail`

---

### Task 4: Honour the Q's repeat locks

**Files:**
- Modify: `src/types/beatdown.ts` (`BeatdownInputs.released_terms: string[]`)
- Modify: `src/lib/beatdown/prompts/user.ts`
- Modify: `src/app/api/beatdown/generate/route.ts` (validate + thread through)
- Test: `tests/beatdownPrompt.test.ts` (extend)

**Interfaces:**
- Consumes: `BeatdownInputs` from Task 2.
- Produces: `buildUserPrompt` drops any `recentExercises` entry whose term is in `inputs.released_terms`, and names the release explicitly so the model does not treat the omission as an accident.

- [ ] **Step 1: Write the failing tests**

```ts
test("released terms are removed from the avoid-repeat list", () => {
  const prompt = buildUserPrompt(baseArgs({
    inputs: { ...INPUTS, released_terms: ["Merkin"] },
    recentExercises: [
      { term: "Merkin", count: 8, lastUsed: "2026-08-15" },
      { term: "Squat", count: 7, lastUsed: "2026-08-15" },
    ],
  }));
  assert.doesNotMatch(prompt, /- Merkin \(8 of the last/);
  assert.match(prompt, /- Squat \(7 of the last/);
});

test("released terms are named so the model knows they are deliberate", () => {
  const prompt = buildUserPrompt(baseArgs({
    inputs: { ...INPUTS, released_terms: ["Merkin"] },
    recentExercises: [{ term: "Merkin", count: 8, lastUsed: "2026-08-15" }],
  }));
  assert.match(prompt, /Q has explicitly allowed: Merkin/);
});

test("release matching is case-insensitive", () => {
  const prompt = buildUserPrompt(baseArgs({
    inputs: { ...INPUTS, released_terms: ["merkin"] },
    recentExercises: [{ term: "Merkin", count: 8, lastUsed: "2026-08-15" }],
  }));
  assert.doesNotMatch(prompt, /- Merkin \(8 of the last/);
});

test("an empty release list leaves the avoid-repeat block untouched", () => {
  const prompt = buildUserPrompt(baseArgs({
    recentExercises: [{ term: "Merkin", count: 8, lastUsed: "2026-08-15" }],
  }));
  assert.match(prompt, /- Merkin \(8 of the last/);
  assert.doesNotMatch(prompt, /explicitly allowed/);
});
```

- [ ] **Step 2** Run → FAIL (`released_terms` not on the type).
- [ ] **Step 3** Add `released_terms` to `BeatdownInputs`, filter in `buildUserPrompt`, validate in the route (`Array.isArray`, strings only, cap at 40 entries, cap each at 60 chars).
- [ ] **Step 4** Run `npm run test:unit` → PASS.
- [ ] **Step 5: Commit** — `feat(beatdown): let the Q release locked repeat terms`

---

### Task 5: Receipts on generated exercises

**Files:**
- Modify: `src/types/beatdown.ts` (`BeatdownExerciseItem.source?: string`)
- Modify: `src/lib/beatdown/prompts/system.ts` (schema + instruction)
- Modify: `src/lib/beatdown/localFallback.ts` (emit no source rather than a fake one)
- Create: `src/components/beatdown/SourceTag.tsx`
- Test: `tests/beatdownSource.test.ts`

**Interfaces:**
- Produces: `SOURCE_KINDS` — the single-source-of-truth vocabulary shared by the prompt, the parser and the UI:
```ts
export const SOURCE_KINDS = ['ao-signature', 'crowd-pleaser', 'fresh', 'famous-bd', 'q-notes', 'region'] as const;
export type SourceKind = (typeof SOURCE_KINDS)[number];
```
- `normalizeSource(raw: unknown): SourceKind | null` — tolerant of absence and of a model returning an unknown string. A missing source renders nothing; it must never break a draft.

- [ ] **Step 1** Write tests: every `SOURCE_KINDS` value round-trips through `normalizeSource`; unknown strings and `undefined` return `null`; the system instruction names every kind (vocabulary contract test).
- [ ] **Step 2** Run → FAIL.
- [ ] **Step 3** Implement, extend the system-prompt schema with `"source"`, render `SourceTag` in `ExerciseRow`.
- [ ] **Step 4** Run tests → PASS.
- [ ] **Step 5: Commit** — `feat(beatdown): attribute each generated exercise`

---

### Task 6: The workbench

**Files:**
- Create: `src/components/beatdown/IntelRail.tsx`, `MusterLog.tsx`, `ProvenanceStrip.tsx`
- Modify: `src/app/beatdown-builder/BeatdownBuilderClient.tsx`, `src/components/beatdown/BeatdownForm.tsx`, `BeatdownDisplay.tsx`, `ShareActionsBar.tsx`
- Delete: `src/components/beatdown/BeatdownLoader.tsx` (superseded by `MusterLog`)
- Test: `tests/beatdown-builder.spec.ts` (extend, Playwright)

**Interfaces:**
- Consumes: `BeatdownIntel` (Task 2), `GET /api/beatdown/intel` (Task 3), `released_terms` (Task 4), `SourceTag` (Task 5).

- [ ] **Step 1** `BeatdownBuilderClient` holds `intel`, `releasedTerms`, `step`. Fetch intel on AO change with an `AbortController` so fast switching cannot land a stale rail.
- [ ] **Step 2** Two-column grid at `lg:`, single column below; the rail becomes a collapsible drawer under the AO picker on mobile. Chips move to square brand chips at `min-height: 44px`.
- [ ] **Step 3** `MusterLog` advances through real stage labels driven by elapsed time, and states the AO and lock count it is generating against.
- [ ] **Step 4** `ShareActionsBar` gets an opaque background and a hard top rule — the transparent sticky bar is what caused the iOS ghosting bug.
- [ ] **Step 5** `npx tsc --noEmit && npm run test:unit` → PASS; then drive the page in a browser (ui-feature-verify gate) before claiming done.
- [ ] **Step 6: Commit** — `feat(beatdown): intel rail, muster log and provenance strip`

---

### Task 7: The Ledger page

**Files:**
- Create: `src/app/beatdown-builder/ledger/page.tsx`, `LedgerClient.tsx`

**Interfaces:**
- Consumes: `GET /api/beatdown/intel` per AO; the AO list from `ao_channels`.

- [ ] **Step 1** Server component loads the enabled AO list (ISR 3600, same graceful-degradation contract as the builder page).
- [ ] **Step 2** Client renders knowledge freshness against `KNOWLEDGE_STALE_DAYS = 14`, per-AO coverage bars scaled to the largest AO, verbatim voice samples, and the source backblasts.
- [ ] **Step 3** Link it from the rail.
- [ ] **Step 4** `npx tsc --noEmit && npm run build` → PASS.
- [ ] **Step 5: Commit** — `feat(beatdown): add the archive ledger page`

---

## Self-Review

**Spec coverage:** rail → Task 6; repeat ledger + release → Tasks 2/3/4/6; muster log → Task 6; provenance strip → Tasks 3/6; receipts → Task 5; Ledger artboard → Task 7; brand repair (the whole canvas assumes it) → Task 1.

**Type consistency:** `BeatdownIntel.window` / `.on_file` / `.ledger[].used` are used with those exact names in Tasks 3, 6 and 7. `released_terms` is the wire name in Tasks 4 and 6. `SOURCE_KINDS` is declared once in Task 5 and consumed by prompt, parser and UI.

**Known gap:** the model fallback chain (`3.5-flash`, `2.5-flash`, `localFallback`) is threaded into provenance data by Task 3 but is not surfaced in the UI — Jordan has that decision open.
