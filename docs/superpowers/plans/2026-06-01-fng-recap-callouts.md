# FNG Welcome Callouts in Monthly Recap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-AO and region-wide FNG (first-timer) welcome callout to the monthly recap Slack posts — a count plus a celebratory welcome that @-mentions each newcomer when a Slack id resolves.

**Architecture:** Reuse the existing single FNG-detection path (`getFngsList`) so the recap count matches the `/admin/analytics/fngs` roster. Thread each FNG's originating Slack id through `FngEntry`, group entries by AO, attach a `FngWelcome` to the existing pure recap blocks, and render one extra line in the two pure message builders. Cron/preview are thin I/O over the tested pure functions.

**Tech Stack:** TypeScript, Next.js route handlers, Neon (`getSql`), `node:test` via `tsx --test`.

**Spec:** `docs/superpowers/specs/2026-06-01-fng-recap-callouts-design.md`

**Run a single test file:** `npx tsx --test tests/<file>.test.ts`
**Run all unit tests:** `npm run test:unit`
**Type-check:** `npx tsc --noEmit`

---

### Task 1: Thread the originating Slack id through `FngEntry`

`getFngsList` canonicalizes a `U…` token to `n:<name>` and discards the id. Capture
it so the recap can @-mention FNGs. Additive field; existing roster consumers ignore it.

**Files:**
- Modify: `src/lib/stats/getFngsList.ts`

- [ ] **Step 1: Add `slackUserId` to the `FngEntry` type**

In `src/lib/stats/getFngsList.ts`, add the field to `FngEntry`:

```ts
export type FngEntry = {
  eventDate: string; // YYYY-MM-DD
  aoName: string;
  aoSlug: string;
  fngKey: string;
  fngLabel: string;
  eventId: string;
  beatdownTitle: string | null;
  qName: string | null;
  slackUserId: string | null;
};
```

- [ ] **Step 2: Capture the id in `resolve` and on the candidate entry**

Replace the internal `resolve` function and the candidate construction:

```ts
  const resolve = (token: string): { key: string; label: string; slackUserId: string | null } => {
    if (token.startsWith("U")) {
      const name = slackById.get(token) ?? aliasMap.get(token);
      if (name) return { key: `n:${name.toLowerCase()}`, label: name, slackUserId: token };
      return { key: token, label: token, slackUserId: token };
    }
    const lower = token.startsWith("n:") ? token.slice(2) : token;
    return { key: `n:${lower}`, label: titleCase(lower), slackUserId: null };
  };
```

In the FNG loop, destructure `slackUserId` and add it to `candidate`:

```ts
    for (const token of tokens) {
      const { key, label, slackUserId } = resolve(token);
      const candidate: FngEntry = {
        eventDate: row.event_date,
        aoName: row.ao_name,
        aoSlug: nameToSlug(row.ao_name),
        fngKey: key,
        fngLabel: label,
        eventId: row.event_id,
        beatdownTitle,
        qName,
        slackUserId,
      };
      const existing = earliestByKey.get(key);
      if (!existing || candidate.eventDate < existing.eventDate) {
        earliestByKey.set(key, candidate);
      }
    }
```

(The `qByEvent` use of `resolve(...).label` and the `allTimeKeys` use of
`resolve(...).key` are unaffected — they read only those properties.)

- [ ] **Step 3: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS (no errors).

- [ ] **Step 4: Commit**

```bash
git add src/lib/stats/getFngsList.ts
git commit -m "feat(recap): thread FNG slack id through FngEntry"
```

---

### Task 2: `FngWelcome` types + `groupFngs` pure helper

Group the deduped FNG entries into per-AO and region welcome buckets. Entries from
`getFngsList` are already one-per-identity (earliest callout), so grouping is pure
bucketing — Σ(per-AO counts) == region count.

**Files:**
- Modify: `src/lib/stats/buildAoRecap.ts`
- Test: `tests/groupFngs.test.ts` (create)

- [ ] **Step 1: Write the failing test**

Create `tests/groupFngs.test.ts`:

