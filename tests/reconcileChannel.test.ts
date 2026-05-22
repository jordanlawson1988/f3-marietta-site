import { test } from 'node:test';
import assert from 'node:assert';
import type { getSql } from '../src/lib/db';
import type { NormalizedEvent } from '../src/types/f3Event';
import { reconcileChannel } from '../src/lib/slack/reconcileChannels';

type Sql = ReturnType<typeof getSql>;
const channel = { slack_channel_id: 'C1', ao_display_name: 'Kenmo' };

// Fake tagged-template sql that records each invocation's interpolated values.
function recordingSql(): { sql: Sql; calls: unknown[][] } {
  const calls: unknown[][] = [];
  const fn = (_s: TemplateStringsArray, ...v: unknown[]) => {
    calls.push(v);
    return Promise.resolve([] as Record<string, unknown>[]);
  };
  return { sql: fn as unknown as Sql, calls };
}

const normalized: NormalizedEvent = {
  slack_channel_id: 'C1', slack_message_ts: '100', event_kind: 'backblast',
  content_json: {}, raw_envelope_json: {}, attendees: [], qs: [], blocks: [],
};
const fakeNormalize = async () => normalized;

test('reconcileChannel: not_in_channel → flagged, nothing processed', async () => {
  const { sql } = recordingSql();
  const r = await reconcileChannel(channel, {
    sql,
    fetchHistory: async () => ({ ok: false, error: 'not_in_channel' }),
    normalize: fakeNormalize,
  });
  assert.deepEqual(r, { processed: 0, errors: 1, notInChannel: true });
});

test('reconcileChannel: upserts a backblast, skips chatter/threads/tombstones', async () => {
  const { sql, calls } = recordingSql();
  const r = await reconcileChannel(channel, {
    sql,
    fetchHistory: async () => ({
      ok: true,
      messages: [
        { ts: '100', metadata: { event_type: 'backblast' }, text: 'WARMUP...', bot_id: 'B1' }, // upsert
        { ts: '101', text: 'just chatting' },                                                   // skip (not BB)
        { ts: '102', thread_ts: '100', text: 'backblast reply' },                               // skip (thread reply)
        { ts: '103', subtype: 'tombstone' },                                                    // skip
      ],
    }),
    normalize: fakeNormalize,
  });
  assert.equal(r.processed, 1);
  assert.equal(r.errors, 0);
  assert.equal(r.notInChannel, false);
  assert.equal(calls.length, 1); // exactly one upsert
});
