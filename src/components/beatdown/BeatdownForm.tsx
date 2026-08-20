'use client';

import { useState } from 'react';
import {
  FOCUS_OPTIONS,
  THEME_OPTIONS,
  EQUIPMENT_OPTIONS,
  LENGTH_PRESETS,
  DEFAULT_LENGTH_MIN,
  MIN_LENGTH_MIN,
  MAX_LENGTH_MIN,
  type BeatdownInputs,
  type BeatdownEquipment,
  type BeatdownFocus,
  type BeatdownTheme,
} from '@/types/beatdown';

interface AoOption {
  id: string;
  ao_display_name: string;
}
interface FamousOption {
  slug: string;
  title: string;
  category: 'famous' | 'ipc';
  description: string;
}

interface Props {
  aos: AoOption[];
  famousBeatdowns: FamousOption[];
  disabled: boolean;
  /** AO lives in the parent so the intel rail and the brief stay in step. */
  aoId: string;
  onAoChange: (aoId: string) => void;
  /** Repeat locks currently held, shown under the generate button. */
  lockedCount: number;
  onSubmit: (inputs: Omit<BeatdownInputs, 'released_terms'>) => void;
}

const Q_NOTES_MAX_LENGTH = 1000;

export default function BeatdownForm({
  aos,
  famousBeatdowns,
  disabled,
  aoId,
  onAoChange,
  lockedCount,
  onSubmit,
}: Props) {
  const [focus, setFocus] = useState<BeatdownFocus>('full');
  const [theme, setTheme] = useState<BeatdownTheme>(null);
  const [equipment, setEquipment] = useState<BeatdownEquipment[]>(['bodyweight']);
  const [famousBd, setFamousBd] = useState<string>('');
  const [qNotes, setQNotes] = useState<string>('');
  const [lengthChoice, setLengthChoice] = useState<number | 'custom'>(DEFAULT_LENGTH_MIN);
  const [customLength, setCustomLength] = useState<string>(String(DEFAULT_LENGTH_MIN));

  function toggleEquip(value: BeatdownEquipment) {
    setEquipment((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function resolveLength(): number {
    if (lengthChoice === 'custom') {
      const n = parseInt(customLength, 10);
      if (!Number.isFinite(n)) return DEFAULT_LENGTH_MIN;
      return Math.min(MAX_LENGTH_MIN, Math.max(MIN_LENGTH_MIN, n));
    }
    return lengthChoice;
  }

  const lengthMin = resolveLength();
  const warmup = Math.max(3, Math.round(lengthMin * 0.11));
  const cot = Math.max(3, Math.round(lengthMin * 0.1));

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const ao = aoId ? aos.find((a) => a.id === aoId) : null;
    onSubmit({
      ao_id: ao ? ao.id : null,
      ao_display_name: ao ? ao.ao_display_name : null,
      focus,
      theme,
      equipment: equipment.length > 0 ? equipment : ['bodyweight'],
      famous_bd: famousBd || null,
      q_notes: qNotes.trim().slice(0, Q_NOTES_MAX_LENGTH),
      length_min: lengthMin,
    });
  }

  return (
    <form onSubmit={submit} className="border-[1.5px] border-ink bg-bone-2 p-5 md:p-8">
      <div className="flex items-baseline justify-between border-b-[1.5px] border-ink pb-3">
        <h2 className="font-display font-bold uppercase tracking-[.02em] text-[22px]">The Brief</h2>
        <span className="font-mono text-[10px] uppercase tracking-[.18em] text-muted">
          Step 01 · What you want
        </span>
      </div>

      <Field label="AO">
        <div className="flex flex-wrap gap-2" role="group" aria-label="AO">
          {aos.map((ao) => (
            <Chip
              key={ao.id}
              selected={aoId === ao.id}
              onClick={() => onAoChange(ao.id)}
              label={ao.ao_display_name}
            />
          ))}
          <Chip selected={aoId === ''} onClick={() => onAoChange('')} label="No specific AO" />
        </div>
        <Hint>
          Pick an AO to ground the beatdown in its terrain and recent history. Leave it off for a
          CSAUP or a portable build.
        </Hint>
      </Field>

      <Field label="Length">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Length">
          {LENGTH_PRESETS.map((mins) => (
            <Chip
              key={mins}
              selected={lengthChoice === mins}
              onClick={() => setLengthChoice(mins)}
              label={`${mins} min`}
            />
          ))}
          <Chip
            selected={lengthChoice === 'custom'}
            onClick={() => setLengthChoice('custom')}
            label="Custom"
          />
        </div>
        {lengthChoice === 'custom' && (
          <div className="mt-2 flex items-center gap-2">
            <input
              id="beatdown-custom-length"
              type="number"
              inputMode="numeric"
              min={MIN_LENGTH_MIN}
              max={MAX_LENGTH_MIN}
              value={customLength}
              onChange={(e) => setCustomLength(e.target.value)}
              className={`${fieldClass} w-32`}
              aria-label="Custom length in minutes"
            />
            <span className="text-sm text-muted">
              minutes ({MIN_LENGTH_MIN}–{MAX_LENGTH_MIN})
            </span>
          </div>
        )}
        <Hint>
          Budget · {warmup} min warm-up / {lengthMin - warmup - cot} min thang / {cot} min COT
        </Hint>
      </Field>

      <Field label="Focus">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Focus">
          {FOCUS_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              selected={focus === o.value}
              onClick={() => setFocus(o.value)}
              label={o.label}
            />
          ))}
        </div>
      </Field>

      <Field label="Equipment" note="multi">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Equipment">
          {EQUIPMENT_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              selected={equipment.includes(o.value)}
              onClick={() => toggleEquip(o.value)}
              label={o.label}
            />
          ))}
        </div>
      </Field>

      <Field label="Theme / Occasion">
        <div className="flex flex-wrap gap-2" role="group" aria-label="Theme / Occasion">
          <Chip selected={theme === null} onClick={() => setTheme(null)} label="None" />
          {THEME_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              selected={theme === o.value}
              onClick={() => setTheme(o.value)}
              label={o.label}
            />
          ))}
        </div>
      </Field>

      <Field label="Inspired by" htmlFor="beatdown-famous">
        <select
          id="beatdown-famous"
          value={famousBd}
          onChange={(e) => setFamousBd(e.target.value)}
          className={fieldClass}
        >
          <option value="">— pick a famous BD or leave blank —</option>
          <optgroup label="Famous F3 BDs">
            {famousBeatdowns
              .filter((b) => b.category === 'famous')
              .map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.title} — {b.description}
                </option>
              ))}
          </optgroup>
          <optgroup label="IPC (Iron Pax Challenge)">
            {famousBeatdowns
              .filter((b) => b.category === 'ipc')
              .map((b) => (
                <option key={b.slug} value={b.slug}>
                  {b.title} — {b.description}
                </option>
              ))}
          </optgroup>
        </select>
      </Field>

      <Field label="Q's Notes" htmlFor="beatdown-q-notes">
        <textarea
          id="beatdown-q-notes"
          value={qNotes}
          onChange={(e) => setQNotes(e.target.value.slice(0, Q_NOTES_MAX_LENGTH))}
          placeholder="Honoring a fallen brother · Hammer's 100th post · two FNGs expected"
          maxLength={Q_NOTES_MAX_LENGTH}
          rows={3}
          className={fieldClass}
        />
        <div className="mt-1.5 flex justify-between">
          <span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted">
            Passed to the model verbatim
          </span>
          <span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted">
            {qNotes.length}/1,000
          </span>
        </div>
      </Field>

      <button
        type="submit"
        disabled={disabled}
        className="mt-7 flex w-full items-center justify-center gap-3 clip-chamfer border-[1.5px] border-ink bg-ink px-7 py-4 font-display text-[15px] font-semibold uppercase tracking-[.1em] text-bone transition-colors hover:bg-steel hover:border-steel disabled:opacity-50"
      >
        {disabled ? 'Generating…' : 'Generate Beatdown'}
        {!disabled && <span aria-hidden="true">→</span>}
      </button>
      <p className="mt-3 text-center font-mono text-[10px] uppercase tracking-[.16em] text-muted">
        {lockedCount} repeat {lockedCount === 1 ? 'lock' : 'locks'} active · gemini-3.1-pro-preview
      </p>
    </form>
  );
}

