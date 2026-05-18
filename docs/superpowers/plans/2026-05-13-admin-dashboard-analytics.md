# Admin Dashboard Analytics — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add YTD analytics (Total Posts, FNGs, Unique PAX, Posts-by-AO pie, Top-20-PAX bar) above the existing 4-tile nav grid at `/admin`.

**Architecture:** Single async Server Component (`src/app/admin/page.tsx`) calls a new `getDashboardStats()` helper that runs three SQL queries in parallel, parses `content_text` for PAX and FNG names, merges Slack-ID + nickname identities via `slack_users.display_name`, and returns a typed object. Three new presentation components render the data with hand-rolled SVG and CSS — zero new runtime dependencies.

**Tech Stack:** Next.js 16 App Router (RSC), Neon Postgres via `@neondatabase/serverless`, TypeScript, Tailwind, existing brand UI (`ClipFrame`, `MonoTag`, `SectionHead`), Playwright for integration tests, `node:test` + `tsx` for unit tests.

**Spec:** [`docs/superpowers/specs/2026-05-13-admin-dashboard-analytics-design.md`](../specs/2026-05-13-admin-dashboard-analytics-design.md)

---

## File Structure

**Create:**
- `src/lib/stats/parseFngLine.ts` — Extracts FNG names from a backblast's `content_text`. Returns `Set<string>` of normalized tokens (Slack IDs as `U…`, nicknames as `n:<lower-name>`). Mirrors the pattern in `extractPaxTokens`.
- `src/lib/stats/resolvePaxIdentity.ts` — Merges Slack-ID + nickname tokens into one canonical entry using `slack_users.display_name`. Returns ranked `Array<{ key, label, count }>`.
- `src/lib/stats/getDashboardStats.ts` — Entry point. Fans out three SQL queries via `Promise.all`, parses rows, returns `DashboardStats`.
- `src/components/admin/DashboardStats.tsx` — KPI tile grid (3 tiles: Total Posts / FNGs / Unique PAX).
- `src/components/admin/PostsByAoChart.tsx` — SVG pie chart (top 4 AOs + "Other").
- `src/components/admin/TopPaxChart.tsx` — Horizontal bar chart, top 20 PAX.
- `tests/parseFngLine.test.ts` — Unit tests for the FNG parser.
- `tests/resolvePaxIdentity.test.ts` — Unit tests for the identity merge.
- `tests/admin-dashboard.spec.ts` — Playwright integration test.

**Modify:**
- `src/app/admin/page.tsx` — Make `async`, add analytics rows above the existing 4 nav tiles.
- `package.json` — Add `tsx` to `devDependencies` and a `test:unit` script.

---

## Task 1: Add tsx dev dep + test:unit script

**Why first:** Tasks 2–3 write unit tests run via `tsx --test`. Without `tsx` pinned in `devDependencies`, CI and other contributors can't reproduce the test run.

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install tsx as a dev dependency**

Run from the repo root:
```bash
npm install --save-dev tsx
```
Expected: `tsx` added under `devDependencies` in `package.json` and `package-lock.json` updated.

- [ ] **Step 2: Add a test:unit script**

Edit `package.json` `"scripts"` section. Insert after `"lint": "eslint",`:
```json
"test:unit": "tsx --test tests/*.test.ts",
```
Resulting scripts block (relevant portion):
```json
"scripts": {
  "dev": "next dev",
  "prebuild": "npx tsx scripts/syncGlossary.ts",
  "build": "next build",
  "start": "next start",
  "lint": "eslint",
  "test:unit": "tsx --test tests/*.test.ts",
  "regenerate-glossary": "npx tsx scripts/regenerateGlossary.ts",
  "sync-glossary": "npx tsx scripts/syncGlossary.ts",
  "test:e2e": "playwright test",
  "test:e2e:ui": "playwright test --ui",
  "test:e2e:report": "playwright show-report"
}
```

- [ ] **Step 3: Verify the script runs (no tests yet — should report no files)**

```bash
npm run test:unit
```
Expected: tsx prints something like `> tsx --test tests/*.test.ts` and either reports zero tests or "no test files matched". Either is fine — confirms tsx is wired up. If you see `command not found` or `Cannot find module`, fix before continuing.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore(deps): add tsx + test:unit script for unit tests"
```

---

## Task 2: parseFngLine — tests + implementation

**Files:**
- Create: `tests/parseFngLine.test.ts`
- Create: `src/lib/stats/parseFngLine.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/parseFngLine.test.ts` with this exact content:
```typescript
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseFngLine } from "../src/lib/stats/parseFngLine";

