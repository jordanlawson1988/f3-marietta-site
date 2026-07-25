import { test } from "node:test";
import { strict as assert } from "node:assert";
import { triageSlackEvent, type TriageableSlackEvent } from "../src/lib/slack/triageSlackEvent";

// Build a Slack Events API envelope exactly as /api/slack/events receives it.
// triageSlackEvent takes both the parsed event and the raw envelope string
// because the backblast/preblast classifiers operate on the raw payload.
function envelope(message: Record<string, unknown>): { event: TriageableSlackEvent; raw: string } {
  const event = {
    type: "message",
    channel: "C0B56FKKEE4",
    ts: "1780152273.514269",
    ...message,
  } as unknown as TriageableSlackEvent;
  return { event, raw: JSON.stringify({ type: "event_callback", event }) };
}

const BACKBLAST_TEXT =
  "*Backblast! Germantown*\n*DATE*: 2026-05-30\n*AO*: Germantown\n*Q*: <@U0A9RDSRUGG>\n*PAX*: <@U0A4U71RN4F>\n*COUNT*: 5";
const PREBLAST_TEXT = "*Preblast: Germantown*\n*DATE*: 2026-06-01\n*Q*: <@U0A9RDSRUGG>";

test("plain channel chatter is ignored without any DB action", () => {
  const { event, raw } = envelope({ user: "U1", text: "How do I HC for the coffeeteria?" });
  assert.deepEqual(triageSlackEvent(event, raw), { action: "ignore", reason: "not_f3_content" });
});

test("hand-typed backblast triages to upsert", () => {
  const { event, raw } = envelope({ user: "U1", text: BACKBLAST_TEXT });
  assert.deepEqual(triageSlackEvent(event, raw), { action: "upsert", kind: "backblast" });
});

test("preblast triages to upsert", () => {
  const { event, raw } = envelope({ user: "U1", text: PREBLAST_TEXT });
  assert.deepEqual(triageSlackEvent(event, raw), { action: "upsert", kind: "preblast" });
});

test("Slackblast-app post with metadata event_type triages to upsert", () => {
  const { event, raw } = envelope({
    text: "WARMUP: Abe Vigodas...\nTHE THANG: ...",
    metadata: { event_type: "backblast", event_payload: { the_q: "U1", the_pax: ["U2"] } },
  });
  assert.deepEqual(triageSlackEvent(event, raw), { action: "upsert", kind: "backblast" });
});

test("bot_message backblast triages to upsert", () => {
  const { event, raw } = envelope({ subtype: "bot_message", bot_id: "B1", text: BACKBLAST_TEXT });
  assert.deepEqual(triageSlackEvent(event, raw), { action: "upsert", kind: "backblast" });
});

test("thread reply is ignored even when it looks like a backblast", () => {
  const { event, raw } = envelope({
    user: "U1",
    text: BACKBLAST_TEXT,
    thread_ts: "1780152000.000001", // differs from ts → reply
  });
  assert.deepEqual(triageSlackEvent(event, raw), { action: "ignore", reason: "thread_reply" });
});

test("top-level thread parent (thread_ts === ts) is NOT treated as a reply", () => {
  const { event, raw } = envelope({ user: "U1", text: BACKBLAST_TEXT, thread_ts: "1780152273.514269" });
  assert.deepEqual(triageSlackEvent(event, raw), { action: "upsert", kind: "backblast" });
});

test("message_changed edit of a backblast triages to upsert with the edit ts", () => {
  const { event, raw } = envelope({
    subtype: "message_changed",
    ts: "1780159999.000001", // edit event ts
    message: { ts: "1780152273.514269", user: "U1", text: BACKBLAST_TEXT },
    previous_message: { ts: "1780152273.514269" },
  });
  assert.deepEqual(triageSlackEvent(event, raw), {
    action: "upsert",
    kind: "backblast",
    editTs: "1780159999.000001",
  });
});

test("message_changed edit of ordinary chatter is ignored", () => {
  const { event, raw } = envelope({
    subtype: "message_changed",
    message: { ts: "1780152273.514269", user: "U1", text: "typo fix on my joke" },
  });
  assert.deepEqual(triageSlackEvent(event, raw), { action: "ignore", reason: "not_f3_content" });
});

test("message_changed edit of a thread reply is ignored", () => {
  const { event, raw } = envelope({
    subtype: "message_changed",
    message: { ts: "1780152273.514269", thread_ts: "1780150000.000001", user: "U1", text: BACKBLAST_TEXT },
  });
  assert.deepEqual(triageSlackEvent(event, raw), { action: "ignore", reason: "thread_reply" });
});

test("message_deleted triages to delete with the original message ts", () => {
  const { event, raw } = envelope({
    subtype: "message_deleted",
    previous_message: { ts: "1780152273.514269" },
  });
  assert.deepEqual(triageSlackEvent(event, raw), { action: "delete", previousTs: "1780152273.514269" });
});

test("channel_join system message is ignored", () => {
  const { event, raw } = envelope({ subtype: "channel_join", user: "U1", text: "<@U1> has joined the channel" });
  assert.deepEqual(triageSlackEvent(event, raw), { action: "ignore", reason: "unsupported_subtype" });
});

test("non-message event types are ignored", () => {
  const { event, raw } = envelope({ user: "U1", text: BACKBLAST_TEXT });
  const reactionEvent = { ...event, type: "reaction_added" };
  assert.deepEqual(triageSlackEvent(reactionEvent, raw), { action: "ignore", reason: "not_message" });
});