```ts
import { test } from "node:test";
import { strict as assert } from "node:assert";
import { groupFngs } from "../src/lib/stats/buildAoRecap";
import type { FngEntry } from "../src/lib/stats/getFngsList";

function fng(label: string, aoSlug: string, slackUserId: string | null = null): FngEntry {
  return {
    eventDate: "2026-05-10", aoName: aoSlug, aoSlug,
    fngKey: `n:${label.toLowerCase()}`, fngLabel: label, eventId: "e1",
    beatdownTitle: null, qName: null, slackUserId,
  };
}

test("buckets by AO slug, sorts honorees by label, region aggregates all", () => {
  const entries = [
    fng("Dredd", "the-battlefield"),
    fng("Bishop", "the-battlefield", "U07ABC"),
    fng("Carmine", "the-armory"),
  ];
  const { byAoSlug, region } = groupFngs(entries);

  assert.equal(byAoSlug.get("the-battlefield")?.count, 2);
  assert.deepEqual(
    byAoSlug.get("the-battlefield")?.honorees.map((h) => h.label),
    ["Bishop", "Dredd"],
  );
  assert.equal(byAoSlug.get("the-battlefield")?.honorees[0].slackUserId, "U07ABC");
  assert.equal(byAoSlug.get("the-armory")?.count, 1);

  assert.equal(region?.count, 3);
  const sum = [...byAoSlug.values()].reduce((n, w) => n + w.count, 0);
  assert.equal(sum, region?.count);
});

test("empty entries → null region and empty map", () => {
  const { byAoSlug, region } = groupFngs([]);
  assert.equal(region, null);
  assert.equal(byAoSlug.size, 0);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test tests/groupFngs.test.ts`
Expected: FAIL — `groupFngs` is not exported / not a function.

- [ ] **Step 3: Implement the types + helper**

In `src/lib/stats/buildAoRecap.ts`, add the import near the top (after the existing
imports):

```ts
import type { FngEntry } from "./getFngsList";
```

Then add the types + helper (place them just above `buildRecapBlocks`):

```ts
export type FngHonoree = { label: string; slackUserId: string | null };
export type FngWelcome = { count: number; honorees: FngHonoree[] };

/** Build a welcome bucket from FNG entries (already one-per-identity). Sorts
 *  honorees by label asc for deterministic output; null when there are none. */
function welcomeFrom(entries: FngEntry[]): FngWelcome | null {
  if (entries.length === 0) return null;
  const honorees = entries
    .map((e) => ({ label: e.fngLabel, slackUserId: e.slackUserId }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return { count: honorees.length, honorees };
}

/** Group deduped FNG entries into per-AO buckets (keyed by aoSlug) and a region
 *  bucket spanning all entries. Σ(per-AO counts) == region count. Pure. */
export function groupFngs(entries: FngEntry[]): {
  byAoSlug: Map<string, FngWelcome>;
  region: FngWelcome | null;
} {
  const bySlug = new Map<string, FngEntry[]>();
  for (const e of entries) {
    const arr = bySlug.get(e.aoSlug) ?? [];
    arr.push(e);
    bySlug.set(e.aoSlug, arr);
  }
  const byAoSlug = new Map<string, FngWelcome>();
  for (const [slug, arr] of bySlug) {
    const w = welcomeFrom(arr);
    if (w) byAoSlug.set(slug, w);
  }
  return { byAoSlug, region: welcomeFrom(entries) };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx tsx --test tests/groupFngs.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/lib/stats/buildAoRecap.ts tests/groupFngs.test.ts
git commit -m "feat(recap): groupFngs + FngWelcome buckets for recap"
```

---

### Task 3: Attach `fngs` to recap blocks

Add the `fngs` field to both block types, populate it in `buildRecapBlocks` from a
new trailing `fngEntries` arg, and keep every existing block literal type-valid.

**Files:**
- Modify: `src/lib/stats/buildAoRecap.ts`
- Modify: `tests/buildRecapBlocks.test.ts`
- Modify: `tests/buildAoRecapMessage.test.ts` (literals only — keep tsc green)

- [ ] **Step 1: Write the failing test (block attachment)**

Append to `tests/buildRecapBlocks.test.ts`. First extend the imports at the top of
the file to include the FNG type and the helper:

```ts
import type { FngEntry } from "../src/lib/stats/getFngsList";
```

Then append these tests:

