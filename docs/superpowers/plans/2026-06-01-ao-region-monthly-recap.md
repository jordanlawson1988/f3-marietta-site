# AO + Region Monthly Recap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** On the 1st of each month, auto-post a deterministic stats recap of the prior month to every enabled AO Slack channel and to the region channel `#all-f3-marietta`.

**Architecture:** Mirror the shipped `monthly-pax-recap`. Pure aggregation + render functions in `src/lib/stats/buildAoRecap.ts` (unit-tested), a channel-oriented run-report in `src/lib/stats/aoRecapReport.ts`, an idempotency guard in `src/lib/stats/recapPosts.ts`, and thin cron + admin-preview routes. Reuse `getAttendanceFact`, `getAliasMap`, `getSiteBaseUrl`, `nameToSlug`, `formatRecapMonth`, `parseTimeRange`, `getSlackClient`.

**Tech Stack:** Next.js 16 route handlers, `@neondatabase/serverless` (raw SQL tags), `@slack/web-api`, tests via `node:test` + `node:assert` (`npx tsx --test tests/*.test.ts`).

**Spec:** `docs/superpowers/specs/2026-06-01-ao-region-monthly-recap-design.md`

**Test convention:** Pure functions get `tests/*.test.ts` unit tests (TDD). Thin I/O wrappers (`planMonthlyAoRecap`, `recapPosts`, routes) follow the repo pattern of *no* unit test — verified via the cron dry-run path (Task 8).

---

## File Structure

- **Create** `src/lib/stats/buildAoRecap.ts` — types, `rankPaxForRecap` (pure), `buildRecapBlocks` (pure), `buildAoRecapMessage`/`buildRegionRecapMessage` (pure), `planMonthlyAoRecap` (I/O).
- **Create** `src/lib/stats/aoRecapReport.ts` — `buildAoRecapRunReport` (pure) + result types.
- **Create** `src/lib/stats/recapPosts.ts` — `claimRecapPost`/`releaseRecapPost`/`setRecapPostTs` (I/O idempotency guard).
- **Create** `src/app/api/cron/monthly-ao-recap/route.ts` — cron handler.
- **Create** `src/app/api/admin/monthly-ao-recap/preview/route.ts` — admin preview.
- **Create** tests: `tests/rankPaxForRecap.test.ts`, `tests/buildAoRecapMessage.test.ts`, `tests/buildRecapBlocks.test.ts`, `tests/aoRecapReport.test.ts`.
- **Modify** `scripts/neon-schema.sql` — add `monthly_ao_recap_posts` DDL.
- **Modify** `vercel.json` — add the cron entry.

---

## Task 1: Idempotency table

**Files:**
- Modify: `scripts/neon-schema.sql` (append)
- Apply: Neon project `dark-snow-80785418` (additive — allowed per CLAUDE.md)

- [ ] **Step 1: Append DDL to `scripts/neon-schema.sql`**

```sql
-- Monthly AO/region recap idempotency guard: one row per (recapped month, channel).
CREATE TABLE IF NOT EXISTS monthly_ao_recap_posts (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period      text NOT NULL,        -- recapped month, 'YYYY-MM'
  channel_id  text NOT NULL,        -- Slack channel posted to
  scope       text NOT NULL,        -- 'ao' | 'region'
  ao_name     text,                 -- AO display name for 'ao', NULL for region
  message_ts  text,                 -- Slack ts of the delivered message
  posted_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE (period, channel_id)
);
```

- [ ] **Step 2: Create the table in Neon**

Run the same `CREATE TABLE IF NOT EXISTS …` statement against project `dark-snow-80785418` (via the Neon MCP `run_sql` or `psql "$DATABASE_URL"`). Idempotent; safe to re-run.

- [ ] **Step 3: Verify**

Run: `SELECT to_regclass('public.monthly_ao_recap_posts');`
Expected: returns `monthly_ao_recap_posts` (not null).

- [ ] **Step 4: Commit**

```bash
git add scripts/neon-schema.sql
git commit -m "feat(recap): add monthly_ao_recap_posts idempotency table"
```

---

## Task 2: `rankPaxForRecap` (pure PAX ranking)

