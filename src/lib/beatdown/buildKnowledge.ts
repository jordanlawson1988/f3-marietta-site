import Anthropic from '@anthropic-ai/sdk';
import { getSql } from '@/lib/db';
import { KNOWLEDGE_SYSTEM_INSTRUCTION, buildKnowledgeUserPrompt } from '@/lib/beatdown/prompts/marietta-knowledge';

const KNOWLEDGE_MODEL = 'claude-sonnet-4-20250514';
const MAX_TOKENS = 4000;

export interface BuildKnowledgeResult {
  status: 'built' | 'skipped' | 'failed';
  reason?: string;
  knowledge_id?: number;
  source_event_count?: number;
  generation_ms?: number;
}

let _anthropic: Anthropic | null = null;
function getAnthropic(): Anthropic {
  if (!_anthropic) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) throw new Error('ANTHROPIC_API_KEY is not set');
    _anthropic = new Anthropic({ apiKey });
  }
  return _anthropic;
}

export async function buildBeatdownKnowledge(opts: { force?: boolean } = {}): Promise<BuildKnowledgeResult> {
  const sql = getSql();
  const t0 = Date.now();

  const events = await sql`
    SELECT event_date, q_name, content_text, ao_display_name
    FROM f3_events
    WHERE event_kind = 'backblast'
      AND is_deleted = false
      AND content_text IS NOT NULL
    ORDER BY event_date DESC NULLS LAST, created_at DESC
  ` as { event_date: string | null; q_name: string | null; content_text: string | null; ao_display_name: string | null }[];

  if (events.length === 0) return { status: 'skipped', reason: 'no_backblasts' };

  if (!opts.force) {
    const latest = await sql`
      SELECT generated_at, source_event_count
      FROM marietta_bd_knowledge
      ORDER BY generated_at DESC
      LIMIT 1
    ` as { generated_at: string; source_event_count: number }[];
    if (latest.length > 0 && latest[0].source_event_count === events.length) {
      return { status: 'skipped', reason: 'no_new_backblasts' };
    }
  }

  const grouped = new Map<string, typeof events>();
  for (const e of events) {
    const ao = e.ao_display_name || 'Unknown AO';
    const arr = grouped.get(ao) || [];
    arr.push(e);
    grouped.set(ao, arr);
  }

  const userPrompt = buildKnowledgeUserPrompt(grouped);

  let parsed: { content: string; per_ao_summary: Record<string, unknown> };
  try {
    const anthropic = getAnthropic();
    const resp = await anthropic.messages.create({
      model: KNOWLEDGE_MODEL,
      max_tokens: MAX_TOKENS,
      system: KNOWLEDGE_SYSTEM_INSTRUCTION,
      messages: [{ role: 'user', content: userPrompt }],
    });
    const block = resp.content.find(c => c.type === 'text');
    if (!block || block.type !== 'text') throw new Error('No text block in Claude response');
    const text = block.text.trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '').trim();
    parsed = JSON.parse(text);
  } catch (err) {
    console.error('[buildKnowledge] Claude call failed', err);
    return { status: 'failed', reason: (err as Error).message };
  }

  const generation_ms = Date.now() - t0;

  const inserted = await sql`
    INSERT INTO marietta_bd_knowledge (source_event_count, content, per_ao_summary, generation_model, generation_ms)
    VALUES (${events.length}, ${parsed.content}, ${JSON.stringify(parsed.per_ao_summary || {})}, ${KNOWLEDGE_MODEL}, ${generation_ms})
    RETURNING id
  ` as { id: number }[];

  await sql`DELETE FROM marietta_bd_knowledge WHERE generated_at < now() - interval '30 days'`;

  return {
    status: 'built',
    knowledge_id: inserted[0].id,
    source_event_count: events.length,
    generation_ms,
  };
}