```ts
function fngEntry(label: string, aoSlug: string, slackUserId: string | null = null): FngEntry {
  return {
    eventDate: "2026-05-10", aoName: aoSlug, aoSlug,
    fngKey: `n:${label.toLowerCase()}`, fngLabel: label, eventId: "e1",
    beatdownTitle: null, qName: null, slackUserId,
  };
}

test("attaches per-AO FNG welcome and region welcome; AO with no FNG is null", () => {
  const fact = [
    fr("n:milton", "b1", "The Battlefield"),
    fr("n:sled", "b1", "The Last Stand"),
  ];
  const fngs = [
    fngEntry("Bishop", "the-battlefield", "U07ABC"),
    fngEntry("Carmine", "the-battlefield"),
  ];
  const { aoBlocks, regionBlock } = buildRecapBlocks(fact, channels, maps, BASE, fngs);

  const bf = aoBlocks.find((b) => b.slug === "the-battlefield")!;
  const ls = aoBlocks.find((b) => b.slug === "the-last-stand")!;
  assert.equal(bf.fngs?.count, 2);
  assert.deepEqual(bf.fngs?.honorees.map((h) => h.label), ["Bishop", "Carmine"]);
  assert.equal(ls.fngs, null); // posts but no FNGs
  assert.equal(regionBlock!.fngs?.count, 2);
});

test("FNG at a slug with no enabled channel still counts region-wide", () => {
  const fact = [fr("n:milton", "b1", "The Battlefield")];
  const fngs = [fngEntry("Ghost", "a-retired-ao")];
  const { aoBlocks, regionBlock } = buildRecapBlocks(fact, channels, maps, BASE, fngs);
  assert.equal(aoBlocks.find((b) => b.slug === "the-battlefield")!.fngs, null);
  assert.equal(regionBlock!.fngs?.count, 1);
});

test("no fngEntries arg → blocks have null fngs (backward compatible)", () => {
  const fact = [fr("n:milton", "b1", "The Battlefield")];
  const { aoBlocks, regionBlock } = buildRecapBlocks(fact, channels, maps, BASE);
  assert.equal(aoBlocks[0].fngs, null);
  assert.equal(regionBlock!.fngs, null);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test tests/buildRecapBlocks.test.ts`
Expected: FAIL — `buildRecapBlocks` ignores a 5th arg / `block.fngs` is undefined,
and tsc errors that `fngs` is not on the block type.

- [ ] **Step 3: Add `fngs` to the block types**

In `src/lib/stats/buildAoRecap.ts`, update the two block types:

```ts
export type AoRecapBlock = BlockStats & {
  scope: "ao"; aoDisplayName: string; slug: string; channelId: string; url: string;
  fngs: FngWelcome | null;
};
export type RegionRecapBlock = BlockStats & {
  scope: "region"; aoCount: number; url: string;
  fngs: FngWelcome | null;
};
```

- [ ] **Step 4: Populate `fngs` in `buildRecapBlocks`**

Replace the body of `buildRecapBlocks` with the version that takes `fngEntries` and
sets `fngs`:

```ts
export function buildRecapBlocks(
  fact: FactRow[],
  aoChannels: AoChannel[],
  maps: RecapMaps,
  baseUrl: string,
  fngEntries: FngEntry[] = [],
): { aoBlocks: AoRecapBlock[]; regionBlock: RegionRecapBlock | null } {
  const base = baseUrl.replace(/\/+$/, "");
  const { byAoSlug, region } = groupFngs(fngEntries);
  const aoBlocks: AoRecapBlock[] = [];
  for (const ch of aoChannels) {
    const slug = nameToSlug(ch.aoDisplayName);
    const subset = fact.filter((f) => nameToSlug(f.aoName) === slug);
    if (subset.length === 0) continue; // skip AOs with no posts
    aoBlocks.push({
      scope: "ao", aoDisplayName: ch.aoDisplayName, slug, channelId: ch.slackChannelId,
      url: `${base}/stats?range=last-month&ao=${slug}`,
      fngs: byAoSlug.get(slug) ?? null,
      ...statsFor(subset, maps),
    });
  }
  const regionBlock: RegionRecapBlock | null = fact.length === 0 ? null : {
    scope: "region",
    aoCount: new Set(fact.map((f) => nameToSlug(f.aoName))).size,
    url: `${base}/stats?range=last-month`,
    fngs: region,
    ...statsFor(fact, maps),
  };
  return { aoBlocks, regionBlock };
}
```

- [ ] **Step 5: Keep `tests/buildAoRecapMessage.test.ts` literals type-valid**

The `fngs` field is now required on both block types. In
`tests/buildAoRecapMessage.test.ts`, add `fngs: null` to the two block literals:

- In the `aoBlock` const, add `fngs: null,` (e.g. right after the `url:` line).
- In the `region` const inside the third test, add `fngs: null,` likewise.

