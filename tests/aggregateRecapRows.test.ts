import { test } from "node:test";
import { strict as assert } from "node:assert";
import { aggregateRecapRows } from "../src/lib/stats/getMonthlyPaxRecap";
import type { FactRow } from "../src/lib/stats/getAttendanceFact";

function fr(paxToken: string, eventId: string, extra: Partial<FactRow> = {}): FactRow {
  return {
    eventId,
    eventDate: "2026-04-10",
    aoSlug: "the-battlefield",
    aoName: "The Battlefield",
    paxToken,
    isQ: false,
    headcount: 5,
    fngCount: 0,
    ...extra,
  };
}

const emptyMaps = () => ({
  nameById: new Map<string, string>(),
  idByName: new Map<string, string>(),
  aliasMap: new Map<string, string>(),
});

test("nickname-only token with no mapping becomes an unreachable row", () => {
  const { recipients, unreachable } = aggregateRecapRows(
    [fr("n:bulldog", "e1"), fr("n:bulldog", "e2")],
    emptyMaps(),
  );
  assert.equal(recipients.length, 0);
  assert.deepEqual(unreachable, [
    { paxToken: "n:bulldog", paxLabel: "bulldog", posts: 2, reason: "no-slack-mapping" },
  ]);
});

test("nickname token with a mapping becomes a recipient, not unreachable", () => {
  const maps = emptyMaps();
  maps.idByName.set("mr clean", "U001");
  maps.nameById.set("U001", "Mr Clean");
  const { recipients, unreachable } = aggregateRecapRows([fr("n:mr clean", "e1")], maps);
  assert.equal(unreachable.length, 0);
  assert.equal(recipients.length, 1);
  assert.equal(recipients[0].slackUserId, "U001");
  assert.equal(recipients[0].paxLabel, "Mr Clean");
  assert.equal(recipients[0].posts, 1);
});

test("U-prefixed token absent from slack_users is still a reachable recipient", () => {
  const { recipients, unreachable } = aggregateRecapRows([fr("U999", "e1")], emptyMaps());
  assert.equal(unreachable.length, 0);
  assert.equal(recipients.length, 1);
  assert.equal(recipients[0].slackUserId, "U999");
  assert.equal(recipients[0].paxLabel, "U999"); // falls back to the raw token
});

test("duplicate eventIds are not double-counted in posts", () => {
  const maps = emptyMaps();
  maps.idByName.set("milton", "U002");
  maps.nameById.set("U002", "Milton");
  const { recipients, unreachable } = aggregateRecapRows(
    [
      fr("U002", "e1"), fr("U002", "e1"), fr("U002", "e2"), // recipient: 2 distinct
      fr("n:ghost", "x1"), fr("n:ghost", "x1"),             // unreachable: 1 distinct
    ],
    maps,
  );
  assert.equal(recipients[0].posts, 2);
  assert.equal(unreachable[0].posts, 1);
});

test("recipients and unreachable are each sorted by posts desc", () => {
  const maps = emptyMaps();
  maps.idByName.set("a", "UA"); maps.nameById.set("UA", "A");
  maps.idByName.set("b", "UB"); maps.nameById.set("UB", "B");
  const fact = [
    fr("n:a", "a1"),                                   // UA: 1 post
    fr("n:b", "b1"), fr("n:b", "b2"), fr("n:b", "b3"), // UB: 3 posts
    fr("n:zero", "z1"),                                // unreachable: 1
    fr("n:two", "t1"), fr("n:two", "t2"),              // unreachable: 2
  ];
  const { recipients, unreachable } = aggregateRecapRows(fact, maps);
  assert.deepEqual(recipients.map((r) => r.slackUserId), ["UB", "UA"]);
  assert.deepEqual(unreachable.map((u) => u.paxToken), ["n:two", "n:zero"]);
});
