import { test } from "node:test";
import { strict as assert } from "node:assert";
import {
  isBackblastPayload,
  isPreblastPayload,
  normalizeSlackMessage,
} from "../src/lib/slack/normalizeSlackMessage";

// Build a Slack Events API envelope as /api/slack/events receives it.
function envelope(message: Record<string, unknown>): string {
  return JSON.stringify({
    type: "event_callback",
    event: { type: "message", channel: "C0B56FKKEE4", ts: "1780152273.514269", ...message },
  });
}

// The real message Germantown's Q typed by hand (Slackblast app NOT used):
// no metadata, text begins with Slack bold markup `*Backblast! ...*`.
const HUMAN_BACKBLAST = envelope({
  user: "U0A9RDSRUGG",
  text: "*Backblast! Germantown*\n*DATE*: 2026-05-30\n*AO*: Germantown\n*Q*: <@U0A9RDSRUGG>\n*PAX*: <@U0A4U71RN4F>, <@U0A62FJ15CK>\n*COUNT*: 5",
});

const HUMAN_PREBLAST = envelope({
  user: "U0A9RDSRUGG",
  text: "*Preblast: Germantown*\n*DATE*: 2026-06-01\n*Q*: <@U0A9RDSRUGG>",
});

// Regression guard: a Slackblast-app post carries metadata.event_type and must
// keep being detected even though its visible text does not start with the word.
const SLACKBLAST_META = envelope({
  text: "WARMUP: Abe Vigodas...\nTHE THANG: ...",
  metadata: { event_type: "backblast", event_payload: { the_q: "U0A9RDSRUGG", the_pax: ["U1", "U2"] } },
});

// A normal chat line in the channel must NOT be treated as a backblast.
const PLAIN_CHAT = envelope({ user: "U0A6LF89YSW", text: "How do I HC for the coffeeteria?" });

test("detects a hand-typed backblast that starts with Slack bold markup", () => {
  assert.equal(isBackblastPayload(HUMAN_BACKBLAST), true);
});

test("detects a hand-typed preblast that starts with Slack bold markup", () => {
  assert.equal(isPreblastPayload(HUMAN_PREBLAST), true);
});

test("normalizes a hand-typed backblast to event_kind='backblast' (not 'unknown')", async () => {
  const n = await normalizeSlackMessage(HUMAN_BACKBLAST, "Germantown");
  assert.equal(n.event_kind, "backblast");
});

test("still detects a Slackblast-app backblast via metadata.event_type", () => {
  assert.equal(isBackblastPayload(SLACKBLAST_META), true);
});

test("does not misclassify a normal chat message as a backblast or preblast", () => {
  assert.equal(isBackblastPayload(PLAIN_CHAT), false);
  assert.equal(isPreblastPayload(PLAIN_CHAT), false);
});

test("extracts a clean title from a markup-wrapped backblast header", async () => {
  const n = await normalizeSlackMessage(HUMAN_BACKBLAST, "Germantown");
  assert.equal(n.title, "Germantown");
});

// Hand-typed backblasts carry no Slackblast metadata, so the date/Q/count must
// be parsed from the message text — otherwise the row has event_date=null and
// is invisible to the stats queries (which require event_date IS NOT NULL).
test("extracts event_date from a hand-typed backblast DATE line", async () => {
  const n = await normalizeSlackMessage(HUMAN_BACKBLAST, "Germantown");
  assert.equal(n.event_date, "2026-05-30");
});

test("extracts the Q slack id from a hand-typed backblast Q line", async () => {
  const n = await normalizeSlackMessage(HUMAN_BACKBLAST, "Germantown");
  assert.equal(n.q_slack_user_id, "U0A9RDSRUGG");
  assert.deepEqual(n.qs.map((q) => q.slack_user_id), ["U0A9RDSRUGG"]);
});

test("reads pax_count from a hand-typed backblast COUNT line", async () => {
  const n = await normalizeSlackMessage(HUMAN_BACKBLAST, "Germantown");
  assert.equal(n.pax_count, 5);
});

// Regression: when Slackblast metadata IS present it must still drive extraction.
test("Slackblast metadata still drives Q and pax_count extraction", async () => {
  const n = await normalizeSlackMessage(SLACKBLAST_META, "Germantown");
  assert.equal(n.q_slack_user_id, "U0A9RDSRUGG");
  assert.equal(n.pax_count, 2);
});
