import Anthropic from '@anthropic-ai/sdk';
import type { CaptionGeneration } from '@/types';

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

export async function generateCaption(
  systemPrompt: string,
  userPrompt: string
): Promise<CaptionGeneration> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(text) as CaptionGeneration;
}

export async function generateNewsletter(
  systemPrompt: string,
  userPrompt: string
): Promise<{ title: string; body_markdown: string; body_slack_mrkdwn: string }> {
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{ role: 'user', content: userPrompt }],
  });

  const text = message.content[0].type === 'text' ? message.content[0].text : '';
  return JSON.parse(text);
}
