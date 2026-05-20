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
