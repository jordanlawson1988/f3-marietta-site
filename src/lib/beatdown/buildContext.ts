import { getSql } from '@/lib/db';
import { filterExiconForFocus } from '@/lib/beatdown/exicon';
import { loadFamousBeatdowns, findFamousBeatdown } from '@/lib/beatdown/loadFamousBeatdowns';
import type { BeatdownInputs } from '@/types/beatdown';

export interface BeatdownContext {
  knowledgeContent: string | null;
  knowledgeVersion: number | null;
  recentAtAo: { event_date: string | null; q_name: string | null; content_text: string | null }[];
}

const KNOWLEDGE_STALE_DAYS = 7;

export async function buildBeatdownContext(inputs: BeatdownInputs): Promise<BeatdownContext> {
  const sql = getSql();

  const knowledgeRows = await sql`
    SELECT id, content, generated_at
    FROM marietta_bd_knowledge
    ORDER BY generated_at DESC
    LIMIT 1
  ` as { id: number; content: string; generated_at: string }[];

  let knowledgeContent: string | null = null;
  let knowledgeVersion: number | null = null;
  if (knowledgeRows.length > 0) {
    const row = knowledgeRows[0];
    const ageMs = Date.now() - new Date(row.generated_at).getTime();
    if (ageMs < KNOWLEDGE_STALE_DAYS * 24 * 3600 * 1000) {
      knowledgeContent = row.content;
      knowledgeVersion = row.id;
    }
  }

  const recentAtAo = await sql`
    SELECT event_date, q_name, content_text
    FROM f3_events
    WHERE event_kind = 'backblast'
      AND is_deleted = false
      AND ao_display_name = ${inputs.ao_display_name}
    ORDER BY event_date DESC NULLS LAST, created_at DESC
    LIMIT 10
  ` as { event_date: string | null; q_name: string | null; content_text: string | null }[];

  // If no knowledge, fall back to a region-wide sample
  if (!knowledgeContent && recentAtAo.length < 5) {
    const fallback = await sql`
      SELECT event_date, q_name, content_text
      FROM f3_events
      WHERE event_kind = 'backblast'
        AND is_deleted = false
      ORDER BY event_date DESC NULLS LAST, created_at DESC
      LIMIT 20
    ` as { event_date: string | null; q_name: string | null; content_text: string | null }[];
    recentAtAo.push(...fallback);
  }

  return { knowledgeContent, knowledgeVersion, recentAtAo };
}

export function loadStaticContext(inputs: BeatdownInputs) {
  return {
    exiconSubset: filterExiconForFocus(inputs.focus),
    famousBdLibrary: loadFamousBeatdowns(),
    selectedFamousBd: findFamousBeatdown(inputs.famous_bd),
  };
}
