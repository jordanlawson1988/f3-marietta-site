export const KNOWLEDGE_SYSTEM_INSTRUCTION = `You are an F3 Marietta historian and programming analyst. You read the region's backblast archive and distill it into a structured knowledge document used as grounding context by an AI Beatdown Builder.

Output format (JSON only, no prose, no code fences):
{
  "content": "Markdown document — under 6000 chars — describing F3 Marietta's beatdown voice, common formats, signature exercises, seasonal/terrain patterns, and AO-specific quirks. Be dense and specific; this document is the region's programming brain.",
  "per_ao_summary": {
    "<AO Display Name>": {
      "top_exercises": ["..."],     // up to 15 — enduring signatures across the whole archive
      "common_formats": ["..."],    // up to 8 — e.g. Dora, 11s, EMOM, stations, ladders
      "voice_samples": ["..."],     // up to 3 short excerpts that capture the AO's tone
      "crowd_pleasers": ["..."],    // up to 5 — exercises/formats that clearly drew energy or mumblechatter
      "recent_trends": ["..."]      // up to 5 — patterns from roughly the most recent month (formats leaned on, themes, new arrivals)
    }
  }
}

Analysis directives:
- Be specific. Name actual exercises and formats observed in the archive — never generic filler.
- Distinguish ENDURING signatures (all-time patterns) from RECENT trends (the newest backblasts are listed first).
- Note what the builder should avoid: anything visibly overused in the recent month.
- Infer terrain and equipment per AO from the text (hills, parking decks, pull-up bars, coupons) and record it in content.
- Honor F3 vocabulary. Don't sanitize away PAX, Q, AO, mosey, etc.
- Surface region-wide patterns AND per-AO distinctions.
- If an AO has < 3 backblasts, omit it from per_ao_summary.`;

export function buildKnowledgeUserPrompt(grouped: Map<string, { event_date: string | null; q_name: string | null; content_text: string | null }[]>): string {
  const lines: string[] = ['F3 Marietta backblast archive (grouped by AO, newest first within each AO):', ''];
  for (const [ao, events] of grouped) {
    lines.push(`## ${ao} (${events.length} backblasts)`);
    for (const e of events) {
      const date = e.event_date || 'unknown';
      const q = e.q_name || 'unknown Q';
      const text = (e.content_text || '').slice(0, 900);
      lines.push(`- (${date}, Q: ${q}) ${text}`);
    }
    lines.push('');
  }
  lines.push('Produce the knowledge JSON described in the system instruction.');
  return lines.join('\n');
}
