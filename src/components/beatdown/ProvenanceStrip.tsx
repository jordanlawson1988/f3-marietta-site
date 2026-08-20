import type { BeatdownIntel } from '@/types/beatdown';

interface Props {
  model: string;
  generationMs: number;
  intel: BeatdownIntel | null;
  knowledgeVersion: number | null;
  locksHonored: number | null;
}

/**
 * What produced this draft, stated plainly under the title. Values come from
 * the generate response, not from the client's memory of what it sent.
 */
export default function ProvenanceStrip({
  model,
  generationMs,
  intel,
  knowledgeVersion,
  locksHonored,
}: Props) {
  const facts: { label: string; value: string }[] = [
    { label: 'Model', value: model },
    { label: 'Time', value: `${(generationMs / 1000).toFixed(1)}s` },
  ];

  if (knowledgeVersion !== null) facts.push({ label: 'Knowledge', value: `v${knowledgeVersion}` });
  if (intel && intel.window > 0) {
    facts.push({ label: 'Read', value: `${intel.window} backblast${intel.window === 1 ? '' : 's'}` });
  }
  if (locksHonored !== null) facts.push({ label: 'Locks honored', value: String(locksHonored) });

  return (
    <div className="border-x-[1.5px] border-b-[1.5px] border-ink bg-bone-2 px-5 py-3 md:px-8">
      <div className="flex flex-wrap gap-x-6 gap-y-2">
        {facts.map((f) => (
          <span key={f.label} className="font-mono text-[10px] uppercase tracking-[.16em] text-muted">
            {f.label} <span className="text-ink">{f.value}</span>
          </span>
        ))}
      </div>
      {intel?.knowledge_stale && (
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[.16em] text-rust">
          Archive analysis is stale — this draft was written without it
        </p>
      )}
    </div>
  );
}
