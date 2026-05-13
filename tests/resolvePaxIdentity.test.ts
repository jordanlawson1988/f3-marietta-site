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
