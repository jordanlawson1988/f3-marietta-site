import { test } from 'node:test';
import assert from 'node:assert';
import { normalizeChannelId, isValidChannelId, validateAoChannelInput } from '../src/lib/admin/aoChannelValidation';

test('normalizeChannelId trims + uppercases', () => {
  assert.equal(normalizeChannelId('  c0a4lqhjudd '), 'C0A4LQHJUDD');
});

test('isValidChannelId accepts C/G ids, rejects junk', () => {
  assert.ok(isValidChannelId('C0A4LQHJUDD'));
  assert.ok(isValidChannelId('G01ABCDEF'));
  assert.ok(!isValidChannelId('nope'));
  assert.ok(!isValidChannelId('123'));
});

test('validateAoChannelInput requires id + display name', () => {
  assert.equal(validateAoChannelInput({ slack_channel_id: '', ao_display_name: 'X' }).ok, false);
  assert.equal(validateAoChannelInput({ slack_channel_id: 'C0A4LQHJUDD', ao_display_name: '' }).ok, false);
  const result = validateAoChannelInput({ slack_channel_id: 'c0a4lqhjudd', ao_display_name: ' Kenmo ', slack_channel_name: '#ao_kenmo' });
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.value.ao_display_name, 'Kenmo');
    assert.equal(result.value.slack_channel_id, 'C0A4LQHJUDD');
    assert.equal(result.value.is_enabled, true);
  }
});