**Files:**
- Create: `src/lib/stats/buildAoRecap.ts`
- Test: `tests/rankPaxForRecap.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { rankPaxForRecap, type RecapMaps } from "../src/lib/stats/buildAoRecap";
import type { FactRow } from "../src/lib/stats/getAttendanceFact";

function fr(paxToken: string, eventId: string, extra: Partial<FactRow> = {}): FactRow {
  return {
    eventId, eventDate: "2026-05-10", aoSlug: "the-battlefield",
    aoName: "The Battlefield", paxToken, isQ: false, headcount: 5, fngCount: 0, ...extra,
  };
}
const maps = (): RecapMaps => ({
  nameById: new Map(), idByName: new Map(), aliasMap: new Map(),
});

test("ranks by distinct posts desc, then label asc; counts Q'd events", () => {
  const m = maps();
  m.nameById.set("U1", "Milton"); m.idByName.set("milton", "U1");
  m.nameById.set("U2", "Mr Clean"); m.idByName.set("mr clean", "U2");
  const ranked = rankPaxForRecap([
    fr("U1", "e1", { isQ: true }), fr("U1", "e1"), fr("U1", "e2"), // Milton: 2 posts, 1 Q (e1)
    fr("U2", "e1"), fr("U2", "e2"), fr("U2", "e3"),                 // Mr Clean: 3 posts, 0 Q
  ], m);
  assert.deepEqual(ranked.map((r) => [r.label, r.posts, r.qd]), [
    ["Mr Clean", 3, 0],
    ["Milton", 2, 1],
  ]);
});

test("includes unmapped nickname-only PAX by their nickname label", () => {
  const ranked = rankPaxForRecap([fr("n:bulldog", "e1"), fr("n:bulldog", "e2")], maps());
  assert.deepEqual(ranked, [{ label: "bulldog", posts: 2, qd: 0 }]);
});

test("merges a nickname token into its mapped slack id (no double count)", () => {
  const m = maps();
  m.nameById.set("U1", "Milton"); m.idByName.set("milton", "U1");
  const ranked = rankPaxForRecap([fr("U1", "e1"), fr("n:milton", "e2")], m);
  assert.equal(ranked.length, 1);
  assert.deepEqual(ranked[0], { label: "Milton", posts: 2, qd: 0 });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/rankPaxForRecap.test.ts`
Expected: FAIL — `rankPaxForRecap` is not exported.

- [ ] **Step 3: Implement `rankPaxForRecap` (and shared types) in `src/lib/stats/buildAoRecap.ts`**

```ts
import type { FactRow } from "./getAttendanceFact";

export type RecapMaps = {
  nameById: Map<string, string>;  // slack_user_id → display name
  idByName: Map<string, string>;  // lowercased name → slack_user_id
  aliasMap: Map<string, string>;  // slack_user_id → alias name
};

export type RankedPax = { label: string; posts: number; qd: number };

/** Canonical key + display label for a paxToken. Nickname tokens that resolve
 *  to a slack id are merged onto that id; unmapped nicknames keep their token. */
function resolve(token: string, maps: RecapMaps): { key: string; label: string } {
  if (token.startsWith("U")) {
    return { key: token, label: maps.nameById.get(token) ?? maps.aliasMap.get(token) ?? token };
  }
  if (token.startsWith("n:")) {
    const name = token.slice(2);
    const id = maps.idByName.get(name.toLowerCase());
    if (id) return { key: id, label: maps.nameById.get(id) ?? maps.aliasMap.get(id) ?? name };
    return { key: token, label: name };
  }
  return { key: token, label: token };
}

/** Aggregate fact rows into ranked PAX (distinct beatdowns attended + Q'd),
 *  sorted by posts desc then label asc. Pure. */
export function rankPaxForRecap(fact: FactRow[], maps: RecapMaps): RankedPax[] {
  type Agg = { label: string; posts: Set<string>; qd: Set<string> };
  const byKey = new Map<string, Agg>();
  for (const f of fact) {
    const { key, label } = resolve(f.paxToken, maps);
    let a = byKey.get(key);
    if (!a) { a = { label, posts: new Set(), qd: new Set() }; byKey.set(key, a); }
    a.posts.add(f.eventId);
    if (f.isQ) a.qd.add(f.eventId);
  }
  return [...byKey.values()]
    .map((a) => ({ label: a.label, posts: a.posts.size, qd: a.qd.size }))
    .sort((x, y) => y.posts - x.posts || x.label.localeCompare(y.label));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/rankPaxForRecap.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/buildAoRecap.ts tests/rankPaxForRecap.test.ts
git commit -m "feat(recap): rankPaxForRecap pure ranking for AO/region recaps"
```

---

## Task 3: Block builder `buildRecapBlocks` (pure)

