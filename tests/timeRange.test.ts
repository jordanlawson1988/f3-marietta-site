import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  TIME_RANGE_SLUGS,
  TIME_RANGE_LABELS,
  parseTimeRange,
  serializeTimeRange,
  monthsInRange,
  defaultTimeRange,
  type TimeRangeSlug,
} from "../src/lib/stats/timeRange";

const NOW = new Date("2026-05-15T12:00:00-04:00");

test("ytd: from = Jan 1 of current year, to = today", () => {
  const r = parseTimeRange({ range: "ytd" }, NOW)!;
  assert.equal(r.slug, "ytd");
  assert.equal(r.from.toISOString().slice(0, 10), "2026-01-01");
  assert.equal(r.to.toISOString().slice(0, 10), "2026-05-15");
  assert.equal(r.label, "Year-to-date");
});

test("current-month: from = first of current month in ET, to = today in ET", () => {
  const r = parseTimeRange({ range: "current-month" }, NOW)!;
  assert.equal(r.slug, "current-month");
  assert.equal(r.from.toISOString().slice(0, 10), "2026-05-01");
  assert.equal(r.to.toISOString().slice(0, 10), "2026-05-15");
  assert.equal(r.label, "Current month");
});

test("current-month: late ET evening near month boundary uses ET date not UTC", () => {
  // 2026-04-30 23:00 ET == 2026-05-01 03:00 UTC. The user perceives it as
  // still April, so current-month should be April, not May.
  const lateEt = new Date("2026-04-30T23:00:00-04:00");
  const r = parseTimeRange({ range: "current-month" }, lateEt)!;
  assert.equal(r.from.toISOString().slice(0, 10), "2026-04-01");
  assert.equal(r.to.toISOString().slice(0, 10), "2026-04-30");
});

test("defaultTimeRange returns current-month", () => {
  const r = defaultTimeRange(NOW);
  assert.equal(r.slug, "current-month");
});

test("mtd slug is no longer recognized (replaced by current-month)", () => {
  assert.equal(parseTimeRange({ range: "mtd" }, NOW), null);
});

test("last-30: rolling 30 days back from today", () => {
  const r = parseTimeRange({ range: "last-30" }, NOW)!;
  assert.equal(r.slug, "last-30");
  assert.equal(r.from.toISOString().slice(0, 10), "2026-04-15");
  assert.equal(r.to.toISOString().slice(0, 10), "2026-05-15");
});

test("last-90: rolling 90 days back from today", () => {
  const r = parseTimeRange({ range: "last-90" }, NOW)!;
  assert.equal(r.from.toISOString().slice(0, 10), "2026-02-14");
});

test("custom: uses from + to params (inclusive)", () => {
  const r = parseTimeRange(
    { range: "custom", from: "2026-03-01", to: "2026-03-31" },
    NOW,
  )!;
  assert.equal(r.slug, "custom");
  assert.equal(r.from.toISOString().slice(0, 10), "2026-03-01");
  assert.equal(r.to.toISOString().slice(0, 10), "2026-03-31");
  assert.equal(r.label, "2026-03-01 to 2026-03-31");
});

test("custom: invalid (from > to) returns null", () => {
  const r = parseTimeRange(
    { range: "custom", from: "2026-04-01", to: "2026-03-01" },
    NOW,
  );
  assert.equal(r, null);
});

test("custom: invalid (to in future) returns null", () => {
  const r = parseTimeRange(
    { range: "custom", from: "2026-01-01", to: "2027-12-31" },
    NOW,
  );
  assert.equal(r, null);
});

test("custom: to === today is allowed (boundary)", () => {
  const r = parseTimeRange(
    { range: "custom", from: "2026-05-01", to: "2026-05-15" },
    NOW,
  );
  assert.ok(r);
  assert.equal(r!.slug, "custom");
  assert.equal(r!.to.toISOString().slice(0, 10), "2026-05-15");
});

