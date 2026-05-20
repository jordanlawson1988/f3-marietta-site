import type { ChatPostMessageArguments } from '@slack/web-api';
import { getSlackClient } from './slackClient';

export type PostNewsletterOptions = {
  /** Override the bot's displayed username for this single message (requires
   *  the Slack app to have the `chat:write.customize` Bot Token Scope). */
  username?: string;
  /** Optional avatar URL to display next to `username`. */
  iconUrl?: string;
  /** Optional Slack emoji code (e.g. `:bust_in_silhouette:`) — alternative to iconUrl. */
  iconEmoji?: string;
};

export async function postNewsletter(
  body: string,
  options: PostNewsletterOptions = {}
): Promise<string> {
  const client = getSlackClient();
  // The @slack/web-api types model chat:write.customize fields as a discriminated
  // union variant that the plain `{text,channel}` shape doesn't satisfy. Cast
  // through unknown — runtime accepts the same payload.
  const args = {
    channel: process.env.SLACK_NEWSLETTER_CHANNEL_ID!,
    text: body,
    unfurl_links: false,
    ...(options.username ? { username: options.username } : {}),
    ...(options.iconUrl ? { icon_url: options.iconUrl } : {}),
    ...(options.iconEmoji ? { icon_emoji: options.iconEmoji } : {}),
  } as unknown as ChatPostMessageArguments;
  const result = await client.chat.postMessage(args);
  return result.ts ?? '';
}
