/**
 * Why a generated exercise is in the draft — the receipt the builder shows the
 * Q. Declared once here and consumed by three places that must agree: the
 * system prompt (which offers these values to the model), the normalizer
 * (which accepts them back), and the UI tag. `tests/beatdownSource.test.ts`
 * holds that contract.
 */
export const SOURCE_KINDS = [
  'ao-signature',
  'crowd-pleaser',
  'fresh',
  'famous-bd',
  'q-notes',
  'region',
] as const;

export type SourceKind = (typeof SOURCE_KINDS)[number];

export const SOURCE_LABELS: Record<SourceKind, string> = {
  'ao-signature': 'AO signature',
  'crowd-pleaser': 'Crowd pleaser',
  fresh: 'Fresh pick',
  'famous-bd': 'Famous BD',
  'q-notes': "Q's notes",
  region: 'Region-wide',
};

/** Brand token each receipt is tinted with. Steel = drawn from this AO's
 *  history, rust = deliberately not recent, brass = the Q asked for it,
 *  olive = region-wide rather than local. */
export const SOURCE_TONES: Record<SourceKind, string> = {
  'ao-signature': 'text-steel border-steel/50',
  'crowd-pleaser': 'text-brass border-brass/50',
  fresh: 'text-rust border-rust/50',
  'famous-bd': 'text-olive border-olive/50',
  'q-notes': 'text-brass border-brass/50',
  region: 'text-olive border-olive/50',
};

const LOOKUP = new Set<string>(SOURCE_KINDS);

/**
 * Accept a source value from the model. Anything unrecognised is dropped
 * rather than rendered — a draft must never break because the model invented
 * a category, and a raw slug on screen is worse than no tag at all.
 */
export function normalizeSource(raw: unknown): SourceKind | null {
  if (typeof raw !== 'string') return null;
  const candidate = raw.trim().toLowerCase();
  return LOOKUP.has(candidate) ? (candidate as SourceKind) : null;
}
