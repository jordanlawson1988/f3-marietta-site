'use client';

import type { BeatdownExerciseItem, BeatdownInputs, BeatdownDraft } from '@/types/beatdown';
import ExerciseRow from './ExerciseRow';
import EditableText from './EditableText';

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
  onChangeFormatNote?: (next: string) => void;
  onChangeCotTalkingPoints?: (next: string[]) => void;
  onChangeCotNotes?: (next: string) => void;
}

export default function BeatdownSection({
  label, sectionKey, draft, showCoaching,
  onChangeItems, onAddItem, onRegenerate, onSwap, regenerating,
  onChangeFormatNote, onChangeCotTalkingPoints, onChangeCotNotes,
}: Props) {
  const section = draft.sections[sectionKey];

  if (sectionKey === 'cot') {
    const cot = section as BeatdownDraft['sections']['cot'];
    return (
      <div className="rounded-md border border-border p-4 bg-card">
        <SectionHeader label={label} regenerating={regenerating} onRegenerate={onRegenerate} />
        <ul className="mt-2 space-y-1 list-disc list-inside text-base">
          {cot.talking_points.map((p, i) => (
            <li key={i} className="group flex items-start gap-2">
              <div className="flex-1">
                <EditableText
                  value={p}
                  onChange={(value) => {
                    if (!onChangeCotTalkingPoints) return;
                    const copy = [...cot.talking_points];
                    if (value.trim() === '') copy.splice(i, 1);
                    else copy[i] = value;
                    onChangeCotTalkingPoints(copy);
                  }}
                  as="span"
                  placeholder="Talking point"
                  ariaLabel={`Edit talking point ${i + 1}`}
                />
              </div>
              {onChangeCotTalkingPoints && (
                <button
                  type="button"
                  onClick={() => onChangeCotTalkingPoints(cot.talking_points.filter((_, idx) => idx !== i))}
                  className="text-xs px-2 py-1 rounded bg-muted hover:bg-red-500/20 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity no-print"
                  aria-label={`Remove talking point ${i + 1}`}
                >
                  Remove
                </button>
              )}
            </li>
          ))}
        </ul>
        {onChangeCotTalkingPoints && (
          <button
            type="button"
            onClick={() => onChangeCotTalkingPoints([...cot.talking_points, 'New talking point'])}
            className="mt-2 text-sm text-muted-foreground underline-offset-2 hover:underline no-print"
          >
            + Add talking point
          </button>
        )}
        <div className="mt-3">
          {onChangeCotNotes ? (
            <EditableText
              value={cot.notes}
              onChange={onChangeCotNotes}
              as="p"
              className="text-sm text-muted-foreground"
              placeholder="Add closing notes (optional)"
              ariaLabel="Edit COT notes"
              multiline
            />
          ) : (
            cot.notes && <p className="text-sm text-muted-foreground">{cot.notes}</p>
          )}
        </div>
      </div>
    );
  }

  const items = (section as { items: BeatdownExerciseItem[] }).items;
  const formatNote = sectionKey === 'thang' ? draft.sections.thang.format_note : '';

  return (
    <div className="rounded-md border border-border p-4 bg-card">
      <SectionHeader label={label} regenerating={regenerating} onRegenerate={onRegenerate} />
      {sectionKey === 'thang' && onChangeFormatNote ? (
        <EditableText
          value={formatNote}
          onChange={onChangeFormatNote}
          as="p"
          className="mt-1 italic text-sm text-muted-foreground"
          placeholder="Format note (optional)"
          ariaLabel="Edit format note"
          multiline
        />
      ) : (
        formatNote && <p className="mt-1 italic text-sm text-muted-foreground">{formatNote}</p>
      )}
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