**Files:**
- Modify: `src/lib/stats/buildAoRecap.ts`
- Test: `tests/buildRecapBlocks.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildRecapBlocks, type RecapMaps, type AoChannel } from "../src/lib/stats/buildAoRecap";
import type { FactRow } from "../src/lib/stats/getAttendanceFact";

function fr(paxToken: string, eventId: string, aoName: string, isQ = false): FactRow {
  return { eventId, eventDate: "2026-05-10", aoSlug: "", aoName, paxToken, isQ, headcount: null, fngCount: 0 };
}
const maps: RecapMaps = { nameById: new Map(), idByName: new Map(), aliasMap: new Map() };
const channels: AoChannel[] = [
  { slackChannelId: "C_BF", aoDisplayName: "The Battlefield" },
  { slackChannelId: "C_LS", aoDisplayName: "The Last Stand" },
];
const BASE = "https://www.f3marietta.com";

test("builds one block per AO with posts, skips empty AOs, builds region", () => {
  const fact = [
    fr("n:milton", "b1", "The Battlefield", true), fr("n:milton", "b2", "The Battlefield"),
    fr("n:clean", "b1", "The Battlefield"),
    // The Last Stand has zero posts -> skipped
  ];
  const { aoBlocks, regionBlock } = buildRecapBlocks(fact, channels, maps, BASE);
  assert.equal(aoBlocks.length, 1);
  const bf = aoBlocks[0];
  assert.equal(bf.aoDisplayName, "The Battlefield");
  assert.equal(bf.channelId, "C_BF");
  assert.equal(bf.beatdowns, 2);
  assert.equal(bf.paxCount, 2);
  assert.equal(bf.posts, 3);
  assert.deepEqual(bf.topPosters, { names: ["milton"], count: 2 });
  assert.equal(bf.url, "https://www.f3marietta.com/stats?range=last-month&ao=the-battlefield");
  assert.ok(regionBlock);
  assert.equal(regionBlock!.aoCount, 1);
  assert.equal(regionBlock!.url, "https://www.f3marietta.com/stats?range=last-month");
});

test("topQs is null when nobody Q'd; ties list all names", () => {
  const fact = [
    fr("n:a", "b1", "The Battlefield"), fr("n:b", "b1", "The Battlefield"),
    fr("n:b", "b2", "The Battlefield"), fr("n:a", "b2", "The Battlefield"),
  ];
  const { aoBlocks } = buildRecapBlocks(fact, channels, maps, BASE);
  assert.equal(aoBlocks[0].topQs, null);
  assert.deepEqual(aoBlocks[0].topPosters, { names: ["a", "b"], count: 2 });
});

test("empty fact yields no AO blocks and a null region block", () => {
  const { aoBlocks, regionBlock } = buildRecapBlocks([], channels, maps, BASE);
  assert.equal(aoBlocks.length, 0);
  assert.equal(regionBlock, null);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/buildRecapBlocks.test.ts`
Expected: FAIL — `buildRecapBlocks` not exported.

- [ ] **Step 3: Implement in `src/lib/stats/buildAoRecap.ts`** (append)

```ts
import { nameToSlug } from "./slugify";

export type AoChannel = { slackChannelId: string; aoDisplayName: string };
export type ShoutOut = { names: string[]; count: number };

type BlockStats = {
  posts: number; beatdowns: number; paxCount: number;
  topPosters: ShoutOut; topQs: ShoutOut | null; top10: RankedPax[];
};
export type AoRecapBlock = BlockStats & {
  scope: "ao"; aoDisplayName: string; slug: string; channelId: string; url: string;
};
export type RegionRecapBlock = BlockStats & { scope: "region"; aoCount: number; url: string };

/** Top names tied at the max value of `metric`; null when the max is 0. */
function shoutFrom(ranked: RankedPax[], metric: "posts" | "qd"): ShoutOut | null {
  if (ranked.length === 0) return null;
  const max = Math.max(...ranked.map((r) => r[metric]));
  if (max === 0) return null;
  return { names: ranked.filter((r) => r[metric] === max).map((r) => r.label), count: max };
}

function statsFor(fact: FactRow[], maps: RecapMaps): BlockStats {
  const ranked = rankPaxForRecap(fact, maps);
  return {
    posts: ranked.reduce((n, r) => n + r.posts, 0),
    beatdowns: new Set(fact.map((f) => f.eventId)).size,
    paxCount: ranked.length,
    topPosters: shoutFrom(ranked, "posts") ?? { names: [], count: 0 },
    topQs: shoutFrom(ranked, "qd"),
    top10: ranked.slice(0, 10),
  };
}

export function buildRecapBlocks(
  fact: FactRow[],
  aoChannels: AoChannel[],
  maps: RecapMaps,
  baseUrl: string,
): { aoBlocks: AoRecapBlock[]; regionBlock: RegionRecapBlock | null } {
  const base = baseUrl.replace(/\/+$/, "");
  const aoBlocks: AoRecapBlock[] = [];
  for (const ch of aoChannels) {
    const slug = nameToSlug(ch.aoDisplayName);
    const subset = fact.filter((f) => nameToSlug(f.aoName) === slug);
    if (subset.length === 0) continue; // skip AOs with no posts
    aoBlocks.push({
      scope: "ao", aoDisplayName: ch.aoDisplayName, slug, channelId: ch.slackChannelId,
      url: `${base}/stats?range=last-month&ao=${slug}`,
      ...statsFor(subset, maps),
    });
  }
  const regionBlock: RegionRecapBlock | null = fact.length === 0 ? null : {
    scope: "region",
    aoCount: new Set(fact.map((f) => nameToSlug(f.aoName))).size,
    url: `${base}/stats?range=last-month`,
    ...statsFor(fact, maps),
  };
  return { aoBlocks, regionBlock };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/buildRecapBlocks.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/buildAoRecap.ts tests/buildRecapBlocks.test.ts
git commit -m "feat(recap): buildRecapBlocks per-AO + region aggregation"
```

