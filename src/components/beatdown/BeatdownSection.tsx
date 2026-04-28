'use client';

import type { BeatdownExerciseItem, BeatdownInputs, BeatdownDraft } from '@/types/beatdown';
import ExerciseRow from './ExerciseRow';

interface Props {
  label: string;
  sectionKey: 'warmup' | 'thang' | 'cot';
  draft: BeatdownDraft;
  inputs: BeatdownInputs;
  showCoaching: boolean;
  onChangeItems: (items: BeatdownExerciseItem[]) => void;
  onAddItem: () => void;
  onRegenerate: () => Promise<void>;
  onSwap: (index: number) => void;
  regenerating: boolean;
}

export default function BeatdownSection({
  label, sectionKey, draft, showCoaching,
  onChangeItems, onAddItem, onRegenerate, onSwap, regenerating,
}: Props) {
  const section = draft.sections[sectionKey];

  if (sectionKey === 'cot') {
    const cot = section as BeatdownDraft['sections']['cot'];
    return (
      <div className="rounded-md border border-border p-4 bg-card">
        <SectionHeader label={label} regenerating={regenerating} onRegenerate={onRegenerate} />
        <ul className="mt-2 space-y-1 list-disc list-inside text-base">
          {cot.talking_points.map((p, i) => <li key={i}>{p}</li>)}
        </ul>
        {cot.notes && <p className="mt-3 text-sm text-muted-foreground">{cot.notes}</p>}
      </div>
    );
  }

  const items = (section as { items: BeatdownExerciseItem[] }).items;
  const formatNote = sectionKey === 'thang' ? draft.sections.thang.format_note : '';

  return (
    <div className="rounded-md border border-border p-4 bg-card">
      <SectionHeader label={label} regenerating={regenerating} onRegenerate={onRegenerate} />
      {formatNote && <p className="mt-1 italic text-sm text-muted-foreground">{formatNote}</p>}
      <div className="mt-2">
        {items.map((it, i) => (
          <ExerciseRow
            key={i}
            item={it}
            showCoaching={showCoaching}
            onChange={(next) => {
              const copy = [...items]; copy[i] = next; onChangeItems(copy);
            }}
            onRemove={() => onChangeItems(items.filter((_, idx) => idx !== i))}
            onSwap={() => onSwap(i)}
          />
        ))}
      </div>
      <button
        type="button"
        onClick={onAddItem}
        className="mt-3 text-sm text-muted-foreground underline-offset-2 hover:underline no-print"
      >
        + Add an exercise
      </button>
    </div>
  );
}

function SectionHeader({ label, regenerating, onRegenerate }: { label: string; regenerating: boolean; onRegenerate: () => void }) {
  return (
    <div className="flex items-center justify-between">
      <h3 className="text-xs uppercase tracking-widest font-semibold text-primary">{label}</h3>
      <button
        type="button"
        onClick={onRegenerate}
        disabled={regenerating}
        className="text-xs text-muted-foreground hover:text-foreground disabled:opacity-50 no-print"
      >
        {regenerating ? 'Regenerating…' : '↻ Regenerate'}
      </button>
    </div>
  );
}
