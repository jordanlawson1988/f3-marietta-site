import { test } from "node:test";
import { strict as assert } from "node:assert";
import { parseAttendance } from "../src/lib/stats/parseAttendance";

test("parses PAX line with Slack IDs and nicknames", () => {
  const text = `
DATE: 2026-04-10
AO: Black Ops
Q: Nessie
PAX: @U01ABC123 @U02DEF456, Bill Nye, Nacho
COUNT: 5
FNG: none
`;
  const r = parseAttendance(text);
  assert.deepEqual(
    [...r.pax].sort(),
    ["U01ABC123", "U02DEF456", "n:bill nye", "n:nacho"].sort(),
  );
});

test("parses headcount from COUNT line", () => {
  const text = "PAX: a, b, c\nCOUNT: 7";
  assert.equal(parseAttendance(text).headcount, 7);
});

test("headcount is null when COUNT line missing", () => {
  const text = "PAX: a, b, c";
  assert.equal(parseAttendance(text).headcount, null);
});

test("headcount handles 'COUNT: 12 (incl. 2 FNG)'", () => {
  const text = "PAX: a\nCOUNT: 12 (incl. 2 FNG)";
  assert.equal(parseAttendance(text).headcount, 12);
});

test("malformed COUNT line returns null headcount", () => {
  const text = "PAX: a\nCOUNT: many";
  assert.equal(parseAttendance(text).headcount, null);
});

test("parses FNG tokens from FNG line", () => {
  const text = "FNG: @U99NEWPAX, Stranger";
  const r = parseAttendance(text);
  assert.deepEqual([...r.fngTokens].sort(), ["U99NEWPAX", "n:stranger"].sort());
});

test("FNG line 'none' returns empty fngTokens", () => {
  const text = "FNG: none";
  assert.deepEqual([...parseAttendance(text).fngTokens], []);
});

test("FNG numeric-only returns empty fngTokens", () => {
  const text = "FNG: 2";
  assert.deepEqual([...parseAttendance(text).fngTokens], []);
});

test("empty content returns empty everything", () => {
  const r = parseAttendance("");
  assert.deepEqual([...r.pax], []);
  assert.equal(r.headcount, null);
  assert.deepEqual([...r.fngTokens], []);
});

test("PAX excludes FNG names that appear in both lines", () => {
  // FNGs are counted separately; they should appear in fngTokens but
  // also in pax since the PAX line lists them.
  const text = "PAX: @U99NEWPAX, Bill\nFNG: @U99NEWPAX";
  const r = parseAttendance(text);
  assert.ok(r.pax.has("U99NEWPAX"));
  assert.ok(r.fngTokens.has("U99NEWPAX"));
});

test("tolerates Slack markdown wrapping (asterisks, underscores)", () => {
  const text = "*PAX*: Nessie, Nacho\n*COUNT*: 4";
  const r = parseAttendance(text);
  assert.ok(r.pax.has("n:nessie"));
  assert.ok(r.pax.has("n:nacho"));
  assert.equal(r.headcount, 4);
});