---

## Task 4: Message renderers (pure)

**Files:**
- Modify: `src/lib/stats/buildAoRecap.ts`
- Test: `tests/buildAoRecapMessage.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  buildAoRecapMessage, buildRegionRecapMessage,
  type AoRecapBlock, type RegionRecapBlock,
} from "../src/lib/stats/buildAoRecap";

const aoBlock: AoRecapBlock = {
  scope: "ao", aoDisplayName: "The Battlefield", slug: "the-battlefield", channelId: "C_BF",
  posts: 142, beatdowns: 18, paxCount: 27,
  topPosters: { names: ["Milton"], count: 16 },
  topQs: { names: ["Mr Clean"], count: 5 },
  top10: [{ label: "Milton", posts: 16, qd: 4 }, { label: "Mr Clean", posts: 14, qd: 5 }],
  url: "https://www.f3marietta.com/stats?range=last-month&ao=the-battlefield",
};

test("AO message has header, stat line, shoutouts, top-10, url", () => {
  const msg = buildAoRecapMessage(aoBlock, "May 2026");
  assert.match(msg, /^\*The Battlefield — May 2026 Recap\* 🏋️/);
  assert.match(msg, /142 posts · 18 beatdowns · 27 PAX/);
  assert.match(msg, /🏆 Most posts: Milton \(16\)/);
  assert.match(msg, /🎤 Most Q'd: Mr Clean \(5\)/);
  assert.match(msg, /1\. Milton — 16/);
  assert.match(msg, /2\. Mr Clean — 14/);
  assert.match(msg, /Deep dive → https:\/\/www\.f3marietta\.com\/stats\?range=last-month&ao=the-battlefield/);
});

test("Q line omitted when topQs is null; ties comma-joined; singular post", () => {
  const msg = buildAoRecapMessage(
    { ...aoBlock, posts: 1, beatdowns: 1, topPosters: { names: ["A", "B"], count: 1 }, topQs: null },
    "May 2026",
  );
  assert.doesNotMatch(msg, /Most Q'd/);
  assert.match(msg, /1 post · 1 beatdown/);
  assert.match(msg, /🏆 Most posts: A, B \(1\)/);
});

test("region message has region header, AO count, region url + labels", () => {
  const region: RegionRecapBlock = {
    scope: "region", posts: 842, beatdowns: 96, paxCount: 118, aoCount: 6,
    topPosters: { names: ["Milton"], count: 41 }, topQs: { names: ["Mr Clean"], count: 12 },
    top10: [{ label: "Milton", posts: 41, qd: 3 }],
    url: "https://www.f3marietta.com/stats?range=last-month",
  };
  const msg = buildRegionRecapMessage(region, "May 2026");
  assert.match(msg, /^\*F3 Marietta — May 2026 Region Recap\* 🌎/);
  assert.match(msg, /842 posts · 96 beatdowns · 118 PAX · 6 AOs/);
  assert.match(msg, /🏆 Most posts \(region\): Milton \(41\)/);
  assert.match(msg, /Top 10 PAX region-wide:/);
  assert.match(msg, /Deep dive → https:\/\/www\.f3marietta\.com\/stats\?range=last-month$/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/buildAoRecapMessage.test.ts`
Expected: FAIL — renderers not exported.

- [ ] **Step 3: Implement in `src/lib/stats/buildAoRecap.ts`** (append)