test("custom: span exactly 2 calendar years across leap year is allowed", () => {
  // 2024 is a leap year; 2024-01-01 → 2026-01-01 = 731 days
  const r = parseTimeRange(
    { range: "custom", from: "2024-01-01", to: "2026-01-01" },
    NOW,
  );
  assert.ok(r, "2 calendar years across a leap year should be allowed");
});

test("custom: span > 2 calendar years is rejected (post-leap-year boundary)", () => {
  // 2024-01-01 → 2026-01-02 = one day past 2 calendar years
  const r = parseTimeRange(
    { range: "custom", from: "2024-01-01", to: "2026-01-02" },
    NOW,
  );
  assert.equal(r, null);
});

test("custom: span > 2 years returns null", () => {
  const r = parseTimeRange(
    { range: "custom", from: "2023-01-01", to: "2026-01-02" },
    NOW,
  );
  assert.equal(r, null);
});

test("custom: missing from or to returns null", () => {
  assert.equal(parseTimeRange({ range: "custom", from: "2026-01-01" }, NOW), null);
  assert.equal(parseTimeRange({ range: "custom", to: "2026-01-01" }, NOW), null);
});

test("custom: malformed dates return null", () => {
  assert.equal(parseTimeRange({ range: "custom", from: "banana", to: "2026-01-01" }, NOW), null);
});

test("unknown range slug returns null", () => {
  assert.equal(parseTimeRange({ range: "monthly" }, NOW), null);
  assert.equal(parseTimeRange({}, NOW), null);
});

test("serializeTimeRange round-trips ytd", () => {
  const r = parseTimeRange({ range: "ytd" }, NOW)!;
  assert.deepEqual(serializeTimeRange(r), { range: "ytd" });
});

test("serializeTimeRange round-trips custom", () => {
  const r = parseTimeRange(
    { range: "custom", from: "2026-03-01", to: "2026-03-31" },
    NOW,
  )!;
  assert.deepEqual(serializeTimeRange(r), {
    range: "custom",
    from: "2026-03-01",
    to: "2026-03-31",
  });
});

// --- Vocabulary contract: every preset slug has a label AND parses ---

test("vocabulary contract: every TIME_RANGE_SLUGS entry has a label", () => {
  for (const slug of TIME_RANGE_SLUGS) {
    assert.ok(
      TIME_RANGE_LABELS[slug],
      `slug "${slug}" is missing a label in TIME_RANGE_LABELS`,
    );
  }
});

test("vocabulary contract: every preset slug parses successfully", () => {
  for (const slug of TIME_RANGE_SLUGS) {
    if (slug === "custom") continue; // requires from/to
    const r = parseTimeRange({ range: slug }, NOW);
    assert.ok(r, `slug "${slug}" did not parse`);
    assert.equal(r!.slug, slug);
  }
});

test("vocabulary contract: TIME_RANGE_LABELS keys match TIME_RANGE_SLUGS", () => {
  const labelKeys = Object.keys(TIME_RANGE_LABELS).sort();
  const slugs = [...TIME_RANGE_SLUGS].sort();
  assert.deepEqual(labelKeys, slugs);
});

// --- monthsInRange: enumerate YYYY-MM strings inclusive of start and end ---

test("monthsInRange: same month returns single entry", () => {
  const r = parseTimeRange(
    { range: "custom", from: "2026-03-05", to: "2026-03-20" },
    NOW,
  )!;
  assert.deepEqual(monthsInRange(r.from, r.to), ["2026-03"]);
});

test("monthsInRange: multi-month custom range pads empty months", () => {
  const r = parseTimeRange(
    { range: "custom", from: "2025-11-03", to: "2026-05-15" },
    NOW,
  )!;
  assert.deepEqual(monthsInRange(r.from, r.to), [
    "2025-11",
    "2025-12",
    "2026-01",
    "2026-02",
    "2026-03",
    "2026-04",
    "2026-05",
  ]);
});

test("monthsInRange: crosses year boundary", () => {
  const r = parseTimeRange(
    { range: "custom", from: "2025-12-15", to: "2026-01-15" },
    NOW,
  )!;
  assert.deepEqual(monthsInRange(r.from, r.to), ["2025-12", "2026-01"]);
});
