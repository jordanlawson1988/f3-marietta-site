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
  ao_id: string;
  ao_display_name: string;
  focus: BeatdownFocus;
  theme: BeatdownTheme;
  equipment: BeatdownEquipment[];
  famous_bd: string | null;
  q_notes: string;
}

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

export interface MariettaBdKnowledge {
  id: number;
  generated_at: string;
  source_event_count: number;
  content: string;
  per_ao_summary: Record<string, {
    top_exercises: string[];
    common_formats: string[];
    voice_samples: string[];
  }>;
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
