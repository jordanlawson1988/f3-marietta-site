import type { GlossaryEntry } from '@/../data/f3Glossary';
import type { BeatdownInputs } from '@/types/beatdown';
import type { FamousBeatdown } from '@/lib/beatdown/loadFamousBeatdowns';

export interface UserPromptArgs {
  inputs: BeatdownInputs;
  knowledgeContent: string | null;
  recentAtAo: { event_date: string | null; q_name: string | null; content_text: string | null }[];
  exiconSubset: GlossaryEntry[];
  famousBdLibrary: FamousBeatdown[];
  selectedFamousBd: FamousBeatdown | null;
}

export function buildUserPrompt(args: UserPromptArgs): string {
  const lines: string[] = [];

  if (args.knowledgeContent) {
    lines.push('[PINNED — F3 Marietta Knowledge]');
    lines.push(args.knowledgeContent);
    lines.push('');
  }

  lines.push('[PINNED — Famous F3 Beatdowns Library]');
  for (const bd of args.famousBdLibrary) {
    lines.push(`- ${bd.title} (${bd.category}, ${bd.length_min}m, ${bd.focus}): ${bd.description}`);
  }
  lines.push('');

  lines.push('[PINNED — Local Exicon entries]');
  for (const e of args.exiconSubset) {
    lines.push(`- ${e.term}: ${(e.shortDescription || '').slice(0, 120)}`);
  }
  lines.push('');

  if (args.recentAtAo.length > 0) {
    lines.push(`[DYNAMIC — Last ${args.recentAtAo.length} backblasts at ${args.inputs.ao_display_name}]`);
    for (const r of args.recentAtAo) {
      const date = r.event_date || 'unknown date';
      const q = r.q_name || 'unknown Q';
      const excerpt = (r.content_text || '').slice(0, 400);
      lines.push(`(${date}, Q: ${q}) ${excerpt}`);
    }
    lines.push('');
  }

  if (args.selectedFamousBd) {
    lines.push(`[SELECTED FAMOUS BD — ${args.selectedFamousBd.title}]`);
    lines.push(args.selectedFamousBd.body);
    lines.push('');
  }

  lines.push('[Q INPUTS]');
  lines.push(`AO: ${args.inputs.ao_display_name}`);
  lines.push(`Focus: ${args.inputs.focus}`);
  lines.push(`Theme: ${args.inputs.theme || '—'}`);
  lines.push(`Equipment: ${args.inputs.equipment.join(', ')}`);
  lines.push(`Inspired by: ${args.selectedFamousBd?.title || '—'}`);
  lines.push(`Q's notes: ${args.inputs.q_notes || '—'}`);
  lines.push('');
  lines.push('Generate a beatdown that fits these inputs. Output JSON only.');

  return lines.join('\n');
}
