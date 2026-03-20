import { getSlackClient } from './slackClient';

export async function postNewsletter(body: string): Promise<string> {
  const client = getSlackClient();
  const result = await client.chat.postMessage({
    channel: process.env.SLACK_NEWSLETTER_CHANNEL_ID!,
    text: body,
    unfurl_links: false,
  });
  return result.ts ?? '';
}
