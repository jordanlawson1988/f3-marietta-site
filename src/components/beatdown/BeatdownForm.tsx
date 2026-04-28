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
      className="space-y-6 rounded-lg border border-border bg-card p-4 md:p-6"
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
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-base text-foreground"
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
        <div className="flex flex-wrap gap-2">
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
        <div className="flex flex-wrap gap-2">
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
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-base text-foreground"
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
          className="w-full rounded-md border border-border bg-card px-3 py-2 text-base text-foreground"
        />
        <div className="text-xs text-muted-foreground mt-1">{qNotes.length}/200</div>
      </div>

      <Button type="submit" disabled={disabled || !aoId} className="w-full">
        {disabled ? 'Generating…' : 'Generate Beatdown'}
      </Button>
    </form>
  );
}

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
    <div>
      <label className="block text-sm font-medium mb-2">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip
            key={o.value}
            selected={value === o.value}
            onClick={() => onChange(o.value)}
            label={o.label}
          />
        ))}
      </div>
    </div>
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
      onClick={onClick}
      className={
        'px-3 py-1.5 rounded-full text-sm border transition-colors ' +
        (selected
          ? 'bg-primary text-primary-foreground border-primary'
          : 'bg-card border-border text-foreground hover:bg-muted')
      }
    >
      {label}
    </button>
  );
}
