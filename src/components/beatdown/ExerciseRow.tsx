'use client';

import { useState } from 'react';
import type { BeatdownExerciseItem } from '@/types/beatdown';

interface Props {
  item: BeatdownExerciseItem;
  onChange: (item: BeatdownExerciseItem) => void;
  onRemove: () => void;
  onSwap: () => void;
  showCoaching: boolean;
}

export default function ExerciseRow({ item, onChange, onRemove, onSwap, showCoaching }: Props) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <div className="flex flex-col gap-2 py-2">
        <input
          autoFocus
          value={item.exercise}
          onChange={e => onChange({ ...item, exercise: e.target.value })}
          onBlur={() => setEditing(false)}
          onKeyDown={e => { if (e.key === 'Enter') setEditing(false); }}
          className="rounded-md border border-border bg-card text-foreground px-2 py-1 text-base"
        />
        <input
          value={item.reps}
          onChange={e => onChange({ ...item, reps: e.target.value })}
          placeholder="x 25 IC"
          className="rounded-md border border-border bg-card text-foreground px-2 py-1 text-sm"
        />
      </div>
    );
  }

  return (
    <div className="group flex items-start gap-2 py-1.5 border-b border-border last:border-b-0">
      <div className="flex-1">
        <button onClick={() => setEditing(true)} className="text-left w-full">
          <span className="font-medium">{item.exercise}</span>
          <span className="text-muted-foreground"> {item.reps}</span>
        </button>
        {showCoaching && item.note && (
          <div className="text-xs text-muted-foreground italic mt-0.5">{item.note}</div>
        )}
      </div>
      <div className="flex gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity no-print">
        <button type="button" onClick={onSwap} className="text-xs px-2 py-1 rounded bg-muted hover:bg-muted/70">Swap</button>
        <button type="button" onClick={onRemove} className="text-xs px-2 py-1 rounded bg-muted hover:bg-red-500/20">Remove</button>
      </div>
    </div>
  );
}
