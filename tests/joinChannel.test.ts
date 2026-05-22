import { test } from 'node:test';
import assert from 'node:assert';
import { shouldBackfill, joinSlackChannel, resolveBotForChannel } from '../src/lib/slack/joinChannel';

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

const base = { slackChannelId: 'C1', displayName: 'Kenmo' };
const joinIn = async () => ({ status: 'in' } as const);
const joinCannot = async () => ({ status: 'cannot_join', reason: 'method_not_supported_for_channel_type' } as const);

test('resolveBotForChannel: disabled → no join, no warning', async () => {
  let joined = false;
  const r = await resolveBotForChannel(
    { ...base, prevEnabled: false, nextEnabled: false },
    { join: async () => { joined = true; return { status: 'in' }; }, reconcile: async () => ({ processed: 9 }) }
  );
  assert.equal(joined, false);
  assert.deepEqual(r, { inChannel: false, backfilled: 0, warning: null });
});

test('resolveBotForChannel: enable-transition + joinable → backfills', async () => {
  const r = await resolveBotForChannel(
    { ...base, prevEnabled: false, nextEnabled: true },
    { join: joinIn, reconcile: async () => ({ processed: 4 }) }
  );
  assert.deepEqual(r, { inChannel: true, backfilled: 4, warning: null });
});

test('resolveBotForChannel: already enabled (edit) → in channel, no backfill', async () => {
  let reconciled = false;
  const r = await resolveBotForChannel(
    { ...base, prevEnabled: true, nextEnabled: true },
    { join: joinIn, reconcile: async () => { reconciled = true; return { processed: 1 }; } }
  );
  assert.equal(reconciled, false);
  assert.deepEqual(r, { inChannel: true, backfilled: 0, warning: null });
});

test('resolveBotForChannel: cannot join → warning, no backfill', async () => {
  const r = await resolveBotForChannel(
    { ...base, prevEnabled: false, nextEnabled: true },
    { join: joinCannot, reconcile: async () => ({ processed: 5 }) }
  );
  assert.equal(r.inChannel, false);
  assert.equal(r.backfilled, 0);
  assert.match(r.warning ?? '', /Kenmo/);
  assert.match(r.warning ?? '', /invite/i);
});