const fieldClass =
  'w-full border-[1.5px] border-line-soft bg-bone px-3 py-2.5 text-base text-ink outline-none focus:border-steel';

function Field({
  label,
  note,
  htmlFor,
  children,
}: {
  label: string;
  note?: string;
  htmlFor?: string;
  children: React.ReactNode;
}) {
  const Heading = htmlFor ? 'label' : 'div';
  return (
    <div className="mt-6">
      <Heading
        {...(htmlFor ? { htmlFor } : {})}
        className="mb-2.5 block font-display text-[13px] font-semibold uppercase tracking-[.06em]"
      >
        {label}
        {note && (
          <span className="ml-2 font-mono text-[10px] font-normal tracking-[.16em] text-muted">
            · {note}
          </span>
        )}
      </Heading>
      {children}
    </div>
  );
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="mt-2 font-mono text-[10px] uppercase tracking-[.16em] leading-relaxed text-muted">{children}</p>;
}

function Chip({
  selected,
  onClick,
  label,
}: {
  selected: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      data-selected={selected ? 'true' : 'false'}
      onClick={onClick}
      className={
        'inline-flex min-h-[44px] items-center border-[1.5px] px-3.5 font-display text-[13px] font-semibold uppercase tracking-[.06em] transition-colors ' +
        (selected
          ? 'border-ink bg-ink text-bone'
          : 'border-line-soft bg-bone text-ink hover:border-steel')
      }
    >
      {label}
    </button>
  );
}
