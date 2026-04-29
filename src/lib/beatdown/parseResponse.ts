import type { BeatdownDraft, BeatdownSections } from '@/types/beatdown';

const REQUIRED_KEYS: (keyof BeatdownSections)[] = ['header', 'warmup', 'thang', 'cot'];

/**
 * Parse a Gemini response into a BeatdownDraft. Repairs minor JSON
 * formatting drift (code fences, trailing commas). Throws on irreparable
 * structural issues.
 */
export function parseResponse(raw: string): BeatdownDraft {
  const cleaned = stripCodeFences(raw).trim();
  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch {
    parsed = JSON.parse(repairTrailingCommas(cleaned));
  }

  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Beatdown response is not an object');
  }
  const obj = parsed as Record<string, unknown>;
  if (typeof obj.title !== 'string') throw new Error('Missing title');

  const sections = obj.sections as Record<string, unknown> | undefined;
  if (!sections || typeof sections !== 'object') throw new Error('Missing sections');

  for (const key of REQUIRED_KEYS) {
    if (!(key in sections)) throw new Error(`Missing section: ${key}`);
  }

  return { title: obj.title, sections: sections as unknown as BeatdownSections };
}

export function stripCodeFences(s: string): string {
  return s
    .replace(/^```(?:json)?\n?/im, '')
    .replace(/\n?```\s*$/m, '')
    .trim();
}

function repairTrailingCommas(s: string): string {
  return s.replace(/,(\s*[}\]])/g, '$1');
}
