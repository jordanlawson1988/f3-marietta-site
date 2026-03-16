import Anthropic from '@anthropic-ai/sdk';
import type { CaptionGeneration } from '@/types';

let anthropicInstance: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicInstance) {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured');
    }
    anthropicInstance = new Anthropic();
  }
  return anthropicInstance;
}

function cleanJsonResponse(text: string): string {
  return text.replace(/^```json?\n?/, '').replace(/\n?```$/, '').trim();
}

export async function generateCaption(
  systemPrompt: string,
  userPrompt: string
): Promise<CaptionGeneration> {
  const message = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const parsed = JSON.parse(cleanJsonResponse(text));

  if (!parsed.caption || !Array.isArray(parsed.hashtags)) {
    throw new Error('Claude returned unexpected JSON structure for caption');
  }

  return parsed as CaptionGeneration;
}

export async function generateNewsletter(
  systemPrompt: string,
  userPrompt: string
): Promise<{ title: string; body_markdown: string; body_slack_mrkdwn: string }> {
  const message = await getAnthropic().messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  const parsed = JSON.parse(cleanJsonResponse(text));

  if (!parsed.body_slack_mrkdwn) {
    throw new Error('Claude returned unexpected JSON structure for newsletter');
  }

  return parsed;
}
