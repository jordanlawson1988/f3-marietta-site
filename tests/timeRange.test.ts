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
  assert.equal(r.label, "YTD");
});

test("current-month: from = first of current month in ET, to = today in ET", () => {
  const r = parseTimeRange({ range: "current-month" }, NOW)!;
  assert.equal(r.slug, "current-month");
  assert.equal(r.from.toISOString().slice(0, 10), "2026-05-01");
  assert.equal(r.to.toISOString().slice(0, 10), "2026-05-15");
  assert.equal(r.label, "This month");
});

test("current-week: from = Monday of current ET week, to = today in ET", () => {
  // 2026-05-15 is a Friday → Monday of that ISO week is 2026-05-11
  const r = parseTimeRange({ range: "current-week" }, NOW)!;
  assert.equal(r.slug, "current-week");
  assert.equal(r.from.toISOString().slice(0, 10), "2026-05-11");
  assert.equal(r.to.toISOString().slice(0, 10), "2026-05-15");
  assert.equal(r.label, "This week");
});

test("current-week: Sunday rolls back to the prior Monday (ISO week)", () => {
  // 2026-05-17 is a Sunday → ISO Monday is 2026-05-11
  const sunday = new Date("2026-05-17T12:00:00-04:00");
  const r = parseTimeRange({ range: "current-week" }, sunday)!;
  assert.equal(r.from.toISOString().slice(0, 10), "2026-05-11");
});

test("trailing-365: rolling 365 days back from today", () => {
  const r = parseTimeRange({ range: "trailing-365" }, NOW)!;
  assert.equal(r.slug, "trailing-365");
  assert.equal(r.from.toISOString().slice(0, 10), "2025-05-15");
  assert.equal(r.to.toISOString().slice(0, 10), "2026-05-15");
});

test("current-month: late ET evening near month boundary uses ET date not UTC", () => {
  // 2026-04-30 23:00 ET == 2026-05-01 03:00 UTC. The user perceives it as
  // still April, so current-month should be April, not May.
  const lateEt = new Date("2026-04-30T23:00:00-04:00");
  const r = parseTimeRange({ range: "current-month" }, lateEt)!;
  assert.equal(r.from.toISOString().slice(0, 10), "2026-04-01");
  assert.equal(r.to.toISOString().slice(0, 10), "2026-04-30");
});

test("last-month mid-month: from = 1st of previous month, to = last day of previous month", () => {
  // NOW = 2026-05-15 → last-month should be Apr 1 – Apr 30
  const r = parseTimeRange({ range: "last-month" }, NOW)!;
  assert.equal(r.slug, "last-month");
  assert.equal(r.from.toISOString().slice(0, 10), "2026-04-01");
  assert.equal(r.to.toISOString().slice(0, 10), "2026-04-30");
  assert.equal(r.label, "Last month");
});

test("last-month on the 1st of the current month still points to the prior month", () => {
  // NOW = 2026-06-01 → last-month should be May 1 – May 31
  const firstOfMonth = new Date("2026-06-01T12:00:00-04:00");
  const r = parseTimeRange({ range: "last-month" }, firstOfMonth)!;
  assert.equal(r.from.toISOString().slice(0, 10), "2026-05-01");
  assert.equal(r.to.toISOString().slice(0, 10), "2026-05-31");
});

test("last-month in January crosses the year boundary into December", () => {
  // NOW = 2026-01-15 → last-month should be Dec 1 – Dec 31, 2025
  const january = new Date("2026-01-15T12:00:00-05:00");
  const r = parseTimeRange({ range: "last-month" }, january)!;
  assert.equal(r.from.toISOString().slice(0, 10), "2025-12-01");
  assert.equal(r.to.toISOString().slice(0, 10), "2025-12-31");
});

test("last-month handles a 28-day February correctly", () => {
  // NOW = 2026-03-10 → last-month should be Feb 1 – Feb 28, 2026 (not 29)
  const march = new Date("2026-03-10T12:00:00-05:00");
  const r = parseTimeRange({ range: "last-month" }, march)!;
  assert.equal(r.from.toISOString().slice(0, 10), "2026-02-01");
  assert.equal(r.to.toISOString().slice(0, 10), "2026-02-28");
});

test("last-month handles a 29-day February (leap year) correctly", () => {
  // NOW = 2024-03-10 → last-month should be Feb 1 – Feb 29, 2024
  const leapMarch = new Date("2024-03-10T12:00:00-05:00");
  const r = parseTimeRange({ range: "last-month" }, leapMarch)!;
  assert.equal(r.from.toISOString().slice(0, 10), "2024-02-01");
  assert.equal(r.to.toISOString().slice(0, 10), "2024-02-29");
});

test("last-month uses ET (not UTC) for the calendar — late evening near month boundary", () => {
  // 2026-05-01 00:30 ET == 2026-05-01 04:30 UTC. ET-perceived month is May,
  // so last-month is April — same as if it were noon on May 1.
  const earlyMay = new Date("2026-05-01T00:30:00-04:00");
  const r = parseTimeRange({ range: "last-month" }, earlyMay)!;
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
