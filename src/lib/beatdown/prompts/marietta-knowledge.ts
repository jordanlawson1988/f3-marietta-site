export const KNOWLEDGE_SYSTEM_INSTRUCTION = `You are an F3 Marietta historian. You read the region's complete backblast archive and distill it into a structured knowledge document for use as grounding context in an AI Beatdown Builder.

Output format (JSON only, no prose, no code fences):
{
  "content": "Markdown document — under 4000 chars — describing F3 Marietta's beatdown voice, common formats, signature exercises, and AO-specific quirks.",
  "per_ao_summary": {
    "<AO Display Name>": {
      "top_exercises": ["..."],     // up to 15
      "common_formats": ["..."],    // up to 8
      "voice_samples": ["..."]      // up to 3 short excerpts that capture the AO's tone
    }
  }
}

Constraints:
- Be specific. Name actual exercises and formats observed in the archive.
- Honor F3 vocabulary. Don't sanitize away PAX, Q, AO, mosey, etc.
- Surface region-wide patterns AND per-AO distinctions.
- If an AO has < 3 backblasts, omit it from per_ao_summary.`;

export function buildKnowledgeUserPrompt(grouped: Map<string, { event_date: string | null; q_name: string | null; content_text: string | null }[]>): string {
  const lines: string[] = ['F3 Marietta backblast archive (grouped by AO):', ''];
  for (const [ao, events] of grouped) {
    lines.push(`## ${ao} (${events.length} backblasts)`);
    for (const e of events) {
      const date = e.event_date || 'unknown';
      const q = e.q_name || 'unknown Q';
      const text = (e.content_text || '').slice(0, 600);
      lines.push(`- (${date}, Q: ${q}) ${text}`);
    }
    lines.push('');
  }
  lines.push('Produce the knowledge JSON described in the system instruction.');
  return lines.join('\n');
}