```ts
function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
function shoutLine(emoji: string, label: string, s: ShoutOut): string {
  return `${emoji} ${label}: ${s.names.join(", ")} (${s.count})`;
}
function topTen(headerLine: string, top10: RankedPax[]): string {
  return [headerLine, ...top10.map((p, i) => `${i + 1}. ${p.label} — ${p.posts}`)].join("\n");
}

export function buildAoRecapMessage(b: AoRecapBlock, monthLabel: string): string {
  const lines = [
    `*${b.aoDisplayName} — ${monthLabel} Recap* 🏋️`,
    `${plural(b.posts, "post")} · ${plural(b.beatdowns, "beatdown")} · ${b.paxCount} PAX`,
    "",
    shoutLine("🏆", "Most posts", b.topPosters),
  ];
  if (b.topQs) lines.push(shoutLine("🎤", "Most Q'd", b.topQs));
  lines.push("", topTen("Top 10 by posts:", b.top10), "", `Deep dive → ${b.url}`);
  return lines.join("\n");
}

export function buildRegionRecapMessage(b: RegionRecapBlock, monthLabel: string): string {
  const lines = [
    `*F3 Marietta — ${monthLabel} Region Recap* 🌎`,
    `${plural(b.posts, "post")} · ${plural(b.beatdowns, "beatdown")} · ${b.paxCount} PAX · ${plural(b.aoCount, "AO")}`,
    "",
    shoutLine("🏆", "Most posts (region)", b.topPosters),
  ];
  if (b.topQs) lines.push(shoutLine("🎤", "Most Q'd (region)", b.topQs));
  lines.push("", topTen("Top 10 PAX region-wide:", b.top10), "", `Deep dive → ${b.url}`);
  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/buildAoRecapMessage.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/buildAoRecap.ts tests/buildAoRecapMessage.test.ts
git commit -m "feat(recap): AO + region Slack message renderers"
```

---

## Task 5: `planMonthlyAoRecap` (I/O wrapper, no unit test)

**Files:**
- Modify: `src/lib/stats/buildAoRecap.ts`

- [ ] **Step 1: Implement** (append). Reuses `getAttendanceFact`, `getAliasMap`, `getSiteBaseUrl`, `formatRecapMonth`, `parseTimeRange`. Map-building mirrors `getMonthlyPaxRecap`.

```ts
import { getSql } from "@/lib/db";
import { getAttendanceFact } from "./getAttendanceFact";
import { getAliasMap } from "./aliasMap";
import { parseTimeRange } from "./timeRange";
import { formatRecapMonth, getSiteBaseUrl, type RecapWindow } from "./buildPaxRecap";

export type AoRecapPlan = {
  window: RecapWindow;
  aoBlocks: AoRecapBlock[];
  regionBlock: RegionRecapBlock | null;
};

export async function planMonthlyAoRecap(now: Date = new Date()): Promise<AoRecapPlan> {
  const range = parseTimeRange({ range: "last-month" }, now);
  if (!range) throw new Error("Failed to compute last-month range");
  const window: RecapWindow = {
    from: range.from.toISOString().slice(0, 10),
    to: range.to.toISOString().slice(0, 10),
    monthLabel: formatRecapMonth(range.from),
  };

  const sql = getSql();
  const [fact, channelRows, slackUsers, aliasMap] = await Promise.all([
    getAttendanceFact({ from: range.from, to: range.to }),
    sql`SELECT slack_channel_id, ao_display_name FROM ao_channels WHERE is_enabled = true` as
      unknown as Promise<Array<{ slack_channel_id: string; ao_display_name: string }>>,
    sql`SELECT slack_user_id, display_name, real_name FROM slack_users
        WHERE display_name IS NOT NULL OR real_name IS NOT NULL` as
      unknown as Promise<Array<{ slack_user_id: string; display_name: string | null; real_name: string | null }>>,
    getAliasMap(),
  ]);

  const nameById = new Map<string, string>();
  const idByName = new Map<string, string>();
  for (const u of slackUsers) {
    const name = u.display_name ?? u.real_name;
    if (!name) continue;
    nameById.set(u.slack_user_id, name);
    idByName.set(name.toLowerCase(), u.slack_user_id);
  }
  for (const [id, name] of aliasMap) {
    if (!nameById.has(id)) nameById.set(id, name);
    if (!idByName.has(name.toLowerCase())) idByName.set(name.toLowerCase(), id);
  }

  const aoChannels: AoChannel[] = channelRows.map((c) => ({
    slackChannelId: c.slack_channel_id, aoDisplayName: c.ao_display_name,
  }));
  const { aoBlocks, regionBlock } = buildRecapBlocks(
    fact, aoChannels, { nameById, idByName, aliasMap }, getSiteBaseUrl(),
  );
  return { window, aoBlocks, regionBlock };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stats/buildAoRecap.ts
git commit -m "feat(recap): planMonthlyAoRecap loads fact + channels into recap plan"
```

---

## Task 6: Run-report builder (pure)

