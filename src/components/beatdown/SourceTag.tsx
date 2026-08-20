import { normalizeSource, SOURCE_LABELS, SOURCE_TONES } from '@/lib/beatdown/source';

/**
 * The receipt on a generated exercise — why the builder picked it. Renders
 * nothing when the model omitted a source or sent one we don't recognise;
 * a draft is never worse for lacking a tag.
 */
export default function SourceTag({ source }: { source?: string }) {
  const kind = normalizeSource(source);
  if (!kind) return null;

  return (
    <span
      className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.18em] ${SOURCE_TONES[kind]} no-print`}
      title="Why the builder chose this"
    >
      {SOURCE_LABELS[kind]}
    </span>
  );
}
