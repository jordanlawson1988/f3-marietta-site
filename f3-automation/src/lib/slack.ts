import { WebClient } from '@slack/web-api';

let slackInstance: WebClient | null = null;

function getSlack(): WebClient {
  if (!slackInstance) {
    if (!process.env.SLACK_BOT_TOKEN) {
      throw new Error('SLACK_BOT_TOKEN not configured');
    }
    slackInstance = new WebClient(process.env.SLACK_BOT_TOKEN);
  }
  return slackInstance;
}

export async function postNewsletter(body: string): Promise<string> {
  const result = await getSlack().chat.postMessage({
    channel: process.env.SLACK_NEWSLETTER_CHANNEL_ID!,
    text: body,
    unfurl_links: false,
  });
  return result.ts ?? '';
}
