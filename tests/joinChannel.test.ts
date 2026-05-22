import { test } from 'node:test';
import assert from 'node:assert';
import { shouldBackfill, joinSlackChannel } from '../src/lib/slack/joinChannel';

type JoinFn = (args: { channel: string }) => Promise<unknown>;
const fakeClient = (join: JoinFn) => ({ conversations: { join } });

test('shouldBackfill: true only on enable-transition with bot in channel', () => {
  assert.equal(shouldBackfill(false, true, true), true);   // newly enabled, bot in → backfill
  assert.equal(shouldBackfill(true, true, true), false);   // already enabled (plain edit) → no
  assert.equal(shouldBackfill(false, true, false), false); // enabled but bot can't join → no
  assert.equal(shouldBackfill(false, false, true), false); // staying disabled → no
  assert.equal(shouldBackfill(true, false, true), false);  // disabling → no
});

test('joinSlackChannel → in when join resolves ok', async () => {
  const r = await joinSlackChannel('C1', fakeClient(async () => ({ ok: true })));
  assert.deepEqual(r, { status: 'in' });
});

test('joinSlackChannel → cannot_join on missing_scope', async () => {
  const r = await joinSlackChannel('C1', fakeClient(async () => { throw { data: { error: 'missing_scope' } }; }));
  assert.deepEqual(r, { status: 'cannot_join', reason: 'missing_scope' });
});

test('joinSlackChannel → cannot_join on archived channel', async () => {
  const r = await joinSlackChannel('C1', fakeClient(async () => { throw { data: { error: 'is_archived' } }; }));
  assert.deepEqual(r, { status: 'cannot_join', reason: 'is_archived' });
});

test('joinSlackChannel → cannot_join on private channel', async () => {
  const r = await joinSlackChannel('C1', fakeClient(async () => { throw { data: { error: 'method_not_supported_for_channel_type' } }; }));
  assert.deepEqual(r, { status: 'cannot_join', reason: 'method_not_supported_for_channel_type' });
});

test('joinSlackChannel rethrows unexpected errors', async () => {
  await assert.rejects(
    () => joinSlackChannel('C1', fakeClient(async () => { throw { data: { error: 'ratelimited' } }; })),
    (err: unknown) => (err as { data?: { error?: string } })?.data?.error === 'ratelimited'
  );
});
