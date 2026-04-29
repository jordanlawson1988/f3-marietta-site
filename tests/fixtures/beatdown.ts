import type { BeatdownDraft, BeatdownInputs } from '@/types/beatdown';

export const fixtureInputs: BeatdownInputs = {
  ao_id: '00000000-0000-0000-0000-000000000000',
  ao_display_name: 'The Battlefield',
  focus: 'full',
  theme: null,
  equipment: ['bodyweight'],
  famous_bd: null,
  q_notes: '',
  length_min: 45,
};

export const fixtureDraft: BeatdownDraft = {
  title: 'Crawl, Walk, Run',
  sections: {
    header: { title: 'Crawl, Walk, Run', ao_name: 'The Battlefield', length_min: 45, summary: 'Hill work + Mary' },
    warmup: { items: [
      { exercise: 'SSH', reps: 'x 25 IC', note: '' },
      { exercise: 'Imperial Walkers', reps: 'x 20 IC', note: '' },
      { exercise: 'Mosey', reps: 'to flag pole', note: '' },
    ]},
    thang: { items: [
      { exercise: 'Merkins', reps: 'x 10', note: '' },
      { exercise: 'Squats', reps: 'x 10', note: '' },
    ], format_note: '11s on the back hill' },
    cot: { talking_points: ['Count-o-rama', 'Name-o-rama', 'BOM'], notes: '' },
  },
};
