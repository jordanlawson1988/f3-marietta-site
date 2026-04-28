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

  const [knowledgeRows, primaryRecent] = await Promise.all([
    sql`
      SELECT id, content, generated_at
      FROM marietta_bd_knowledge
      ORDER BY generated_at DESC
      LIMIT 1
    ` as unknown as { id: number; content: string; generated_at: string }[],
    sql`
      SELECT id, event_date, q_name, content_text
      FROM f3_events
      WHERE event_kind = 'backblast'
        AND is_deleted = false
        AND ao_display_name = ${inputs.ao_display_name}
      ORDER BY event_date DESC NULLS LAST, created_at DESC
      LIMIT 10
    ` as unknown as { id: string; event_date: string | null; q_name: string | null; content_text: string | null }[],
  ]);

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

  let recentAtAo: { event_date: string | null; q_name: string | null; content_text: string | null }[] =
    primaryRecent.map(r => ({ event_date: r.event_date, q_name: r.q_name, content_text: r.content_text }));

  // If no knowledge AND fewer than 5 AO-specific rows, backfill region-wide while skipping any IDs we already have.
  if (!knowledgeContent && primaryRecent.length < 5) {
    const seenIds = new Set(primaryRecent.map(r => r.id));
    const fallback = await sql`
      SELECT id, event_date, q_name, content_text
      FROM f3_events
      WHERE event_kind = 'backblast'
        AND is_deleted = false
      ORDER BY event_date DESC NULLS LAST, created_at DESC
      LIMIT 20
    ` as unknown as { id: string; event_date: string | null; q_name: string | null; content_text: string | null }[];
    for (const row of fallback) {
      if (seenIds.has(row.id)) continue;
      recentAtAo.push({ event_date: row.event_date, q_name: row.q_name, content_text: row.content_text });
    }
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
