import type {
  BeatdownDraft,
  BeatdownEquipment,
  BeatdownExerciseItem,
  BeatdownFocus,
  BeatdownInputs,
  BeatdownSections,
} from '@/types/beatdown';

export const LOCAL_BEATDOWN_MODEL = 'local-beatdown-template';

const FOCUS_FORMATS: Record<BeatdownFocus, { title: string; summary: string; format_note: string; items: BeatdownExerciseItem[] }> = {
  full: {
    title: 'Total Body Tour',
    summary: 'Full-body bootcamp with steady movement and simple rep counts.',
    format_note: 'Four corners: rotate through each station for three rounds, then regroup for Mary.',
    items: [
      { exercise: 'Merkins', reps: 'x 20', note: 'Modify on knees as needed' },
      { exercise: 'Air Squats', reps: 'x 25', note: 'Full depth, chest up' },
      { exercise: 'Big Boy Sit-ups', reps: 'x 20', note: 'Feet anchored if needed' },
      { exercise: 'Burpees', reps: 'x 10', note: 'Keep the six moving' },
    ],
  },
  legs: {
    title: 'Leg Day Ladder',
    summary: 'Lower-body ladder with enough movement to keep the heart rate up.',
    format_note: 'Ladder 5-10-15-20, run a short lap between rounds.',
    items: [
      { exercise: 'Jump Squats', reps: 'x 5/10/15/20', note: 'Step-ups if jumping is not right today' },
      { exercise: 'Lunges', reps: 'x 10 each leg', note: 'Alternate legs' },
      { exercise: 'Calf Raises', reps: 'x 25', note: 'Pause at the top' },
      { exercise: 'Wall Sit', reps: '60 sec', note: 'Recover together' },
    ],
  },
  core: {
    title: 'Core Control',
    summary: 'Midline-focused work with short runs to reset between sets.',
    format_note: 'Three rounds with a 100-yard mosey after each round.',
    items: [
      { exercise: 'Big Boy Sit-ups', reps: 'x 25', note: '' },
      { exercise: 'Flutter Kicks', reps: 'x 30 IC', note: 'Hands under hips' },
      { exercise: 'American Hammers', reps: 'x 20 IC', note: '' },
      { exercise: 'Plank', reps: '60 sec', note: 'Rotate to side planks halfway' },
    ],
  },
  upper: {
    title: 'Push Pull Press',
    summary: 'Upper-body push work with simple pacing and built-in modifications.',
    format_note: 'Dora-style partner work: one partner works while one partner runs.',
    items: [
      { exercise: 'Merkins', reps: 'x 100 total', note: 'Partner total' },
      { exercise: 'Carolina Dry Docks', reps: 'x 150 total', note: 'Partner total' },
      { exercise: 'Shoulder Taps', reps: 'x 200 total', note: 'Partner total' },
      { exercise: 'Bear Crawl', reps: '20 yards', note: 'Each round' },
    ],
  },
  cardio: {
    title: 'Gloom Engine',
    summary: 'Cardio-forward bootcamp with bodyweight stations.',
    format_note: 'Run-stop-repeat loop: stop at each marker for the listed work.',
    items: [
      { exercise: 'Mosey', reps: '400m', note: 'Conversational pace' },
      { exercise: 'Burpees', reps: 'x 10', note: '' },
      { exercise: 'Mountain Climbers', reps: 'x 30 IC', note: '' },
      { exercise: 'Squat Jumps', reps: 'x 20', note: 'Air squats to modify' },
    ],
  },
};

const EQUIPMENT_ITEMS: Record<BeatdownEquipment, BeatdownExerciseItem> = {
  bodyweight: { exercise: 'Plank Jacks', reps: 'x 20 IC', note: 'No gear needed' },
  coupon: { exercise: 'Coupon Thrusters', reps: 'x 15', note: 'Use safe lifting form' },
  sandbag: { exercise: 'Sandbag Carry', reps: '40 yards', note: 'Switch shoulders halfway' },
  kettlebell: { exercise: 'Kettlebell Swings', reps: 'x 20', note: 'Hinge, do not squat' },
  sled: { exercise: 'Sled Push', reps: '30 yards', note: 'Rotate quickly' },
};

export function buildLocalBeatdownFallback(inputs: BeatdownInputs): BeatdownDraft {
  const focus = FOCUS_FORMATS[inputs.focus];
  const title = buildTitle(inputs, focus.title);
  const equipmentItems = inputs.equipment
    .filter((item) => item !== 'bodyweight')
    .map((item) => EQUIPMENT_ITEMS[item]);

  const sections: BeatdownSections = {
    header: {
      title,
      ao_name: inputs.ao_display_name ?? '',
      length_min: inputs.length_min,
      summary: themeSummary(inputs, focus.summary),
    },
    warmup: {
      items: [
        { exercise: 'SSH', reps: 'x 20 IC', note: 'Start together' },
        { exercise: 'Imperial Walkers', reps: 'x 15 IC', note: '' },
        { exercise: 'Willie Mays Hayes', reps: 'x 10 each side', note: '' },
        { exercise: 'Mosey', reps: '2-3 minutes', note: 'Point out boundaries and hazards' },
      ],
    },
    thang: {
      items: [...focus.items, ...equipmentItems, EQUIPMENT_ITEMS.bodyweight].slice(0, 6),
      format_note: focus.format_note,
    },
    cot: {
      talking_points: ['Count-o-rama', 'Name-o-rama', 'Announcements', 'Prayer requests', 'Ball of Man'],
      notes: inputs.q_notes || 'Keep the six together and call clear modifications for FNGs.',
    },
  };

  return { title, sections };
}

export function buildLocalSectionFallback(
  inputs: BeatdownInputs,
  section: 'warmup' | 'thang' | 'cot'
): BeatdownSections[typeof section] {
  return buildLocalBeatdownFallback(inputs).sections[section];
}

function buildTitle(inputs: BeatdownInputs, base: string): string {
  if (inputs.theme === 'q-school') return `Q School ${base}`;
  if (inputs.theme === 'fng-friendly') return `FNG Friendly ${base}`;
  if (inputs.theme === 'birthday-q') return `Birthday Q ${base}`;
  if (inputs.theme === 'ruck') return `Ruck Ready ${base}`;
  if (inputs.theme === 'honor') return `Honor Run ${base}`;
  if (inputs.theme === 'holiday') return `Holiday ${base}`;
  return base;
}

function themeSummary(inputs: BeatdownInputs, base: string): string {
  if (inputs.q_notes) return `${base} Q notes: ${inputs.q_notes}`;
  if (inputs.theme === 'fng-friendly') return `${base} FNG-friendly with clear demos and modifications.`;
  if (inputs.theme === 'q-school') return `${base} Includes Q-school reminders for cadence, safety, and the six.`;
  return base;
}