**Files:**
- Create: `src/lib/stats/aoRecapReport.ts`
- Test: `tests/aoRecapReport.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildAoRecapRunReport, type AoPostResult } from "../src/lib/stats/aoRecapReport";

const r = (over: Partial<AoPostResult>): AoPostResult => ({
  scope: "ao", label: "The Battlefield", channelId: "C", status: "posted", ...over,
});

test("all-posted summary lists counts and channels", () => {
  const out = buildAoRecapRunReport({
    monthLabel: "May 2026", mode: "live",
    results: [r({}), r({ label: "Kenmo", channelId: "C2" }), r({ scope: "region", label: "#all-f3-marietta", channelId: "C3" })],
    skippedEmpty: ["CSAUP"],
  });
  assert.match(out, /F3 Marietta — AO\/Region Recap Run \(May 2026\)/);
  assert.match(out, /Mode: live · Posted: 3 · Already: 0 · Errors: 0/);
  assert.match(out, /Skipped \(no posts\): CSAUP/);
});

test("errors and already-posted are itemized", () => {
  const out = buildAoRecapRunReport({
    monthLabel: "May 2026", mode: "live",
    results: [
      r({ status: "error", error: "not_in_channel" }),
      r({ label: "Kenmo", channelId: "C2", status: "already-posted" }),
    ],
    skippedEmpty: [],
  });
  assert.match(out, /Posted: 0 · Already: 1 · Errors: 1/);
  assert.match(out, /• The Battlefield — not_in_channel/);
  assert.match(out, /Already posted this month: Kenmo/);
});

test("dry-run shows what would post", () => {
  const out = buildAoRecapRunReport({
    monthLabel: "May 2026", mode: "dry-run",
    results: [r({ status: "dry-run" })], skippedEmpty: [],
  });
  assert.match(out, /Mode: dry-run/);
  assert.match(out, /Would post: 1/);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx tsx --test tests/aoRecapReport.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `src/lib/stats/aoRecapReport.ts`**

```ts
export type AoPostStatus = "posted" | "already-posted" | "error" | "dry-run";
export type AoPostResult = {
  scope: "ao" | "region";
  label: string;       // AO display name, or "#all-f3-marietta" for region
  channelId: string;
  status: AoPostStatus;
  error?: string;
};
export type AoRecapRunReportInput = {
  monthLabel: string;
  mode: "live" | "dry-run";
  results: AoPostResult[];
  skippedEmpty: string[];  // AO display names with 0 posts
};

