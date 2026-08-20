import { getSql } from '@/lib/db';
import { exiconEntries } from '@/../data/f3Glossary';
import { filterExiconForFocus } from '@/lib/beatdown/exicon';
import { extractRecentExercises, type RecentExerciseStat } from '@/lib/beatdown/recentExercises';
import { loadFamousBeatdowns, findFamousBeatdown } from '@/lib/beatdown/loadFamousBeatdowns';
import { getAoBeatdownContext } from '@/lib/beatdown/aoContext';
import type { AoIntel, BeatdownInputs } from '@/types/beatdown';

export interface KnowledgeRow {
  id: number;
  generated_at: string;
  source_event_count: number;
}

export interface RecentBackblast {
  event_date: string | null;
  q_name: string | null;
  title: string | null;
  content_text: string | null;
}

export interface BeatdownContext {
  knowledgeContent: string | null;
  knowledgeVersion: number | null;
  /**
   * The latest knowledge row regardless of freshness. Generation ignores it
   * once stale, but the builder still reports it so a Q can see that the
   * archive analysis has gone blind rather than silently losing it.
   */
  knowledge: KnowledgeRow | null;
  /** True when `knowledge` exists but is past the staleness window. */
  knowledgeStale: boolean;
  recentAtAo: RecentBackblast[];
  /** Backblasts on file for this AO (or region-wide when none is selected). */
  onFile: number;
  /** Per-AO analysis from the latest knowledge row, when an AO is selected. */
  aoIntel: AoIntel | null;
  /** Exicon-term frequency across recentAtAo — the avoid-repeat signal. */
  recentExercises: RecentExerciseStat[];
}

// Knowledge is rebuilt by the daily reconcile cron whenever new backblasts
// land. Two weeks of staleness tolerance keeps generation from going
// knowledge-blind if a few cron runs fail in a row.
const KNOWLEDGE_STALE_DAYS = 14;

/** Only the AO matters for context assembly — the intel route passes a stub. */
export type ContextInputs = Pick<BeatdownInputs, 'ao_display_name'>;

export async function buildBeatdownContext(inputs: ContextInputs): Promise<BeatdownContext> {
  const sql = getSql();

  const knowledgePromise = sql`
    SELECT id, content, per_ao_summary, generated_at, source_event_count
    FROM marietta_bd_knowledge
    ORDER BY generated_at DESC
    LIMIT 1
  ` as unknown as Promise<
    { id: number; content: string; per_ao_summary: unknown; generated_at: string; source_event_count: number }[]
  >;

  const primaryRecentPromise = inputs.ao_display_name
    ? (sql`
        SELECT id, event_date, q_name, title, content_text
        FROM f3_events
        WHERE event_kind = 'backblast'
          AND is_deleted = false
          AND ao_display_name = ${inputs.ao_display_name}
        ORDER BY event_date DESC NULLS LAST, created_at DESC
        LIMIT 10
      ` as unknown as Promise<
        { id: string; event_date: string | null; q_name: string | null; title: string | null; content_text: string | null }[]
      >)
    : Promise.resolve(
        [] as { id: string; event_date: string | null; q_name: string | null; title: string | null; content_text: string | null }[],
      );

  // Archive depth for the selected AO. Bundled into the same Promise.all so
  // the whole context still costs one Neon wake — compute hygiene matters
  // more here than statement count.
  const onFilePromise = inputs.ao_display_name
    ? (sql`
        SELECT count(*)::int AS n
        FROM f3_events
        WHERE event_kind = 'backblast'
          AND is_deleted = false
          AND ao_display_name = ${inputs.ao_display_name}
      ` as unknown as Promise<{ n: number }[]>)
    : (sql`
        SELECT count(*)::int AS n
        FROM f3_events
        WHERE event_kind = 'backblast'
          AND is_deleted = false
      ` as unknown as Promise<{ n: number }[]>);

  const [knowledgeRows, primaryRecent, onFileRows] = await Promise.all([
    knowledgePromise,
    primaryRecentPromise,
    onFilePromise,
  ]);

  let knowledgeContent: string | null = null;
  let knowledgeVersion: number | null = null;
  let knowledge: KnowledgeRow | null = null;
  let knowledgeStale = false;
  let aoIntel: AoIntel | null = null;

  if (knowledgeRows.length > 0) {
    const row = knowledgeRows[0];
    knowledge = {
      id: row.id,
      generated_at: row.generated_at,
      source_event_count: row.source_event_count,
    };
    const ageMs = Date.now() - new Date(row.generated_at).getTime();
    if (ageMs < KNOWLEDGE_STALE_DAYS * 24 * 3600 * 1000) {
      knowledgeContent = row.content;
      knowledgeVersion = row.id;
      if (inputs.ao_display_name) {
        aoIntel = pickAoIntel(row.per_ao_summary, inputs.ao_display_name);
      }
    } else {
      knowledgeStale = true;
    }
  }

  const recentAtAo: RecentBackblast[] = primaryRecent.map((r) => ({
    event_date: r.event_date,
    q_name: r.q_name,
    title: r.title,
    content_text: r.content_text,
  }));

  // If no knowledge AND fewer than 5 AO-specific rows, backfill region-wide while skipping any IDs we already have.
  if (!knowledgeContent && primaryRecent.length < 5) {
    const seenIds = new Set(primaryRecent.map((r) => r.id));
    const fallback = (await sql`
      SELECT id, event_date, q_name, title, content_text
      FROM f3_events
      WHERE event_kind = 'backblast'
        AND is_deleted = false
      ORDER BY event_date DESC NULLS LAST, created_at DESC
      LIMIT 20
    `) as unknown as {
      id: string;
      event_date: string | null;
      q_name: string | null;
      title: string | null;
      content_text: string | null;
    }[];
    for (const row of fallback) {
      if (seenIds.has(row.id)) continue;
      recentAtAo.push({
        event_date: row.event_date,
        q_name: row.q_name,
        title: row.title,
        content_text: row.content_text,
      });
    }
  }

  const recentExercises = extractRecentExercises(recentAtAo, exiconEntries, { max: 20 });

  return {
    knowledgeContent,
    knowledgeVersion,
    knowledge,
    knowledgeStale,
    recentAtAo,
    onFile: onFileRows[0]?.n ?? 0,
    aoIntel,
    recentExercises,
  };
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

  const hasContent =
    intel.top_exercises.length > 0 || intel.common_formats.length > 0 || intel.voice_samples.length > 0;
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