test("parses simple FNG: line with comma-separated nicknames", () => {
  const result = parseFngLine("FNG: Nessie, Bill Nye");
  assert.deepEqual(Array.from(result).sort(), ["n:bill nye", "n:nessie"]);
});

test("parses FNGs: (plural) with Slack markdown asterisks", () => {
  const result = parseFngLine("*FNGs:* Nessie, @U01ABC123");
  assert.deepEqual(Array.from(result).sort(), ["U01ABC123", "n:nessie"]);
});

test("returns empty set for FNG: none", () => {
  assert.equal(parseFngLine("FNG: none").size, 0);
});

test("returns empty set for FNG: n/a", () => {
  assert.equal(parseFngLine("FNG: n/a").size, 0);
});

test("returns empty set for FNG: 0", () => {
  assert.equal(parseFngLine("FNG: 0").size, 0);
});

test("returns empty set for numeric-only FNG: 2", () => {
  assert.equal(parseFngLine("FNG: 2").size, 0);
});

test("returns empty set for FNG: 3 (no names)", () => {
  assert.equal(parseFngLine("FNG: 3 (no names)").size, 0);
});

test("finds FNG line embedded in multi-line content", () => {
  const content = "Beatdown was strong.\nPAX: Foo, Bar\nFNG: Newbie\nCOT: Done.";
  const result = parseFngLine(content);
  assert.deepEqual(Array.from(result), ["n:newbie"]);
});

test("returns empty set when no FNG line is present", () => {
  assert.equal(parseFngLine("Just a regular post with no FNG line.").size, 0);
});

test("handles empty string input", () => {
  assert.equal(parseFngLine("").size, 0);
});

test("handles raw Slack ID without @ prefix", () => {
  const result = parseFngLine("FNG: U02XYZ9876");
  assert.deepEqual(Array.from(result), ["U02XYZ9876"]);
});

