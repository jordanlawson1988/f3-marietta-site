import { test } from "node:test";
import { strict as assert } from "node:assert";
import { groupFngs } from "../src/lib/stats/buildAoRecap";
import type { FngEntry } from "../src/lib/stats/getFngsList";

function fng(label: string, aoSlug: string, slackUserId: string | null = null): FngEntry {
  return {
    eventDate: "2026-05-10", aoName: aoSlug, aoSlug,
    fngKey: `n:${label.toLowerCase()}`, fngLabel: label, eventId: "e1",
    beatdownTitle: null, qName: null, slackUserId,
  };
}

test("buckets by AO slug, sorts honorees by label, region aggregates all", () => {
  const entries = [
    fng("Dredd", "the-battlefield"),
    fng("Bishop", "the-battlefield", "U07ABC"),
    fng("Carmine", "the-armory"),
  ];
  const { byAoSlug, region } = groupFngs(entries);

  assert.equal(byAoSlug.get("the-battlefield")?.count, 2);
  assert.deepEqual(
    byAoSlug.get("the-battlefield")?.honorees.map((h) => h.label),
    ["Bishop", "Dredd"],
  );
  assert.equal(byAoSlug.get("the-battlefield")?.honorees[0].slackUserId, "U07ABC");
  assert.equal(byAoSlug.get("the-armory")?.count, 1);

  assert.equal(region?.count, 3);
  const sum = [...byAoSlug.values()].reduce((n, w) => n + w.count, 0);
  assert.equal(sum, region?.count);
});

test("empty entries → null region and empty map", () => {
  const { byAoSlug, region } = groupFngs([]);
  assert.equal(region, null);
  assert.equal(byAoSlug.size, 0);
});
