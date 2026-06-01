import { test } from "node:test";
import { strict as assert } from "node:assert";
import { rankPaxForRecap, type RecapMaps } from "../src/lib/stats/buildAoRecap";
import type { FactRow } from "../src/lib/stats/getAttendanceFact";

function fr(paxToken: string, eventId: string, extra: Partial<FactRow> = {}): FactRow {
  return {
    eventId, eventDate: "2026-05-10", aoSlug: "the-battlefield",
    aoName: "The Battlefield", paxToken, isQ: false, headcount: 5, fngCount: 0, ...extra,
  };
}
const maps = (): RecapMaps => ({
  nameById: new Map(), idByName: new Map(), aliasMap: new Map(),
});

test("ranks by distinct posts desc, then label asc; counts Q'd events", () => {
  const m = maps();
  m.nameById.set("U1", "Milton"); m.idByName.set("milton", "U1");
  m.nameById.set("U2", "Mr Clean"); m.idByName.set("mr clean", "U2");
  const ranked = rankPaxForRecap([
    fr("U1", "e1", { isQ: true }), fr("U1", "e1"), fr("U1", "e2"),
    fr("U2", "e1"), fr("U2", "e2"), fr("U2", "e3"),
  ], m);
  assert.deepEqual(ranked.map((r) => [r.label, r.posts, r.qd]), [
    ["Mr Clean", 3, 0],
    ["Milton", 2, 1],
  ]);
});

test("includes unmapped nickname-only PAX by their nickname label", () => {
  const ranked = rankPaxForRecap([fr("n:bulldog", "e1"), fr("n:bulldog", "e2")], maps());
  assert.deepEqual(ranked, [{ label: "bulldog", posts: 2, qd: 0 }]);
});

test("merges a nickname token into its mapped slack id (no double count)", () => {
  const m = maps();
  m.nameById.set("U1", "Milton"); m.idByName.set("milton", "U1");
  const ranked = rankPaxForRecap([fr("U1", "e1"), fr("n:milton", "e2")], m);
  assert.equal(ranked.length, 1);
  assert.deepEqual(ranked[0], { label: "Milton", posts: 2, qd: 0 });
});

test("Q'd is de-duplicated per event (two Q rows for one event count once)", () => {
  const m = maps();
  m.nameById.set("U1", "Milton"); m.idByName.set("milton", "U1");
  const ranked = rankPaxForRecap([
    fr("U1", "e1", { isQ: true }), fr("U1", "e1", { isQ: true }), fr("U1", "e2"),
  ], m);
  assert.deepEqual(ranked[0], { label: "Milton", posts: 2, qd: 1 });
});

test("returns an empty array for empty fact input", () => {
  assert.deepEqual(rankPaxForRecap([], maps()), []);
});