test("filters single-character tokens", () => {
  const result = parseFngLine("FNG: A, Bill Nye");
  assert.deepEqual(Array.from(result), ["n:bill nye"]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:unit
```
Expected: All `parseFngLine.test.ts` tests fail with `Cannot find module '../src/lib/stats/parseFngLine'` (or similar import error).

- [ ] **Step 3: Implement parseFngLine**

Create `src/lib/stats/parseFngLine.ts` with this exact content:
```typescript
const STOPWORDS = new Set([
  "none",
  "n/a",
  "na",
  "-",
  "0",
  "zero",
  "pax",
  "fng",
  "fngs",
  "",
]);

const FNG_LINE = /^[\s*_]*FNG[s]?[\s*_]*:\s*(.+)$/im;
const NUMERIC_ONLY = /^[\s*_]*\d+[\s*_]*(\(.*\))?[\s*_]*$/;
const SLACK_ID = /@?(U[A-Z0-9]{7,})/g;

/**
 * Extract FNG names from a backblast's content_text.
 *
 * Returns a Set of normalized tokens:
 *   - Slack user IDs kept as uppercase `U...`
 *   - Free-text nicknames stored as `n:<lowercased-name>`
 *
 * Returns an empty Set for missing lines, "FNG: none", and numeric-only
 * lines (e.g. "FNG: 2") — without names we can't dedupe across the year.
 */
export function parseFngLine(content: string): Set<string> {
  const out = new Set<string>();
  if (!content) return out;

  const match = content.match(FNG_LINE);
  if (!match || !match[1]) return out;

  let remainder = match[1].trim();
  if (NUMERIC_ONLY.test(remainder)) return out;

  // Pull Slack IDs first so they don't get mangled by nickname normalization.
  let m: RegExpExecArray | null;
  while ((m = SLACK_ID.exec(remainder)) !== null) {
    out.add(m[1]);
  }
  remainder = remainder.replace(SLACK_ID, "");

  for (const piece of remainder.split(",")) {
    const name = piece
      .trim()
      .replace(/^@/, "")
      .replace(/^[.<>()\[\]"'`]+|[.<>()\[\]"'`]+$/g, "")
      .trim()
      .toLowerCase();
    if (!name || STOPWORDS.has(name) || name.length < 2) continue;
    out.add(`n:${name}`);
  }

  return out;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:unit
```
Expected: All 12 `parseFngLine.test.ts` cases pass. No type errors.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```
Expected: Clean exit, no output.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stats/parseFngLine.ts tests/parseFngLine.test.ts
git commit -m "feat(stats): add parseFngLine for extracting FNGs from backblasts"
```

---

## Task 3: resolvePaxIdentity — tests + implementation

**Files:**
- Create: `tests/resolvePaxIdentity.test.ts`
- Create: `src/lib/stats/resolvePaxIdentity.ts`

- [ ] **Step 1: Write the failing tests**

Create `tests/resolvePaxIdentity.test.ts` with this exact content:
```typescript
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { resolvePaxIdentity } from "../src/lib/stats/resolvePaxIdentity";

test("merges Slack ID with matching nickname into one entry", () => {
  const counts = new Map<string, number>([
    ["U01ABC", 3],
    ["n:nessie", 5],
  ]);
  const slackUsers = [{ slack_user_id: "U01ABC", display_name: "Nessie" }];
  const result = resolvePaxIdentity(counts, slackUsers);
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "n:nessie");
  assert.equal(result[0].label, "Nessie");
  assert.equal(result[0].count, 8);
});

test("keeps Slack ID raw when no slack_users row matches", () => {
  const counts = new Map<string, number>([["U01XYZ", 2]]);
  const result = resolvePaxIdentity(counts, []);
  assert.equal(result.length, 1);
  assert.equal(result[0].key, "U01XYZ");
  assert.equal(result[0].label, "U01XYZ");
  assert.equal(result[0].count, 2);
});

test("keeps unrelated nicknames as separate entries", () => {
  const counts = new Map<string, number>([
    ["n:nessie", 3],
    ["n:bill nye", 5],
  ]);
  const result = resolvePaxIdentity(counts, []);
  assert.equal(result.length, 2);
  assert.equal(result[0].count, 5);
  assert.equal(result[1].count, 3);
});

test("title-cases unmatched multi-word nicknames", () => {
  const counts = new Map<string, number>([["n:bill nye", 4]]);
  const result = resolvePaxIdentity(counts, []);
  assert.equal(result[0].label, "Bill Nye");
});

test("uses display_name casing when slack_users matches a nickname", () => {
  const counts = new Map<string, number>([["n:nessie", 7]]);
  const slackUsers = [{ slack_user_id: "U01ABC", display_name: "Nessie" }];
  const result = resolvePaxIdentity(counts, slackUsers);
  assert.equal(result[0].label, "Nessie");
});

test("sorts results by count descending", () => {
  const counts = new Map<string, number>([
    ["n:a", 1],
    ["n:b", 5],
    ["n:c", 3],
  ]);
  const result = resolvePaxIdentity(counts, []);
  assert.deepEqual(
    result.map((r) => r.label),
    ["B", "C", "A"],
  );
});

test("returns empty array for empty input", () => {
  assert.deepEqual(resolvePaxIdentity(new Map(), []), []);
});

test("ignores slack_users rows with null display_name", () => {
  const counts = new Map<string, number>([["U01ABC", 4]]);
  const slackUsers = [{ slack_user_id: "U01ABC", display_name: null }];
  const result = resolvePaxIdentity(counts, slackUsers);
  assert.equal(result[0].key, "U01ABC");
  assert.equal(result[0].label, "U01ABC");
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npm run test:unit
```
Expected: `resolvePaxIdentity.test.ts` cases fail with `Cannot find module '../src/lib/stats/resolvePaxIdentity'`. The Task 2 tests still pass.

- [ ] **Step 3: Implement resolvePaxIdentity**

Create `src/lib/stats/resolvePaxIdentity.ts` with this exact content:
```typescript
export type SlackUser = {
  slack_user_id: string;
  display_name: string | null;
};

export type PaxRanking = {
  key: string;
  label: string;
  count: number;
};

/**
 * Merge Slack-ID tokens (U...) and nickname tokens (n:lowercased-name) into
 * one canonical entry per person, using slack_users.display_name as the
 * bridge. Returns ranked entries sorted by count descending.
 *
 * Limitations (acceptable for v1):
 *   - Two nicknames differing only by spacing/punctuation are not merged.
 *   - Distinctive nickname casing (e.g. "MC Hammer") is title-cased to
 *     "Mc Hammer" when there is no slack_users match.
 *   - Slack IDs without a slack_users row display as their raw "U..." token.
 */
export function resolvePaxIdentity(
  counts: Map<string, number>,
  slackUsers: SlackUser[],
): PaxRanking[] {
  const slackById = new Map<string, string>();
  const slackByName = new Map<string, string>();
  for (const u of slackUsers) {
    if (!u.display_name) continue;
    slackById.set(u.slack_user_id, u.display_name);
    slackByName.set(`n:${u.display_name.toLowerCase()}`, u.display_name);
  }

  const merged = new Map<string, number>();
  for (const [token, count] of counts) {
    let canonical = token;
    if (token.startsWith("U") && slackById.has(token)) {
      canonical = `n:${slackById.get(token)!.toLowerCase()}`;
    }
    merged.set(canonical, (merged.get(canonical) ?? 0) + count);
  }

  const result: PaxRanking[] = [];
  for (const [key, count] of merged) {
    let label: string;
    if (slackByName.has(key)) {
      label = slackByName.get(key)!;
    } else if (key.startsWith("U")) {
      label = key;
    } else {
      label = key.slice(2).replace(/\b\w/g, (c) => c.toUpperCase());
    }
    result.push({ key, label, count });
  }

  result.sort((a, b) => b.count - a.count);
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npm run test:unit
```
Expected: All 12 parseFngLine tests + 8 resolvePaxIdentity tests pass.

- [ ] **Step 5: Type check**

```bash
npx tsc --noEmit
```
Expected: Clean exit.

- [ ] **Step 6: Commit**

```bash
git add src/lib/stats/resolvePaxIdentity.ts tests/resolvePaxIdentity.test.ts
git commit -m "feat(stats): add resolvePaxIdentity for merging Slack ID + nickname tokens"
```

---

## Task 4: getDashboardStats — data orchestrator

**Files:**
- Create: `src/lib/stats/getDashboardStats.ts`

No unit test for this task — it's a DB-bound orchestrator. Manual verification happens in Task 8 once the page is wired up; the Playwright test in Task 9 covers integration.

- [ ] **Step 1: Implement getDashboardStats**

Create `src/lib/stats/getDashboardStats.ts` with this exact content:
```typescript
import { getSql } from "@/lib/db";
import { extractPaxTokens } from "@/lib/stats/getWeeklyPaxCount";
import { parseFngLine } from "./parseFngLine";
import {
  resolvePaxIdentity,
  type SlackUser,
  type PaxRanking,
} from "./resolvePaxIdentity";

export type DashboardStats = {
  totalPosts: number;
  uniquePax: number;
  newFngs: number;
  byAo: Array<{ ao: string; count: number }>;
  topPax: PaxRanking[];
};

const EMPTY_STATS: DashboardStats = {
  totalPosts: 0,
  uniquePax: 0,
  newFngs: 0,
  byAo: [],
  topPax: [],
};

/**
 * Fetch year-to-date analytics for the Marietta region admin dashboard.
 *
 * Runs three parallel SQL queries: posts grouped by AO, raw content_text
 * rows for parsing, and slack_users for identity resolution. Returns the
 * empty stats object on any error so the dashboard renders zero state
 * instead of crashing.
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  try {
    const sql = getSql();
    const [byAoRows, contentRows, userRows] = await Promise.all([
      sql`
        SELECT e.ao_display_name AS ao, COUNT(*)::int AS n
        FROM f3_events e
        JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
        WHERE e.event_kind = 'backblast'
          AND e.is_deleted = false
          AND c.is_enabled = true
          AND e.event_date IS NOT NULL
          AND e.event_date >= date_trunc('year', (now() AT TIME ZONE 'America/New_York'))::date
        GROUP BY e.ao_display_name
        ORDER BY n DESC
      `,
      sql`
        SELECT e.content_text
        FROM f3_events e
        JOIN ao_channels c ON c.slack_channel_id = e.slack_channel_id
        WHERE e.event_kind = 'backblast'
          AND e.is_deleted = false
          AND c.is_enabled = true
          AND e.event_date IS NOT NULL
          AND e.event_date >= date_trunc('year', (now() AT TIME ZONE 'America/New_York'))::date
      `,
      sql`
        SELECT slack_user_id, display_name
        FROM slack_users
        WHERE display_name IS NOT NULL
      `,
    ]);

    const byAo = (byAoRows as Array<{ ao: string | null; n: number }>)
      .filter((r) => r.ao !== null)
      .map((r) => ({ ao: r.ao as string, count: Number(r.n) }));
    const totalPosts = byAo.reduce((sum, r) => sum + r.count, 0);

    const paxCounts = new Map<string, number>();
    const fngTokens = new Set<string>();
    for (const row of contentRows as Array<{ content_text: string | null }>) {
      const text = row.content_text ?? "";
      for (const token of extractPaxTokens(text)) {
        paxCounts.set(token, (paxCounts.get(token) ?? 0) + 1);
      }
      for (const fng of parseFngLine(text)) {
        fngTokens.add(fng);
      }
    }

    const slackUsers = userRows as SlackUser[];
    const ranked = resolvePaxIdentity(paxCounts, slackUsers);
    const topPax = ranked.slice(0, 20);
    const uniquePax = ranked.length;

    const fngCounts = new Map<string, number>();
    for (const t of fngTokens) fngCounts.set(t, 1);
    const newFngs = resolvePaxIdentity(fngCounts, slackUsers).length;

    return { totalPosts, uniquePax, newFngs, byAo, topPax };
  } catch (err) {
    console.error("[getDashboardStats] failed:", err);
    return EMPTY_STATS;
  }
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: Clean exit. If `extractPaxTokens` is not exported from `getWeeklyPaxCount`, verify the import is correct — at the time of writing it is exported (see `src/lib/stats/getWeeklyPaxCount.ts:64`).

- [ ] **Step 3: Commit**

```bash
git add src/lib/stats/getDashboardStats.ts
git commit -m "feat(stats): add getDashboardStats orchestrator for admin dashboard"
```

---

## Task 5: PostsByAoChart component

**Files:**
- Create: `src/components/admin/PostsByAoChart.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/admin/PostsByAoChart.tsx` with this exact content:
```typescript
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

type Datum = { ao: string; count: number };

type Slice = { ao: string; count: number; color: string; path: string; pct: number };

const COLORS = ["#d4a93c", "#0a0a0a", "#7e6b3a", "#b8a160", "#d4d0c2"];

function buildArcs(data: Datum[], total: number): Slice[] {
  const top = data.slice(0, 4);
  const rest = data.slice(4);

  const flat: Array<{ ao: string; count: number; color: string }> = top.map((d, i) => ({
    ao: d.ao,
    count: d.count,
    color: COLORS[i],
  }));
  if (rest.length > 0) {
    flat.push({
      ao: rest.length === 1 ? rest[0].ao : `Other (${rest.length} AOs)`,
      count: rest.reduce((s, r) => s + r.count, 0),
      color: COLORS[4],
    });
  }

  let cumulative = 0;
  return flat.map((s) => {
    const startFrac = cumulative / total;
    cumulative += s.count;
    const endFrac = cumulative / total;
    const startAngle = startFrac * 2 * Math.PI - Math.PI / 2;
    const endAngle = endFrac * 2 * Math.PI - Math.PI / 2;
    const x1 = 100 * Math.cos(startAngle);
    const y1 = 100 * Math.sin(startAngle);
    const x2 = 100 * Math.cos(endAngle);
    const y2 = 100 * Math.sin(endAngle);
    const largeArc = endFrac - startFrac > 0.5 ? 1 : 0;
    const path =
      flat.length === 1
        // single AO — draw a full circle
        ? `M 0 -100 A 100 100 0 1 1 0 100 A 100 100 0 1 1 0 -100 Z`
        : `M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 100 100 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    return { ...s, path, pct: Math.round((s.count / total) * 100) };
  });
}

export function PostsByAoChart({ data }: { data: Datum[] }) {
  const total = data.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) {
    return (
      <ClipFrame padding="p-6" className="min-h-[260px]">
        <MonoTag>// posts by ao</MonoTag>
        <h3 className="font-display font-black uppercase text-[24px] tracking-[-.01em] mt-3 mb-4">
          By AO
        </h3>
        <p className="font-mono text-xs text-muted">// no posts yet this year</p>
      </ClipFrame>
    );
  }

  const arcs = buildArcs(data, total);

  return (
    <ClipFrame padding="p-6" className="min-h-[260px]">
      <MonoTag>// posts by ao</MonoTag>
      <h3 className="font-display font-black uppercase text-[24px] tracking-[-.01em] mt-3 mb-4">
        By AO
      </h3>
      <div className="flex gap-6 items-center">
        <svg
          viewBox="-110 -110 220 220"
          className="w-[180px] h-[180px] flex-shrink-0"
          role="img"
          aria-label={`Posts by AO. ${arcs.map((a) => `${a.ao} ${a.pct}%`).join(", ")}.`}
        >
          {arcs.map((a, i) => (
            <path key={`${a.ao}-${i}`} d={a.path} fill={a.color} stroke="#0a0a0a" strokeWidth={1} />
          ))}
        </svg>
        <ul className="font-mono text-xs leading-relaxed flex-1 space-y-1.5">
          {arcs.map((a, i) => (
            <li key={`${a.ao}-${i}`} className="grid grid-cols-[14px_1fr_40px] items-center gap-2">
              <span
                className="w-2.5 h-2.5 border border-ink inline-block"
                style={{ background: a.color }}
                aria-hidden="true"
              />
              <span className="truncate">{a.ao}</span>
              <span className="text-right text-muted">{a.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ClipFrame>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/PostsByAoChart.tsx
git commit -m "feat(admin): add PostsByAoChart pie component"
```

---

## Task 6: TopPaxChart component

**Files:**
- Create: `src/components/admin/TopPaxChart.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/admin/TopPaxChart.tsx` with this exact content:
```typescript
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import type { PaxRanking } from "@/lib/stats/resolvePaxIdentity";

export function TopPaxChart({ data }: { data: PaxRanking[] }) {
  if (data.length === 0) {
    return (
      <ClipFrame padding="p-6" className="min-h-[260px]">
        <MonoTag>// top posters · top 20 ytd</MonoTag>
        <h3 className="font-display font-black uppercase text-[24px] tracking-[-.01em] mt-3 mb-4">
          Top PAX
        </h3>
        <p className="font-mono text-xs text-muted">// no posts yet this year</p>
      </ClipFrame>
    );
  }

  const max = data[0].count;

  return (
    <ClipFrame padding="p-6" className="min-h-[260px]">
      <MonoTag>// top posters · top 20 ytd</MonoTag>
      <h3 className="font-display font-black uppercase text-[24px] tracking-[-.01em] mt-3 mb-4">
        Top PAX
      </h3>
      <ul className="font-mono text-xs space-y-1.5">
        {data.map((p) => {
          const widthPct = max === 0 ? 0 : Math.max(2, (p.count / max) * 100);
          return (
            <li
              key={p.key}
              className="grid grid-cols-[130px_1fr_40px] items-center gap-3"
            >
              <span className="truncate" title={p.label}>
                {p.label}
              </span>
              <span
                className="h-3.5 bg-ink block"
                style={{ width: `${widthPct}%` }}
                aria-hidden="true"
              />
              <span className="text-right">{p.count}</span>
            </li>
          );
        })}
      </ul>
    </ClipFrame>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/TopPaxChart.tsx
git commit -m "feat(admin): add TopPaxChart bar component"
```

---

## Task 7: DashboardStats KPI tile component

**Files:**
- Create: `src/components/admin/DashboardStats.tsx`

- [ ] **Step 1: Implement the component**

Create `src/components/admin/DashboardStats.tsx` with this exact content:
```typescript
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

type Props = {
  totalPosts: number;
  uniquePax: number;
  newFngs: number;
  aoCount: number;
};

export function DashboardStats({ totalPosts, uniquePax, newFngs, aoCount }: Props) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
      <Stat
        tag="// total posts ytd"
        value={totalPosts}
        sub={aoCount === 1 ? "across 1 AO" : `across ${aoCount} AOs`}
      />
      <Stat
        tag="// new fngs ytd"
        value={newFngs}
        sub="parsed from backblast FNG: lines"
      />
      <Stat
        tag="// unique pax ytd"
        value={uniquePax}
        sub="posted at least once this year"
      />
    </div>
  );
}

function Stat({ tag, value, sub }: { tag: string; value: number; sub: string }) {
  return (
    <ClipFrame padding="p-5" className="min-h-[120px]">
      <MonoTag>{tag}</MonoTag>
      <div className="font-display text-[68px] leading-[.95] tracking-[-.01em] mt-2">
        {value.toLocaleString()}
      </div>
      <div className="font-mono text-[11px] text-muted mt-2">{sub}</div>
    </ClipFrame>
  );
}
```

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: Clean exit.

- [ ] **Step 3: Commit**

```bash
git add src/components/admin/DashboardStats.tsx
git commit -m "feat(admin): add DashboardStats KPI tile component"
```

---

## Task 8: Wire analytics into /admin page

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Replace the page contents**

Replace the entire contents of `src/app/admin/page.tsx` with:
```typescript
import Link from "next/link";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ChamferButton } from "@/components/ui/brand/ChamferButton";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { DashboardStats } from "@/components/admin/DashboardStats";
import { PostsByAoChart } from "@/components/admin/PostsByAoChart";
import { TopPaxChart } from "@/components/admin/TopPaxChart";
import { getDashboardStats } from "@/lib/stats/getDashboardStats";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const stats = await getDashboardStats();

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow="§ Admin · Dashboard"
        h2="Region Ops."
        kicker={<>YTD analytics + management.</>}
        align="left"
      />

      <DashboardStats
        totalPosts={stats.totalPosts}
        uniquePax={stats.uniquePax}
        newFngs={stats.newFngs}
        aoCount={stats.byAo.length}
      />

      <div className="grid grid-cols-1 md:grid-cols-12 gap-4 mb-14">
        <div className="md:col-span-5">
          <PostsByAoChart data={stats.byAo} />
        </div>
        <div className="md:col-span-7">
          <TopPaxChart data={stats.topPax} />
        </div>
      </div>

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
              <div className="mt-4 font-display font-bold uppercase text-[32px] tracking-[-.01em]">
                Manage →
              </div>
            </ClipFrame>
          </Link>
        ))}
      </div>

      <div className="flex flex-wrap gap-3">
        <ChamferButton href="/admin/workouts" variant="ink" size="md">
          New Workout
        </ChamferButton>
        <ChamferButton href="/admin/drafts" variant="ink" size="md">
          New Draft
        </ChamferButton>
      </div>
    </section>
  );
}
```

The key differences vs the existing page:
1. `async` function with `await getDashboardStats()`
2. `export const dynamic = "force-dynamic"` — disables ISR so the DB query runs on every load (matches the "live query" decision in the spec)
3. Three new sections above the existing 4-tile nav grid
4. Kicker copy changed from "Manage workouts, regions, drafts, newsletter, and the knowledge base." to "YTD analytics + management."

- [ ] **Step 2: Type check**

```bash
npx tsc --noEmit
```
Expected: Clean exit.

- [ ] **Step 3: Smoke test in the browser**

Confirm the dev server is running (`http://localhost:3001` per the running session) and load `/admin`. You should see:
- The Region Ops. header (unchanged)
- 3 KPI tiles with real numbers
- A pie chart and a bar chart
- The 4 existing nav tiles below
- The two existing "New Workout" / "New Draft" buttons at the bottom

Confirm no console errors. If there's a runtime error (e.g., missing DB column), open the dev server log and address before continuing.

- [ ] **Step 4: Commit**

```bash
git add src/app/admin/page.tsx
git commit -m "feat(admin): wire YTD analytics above existing nav tiles"
```

---

## Task 9: Playwright integration test

**Files:**
- Create: `tests/admin-dashboard.spec.ts`

- [ ] **Step 1: Inspect existing Playwright auth pattern**

Read the existing admin test for the auth pattern:
```bash
cat tests/admin-newsletter.spec.ts | head -50
```
The new test follows the same login flow. If `tests/admin-newsletter.spec.ts` does NOT exist (it should, per the git status at session start), instead read `tests/beatdown-builder.spec.ts` for the auth pattern.

- [ ] **Step 2: Write the test**

Create `tests/admin-dashboard.spec.ts` with this exact content. Adjust the login flow lines (marked) to match the pattern from Step 1 — the rest stays as-is:
```typescript
import { test, expect } from "@playwright/test";

const ADMIN_PATH = "/admin";

test.describe("admin dashboard", () => {
  test("renders KPI tiles, pie chart, bar chart, and nav tiles", async ({ page }) => {
    // --- LOGIN ---
    // Replace this block with the actual admin login flow used by other admin
    // specs (e.g., setting an admin cookie, visiting a magic-link URL, or
    // submitting the admin login form). The exact pattern lives in
    // tests/admin-newsletter.spec.ts — copy it verbatim here.
    await page.goto(ADMIN_PATH);

    // --- HERO ---
    await expect(page.getByRole("heading", { name: /Region Ops\./i })).toBeVisible();

    // --- KPI TILES ---
    // Each tile is identified by its eyebrow text (case-insensitive). Each
    // should contain a number (we don't pin a specific value because real
    // region data shifts daily).
    for (const tag of ["// total posts ytd", "// new fngs ytd", "// unique pax ytd"]) {
      const tile = page.locator("div", { hasText: tag }).first();
      await expect(tile).toBeVisible();
      await expect(tile).toContainText(/\d+/);
    }

    // --- PIE CHART ---
    // The pie SVG has aria-label="Posts by AO. ...".
    const pie = page.getByRole("img", { name: /Posts by AO/i });
    await expect(pie).toBeVisible();

    // --- BAR CHART ---
    await expect(page.getByRole("heading", { name: /Top PAX/i })).toBeVisible();

    // --- EXISTING NAV TILES ---
    for (const label of ["Active AOs", "Regions", "Drafts", "Newsletter"]) {
      await expect(page.getByText(`// ${label}`)).toBeVisible();
    }

    // --- NEW WORKOUT / NEW DRAFT BUTTONS ---
    await expect(page.getByRole("link", { name: /New Workout/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /New Draft/i })).toBeVisible();
  });
});
```

- [ ] **Step 3: Update the login block**

Open `tests/admin-newsletter.spec.ts`, find the login helper or `beforeEach` block, and copy it verbatim into the `// LOGIN` placeholder in the new test. If the pattern is a function imported from a helper file (e.g., `tests/helpers/login.ts`), import the helper instead.

- [ ] **Step 4: Run the test**

```bash
npx playwright test tests/admin-dashboard.spec.ts
```
Expected: Test passes. If it fails on the login block, adjust by re-checking the helper. If it fails on a selector, inspect the rendered HTML via `npx playwright test tests/admin-dashboard.spec.ts --ui` and tweak selectors to match.

- [ ] **Step 5: Commit**

```bash
git add tests/admin-dashboard.spec.ts
git commit -m "test(admin): add Playwright spec for dashboard analytics"
```

---

## Task 10: Manual browser verification + final type/build check

**Files:**
- None to change unless issues are found.

- [ ] **Step 1: Run the full type check**

```bash
npx tsc --noEmit
```
Expected: Clean exit, no errors.

- [ ] **Step 2: Run the unit tests**

```bash
npm run test:unit
```
Expected: All parseFngLine + resolvePaxIdentity tests pass.

- [ ] **Step 3: Run the build**

```bash
npm run build
```
Expected: Build succeeds. Watch for any errors in `/admin` routing or RSC compilation.

- [ ] **Step 4: Browser verification (per CLAUDE.md UI Feature Verification rule)**

With the dev server running at `http://localhost:3001`:
1. Open `/admin` in a real browser.
2. Confirm:
   - 3 KPI tiles render with non-placeholder integers.
   - Pie chart has visible slices (or "No posts yet this year" if the region is empty).
   - Bar chart shows ≥1 PAX row (or empty state).
   - 4 nav tiles below still navigate correctly to `/admin/workouts`, `/admin/regions`, `/admin/drafts`, `/admin/newsletter`.
   - "New Workout" and "New Draft" buttons still navigate.
3. Open DevTools console — no errors.
4. Check `Network` tab — `/admin` returns 200, no 500s.
5. Resize the browser window to mobile width (~390px) and confirm the grid collapses to a single column.

If any of the above fails, **do not mark complete**. File a follow-up commit with the fix.

- [ ] **Step 5: Screenshot for PR**

Capture a desktop-width screenshot of `/admin` to attach to the PR (optional but encouraged per CLAUDE.md).

- [ ] **Step 6: Final commit (only if Step 4 produced fixes)**

```bash
git add <fixed-files>
git commit -m "fix(admin): <specific fix from browser verification>"
```

If Step 4 surfaced no issues, skip this step.

---

## Self-Review (filled in by plan author)

**Spec coverage** — every section of the spec maps to a task:

| Spec section | Task(s) |
| --- | --- |
| Goals 1–3 (Total Posts / Top PAX / FNGs) | Tasks 4, 5, 6, 7 |
| Goal 4 (preserve nav tiles) | Task 8 |
| Goal 5 (zero new deps) | All — tsx is dev-only |
| Decisions: layout / YTD / FNG / top 20 / merge / live / no library / RSC | Task 4 (data), Task 8 (page) |
| Architecture (RSC, getDashboardStats, three queries) | Task 4 |
| File layout | All — see "File Structure" |
| Data flow | Task 4 |
| Data definitions (totals, pie, top PAX, FNGs, identity merge) | Tasks 2, 3, 4 |
| UI design (layout, palette, brand reuse) | Tasks 5, 6, 7, 8 |
| Empty + error states | Tasks 4, 5, 6 |
| Performance | N/A — implementation matches spec |
| Testing (unit + integration + manual) | Tasks 2, 3, 9, 10 |

**Placeholder scan** — none found. All steps include complete code or exact commands. The one intentional handoff is the login block in Task 9 Step 3, which is explicitly directed to copy from `admin-newsletter.spec.ts` rather than inventing a pattern.

**Type consistency** — verified:
- `PaxRanking` is defined once in `resolvePaxIdentity.ts`, imported by `getDashboardStats.ts` and `TopPaxChart.tsx`.
- `SlackUser` defined once in `resolvePaxIdentity.ts`, used in `getDashboardStats.ts`.
- `DashboardStats` (type) defined in `getDashboardStats.ts`; consumed by `page.tsx`.
- Component props match in both directions: `PostsByAoChart` accepts `data: Array<{ ao: string; count: number }>` which matches `byAo` shape on the stats object; `TopPaxChart` accepts `data: PaxRanking[]` which matches `topPax`.
