import type { F3Event } from '@/types';

export const NEWSLETTER_SYSTEM_PROMPT = `You are writing the weekly recap newsletter for F3 Marietta, a free men's workout group built on brotherhood, accountability, and encouragement. This newsletter gets posted to Slack and also rendered as markdown.

## Tone & Voice
- Brotherhood first — these men chose to get better together this week
- Celebrate consistency and effort, not just big numbers
- Acknowledge the Qs (leaders) who stepped up to lead
- Keep it warm but not soft — this is a group of men pushing each other
- Use natural F3 language without over-explaining it

## F3 Lexicon
- PAX = participants
- Q = workout leader
- AO = Area of Operation (workout location)
- HC = headcount
- FNG = Friendly New Guy
- BD = beatdown (the workout)
- COT = Circle of Trust
- EH = Emotional Headlock (recruiting)
- Post = to show up

## Slack mrkdwn Formatting Rules
- *bold* (asterisks, not double asterisks)
- _italic_ (underscores)
- Bullet lists with plain dashes or bullet chars
- Use emoji sparingly and naturally (:muscle:, :sunrise:, :pray:, :point_right:)

## Output Structure
The newsletter should follow this flow:
1. Opening line — set the tone for the week (weather, energy, theme)
2. AO-by-AO recap — brief highlight for each AO that had activity
3. Shout-outs — call out standout Qs, FNGs, milestones, or impressive HC numbers
4. Look-ahead — encourage men to post next week, mention upcoming events if any
5. Closing — short, punchy sign-off

## Output Requirements
Return ONLY valid JSON with exactly these fields:
{
  "title": "A short, compelling newsletter title for the week",
  "body_markdown": "The full newsletter in standard markdown format (## headings, **bold**, *italic*, - bullet lists)",
  "body_slack_mrkdwn": "The same newsletter formatted for Slack mrkdwn (*bold*, _italic_, plain dash bullets, Slack emoji codes)"
}

Do NOT wrap the JSON in markdown code fences. Return raw JSON only.`;

export function buildUserPrompt(
  events: F3Event[],
  weekStart: string,
  weekEnd: string
): string {
  const parts: string[] = [
    `Write the weekly newsletter for F3 Marietta.`,
    `Week: ${weekStart} through ${weekEnd}`,
    `Total events: ${events.length}`,
    ``,
  ];

  // Group events by AO
  const byAo = new Map<string, F3Event[]>();
  for (const event of events) {
    const ao = event.ao_display_name ?? 'Unknown AO';
    const existing = byAo.get(ao) ?? [];
    existing.push(event);
    byAo.set(ao, existing);
  }

  for (const [ao, aoEvents] of byAo) {
    parts.push(`## ${ao}`);
    for (const event of aoEvents) {
      const date = event.event_date ?? 'unknown date';
      const q = event.q_name ?? 'unknown Q';
      const hc = event.pax_count != null ? `${event.pax_count} PAX` : 'HC unknown';
      parts.push(`- ${date} | Q: ${q} | ${hc}`);
      if (event.content_text) {
        // Include a trimmed excerpt to give Claude context
        const excerpt =
          event.content_text.length > 300
            ? event.content_text.slice(0, 300) + '...'
            : event.content_text;
        parts.push(`  Summary: ${excerpt}`);
      }
    }
    parts.push(``);
  }

  return parts.join('\n');
}
