import { getSlackClient } from './slackClient';

export type JoinOutcome = { status: 'in' } | { status: 'cannot_join'; reason: string };

type JoinCapableClient = { conversations: { join: (args: { channel: string }) => Promise<unknown> } };

// Slack errors that mean "the bot cannot self-join this channel" — surfaced, not thrown.
const CANNOT_JOIN_ERRORS = new Set([
  'is_archived',
  'method_not_supported_for_channel_type', // private channel
  'missing_scope',
  'channel_not_found',
  'is_private',
]);

/** Join a public Slack channel. Returns `in` (joined or already a member) or `cannot_join`. */
export async function joinSlackChannel(
  channelId: string,
  client: JoinCapableClient = getSlackClient()
): Promise<JoinOutcome> {
  try {
    await client.conversations.join({ channel: channelId });
    return { status: 'in' };
  } catch (err) {
    const code = (err as { data?: { error?: string } })?.data?.error;
    if (code && CANNOT_JOIN_ERRORS.has(code)) {
      return { status: 'cannot_join', reason: code };
    }
    throw err;
  }
}

/** Backfill iff the channel is newly enabled (false→true) and the bot can see it. */
export function shouldBackfill(prevEnabled: boolean, nextEnabled: boolean, botInChannel: boolean): boolean {
  return nextEnabled && !prevEnabled && botInChannel;
}
