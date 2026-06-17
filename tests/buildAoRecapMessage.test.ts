import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  buildAoRecapMessage, buildRegionRecapMessage,
  type AoRecapBlock, type RegionRecapBlock,
} from "../src/lib/stats/buildAoRecap";

const aoBlock: AoRecapBlock = {
  scope: "ao", aoDisplayName: "The Battlefield", slug: "the-battlefield", channelId: "C_BF",
  posts: 142, beatdowns: 18, paxCount: 27,
  topPosters: { names: ["Milton"], count: 16 },
  topQs: { names: ["Mr Clean"], count: 5 },
  top10: [{ label: "Milton", posts: 16, qd: 4 }, { label: "Mr Clean", posts: 14, qd: 5 }],
  url: "https://www.f3marietta.com/stats?range=last-month&ao=the-battlefield",
  fngs: null,
};

test("AO message has header, stat line, shoutouts, top-10, url", () => {
  const msg = buildAoRecapMessage(aoBlock, "May 2026");
  assert.match(msg, /^\*The Battlefield — May 2026 Recap\* 🏋️/);
  assert.match(msg, /142 posts · 18 beatdowns · 27 PAX/);
  assert.match(msg, /🏆 Most posts: Milton \(16\)/);
  assert.match(msg, /🎤 Most Q'd: Mr Clean \(5\)/);
  assert.match(msg, /1\. Milton — 16/);
  assert.match(msg, /2\. Mr Clean — 14/);
  assert.match(msg, /Deep dive → https:\/\/www\.f3marietta\.com\/stats\?range=last-month&ao=the-battlefield/);
});

test("Q line omitted when topQs is null; ties comma-joined; singular post", () => {
  const msg = buildAoRecapMessage(
    { ...aoBlock, posts: 1, beatdowns: 1, topPosters: { names: ["A", "B"], count: 1 }, topQs: null },
    "May 2026",
  );
  assert.doesNotMatch(msg, /Most Q'd/);
  assert.match(msg, /1 post · 1 beatdown/);
  assert.match(msg, /🏆 Most posts: A, B \(1\)/);
});

test("AO FNG line: count, mention vs plain name, singular/plural, placement", () => {
  const withFngs: AoRecapBlock = {
    ...aoBlock,
    fngs: {
      count: 3,
      honorees: [
        { label: "Bishop", slackUserId: "U07ABC" },
        { label: "Carmine", slackUserId: null },
        { label: "Dredd", slackUserId: null },
      ],
    },
  };
  const msg = buildAoRecapMessage(withFngs, "May 2026");
  assert.match(msg, /🌱 3 new FNGs this month — welcome <@U07ABC>, Carmine, Dredd! 🎉/);
  // line sits directly under the stat line
  assert.match(msg, /27 PAX\n🌱 3 new FNGs this month/);

  const one = buildAoRecapMessage(
    { ...aoBlock, fngs: { count: 1, honorees: [{ label: "Bishop", slackUserId: null }] } },
    "May 2026",
  );
  assert.match(one, /🌱 1 new FNG this month — welcome Bishop! 🎉/);
});

test("AO FNG line omitted when fngs is null", () => {
  const msg = buildAoRecapMessage(aoBlock, "May 2026");
  assert.doesNotMatch(msg, /new FNG/);
});

test("region FNG line uses region wording and lists everyone", () => {
  const region: RegionRecapBlock = {
    scope: "region", posts: 842, beatdowns: 96, paxCount: 118, aoCount: 6,
    topPosters: { names: ["Milton"], count: 41 }, topQs: { names: ["Mr Clean"], count: 12 },
    top10: [{ label: "Milton", posts: 41, qd: 3 }],
    url: "https://www.f3marietta.com/stats?range=last-month",
    fngs: {
      count: 2,
      honorees: [{ label: "Ace", slackUserId: "U01" }, { label: "Bolt", slackUserId: null }],
    },
  };
  const msg = buildRegionRecapMessage(region, "May 2026");
  assert.match(msg, /🌱 2 new FNGs joined the region this month — welcome <@U01>, Bolt! 🎉/);
  assert.match(msg, /118 PAX · 6 AOs\n🌱 2 new FNGs joined the region this month/);
});

test("region message has region header, AO count, region url + labels", () => {
  const region: RegionRecapBlock = {
    scope: "region", posts: 842, beatdowns: 96, paxCount: 118, aoCount: 6,
    topPosters: { names: ["Milton"], count: 41 }, topQs: { names: ["Mr Clean"], count: 12 },
    top10: [{ label: "Milton", posts: 41, qd: 3 }],
    url: "https://www.f3marietta.com/stats?range=last-month",
    fngs: null,
  };
  const msg = buildRegionRecapMessage(region, "May 2026");
  assert.match(msg, /^\*F3 Marietta — May 2026 Region Recap\* 🌎/);
  assert.match(msg, /842 posts · 96 beatdowns · 118 PAX · 6 AOs/);
  assert.match(msg, /🏆 Most posts \(region\): Milton \(41\)/);
  assert.match(msg, /Top 10 PAX region-wide:/);
  assert.match(msg, /Deep dive → https:\/\/www\.f3marietta\.com\/stats\?range=last-month$/);
});
