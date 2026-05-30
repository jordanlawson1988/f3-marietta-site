import { test } from "node:test";
import { strict as assert } from "node:assert";
import { buildRecapRunReport } from "../src/lib/stats/recapReport";
import type { UnreachableRow } from "../src/lib/stats/getMonthlyPaxRecap";

const WINDOW = { from: "2026-04-01", to: "2026-04-30", monthLabel: "April 2026" };

function unreachableList(n: number, posts = 1): UnreachableRow[] {
  return Array.from({ length: n }, (_, i) => ({
    paxToken: `n:pax${i}`,
    paxLabel: `pax${i}`,
    posts,
    reason: "no-slack-mapping" as const,
  }));
}

test("all-clear collapses to a single line when nothing failed or unreachable", () => {
  const out = buildRecapRunReport({
    window: WINDOW, mode: "live", recipientsCount: 12, sent: 12, errors: [], unreachable: [],
  });
  assert.equal(out, "✅ All 12 delivered · 0 unreachable");
});

test("nothing-to-do when no recipients and no unreachable", () => {
  const out = buildRecapRunReport({
    window: WINDOW, mode: "live", recipientsCount: 0, sent: 0, errors: [], unreachable: [],
  });
  assert.equal(out, "No PAX posted in April 2026 — nothing to recap.");
});

test("send-errors section lists each failed PAX with id and error", () => {
  const out = buildRecapRunReport({
    window: WINDOW, mode: "live", recipientsCount: 3, sent: 2,
    errors: [{ slackUserId: "U001", paxLabel: "Mr Clean", error: "cannot_dm_user" }],
    unreachable: [],
  });
  assert.match(out, /F3 Marietta — Monthly Recap Run \(April 2026\)/);
  assert.match(out, /Mode: live · Recipients: 3 · Sent: 2 · Failed: 1 · Unreachable: 0/);
  assert.match(out, /• Mr Clean \(U001\) — cannot_dm_user/);
});

test("unreachable section lists each PAX with post count and the fix hint", () => {
  const out = buildRecapRunReport({
    window: WINDOW, mode: "dry-run", recipientsCount: 5, sent: 0, errors: [],
    unreachable: [{ paxToken: "n:bulldog", paxLabel: "bulldog", posts: 3, reason: "no-slack-mapping" }],
  });
  assert.match(out, /Mode: dry-run/);
  assert.match(out, /• "bulldog" — 3 posts/);
  assert.match(out, /have no Slack ID/);
  assert.match(out, /Add a mapping/);
});

test("reports both failure classes together", () => {
  const out = buildRecapRunReport({
    window: WINDOW, mode: "live", recipientsCount: 4, sent: 2,
    errors: [{ slackUserId: "U001", paxLabel: "Mr Clean", error: "user_not_found" }],
    unreachable: [{ paxToken: "n:ghost", paxLabel: "ghost", posts: 1, reason: "no-slack-mapping" }],
  });
  assert.match(out, /Failed: 1 · Unreachable: 1/);
  assert.match(out, /• Mr Clean \(U001\) — user_not_found/);
  assert.match(out, /• "ghost" — 1 post\b/);
});

test("pluralizes post vs posts in the unreachable list", () => {
  const out = buildRecapRunReport({
    window: WINDOW, mode: "dry-run", recipientsCount: 0, sent: 0, errors: [],
    unreachable: [
      { paxToken: "n:one", paxLabel: "one", posts: 1, reason: "no-slack-mapping" },
      { paxToken: "n:many", paxLabel: "many", posts: 4, reason: "no-slack-mapping" },
    ],
  });
  assert.match(out, /• "many" — 4 posts/);
  assert.match(out, /• "one" — 1 post\b/);
});

test("truncates long lists and shows the remaining count (not silent)", () => {
  const out = buildRecapRunReport({
    window: WINDOW, mode: "dry-run", recipientsCount: 0, sent: 0, errors: [],
    unreachable: unreachableList(30), maxListItems: 25,
  });
  const bulletCount = (out.match(/^• /gm) || []).length;
  assert.equal(bulletCount, 25);
  assert.match(out, /…and 5 more/);
});

test("unreachable list is rendered sorted by posts desc", () => {
  const out = buildRecapRunReport({
    window: WINDOW, mode: "dry-run", recipientsCount: 0, sent: 0, errors: [],
    unreachable: [
      { paxToken: "n:low", paxLabel: "low", posts: 1, reason: "no-slack-mapping" },
      { paxToken: "n:high", paxLabel: "high", posts: 9, reason: "no-slack-mapping" },
    ],
  });
  assert.ok(out.indexOf('"high"') < out.indexOf('"low"'), "higher post count first");
});

test("mode label reflects dry-run", () => {
  const dry = buildRecapRunReport({
    window: WINDOW, mode: "dry-run", recipientsCount: 1, sent: 0, errors: [],
    unreachable: [{ paxToken: "n:x", paxLabel: "x", posts: 1, reason: "no-slack-mapping" }],
  });
  assert.match(dry, /Mode: dry-run/);
});
