import { getSql } from '@/lib/db';
import { exiconEntries } from '@/../data/f3Glossary';
import { filterExiconForFocus } from '@/lib/beatdown/exicon';
import { extractRecentExercises, type RecentExerciseStat } from '@/lib/beatdown/recentExercises';
import { loadFamousBeatdowns, findFamousBeatdown } from '@/lib/beatdown/loadFamousBeatdowns';
import { getAoBeatdownContext } from '@/lib/beatdown/aoContext';
import type { AoIntel, BeatdownInputs } from '@/types/beatdown';

export interface BeatdownContext {
  knowledgeContent: string | null;
  knowledgeVersion: number | null;
  recentAtAo: { event_date: string | null; q_name: string | null; content_text: string | null }[];
  /** Per-AO analysis from the latest knowledge row, when an AO is selected. */
  aoIntel: AoIntel | null;
  /** Exicon-term frequency across recentAtAo — the avoid-repeat signal. */
  recentExercises: RecentExerciseStat[];
}

// Knowledge is rebuilt by the daily reconcile cron whenever new backblasts
// land. Two weeks of staleness tolerance keeps generation from going
// knowledge-blind if a few cron runs fail in a row.
const KNOWLEDGE_STALE_DAYS = 14;

export async function buildBeatdownContext(inputs: BeatdownInputs): Promise<BeatdownContext> {
  const sql = getSql();

  const knowledgePromise = sql`
    SELECT id, content, per_ao_summary, generated_at
    FROM marietta_bd_knowledge
    ORDER BY generated_at DESC
    LIMIT 1
  ` as unknown as Promise<{ id: number; content: string; per_ao_summary: unknown; generated_at: string }[]>;

  const primaryRecentPromise = inputs.ao_display_name
    ? (sql`
        SELECT id, event_date, q_name, content_text
        FROM f3_events
        WHERE event_kind = 'backblast'
          AND is_deleted = false
          AND ao_display_name = ${inputs.ao_display_name}
        ORDER BY event_date DESC NULLS LAST, created_at DESC
        LIMIT 10
      ` as unknown as Promise<{ id: string; event_date: string | null; q_name: string | null; content_text: string | null }[]>)
    : Promise.resolve([] as { id: string; event_date: string | null; q_name: string | null; content_text: string | null }[]);

  const [knowledgeRows, primaryRecent] = await Promise.all([knowledgePromise, primaryRecentPromise]);

  let knowledgeContent: string | null = null;
  let knowledgeVersion: number | null = null;
  let aoIntel: AoIntel | null = null;
  if (knowledgeRows.length > 0) {
    const row = knowledgeRows[0];
    const ageMs = Date.now() - new Date(row.generated_at).getTime();
    if (ageMs < KNOWLEDGE_STALE_DAYS * 24 * 3600 * 1000) {
      knowledgeContent = row.content;
      knowledgeVersion = row.id;
      if (inputs.ao_display_name) {
        aoIntel = pickAoIntel(row.per_ao_summary, inputs.ao_display_name);
      }
    }
  }

  const recentAtAo: { event_date: string | null; q_name: string | null; content_text: string | null }[] =
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

  const recentExercises = extractRecentExercises(recentAtAo, exiconEntries, { max: 20 });

  return { knowledgeContent, knowledgeVersion, recentAtAo, aoIntel, recentExercises };
}

/** Defensive parse of the jsonb per_ao_summary column for one AO. */
function pickAoIntel(perAoSummary: unknown, aoDisplayName: string): AoIntel | null {
  if (!perAoSummary || typeof perAoSummary !== 'object') return null;
  const entry = (perAoSummary as Record<string, unknown>)[aoDisplayName];
  if (!entry || typeof entry !== 'object') return null;
  const e = entry as Record<string, unknown>;
  const strings = (v: unknown): string[] =>
    Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string') : [];

  const intel: AoIntel = {
    top_exercises: strings(e.top_exercises),
    common_formats: strings(e.common_formats),
    voice_samples: strings(e.voice_samples),
  };
  const crowdPleasers = strings(e.crowd_pleasers);
  const recentTrends = strings(e.recent_trends);
  if (crowdPleasers.length > 0) intel.crowd_pleasers = crowdPleasers;
  if (recentTrends.length > 0) intel.recent_trends = recentTrends;

  const hasContent = intel.top_exercises.length > 0 || intel.common_formats.length > 0 || intel.voice_samples.length > 0;
  return hasContent ? intel : null;
}

export function loadStaticContext(inputs: BeatdownInputs) {
  return {
    aoContext: inputs.ao_display_name ? getAoBeatdownContext(inputs.ao_display_name) : null,
    exiconSubset: filterExiconForFocus(inputs.focus),
    famousBdLibrary: loadFamousBeatdowns(),
    selectedFamousBd: findFamousBeatdown(inputs.famous_bd),
  };
}
