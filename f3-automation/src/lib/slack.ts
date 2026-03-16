import { WebClient } from '@slack/web-api';

const slack = new WebClient(process.env.SLACK_BOT_TOKEN);

export async function postNewsletter(body: string): Promise<string> {
  const result = await slack.chat.postMessage({
    channel: process.env.SLACK_NEWSLETTER_CHANNEL_ID!,
    text: body,
    unfurl_links: false,
  });
  return result.ts ?? '';
}
