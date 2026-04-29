'use client';

import { useEffect, useRef, useState } from 'react';
import type { BeatdownExerciseItem } from '@/types/beatdown';

interface Props {
  item: BeatdownExerciseItem;
  onChange: (item: BeatdownExerciseItem) => void;
  onRemove: () => void;
  onSwap: () => void;
  showCoaching: boolean;
}

export default function ExerciseRow({ item, onChange, onRemove, onSwap, showCoaching }: Props) {
  const [editing, setEditing] = useState<null | 'exercise' | 'reps'>(null);
  const exerciseRef = useRef<HTMLInputElement | null>(null);
  const repsRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editing === 'exercise') exerciseRef.current?.focus();
    if (editing === 'reps') {
      repsRef.current?.focus();
      repsRef.current?.select();
    }
  }, [editing]);

  if (editing) {
    return (
      <div
        className="flex flex-col gap-2 py-2"
        onBlur={(e) => {
          if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setEditing(null);
        }}
      >
        <input
          ref={exerciseRef}
          value={item.exercise}
          onChange={e => onChange({ ...item, exercise: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); setEditing(null); }
            if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
          }}
          className="rounded-md border border-border bg-card text-foreground px-2 py-1 text-base"
          aria-label="Exercise name"
        />
        <input
          ref={repsRef}
          value={item.reps}
          onChange={e => onChange({ ...item, reps: e.target.value })}
          onKeyDown={e => {
            if (e.key === 'Enter') { e.preventDefault(); setEditing(null); }
            if (e.key === 'Escape') { e.preventDefault(); setEditing(null); }
          }}
          placeholder="x 25 IC"
          className="rounded-md border border-border bg-card text-foreground px-2 py-1 text-sm"
          aria-label="Reps / quantity"
        />
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2 py-1.5 border-b border-border last:border-b-0">
      <div className="flex-1 flex flex-wrap items-baseline gap-x-1">
        <button
          type="button"
          onClick={() => setEditing('exercise')}
          className="text-left font-medium hover:underline underline-offset-2"
        >
          {item.exercise}
        </button>
        <button
          type="button"
          onClick={() => setEditing('reps')}
          className="text-left text-muted-foreground hover:underline underline-offset-2"
        >
          {item.reps || <span className="italic">add reps</span>}
        </button>
        {showCoaching && item.note && (
          <div className="basis-full text-xs text-muted-foreground italic mt-0.5">{item.note}</div>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity no-print">
        <button type="button" onClick={onSwap} className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/70">Swap</button>
        <button type="button" onClick={onRemove} className="text-xs px-2 py-1 rounded bg-muted hover:bg-red-500/20">Remove</button>
      </div>
    </div>
  );
}
