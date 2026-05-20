import { test } from "node:test";
import { strict as assert } from "node:assert";
import { computeLongestStreak } from "../src/lib/stats/computeStreak";

test("empty array returns 0", () => {
  assert.equal(computeLongestStreak([]), 0);
});

test("single date returns 1", () => {
  assert.equal(computeLongestStreak(["2026-05-01"]), 1);
});

test("two consecutive ISO weeks returns 2", () => {
  assert.equal(computeLongestStreak(["2026-04-27", "2026-05-04"]), 2);
});

test("two dates in same ISO week count as one week", () => {
  assert.equal(computeLongestStreak(["2026-05-04", "2026-05-06"]), 1);
});

test("gap of one week breaks streak", () => {
  assert.equal(
    computeLongestStreak(["2026-04-27", "2026-05-11", "2026-05-18"]),
    2,
  );
});

test("four-week streak", () => {
  assert.equal(
    computeLongestStreak([
      "2026-04-13",
      "2026-04-20",
      "2026-04-27",
      "2026-05-04",
    ]),
    4,
  );
});

test("unsorted input is sorted internally", () => {
  assert.equal(
    computeLongestStreak(["2026-05-04", "2026-04-20", "2026-04-27"]),
    3,
  );
});

test("year boundary handled via ISO-week math", () => {
  // 2025-12-29 is Mon of ISO week 2026-W01; 2025-12-22 is Mon of 2025-W52.
  assert.equal(
    computeLongestStreak(["2025-12-22", "2025-12-29", "2026-01-05"]),
    3,
  );
});
