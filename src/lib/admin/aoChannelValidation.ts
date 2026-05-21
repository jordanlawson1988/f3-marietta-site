const CHANNEL_ID_RE = /^[CG][A-Z0-9]{6,}$/;

export function normalizeChannelId(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidChannelId(id: string): boolean {
  return CHANNEL_ID_RE.test(id);
}

export interface AoChannelValue {
  slack_channel_id: string;
  ao_display_name: string;
  slack_channel_name: string | null;
  is_enabled: boolean;
}

export type ValidationResult =
  | { ok: true; value: AoChannelValue }
  | { ok: false; error: string };

export function validateAoChannelInput(body: Record<string, unknown>): ValidationResult {
  const id = normalizeChannelId(String(body.slack_channel_id ?? ''));
  if (!id) return { ok: false, error: 'Channel ID is required' };
  if (!isValidChannelId(id)) return { ok: false, error: 'Channel ID must look like a Slack ID (e.g. C0A4LQHJUDD)' };
  const ao_display_name = String(body.ao_display_name ?? '').trim();
  if (!ao_display_name) return { ok: false, error: 'Display name is required' };
  const rawName = body.slack_channel_name;
  const slack_channel_name = rawName ? String(rawName).trim() : null;
  const is_enabled = body.is_enabled === undefined ? true : Boolean(body.is_enabled);
  return { ok: true, value: { slack_channel_id: id, ao_display_name, slack_channel_name, is_enabled } };
}
