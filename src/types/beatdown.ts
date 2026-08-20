// Schema for the AI Beatdown Builder. See docs/superpowers/specs/2026-04-27-ai-beatdown-builder-design.md
export type BeatdownFocus = 'full' | 'legs' | 'core' | 'upper' | 'cardio';

export type BeatdownTheme =
  | 'fng-friendly'
  | 'holiday'
  | 'q-school'
  | 'birthday-q'
  | 'ruck'
  | 'honor'
  | null;

export type BeatdownEquipment = 'bodyweight' | 'coupon' | 'sandbag' | 'kettlebell' | 'sled';

export interface BeatdownInputs {
  ao_id: string | null;
  ao_display_name: string | null;
  focus: BeatdownFocus;
  theme: BeatdownTheme;
  equipment: BeatdownEquipment[];
  famous_bd: string | null;
  q_notes: string;
  length_min: number;
  /**
   * Exicon terms the Q has deliberately unlocked from the avoid-repeat
   * ledger. Optional because the regenerate route forwards client JSON
   * verbatim — treat absence as "nothing released".
   */
  released_terms?: string[];
}

export const LENGTH_PRESETS: number[] = [30, 45, 60];
export const DEFAULT_LENGTH_MIN = 45;
export const MIN_LENGTH_MIN = 15;
export const MAX_LENGTH_MIN = 240;

export interface BeatdownExerciseItem {
  exercise: string;
  reps: string;
  note: string;
}

export interface BeatdownSections {
  header: { title: string; ao_name: string; length_min: number; summary: string };
  warmup: { items: BeatdownExerciseItem[] };
  thang: { items: BeatdownExerciseItem[]; format_note: string };
  cot: { talking_points: string[]; notes: string };
}

export interface BeatdownDraft {
  title: string;
  sections: BeatdownSections;
}

export interface BeatdownRecord extends BeatdownDraft {
  short_id: string;
  inputs: BeatdownInputs;
  generation_model: string;
  generation_ms: number;
  created_at: string;
}

/**
 * Per-AO analysis produced by the knowledge pipeline. The first three
 * fields are the original contract; the optional fields were added with
 * the Gemini 3.1 knowledge prompt and may be absent on older rows.
 */
export interface AoIntel {
  top_exercises: string[];
  common_formats: string[];
  voice_samples: string[];
  crowd_pleasers?: string[];
  recent_trends?: string[];
}

export interface MariettaBdKnowledge {
  id: number;
  generated_at: string;
  source_event_count: number;
  content: string;
  per_ao_summary: Record<string, AoIntel>;
}

export const FOCUS_OPTIONS: { value: BeatdownFocus; label: string }[] = [
  { value: 'full', label: 'Full Body' },
  { value: 'legs', label: 'Legs' },
  { value: 'core', label: 'Core' },
  { value: 'upper', label: 'Upper' },
  { value: 'cardio', label: 'Cardio' },
];

export const THEME_OPTIONS: { value: NonNullable<BeatdownTheme>; label: string }[] = [
  { value: 'fng-friendly', label: 'FNG-friendly' },
  { value: 'holiday', label: 'Holiday' },
  { value: 'q-school', label: 'Q-school' },
  { value: 'birthday-q', label: 'Birthday Q' },
  { value: 'ruck', label: 'Ruck' },
  { value: 'honor', label: 'Honor' },
];

export const EQUIPMENT_OPTIONS: { value: BeatdownEquipment; label: string }[] = [
  { value: 'bodyweight', label: 'Bodyweight' },
  { value: 'coupon', label: 'Coupon' },
  { value: 'sandbag', label: 'Sandbag' },
  { value: 'kettlebell', label: 'Kettlebell' },
  { value: 'sled', label: 'Sled' },
];

// ---------------------------------------------------------------------------
// Intel — what the builder learned from the backblast archive, shaped for the
// client. v2 read all of this and showed the Q none of it; v3 puts it on the
// page and lets him overrule it.
// ---------------------------------------------------------------------------

/**
 * How much the archive actually supports a draft for this AO.
 * - `strong` — enough events on file AND a per-AO intel block to draw on
 * - `thin`   — too few events, or no intel block, so the region doc carries it
 * - `region` — no AO selected at all; there is no terrain or local voice
 */
export type IntelConfidence = 'strong' | 'thin' | 'region';

/** One row of the repeat ledger: an Exicon term and how recently it ran. */
export interface LedgerEntry {
  term: string;
  /** Backblasts in the window that used the term (not raw mentions). */
  used: number;
  /** Backblasts actually read — the denominator for `used`. */
  window: number;
  /** ISO date (YYYY-MM-DD) of the most recent backblast using it. */
  last_used: string | null;
}

/** A backblast the ledger was built from, for the Q to audit. */
export interface IntelSource {
  event_date: string | null;
  q_name: string | null;
  title: string | null;
}

export interface BeatdownIntel {
  ao_display_name: string | null;
  confidence: IntelConfidence;
  /** Backblasts read for this request. */
  window: number;
  /** Backblasts on file for this AO across the whole archive. */
  on_file: number;
  knowledge_version: number | null;
  knowledge_generated_at: string | null;
  source_event_count: number | null;
  /**
   * True when a knowledge row exists but is past KNOWLEDGE_STALE_DAYS, so
   * generation has dropped it and is running on the raw backblast window.
   * Absent knowledge is not stale — it is absent.
   */
  knowledge_stale: boolean;
  ao_intel: AoIntel | null;
  ledger: LedgerEntry[];
  sources: IntelSource[];
}