/** Pure, total. Channel-oriented summary DMed to the admin after each run. */
export function buildAoRecapRunReport(input: AoRecapRunReportInput): string {
  const { monthLabel, mode, results, skippedEmpty } = input;
  const by = (s: AoPostStatus) => results.filter((r) => r.status === s);
  const posted = by("posted"), already = by("already-posted"), errored = by("error"), dry = by("dry-run");

  const lines = [`F3 Marietta — AO/Region Recap Run (${monthLabel})`];
  if (mode === "dry-run") {
    lines.push(`Mode: dry-run · Would post: ${dry.length} · Skipped empty: ${skippedEmpty.length}`);
  } else {
    lines.push(`Mode: live · Posted: ${posted.length} · Already: ${already.length} · Errors: ${errored.length}`);
  }
  if (errored.length) {
    lines.push("", `Errors (${errored.length}):`);
    for (const e of errored) lines.push(`• ${e.label} — ${e.error ?? "unknown"}`);
  }
  if (already.length) {
    lines.push("", `Already posted this month: ${already.map((a) => a.label).join(", ")}`);
  }
  if (skippedEmpty.length) {
    lines.push("", `Skipped (no posts): ${skippedEmpty.join(", ")}`);
  }
  return lines.join("\n");
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx tsx --test tests/aoRecapReport.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/aoRecapReport.ts tests/aoRecapReport.test.ts
git commit -m "feat(recap): AO recap run-report builder"
```

---

## Task 7: Idempotency guard helpers (I/O, no unit test)

**Files:**
- Create: `src/lib/stats/recapPosts.ts`

- [ ] **Step 1: Implement**

```ts
import { getSql } from "@/lib/db";

/** Atomically claim (period, channel). Returns true if THIS call inserted the
 *  row (caller should post), false if it already existed (skip). */
export async function claimRecapPost(
  period: string, channelId: string, scope: "ao" | "region", aoName: string | null,
): Promise<boolean> {
  const sql = getSql();
  const rows = (await sql`
    INSERT INTO monthly_ao_recap_posts (period, channel_id, scope, ao_name)
    VALUES (${period}, ${channelId}, ${scope}, ${aoName})
    ON CONFLICT (period, channel_id) DO NOTHING
    RETURNING id
  `) as Array<{ id: string }>;
  return rows.length > 0;
}

/** Undo a claim after a failed post so a later run can retry the channel. */
export async function releaseRecapPost(period: string, channelId: string): Promise<void> {
  await getSql()`DELETE FROM monthly_ao_recap_posts WHERE period = ${period} AND channel_id = ${channelId}`;
}

/** Record the delivered Slack message ts on a successful post. */
export async function setRecapPostTs(period: string, channelId: string, ts: string): Promise<void> {
  await getSql()`UPDATE monthly_ao_recap_posts SET message_ts = ${ts} WHERE period = ${period} AND channel_id = ${channelId}`;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/stats/recapPosts.ts
git commit -m "feat(recap): idempotency guard for monthly recap posts"
```

---

## Task 8: Cron route

**Files:**
- Create: `src/app/api/cron/monthly-ao-recap/route.ts`

- [ ] **Step 1: Implement** (mirrors `monthly-pax-recap/route.ts`)

```ts
import { NextResponse } from "next/server";
import { getSlackClient } from "@/lib/slack/slackClient";
import {
  planMonthlyAoRecap, buildAoRecapMessage, buildRegionRecapMessage,
} from "@/lib/stats/buildAoRecap";
import { buildAoRecapRunReport, type AoPostResult } from "@/lib/stats/aoRecapReport";
import { claimRecapPost, releaseRecapPost, setRecapPostTs } from "@/lib/stats/recapPosts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Monthly AO + region recap cron. On the 1st, posts a deterministic recap of
 * the prior month to each enabled AO channel and to #all-f3-marietta.
 * Dry-run unless MONTHLY_AO_RECAP_LIVE==="true" AND ?live=1 AND not ?dry=1.
 * Idempotent per (period, channel) via monthly_ao_recap_posts.
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const queryDry = url.searchParams.get("dry") === "1";
  const queryLive = url.searchParams.get("live") === "1";
  const envLive = process.env.MONTHLY_AO_RECAP_LIVE === "true";
  const isLive = envLive && queryLive && !queryDry;
  const mode: "live" | "dry-run" = isLive ? "live" : "dry-run";

  const plan = await planMonthlyAoRecap();
  const period = plan.window.from.slice(0, 7); // 'YYYY-MM'
  const regionChannel = process.env.SLACK_NEWSLETTER_CHANNEL_ID;

  type Job = { scope: "ao" | "region"; label: string; channelId: string; text: string; aoName: string | null };
  const jobs: Job[] = plan.aoBlocks.map((b) => ({
    scope: "ao" as const, label: b.aoDisplayName, channelId: b.channelId,
    text: buildAoRecapMessage(b, plan.window.monthLabel), aoName: b.aoDisplayName,
  }));
  if (plan.regionBlock && regionChannel) {
    jobs.push({
      scope: "region", label: "#all-f3-marietta", channelId: regionChannel,
      text: buildRegionRecapMessage(plan.regionBlock, plan.window.monthLabel), aoName: null,
    });
  }

  const client = getSlackClient();
  const results: AoPostResult[] = [];
  for (const j of jobs) {
    if (!isLive) {
      results.push({ scope: j.scope, label: j.label, channelId: j.channelId, status: "dry-run" });
      continue;
    }
    const claimed = await claimRecapPost(period, j.channelId, j.scope, j.aoName);
    if (!claimed) {
      results.push({ scope: j.scope, label: j.label, channelId: j.channelId, status: "already-posted" });
      continue;
    }
    try {
      const res = await client.chat.postMessage({ channel: j.channelId, text: j.text, unfurl_links: false });
      if (res.ts) await setRecapPostTs(period, j.channelId, res.ts);
      results.push({ scope: j.scope, label: j.label, channelId: j.channelId, status: "posted" });
    } catch (err) {
      await releaseRecapPost(period, j.channelId); // free the claim so a retry can re-post
      results.push({
        scope: j.scope, label: j.label, channelId: j.channelId, status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await sleep(250);
  }

  const skippedEmpty = []; // AOs with 0 posts are absent from plan.aoBlocks; surfaced separately below
  const report = buildAoRecapRunReport({ monthLabel: plan.window.monthLabel, mode, results, skippedEmpty });
  const { posted: reportPosted, error: reportError } = await postAdminReport(report);

  return NextResponse.json({
    window: plan.window, mode, regionChannelSet: Boolean(regionChannel),
    jobs: jobs.length, results, reportPosted, reportError,
  });
}

async function postAdminReport(report: string): Promise<{ posted: boolean; error: string | null }> {
  const adminId = process.env.SLACK_ADMIN_USER_ID;
  if (!adminId) return { posted: false, error: "SLACK_ADMIN_USER_ID not set" };
  try {
    await getSlackClient().chat.postMessage({ channel: adminId, text: report, unfurl_links: false });
    return { posted: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[monthly-ao-recap] admin report post failed:", msg);
    return { posted: false, error: msg };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
```

> Note: `skippedEmpty` is left `[]` here because AOs with zero posts are simply
> absent from `plan.aoBlocks`. If you want them named in the report, have
> `planMonthlyAoRecap` also return the enabled-AO names and diff against
> `aoBlocks`. Deferred (YAGNI) unless you want it — flag during review.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 3: Manual dry-run verification (local)**

Start dev server, then:
Run: `curl -s -H "Authorization: Bearer $CRON_SECRET" "http://localhost:3000/api/cron/monthly-ao-recap?dry=1" | python3 -m json.tool`
Expected: `mode: "dry-run"`, `results[*].status: "dry-run"`, no Slack posts, `jobs` ≈ number of AOs with posts + 1 region.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/cron/monthly-ao-recap/route.ts
git commit -m "feat(recap): monthly AO + region recap cron route"
```

---

## Task 9: Admin preview route

**Files:**
- Create: `src/app/api/admin/monthly-ao-recap/preview/route.ts`

- [ ] **Step 1: Implement** (mirrors `monthly-pax-recap/preview/route.ts`)

```ts
import { NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/admin/auth";
import {
  planMonthlyAoRecap, buildAoRecapMessage, buildRegionRecapMessage,
} from "@/lib/stats/buildAoRecap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only dry preview of the AO/region recap. No Slack calls. Renders every
 *  message that would post + the live-flag state. */
export async function GET(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const plan = await planMonthlyAoRecap();
  const aoPosts = plan.aoBlocks.map((b) => ({
    aoDisplayName: b.aoDisplayName, channelId: b.channelId,
    posts: b.posts, beatdowns: b.beatdowns, paxCount: b.paxCount,
    message: buildAoRecapMessage(b, plan.window.monthLabel),
  }));
  const regionPost = plan.regionBlock
    ? { channelId: process.env.SLACK_NEWSLETTER_CHANNEL_ID ?? null,
        message: buildRegionRecapMessage(plan.regionBlock, plan.window.monthLabel) }
    : null;

  return NextResponse.json({
    mode: "dry-run",
    window: plan.window,
    liveFlagSet: process.env.MONTHLY_AO_RECAP_LIVE === "true",
    regionChannelSet: Boolean(process.env.SLACK_NEWSLETTER_CHANNEL_ID),
    aoPostCount: aoPosts.length,
    aoPosts,
    regionPost,
  });
}
```

- [ ] **Step 2: Type-check + full unit suite**

Run: `npx tsc --noEmit && npm run test:unit`
Expected: tsc clean; all unit tests pass (including the 4 new files).

- [ ] **Step 3: Commit**

```bash
git add src/app/api/admin/monthly-ao-recap/preview/route.ts
git commit -m "feat(recap): admin preview for AO + region recap"
```

---

## Task 10: Register cron + env, final verification

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Add the cron entry to `vercel.json`** (in the `crons` array)

```json
{
  "path": "/api/cron/monthly-ao-recap?live=1",
  "schedule": "0 10 1 * *"
}
```

- [ ] **Step 2: Add env var (non-sensitive) — deploy-time, not in repo**

`MONTHLY_AO_RECAP_LIVE` in Vercel Production. Leave **absent/`false`** until the first send is reviewed via the preview endpoint, then set `true` + redeploy (per the recap runbook). Keep it **non-sensitive** so the value is verifiable.

- [ ] **Step 3: Full verification**

Run: `npx tsc --noEmit && npm run test:unit && npm run build`
Expected: tsc clean, all unit tests pass, build succeeds.

- [ ] **Step 4: Commit + open PR**

```bash
git add vercel.json
git commit -m "feat(recap): schedule monthly AO + region recap cron (0 10 1 * *)"
git push -u origin feature/ao-region-monthly-recap
```
Then open a PR to `main` (run `/deploy-check` before any deploy-branch push, per the pre-push gate).

---

## Self-Review

**Spec coverage:**
- Deterministic templates → Task 4. ✓
- Per-AO + region, skip empty → Task 3 (`buildRecapBlocks`). ✓
- Top poster(s)/Q(s) with ties, top-10, URLs → Tasks 3–4. ✓
- Unmapped PAX named in leaderboards → Task 2 (`resolve` keeps `n:` tokens). ✓
- Auto cron + live/dry gate, 5 AM EST → Tasks 8, 10. ✓
- Idempotency guard → Tasks 1, 7, 8. ✓
- Admin preview + run-report → Tasks 6, 9. ✓
- Metric definitions (post/beatdown/PAX) → Task 3 (`statsFor`). ✓

**Placeholder scan:** No TBD/TODO in code. The `skippedEmpty: []` in Task 8 is a documented, intentional deferral (note attached), not a placeholder.

**Type consistency:** `RecapMaps`, `RankedPax`, `ShoutOut`, `AoChannel`, `AoRecapBlock`, `RegionRecapBlock`, `AoRecapPlan`, `AoPostResult` are defined once (Tasks 2/3/6) and referenced consistently. `claimRecapPost`/`releaseRecapPost`/`setRecapPostTs` signatures match between Task 7 (def) and Task 8 (use). `buildAoRecapMessage(block, monthLabel)` arity consistent across Tasks 4, 8, 9.

**Known follow-ups (non-blocking):** naming `skippedEmpty` in the report (deferred); future consolidation of the slack-users map-building shared with `getMonthlyPaxRecap`.
