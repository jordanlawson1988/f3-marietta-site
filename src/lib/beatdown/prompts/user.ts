import type { GlossaryEntry } from '@/../data/f3Glossary';
import type { AoIntel, BeatdownInputs } from '@/types/beatdown';
import type { AoBeatdownContext } from '@/lib/beatdown/aoContext';
import type { FamousBeatdown } from '@/lib/beatdown/loadFamousBeatdowns';
import type { RecentExerciseStat } from '@/lib/beatdown/recentExercises';

export interface UserPromptArgs {
  inputs: BeatdownInputs;
  aoContext: AoBeatdownContext | null;
  knowledgeContent: string | null;
  recentAtAo: { event_date: string | null; q_name: string | null; content_text: string | null }[];
  exiconSubset: GlossaryEntry[];
  famousBdLibrary: FamousBeatdown[];
  selectedFamousBd: FamousBeatdown | null;
  /** Per-AO analysis from the knowledge pipeline (marietta_bd_knowledge.per_ao_summary). */
  aoIntel: AoIntel | null;
  /** Deterministic exicon-term frequency over the recent backblasts. */
  recentExercises: RecentExerciseStat[];
}

export function buildUserPrompt(args: UserPromptArgs): string {
  const lines: string[] = [];

  if (args.knowledgeContent) {
    lines.push('[PINNED — F3 Marietta Knowledge]');
    lines.push(args.knowledgeContent);
    lines.push('');
  }

  if (args.aoIntel && args.inputs.ao_display_name) {
    lines.push(`[PINNED — AO Intel: ${args.inputs.ao_display_name} (AI analysis of the backblast archive)]`);
    pushList(lines, 'Top exercises historically', args.aoIntel.top_exercises);
    pushList(lines, 'Common formats', args.aoIntel.common_formats);
    pushList(lines, 'Crowd pleasers', args.aoIntel.crowd_pleasers ?? []);
    pushList(lines, 'Recent trends', args.aoIntel.recent_trends ?? []);
    if (args.aoIntel.voice_samples.length > 0) {
      lines.push('Voice samples (match this tone):');
      for (const v of args.aoIntel.voice_samples) lines.push(`- "${v}"`);
    }
    lines.push('');
  }

  if (args.aoContext && args.inputs.ao_display_name) {
    lines.push(`[PINNED — AO Context: ${args.inputs.ao_display_name}]`);
    pushList(lines, 'Terrain', args.aoContext.terrain);
    pushList(lines, 'Landmarks', args.aoContext.landmarks);
    pushList(lines, 'Typical stations', args.aoContext.typical_stations);
    pushList(lines, 'Available equipment', args.aoContext.available_equipment);
    pushList(lines, 'Unavailable equipment', args.aoContext.unavailable_equipment);
    pushList(lines, 'Typical formats', args.aoContext.typical_formats);
    pushList(lines, 'Constraints', args.aoContext.constraints);
    pushList(lines, 'Notes', args.aoContext.notes);
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

  if (args.recentAtAo.length > 0 && args.inputs.ao_display_name) {
    lines.push(`[DYNAMIC — Last ${args.recentAtAo.length} backblasts at ${args.inputs.ao_display_name}]`);
    for (const r of args.recentAtAo) {
      const date = r.event_date || 'unknown date';
      const q = r.q_name || 'unknown Q';
      const excerpt = (r.content_text || '').slice(0, 400);
      lines.push(`(${date}, Q: ${q}) ${excerpt}`);
    }
    lines.push('');
  }

  // The Q can release terms from the ledger in the builder's intel rail. A
  // released term must not just vanish from the avoid list — the model has to
  // be told the omission was deliberate, or it infers the term is simply
  // unremarkable and skips it anyway.
  const releasedSet = new Set(
    (args.inputs.released_terms ?? []).map((t) => t.trim().toLowerCase()).filter(Boolean),
  );
  const keptExercises = args.recentExercises.filter((s) => !releasedSet.has(s.term.toLowerCase()));
  const releasedExercises = args.recentExercises.filter((s) => releasedSet.has(s.term.toLowerCase()));

  if (keptExercises.length > 0) {
    const scopeLabel = args.inputs.ao_display_name
      ? `Recently used at ${args.inputs.ao_display_name}`
      : 'Recently used across F3 Marietta';
    const n = args.recentAtAo.length || 'several';
    lines.push(`[DYNAMIC — ${scopeLabel} (last ${n} backblasts) — AVOID over-repeating these]`);
    for (const s of keptExercises) {
      lines.push(`- ${s.term} (${s.count} of the last ${n}${s.lastUsed ? `, last on ${s.lastUsed}` : ''})`);
    }
    lines.push('Rotate in different movements and formats. Warmup staples (SSH, mosey, stretches) are exempt.');
    lines.push('');
  }

  if (releasedExercises.length > 0) {
    lines.push('[DYNAMIC — Repeat locks released by the Q]');
    lines.push(
      `Q has explicitly allowed: ${releasedExercises.map((s) => s.term).join(', ')}. ` +
        'These ran recently, but the Q wants them today — use them freely and do not treat them as over-repeated.',
    );
    lines.push('');
  }

  if (args.selectedFamousBd) {
    lines.push(`[SELECTED FAMOUS BD — ${args.selectedFamousBd.title}]`);
    lines.push(args.selectedFamousBd.body);
    lines.push('');
  }

  lines.push('[Q INPUTS]');
  lines.push(`AO: ${args.inputs.ao_display_name || '— (no specific AO; build a generic / portable beatdown)'}`);
  lines.push(`Length: ${args.inputs.length_min} minutes (set sections.header.length_min to ${args.inputs.length_min}; pace exercise volume to fit this duration)`);
  lines.push(`Focus: ${args.inputs.focus}`);
  lines.push(`Theme: ${args.inputs.theme || '—'}`);
  lines.push(`Equipment: ${args.inputs.equipment.join(', ')}`);
  lines.push(`Inspired by: ${args.selectedFamousBd?.title || '—'}`);
  lines.push(`Q's notes: ${args.inputs.q_notes || '—'}`);
  lines.push('');
  lines.push('Generate a beatdown that fits these inputs. Output JSON only.');

  return lines.join('\n');
}

function pushList(lines: string[], label: string, values: string[]) {
  if (values.length === 0) return;
  lines.push(`${label}: ${values.join('; ')}`);
}
