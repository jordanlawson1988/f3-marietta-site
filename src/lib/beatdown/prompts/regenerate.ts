import type { BeatdownDraft } from '@/types/beatdown';
import { buildUserPrompt, type UserPromptArgs } from '@/lib/beatdown/prompts/user';

export function buildRegeneratePrompt(
  args: UserPromptArgs,
  current: BeatdownDraft,
  section: 'warmup' | 'thang' | 'cot'
): string {
  const base = buildUserPrompt(args);
  const tail = `

[CURRENT DRAFT — preserve everything except ${section}]
Title: ${current.title}
Header: ${JSON.stringify(current.sections.header)}
Warm-up: ${JSON.stringify(current.sections.warmup)}
The Thang: ${JSON.stringify(current.sections.thang)}
COT: ${JSON.stringify(current.sections.cot)}

Regenerate ONLY the "${section}" section. Output JSON in this exact shape:
${section === 'cot'
      ? `{ "talking_points": ["string"], "notes": "string" }`
      : section === 'thang'
        ? `{ "items": [{ "exercise":"string","reps":"string","note":"string" }], "format_note": "string" }`
        : `{ "items": [{ "exercise":"string","reps":"string","note":"string" }] }`}

Output JSON only.`;
  return base + tail;
}