(Message output is unchanged in this task — the renderer doesn't read `fngs` yet — so
the existing message assertions still pass.)

- [ ] **Step 6: Run the affected tests + type-check**

Run: `npx tsx --test tests/buildRecapBlocks.test.ts tests/buildAoRecapMessage.test.ts`
Expected: PASS (all block + message tests).
Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/lib/stats/buildAoRecap.ts tests/buildRecapBlocks.test.ts tests/buildAoRecapMessage.test.ts
git commit -m "feat(recap): attach FNG welcome to AO + region blocks"
```

---

### Task 4: Render the FNG line in both message builders

**Files:**
- Modify: `src/lib/stats/buildAoRecap.ts`
- Modify: `tests/buildAoRecapMessage.test.ts`

- [ ] **Step 1: Write the failing tests (rendered copy)**

Append to `tests/buildAoRecapMessage.test.ts`:

```ts
test("AO FNG line: count, mention vs plain name, singular/plural, placement", () => {
  const withFngs: AoRecapBlock = {
    ...aoBlock,
    fngs: {
      count: 3,
      honorees: [
        { label: "Bishop", slackUserId: "U07ABC" },
        { label: "Carmine", slackUserId: null },
        { label: "Dredd", slackUserId: null },
      ],
    },
  };
  const msg = buildAoRecapMessage(withFngs, "May 2026");
  assert.match(msg, /🌱 3 new FNGs this month — welcome <@U07ABC>, Carmine, Dredd! 🎉/);
  // line sits directly under the stat line
  assert.match(msg, /27 PAX\n🌱 3 new FNGs this month/);

  const one = buildAoRecapMessage(
    { ...aoBlock, fngs: { count: 1, honorees: [{ label: "Bishop", slackUserId: null }] } },
    "May 2026",
  );
  assert.match(one, /🌱 1 new FNG this month — welcome Bishop! 🎉/);
});

test("AO FNG line omitted when fngs is null", () => {
  const msg = buildAoRecapMessage(aoBlock, "May 2026");
  assert.doesNotMatch(msg, /new FNG/);
});

