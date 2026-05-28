import { test } from "node:test";
import { strict as assert } from "node:assert";
import { formatChartMonth } from "../src/lib/stats/formatMonth";

test("formats every calendar month as a 3-letter uppercase abbreviation", () => {
  const expected = [
    "JAN", "FEB", "MAR", "APR", "MAY", "JUN",
    "JUL", "AUG", "SEP", "OCT", "NOV", "DEC",
  ];
  for (let i = 0; i < 12; i++) {
    const key = `2026-${String(i + 1).padStart(2, "0")}`;
    assert.equal(formatChartMonth(key), expected[i], `month ${key}`);
  }
});

test("formats correctly across year boundaries", () => {
  assert.equal(formatChartMonth("2025-12"), "DEC");
  assert.equal(formatChartMonth("2026-01"), "JAN");
});

test("returns the raw input when the shape is invalid (defensive)", () => {
  assert.equal(formatChartMonth(""), "");
  assert.equal(formatChartMonth("2026-13"), "2026-13");
  assert.equal(formatChartMonth("2026-00"), "2026-00");
  assert.equal(formatChartMonth("not-a-date"), "not-a-date");
  assert.equal(formatChartMonth("202601"), "202601");
});
