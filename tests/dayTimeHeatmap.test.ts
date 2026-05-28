import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  bucketize,
  bucketizeFromHourMin,
  TIME_BUCKETS,
  CANONICAL_BUCKETS,
} from "../src/lib/stats/getDayTimeHeatmap";

// --- Each F3 schedule start time must land in its own bucket ---
// Mirrors workout_schedule values: 05:15, 05:30, 05:45, 06:00, 06:30.

test("05:15 lands in the 5:15a bucket", () => {
  assert.equal(bucketize("05:15"), "5:15a");
  assert.equal(bucketize("05:15:00"), "5:15a");
});

test("05:30 lands in the 5:30a bucket", () => {
  assert.equal(bucketize("05:30"), "5:30a");
});

test("05:45 lands in the 5:45a bucket (NOT 5:30a)", () => {
  // Regression guard: previously this collapsed into 5:30a and hid an
  // entire AO cluster in the heatmap.
  assert.equal(bucketize("05:45"), "5:45a");
});

test("06:00 lands in the 6:00a bucket", () => {
  assert.equal(bucketize("06:00"), "6:00a");
});

test("06:30 lands in the 6:30a bucket (NOT 6:00a)", () => {
  // Regression guard: previously 6:00 and 6:30 shared one column.
  assert.equal(bucketize("06:30"), "6:30a");
});

// --- Bucket boundary behavior ---

test("times before 5am bucket as ?", () => {
  assert.equal(bucketize("04:59"), "?");
  assert.equal(bucketize("00:00"), "?");
});

test("nulls, undefineds, and malformed strings bucket as ?", () => {
  assert.equal(bucketize(null), "?");
  assert.equal(bucketize(undefined), "?");
  assert.equal(bucketize(""), "?");
  assert.equal(bucketize("not a time"), "?");
});

test("7am+ buckets as later", () => {
  assert.equal(bucketize("07:00"), "later");
  assert.equal(bucketize("08:30"), "later");
  assert.equal(bucketize("09:15"), "later");
});

test("rounding boundaries hold the F3 grain", () => {
  // 05:22 closer to 05:15 than 05:30 → 5:15a
  assert.equal(bucketizeFromHourMin(5, 22), "5:15a");
  // 05:23 closer to 05:30 → 5:30a
  assert.equal(bucketizeFromHourMin(5, 23), "5:30a");
  // 05:37 still 5:30a
  assert.equal(bucketizeFromHourMin(5, 37), "5:30a");
  // 05:38 → 5:45a
  assert.equal(bucketizeFromHourMin(5, 38), "5:45a");
  // 06:14 → 6:00a, 06:15 → 6:30a
  assert.equal(bucketizeFromHourMin(6, 14), "6:00a");
  assert.equal(bucketizeFromHourMin(6, 15), "6:30a");
  // 06:44 → 6:30a, 06:45 → later
  assert.equal(bucketizeFromHourMin(6, 44), "6:30a");
  assert.equal(bucketizeFromHourMin(6, 45), "later");
});

// --- Vocabulary contracts ---

test("TIME_BUCKETS exposes the F3-canonical 5 plus later + ?", () => {
  assert.deepEqual(TIME_BUCKETS, [
    "5:15a",
    "5:30a",
    "5:45a",
    "6:00a",
    "6:30a",
    "later",
    "?",
  ]);
});

test("CANONICAL_BUCKETS is exactly the 5 pre-dawn F3 columns", () => {
  // Renderer keeps these always-visible so empty cells in them are
  // informative; "later" and "?" are only shown when populated.
  assert.equal(CANONICAL_BUCKETS.size, 5);
  for (const b of ["5:15a", "5:30a", "5:45a", "6:00a", "6:30a"]) {
    assert.ok(
      CANONICAL_BUCKETS.has(b),
      `CANONICAL_BUCKETS missing "${b}" — heatmap will collapse it`,
    );
  }
  assert.ok(!CANONICAL_BUCKETS.has("later"));
  assert.ok(!CANONICAL_BUCKETS.has("?"));
});

test("every bucketize output appears in TIME_BUCKETS", () => {
  // Catches any future bucket added without updating the column list.
  const observed = new Set<string>();
  for (let h = 0; h <= 23; h++) {
    for (let m = 0; m < 60; m += 5) {
      observed.add(bucketizeFromHourMin(h, m));
    }
  }
  observed.add(bucketize(null));
  for (const b of observed) {
    assert.ok(
      TIME_BUCKETS.includes(b),
      `bucketize produced "${b}" which is not in TIME_BUCKETS`,
    );
  }
});
