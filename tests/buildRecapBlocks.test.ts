import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildRecapBlocks, type RecapMaps, type AoChannel } from "../src/lib/stats/buildAoRecap";
import type { FactRow } from "../src/lib/stats/getAttendanceFact";

function fr(paxToken: string, eventId: string, aoName: string, isQ = false): FactRow {
  return { eventId, eventDate: "2026-05-10", aoSlug: "", aoName, paxToken, isQ, headcount: null, fngCount: 0 };
}
const maps: RecapMaps = { nameById: new Map(), idByName: new Map(), aliasMap: new Map() };
const channels: AoChannel[] = [
  { slackChannelId: "C_BF", aoDisplayName: "The Battlefield" },
  { slackChannelId: "C_LS", aoDisplayName: "The Last Stand" },
];
const BASE = "https://www.f3marietta.com";

test("builds one block per AO with posts, skips empty AOs, builds region", () => {
  const fact = [
    fr("n:milton", "b1", "The Battlefield", true), fr("n:milton", "b2", "The Battlefield"),
    fr("n:clean", "b1", "The Battlefield"),
  ];
  const { aoBlocks, regionBlock } = buildRecapBlocks(fact, channels, maps, BASE);
  assert.equal(aoBlocks.length, 1);
  const bf = aoBlocks[0];
  assert.equal(bf.aoDisplayName, "The Battlefield");
  assert.equal(bf.channelId, "C_BF");
  assert.equal(bf.beatdowns, 2);
  assert.equal(bf.paxCount, 2);
  assert.equal(bf.posts, 3);
  assert.deepEqual(bf.topPosters, { names: ["milton"], count: 2 });
  assert.equal(bf.url, "https://www.f3marietta.com/stats?range=last-month&ao=the-battlefield");
  assert.ok(regionBlock);
  assert.equal(regionBlock!.aoCount, 1);
  assert.equal(regionBlock!.url, "https://www.f3marietta.com/stats?range=last-month");
});

test("topQs is null when nobody Q'd; ties list all names", () => {
  const fact = [
    fr("n:a", "b1", "The Battlefield"), fr("n:b", "b1", "The Battlefield"),
    fr("n:b", "b2", "The Battlefield"), fr("n:a", "b2", "The Battlefield"),
  ];
  const { aoBlocks } = buildRecapBlocks(fact, channels, maps, BASE);
  assert.equal(aoBlocks[0].topQs, null);
  assert.deepEqual(aoBlocks[0].topPosters, { names: ["a", "b"], count: 2 });
});

test("empty fact yields no AO blocks and a null region block", () => {
  const { aoBlocks, regionBlock } = buildRecapBlocks([], channels, maps, BASE);
  assert.equal(aoBlocks.length, 0);
  assert.equal(regionBlock, null);
});
