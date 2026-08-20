import type {
  AoIntel,
  BeatdownIntel,
  IntelConfidence,
  IntelSource,
  LedgerEntry,
} from '@/types/beatdown';
import type { RecentExerciseStat } from '@/lib/beatdown/recentExercises';

/**
 * Below this many backblasts on file, an AO has too little history to carry a
 * draft on its own. Mirrors the fallback arithmetic in `buildContext.ts`, where
 * fewer than five AO rows triggers the region-wide backfill.
 */
export const THIN_HISTORY_THRESHOLD = 5;

export interface ShapeIntelArgs {
  aoDisplayName: string | null;
  /** Backblasts on file for this AO across the whole archive. */
  onFile: number;
  knowledge: { id: number; generated_at: string; source_event_count: number } | null;
  aoIntel: AoIntel | null;
  recentExercises: RecentExerciseStat[];
  recent: IntelSource[];
}

/**
 * Turn the pieces `buildBeatdownContext` already gathers into the payload the
 * builder's intel rail renders. Pure — every input is passed in so this can be
 * unit-tested without a database.
 */
export function shapeIntel(args: ShapeIntelArgs): BeatdownIntel {
  const window = args.recent.length;

  const ledger: LedgerEntry[] = args.recentExercises.map((stat) => ({
    term: stat.term,
    used: stat.count,
    window,
    last_used: stat.lastUsed,
  }));

  return {
    ao_display_name: args.aoDisplayName,
    confidence: resolveConfidence(args),
    window,
    on_file: args.onFile,
    knowledge_version: args.knowledge?.id ?? null,
    knowledge_generated_at: args.knowledge?.generated_at ?? null,
    source_event_count: args.knowledge?.source_event_count ?? null,
    ao_intel: args.aoIntel,
    ledger,
    sources: args.recent,
  };
}

function resolveConfidence(args: ShapeIntelArgs): IntelConfidence {
  if (!args.aoDisplayName) return 'region';
  if (args.onFile < THIN_HISTORY_THRESHOLD) return 'thin';
  // An AO can clear the event threshold and still have no per_ao_summary entry
  // — pickAoIntel() returns null when the knowledge build found too little to
  // summarize. Without that block the draft leans on the region-wide document.
  if (!args.aoIntel) return 'thin';
  return 'strong';
}
