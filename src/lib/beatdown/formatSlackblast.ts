import type { BeatdownDraft, BeatdownInputs, BeatdownTheme } from '@/types/beatdown';
import { THEME_OPTIONS } from '@/types/beatdown';

export function formatSlackblast(draft: BeatdownDraft, inputs: BeatdownInputs): string {
  const { title, sections } = draft;
  const lines: string[] = [];

  lines.push(`*${title}*`);
  const headerParts: string[] = [];
  if (inputs.ao_display_name) headerParts.push(inputs.ao_display_name);
  headerParts.push(`${sections.header.length_min}m`);
  headerParts.push(labelEquipment(inputs.equipment));
  lines.push(headerParts.join(' · '));
  if (inputs.theme) lines.push(`Theme: ${labelTheme(inputs.theme)}`);
  lines.push('');

  lines.push('*Warm-up*');
  for (const item of sections.warmup.items) {
    lines.push(`- ${item.exercise} ${item.reps}`.trimEnd());
  }
  lines.push('');

  lines.push('*The Thang*');
  if (sections.thang.format_note) lines.push(`_${sections.thang.format_note}_`);
  for (const item of sections.thang.items) {
    lines.push(`- ${item.exercise} ${item.reps}`.trimEnd());
  }
  lines.push('');

  lines.push('*COT*');
  for (const point of sections.cot.talking_points) {
    lines.push(`- ${point}`);
  }
  if (sections.cot.notes) {
    lines.push('');
    lines.push(sections.cot.notes);
  }

  return lines.join('\n');
}

function labelEquipment(eq: string[]): string {
  if (eq.length === 0 || (eq.length === 1 && eq[0] === 'bodyweight')) return 'Bodyweight';
  return eq.map(e => e[0].toUpperCase() + e.slice(1)).join(', ');
}

function labelTheme(theme: NonNullable<BeatdownTheme>): string {
  return THEME_OPTIONS.find(o => o.value === theme)?.label ?? theme;
}
