import { test } from 'node:test';
import assert from 'node:assert';
import { shouldBackfill } from '../src/lib/slack/joinChannel';

test('shouldBackfill: true only on enable-transition with bot in channel', () => {
  assert.equal(shouldBackfill(false, true, true), true);   // newly enabled, bot in → backfill
  assert.equal(shouldBackfill(true, true, true), false);   // already enabled (plain edit) → no
  assert.equal(shouldBackfill(false, true, false), false); // enabled but bot can't join → no
  assert.equal(shouldBackfill(false, false, true), false); // staying disabled → no
  assert.equal(shouldBackfill(true, false, true), false);  // disabling → no
});
