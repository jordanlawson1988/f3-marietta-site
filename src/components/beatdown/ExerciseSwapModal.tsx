'use client';

import { useEffect, useRef, useState } from 'react';
import type { BeatdownExerciseItem, BeatdownFocus } from '@/types/beatdown';

interface Props {
  focus: BeatdownFocus;
  currentTerm: string;
  onApply: (item: BeatdownExerciseItem) => void;
  onClose: () => void;
}

interface SearchResult { slug: string; term: string; shortDescription: string }

export default function ExerciseSwapModal({ focus, currentTerm, onApply, onClose }: Props) {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<SearchResult[]>([]);
  const [reps, setReps] = useState<string>('x 20');
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/beatdown/exicon-search?focus=${focus}&q=${encodeURIComponent(q)}`)
      .then(r => r.json())
      .then(d => { if (!cancelled) setResults(d.results || []); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [q, focus]);

  useEffect(() => {
    function onEsc(e: KeyboardEvent) { if (e.key === 'Escape') onClose(); }
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [onClose]);

  return (
    <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-end md:items-center justify-center bg-black/40 p-2">
      <div ref={dialogRef} className="w-full max-w-md rounded-lg bg-card border border-border p-4 max-h-[90vh] overflow-hidden flex flex-col">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">Swap exercise (replacing &ldquo;{currentTerm}&rdquo;)</h3>
          <button type="button" onClick={onClose} aria-label="Close" className="text-muted-foreground hover:text-foreground">×</button>
        </div>
        <input
          autoFocus
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search the Exicon…"
          className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-base mb-3"
        />
        <input
          value={reps}
          onChange={e => setReps(e.target.value)}
          placeholder="Reps (e.g., x 25 IC)"
          className="w-full rounded-md border border-border bg-card text-foreground px-3 py-2 text-sm mb-3"
        />
        <div className="flex-1 overflow-y-auto -mx-2">
          {results.map(r => (
            <button
              key={r.slug}
              type="button"
              onClick={() => onApply({ exercise: r.term, reps, note: '' })}
              className="w-full text-left px-2 py-2 rounded hover:bg-muted"
            >
              <div className="font-medium">{r.term}</div>
              <div className="text-xs text-muted-foreground line-clamp-2">{r.shortDescription}</div>
            </button>
          ))}
          {results.length === 0 && <div className="text-sm text-muted-foreground px-2 py-4">No matches.</div>}
        </div>
      </div>
    </div>
  );
}
