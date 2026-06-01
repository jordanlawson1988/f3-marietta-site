import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildAoRecapRunReport, type AoPostResult } from "../src/lib/stats/aoRecapReport";

const r = (over: Partial<AoPostResult>): AoPostResult => ({
  scope: "ao", label: "The Battlefield", channelId: "C", status: "posted", ...over,
});

test("all-posted summary lists counts and channels", () => {
  const out = buildAoRecapRunReport({
    monthLabel: "May 2026", mode: "live",
    results: [r({}), r({ label: "Kenmo", channelId: "C2" }), r({ scope: "region", label: "#all-f3-marietta", channelId: "C3" })],
    skippedEmpty: ["CSAUP"],
  });
  assert.match(out, /F3 Marietta — AO\/Region Recap Run \(May 2026\)/);
  assert.match(out, /Mode: live · Posted: 3 · Already: 0 · Errors: 0/);
  assert.match(out, /Skipped \(no posts\): CSAUP/);
});

test("errors and already-posted are itemized", () => {
  const out = buildAoRecapRunReport({
    monthLabel: "May 2026", mode: "live",
    results: [
      r({ status: "error", error: "not_in_channel" }),
      r({ label: "Kenmo", channelId: "C2", status: "already-posted" }),
    ],
    skippedEmpty: [],
  });
  assert.match(out, /Posted: 0 · Already: 1 · Errors: 1/);
  assert.match(out, /• The Battlefield — not_in_channel/);
  assert.match(out, /Already posted this month: Kenmo/);
});

test("dry-run shows what would post", () => {
  const out = buildAoRecapRunReport({
    monthLabel: "May 2026", mode: "dry-run",
    results: [r({ status: "dry-run" })], skippedEmpty: [],
  });
  assert.match(out, /Mode: dry-run/);
  assert.match(out, /Would post: 1/);
});