test("region FNG line uses region wording and lists everyone", () => {
  const region: RegionRecapBlock = {
    scope: "region", posts: 842, beatdowns: 96, paxCount: 118, aoCount: 6,
    topPosters: { names: ["Milton"], count: 41 }, topQs: { names: ["Mr Clean"], count: 12 },
    top10: [{ label: "Milton", posts: 41, qd: 3 }],
    url: "https://www.f3marietta.com/stats?range=last-month",
    fngs: {
      count: 2,
      honorees: [{ label: "Ace", slackUserId: "U01" }, { label: "Bolt", slackUserId: null }],
    },
  };
  const msg = buildRegionRecapMessage(region, "May 2026");
  assert.match(msg, /🌱 2 new FNGs joined the region this month — welcome <@U01>, Bolt! 🎉/);
  assert.match(msg, /118 PAX · 6 AOs\n🌱 2 new FNGs joined the region this month/);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx tsx --test tests/buildAoRecapMessage.test.ts`
Expected: FAIL — no `🌱` line in the rendered output.

- [ ] **Step 3: Add the FNG render helpers**

In `src/lib/stats/buildAoRecap.ts`, add near the other private render helpers
(`plural`, `shoutLine`, `topTen`):

```ts
function renderHonorees(f: FngWelcome): string {
  return f.honorees.map((h) => (h.slackUserId ? `<@${h.slackUserId}>` : h.label)).join(", ");
}
function fngLine(f: FngWelcome, region: boolean): string {
  const when = region ? "joined the region this month" : "this month";
  return `🌱 ${plural(f.count, "new FNG")} ${when} — welcome ${renderHonorees(f)}! 🎉`;
}
```

- [ ] **Step 4: Emit the line in both builders**

Replace `buildAoRecapMessage` and `buildRegionRecapMessage` so the FNG line renders
directly under the stat line:

```ts
export function buildAoRecapMessage(b: AoRecapBlock, monthLabel: string): string {
  const lines = [
    `*${b.aoDisplayName} — ${monthLabel} Recap* 🏋️`,
    `${plural(b.posts, "post")} · ${plural(b.beatdowns, "beatdown")} · ${b.paxCount} PAX`,
  ];
  if (b.fngs) lines.push(fngLine(b.fngs, false));
  lines.push("");
  if (b.topPosters) lines.push(shoutLine("🏆", "Most posts", b.topPosters));
  if (b.topQs) lines.push(shoutLine("🎤", "Most Q'd", b.topQs));
  lines.push("", topTen("Top 10 by posts:", b.top10), "", `Deep dive → ${b.url}`);
  return lines.join("\n");
}

export function buildRegionRecapMessage(b: RegionRecapBlock, monthLabel: string): string {
  const lines = [
    `*F3 Marietta — ${monthLabel} Region Recap* 🌎`,
    `${plural(b.posts, "post")} · ${plural(b.beatdowns, "beatdown")} · ${b.paxCount} PAX · ${plural(b.aoCount, "AO")}`,
  ];
  if (b.fngs) lines.push(fngLine(b.fngs, true));
  lines.push("");
  if (b.topPosters) lines.push(shoutLine("🏆", "Most posts (region)", b.topPosters));
  if (b.topQs) lines.push(shoutLine("🎤", "Most Q'd (region)", b.topQs));
  lines.push("", topTen("Top 10 PAX region-wide:", b.top10), "", `Deep dive → ${b.url}`);
  return lines.join("\n");
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx tsx --test tests/buildAoRecapMessage.test.ts`
Expected: PASS (all message tests, old + new).

- [ ] **Step 6: Commit**

```bash
git add src/lib/stats/buildAoRecap.ts tests/buildAoRecapMessage.test.ts
git commit -m "feat(recap): render FNG welcome line in AO + region messages"
```

---

### Task 5: Load FNGs in `planMonthlyAoRecap`

Wire the I/O entry point to fetch FNGs for the same window and pass them to
`buildRecapBlocks`.

**Files:**
- Modify: `src/lib/stats/buildAoRecap.ts`

- [ ] **Step 1: Import `getFngsList`**

Add to the imports in `src/lib/stats/buildAoRecap.ts`:

```ts
import { getFngsList } from "./getFngsList";
```

- [ ] **Step 2: Fetch FNGs in the `Promise.all` and pass entries through**

In `planMonthlyAoRecap`, extend the destructured `Promise.all` and the
`buildRecapBlocks` call:

```ts
  const sql = getSql();
  const [fact, channelRows, slackUsers, aliasMap, fngsList] = await Promise.all([
    getAttendanceFact({ from: range.from, to: range.to }),
    sql`SELECT slack_channel_id, ao_display_name FROM ao_channels WHERE is_enabled = true` as
      unknown as Promise<Array<{ slack_channel_id: string; ao_display_name: string }>>,
    sql`SELECT slack_user_id, display_name, real_name FROM slack_users
        WHERE display_name IS NOT NULL OR real_name IS NOT NULL` as
      unknown as Promise<Array<{ slack_user_id: string; display_name: string | null; real_name: string | null }>>,
    getAliasMap(),
    getFngsList(range),
  ]);
```

And the block build:

```ts
  const { aoBlocks, regionBlock } = buildRecapBlocks(
    fact, aoChannels, { nameById, idByName, aliasMap }, getSiteBaseUrl(), fngsList.entries,
  );
```

- [ ] **Step 3: Type-check + run the full unit suite**

Run: `npx tsc --noEmit`
Expected: PASS.
Run: `npm run test:unit`
Expected: PASS (all existing + new tests).

- [ ] **Step 4: Commit**

```bash
git add src/lib/stats/buildAoRecap.ts
git commit -m "feat(recap): load FNGs into planMonthlyAoRecap"
```

---

### Task 6: Surface FNG counts in the preview JSON + run-report

**Files:**
- Modify: `src/lib/stats/aoRecapReport.ts`
- Modify: `tests/aoRecapReport.test.ts`
- Modify: `src/app/api/admin/monthly-ao-recap/preview/route.ts`
- Modify: `src/app/api/cron/monthly-ao-recap/route.ts`

- [ ] **Step 1: Write the failing report test**

Append to `tests/aoRecapReport.test.ts`:

```ts
test("live report includes new-FNG total when > 0", () => {
  const out = buildAoRecapRunReport({
    monthLabel: "May 2026", mode: "live",
    results: [r({})], skippedEmpty: [], fngTotal: 4,
  });
  assert.match(out, /New FNGs celebrated: 4/);
});

test("report omits FNG line when total is 0 or absent", () => {
  const out = buildAoRecapRunReport({
    monthLabel: "May 2026", mode: "live", results: [r({})], skippedEmpty: [],
  });
  assert.doesNotMatch(out, /New FNGs celebrated/);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx tsx --test tests/aoRecapReport.test.ts`
Expected: FAIL — `fngTotal` not on the input type / no "New FNGs celebrated" line.

- [ ] **Step 3: Add `fngTotal` to the report input + render line**

In `src/lib/stats/aoRecapReport.ts`, add the optional field and the line. Update the
type:

```ts
export type AoRecapRunReportInput = {
  monthLabel: string;
  mode: "live" | "dry-run";
  results: AoPostResult[];
  skippedEmpty: string[];  // AO display names with 0 posts
  fngTotal?: number;       // region-wide new FNGs celebrated this month
};
```

Inside `buildAoRecapRunReport`, after the `if (mode === "dry-run") { … } else { … }`
block, add:

```ts
  if (input.fngTotal && input.fngTotal > 0) {
    lines.push(`New FNGs celebrated: ${input.fngTotal}`);
  }
```

- [ ] **Step 4: Run the report test to verify it passes**

Run: `npx tsx --test tests/aoRecapReport.test.ts`
Expected: PASS (old + new).

- [ ] **Step 5: Pass `fngTotal` from the cron**

In `src/app/api/cron/monthly-ao-recap/route.ts`, update the run-report call:

```ts
  const report = buildAoRecapRunReport({
    monthLabel: plan.window.monthLabel, mode, results, skippedEmpty,
    fngTotal: plan.regionBlock?.fngs?.count ?? 0,
  });
```

- [ ] **Step 6: Add `fngCount` to the preview JSON**

In `src/app/api/admin/monthly-ao-recap/preview/route.ts`, add `fngCount` per AO post
and to the region post:

```ts
  const aoPosts = plan.aoBlocks.map((b) => ({
    aoDisplayName: b.aoDisplayName, channelId: b.channelId,
    posts: b.posts, beatdowns: b.beatdowns, paxCount: b.paxCount,
    fngCount: b.fngs?.count ?? 0,
    message: buildAoRecapMessage(b, plan.window.monthLabel),
  }));
  const regionPost = plan.regionBlock
    ? { channelId: process.env.SLACK_NEWSLETTER_CHANNEL_ID ?? null,
        fngCount: plan.regionBlock.fngs?.count ?? 0,
        message: buildRegionRecapMessage(plan.regionBlock, plan.window.monthLabel) }
    : null;
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add src/lib/stats/aoRecapReport.ts tests/aoRecapReport.test.ts \
  src/app/api/admin/monthly-ao-recap/preview/route.ts \
  src/app/api/cron/monthly-ao-recap/route.ts
git commit -m "feat(recap): surface FNG totals in preview JSON + run-report"
```

---

### Task 7: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Type-check**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 2: Full unit suite**

Run: `npm run test:unit`
Expected: PASS — all tests green, including the new groupFngs / block / message /
report cases.

- [ ] **Step 3: Production build**

Run: `npm run build`
Expected: PASS — Next build compiles the cron + preview routes.

- [ ] **Step 4: Spot-check rendered copy**

Run a quick inline render to eyeball the exact Slack text for an AO with mixed
mention/plain FNGs and the region line. Confirm the 🌱 line, singular/plural, and
placement under the stat line. (Pure functions — no DB needed.)

---

## Self-Review

**Spec coverage:**
- Per-AO FNG callout (count + welcome) → Tasks 3–4. ✓
- Region FNG callout → Tasks 3–4. ✓
- "Match the FNG roster page" (reuse `getFngsList`) → Tasks 1, 5. ✓
- @-mention when Slack id resolves, else plain → Tasks 1, 4. ✓
- Earliest-callout AO attribution → reused from `getFngsList` (Task 1 preserves it). ✓
- Omit line when 0 FNGs → Tasks 3 (`null`) + 4 (guard). ✓
- Σ(per-AO) == region → Task 2 (`groupFngs`) + test. ✓
- Drift slug counts region-wide only → Task 3 test. ✓
- Preview faithful + run-report observability → Task 6. ✓

**Placeholder scan:** none — every step has concrete code/commands.

**Type consistency:** `FngEntry.slackUserId` (Task 1) ↔ `FngHonoree.slackUserId`
(Task 2) ↔ `<@${h.slackUserId}>` (Task 4). `FngWelcome { count, honorees }` used
consistently in blocks (Task 3), renderers (Task 4), preview/report counts (Task 6).
`groupFngs` returns `{ byAoSlug, region }` consumed identically in Task 3.
