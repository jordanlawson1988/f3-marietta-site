'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import {
  FOCUS_OPTIONS,
  THEME_OPTIONS,
  EQUIPMENT_OPTIONS,
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
  onSubmit: (inputs: BeatdownInputs) => void;
}

export default function BeatdownForm({ aos, famousBeatdowns, disabled, onSubmit }: Props) {
  const [aoId, setAoId] = useState<string>(aos[0]?.id || '');
  const [focus, setFocus] = useState<BeatdownFocus>('full');
  const [theme, setTheme] = useState<BeatdownTheme>(null);
  const [equipment, setEquipment] = useState<BeatdownEquipment[]>(['bodyweight']);
  const [famousBd, setFamousBd] = useState<string>('');
  const [qNotes, setQNotes] = useState<string>('');

  function toggleEquip(value: BeatdownEquipment) {
    setEquipment((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!aoId) return;
    const ao = aos.find((a) => a.id === aoId);
    if (!ao) return;
    onSubmit({
      ao_id: aoId,
      ao_display_name: ao.ao_display_name,
      focus,
      theme,
      equipment: equipment.length > 0 ? equipment : ['bodyweight'],
      famous_bd: famousBd || null,
      q_notes: qNotes.trim().slice(0, 200),
    });
  }

  return (
    <form
      onSubmit={submit}
      className="space-y-6 rounded-lg border border-[var(--line)] bg-[var(--bone-2)] p-4 shadow-sm md:p-6"
    >
      <div>
        <label htmlFor="beatdown-ao" className="block text-sm font-medium mb-2">
          AO
        </label>
        <select
          id="beatdown-ao"
          required
          value={aoId}
          onChange={(e) => setAoId(e.target.value)}
          className={fieldClass}
        >
          {aos.map((ao) => (
            <option key={ao.id} value={ao.id}>
              {ao.ao_display_name}
            </option>
          ))}
        </select>
      </div>

      <ChipGroup
        label="Focus"
        value={focus}
        options={FOCUS_OPTIONS}
        onChange={(v) => setFocus(v as BeatdownFocus)}
      />

      <div>
        <label className="block text-sm font-medium mb-2">Theme / Occasion</label>
        <div className="flex flex-wrap gap-2" aria-label="Theme / Occasion">
          <Chip selected={theme === null} onClick={() => setTheme(null)} label="—" />
          {THEME_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              selected={theme === o.value}
              onClick={() => setTheme(o.value)}
              label={o.label}
            />
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium mb-2">Equipment (multi)</label>
        <div className="flex flex-wrap gap-2" aria-label="Equipment">
          {EQUIPMENT_OPTIONS.map((o) => (
            <Chip
              key={o.value}
              selected={equipment.includes(o.value)}
              onClick={() => toggleEquip(o.value)}
              label={o.label}
            />
          ))}
        </div>
      </div>

      <div>
        <label htmlFor="beatdown-famous" className="block text-sm font-medium mb-2">
          Inspired by (optional)
        </label>
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
      </div>

      <div>
        <label htmlFor="beatdown-q-notes" className="block text-sm font-medium mb-2">
          Q&apos;s Notes (optional, max 200 chars)
        </label>
        <textarea
          id="beatdown-q-notes"
          value={qNotes}
          onChange={(e) => setQNotes(e.target.value.slice(0, 200))}
          placeholder='e.g., "Honoring fallen brother today", "celebrating Hammer&apos;s 100th post"'
          maxLength={200}
          rows={2}
          className={fieldClass}
        />
        <div className="mt-1 text-xs text-[var(--muted)]">{qNotes.length}/200</div>
      </div>

      <Button
        type="submit"
        disabled={disabled || !aoId}
        className="w-full bg-[var(--ink)] text-[var(--bone)] hover:bg-[var(--steel-2)]"
      >
        {disabled ? 'Generating…' : 'Generate Beatdown'}
      </Button>
    </form>
  );
}

const fieldClass =
  'w-full rounded-md border border-[var(--line)] bg-[var(--bone)] px-3 py-2 text-base text-[var(--ink)] shadow-sm focus:border-[var(--steel)] focus:outline-none focus:ring-2 focus:ring-[rgba(47,110,137,0.25)]';

function ChipGroup<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <fieldset>
      <legend className="block text-sm font-medium mb-2">{label}</legend>
      <div className="flex flex-wrap gap-2" role="group" aria-label={label}>
        {options.map((o) => (
          <Chip
            key={o.value}
            selected={value === o.value}
            onClick={() => onChange(o.value)}
            label={o.label}
          />
        ))}
      </div>
    </fieldset>
  );
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
        'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--steel)] ' +
        (selected
          ? 'border-[var(--ink)] bg-[var(--ink)] text-[var(--bone)] shadow-sm'
          : 'border-[var(--line)] bg-[var(--bone)] text-[var(--ink)] hover:border-[var(--steel)] hover:bg-[var(--bone-3)]')
      }
    >
      {label}
    </button>
  );
}
