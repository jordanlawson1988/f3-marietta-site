'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { ChamferButton } from '@/components/ui/brand/ChamferButton';
import { MonoTag } from '@/components/ui/brand/MonoTag';

function mondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d;
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function defaultWeek(): { start: string; end: string } {
  const today = new Date();
  const start = mondayOf(today);
  const end = new Date(start);
  end.setDate(end.getDate() + 6);
  return { start: toIsoDate(start), end: toIsoDate(end) };
}

export function NewNewsletterModal({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: (newsletterId: string) => void;
}) {
  const initial = defaultWeek();
  const [weekStart, setWeekStart] = useState(initial.start);
  const [weekEnd, setWeekEnd] = useState(initial.end);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  function handleStartChange(value: string) {
    setWeekStart(value);
    if (value && weekEnd && value > weekEnd) {
      const next = new Date(value);
      next.setDate(next.getDate() + 6);
      setWeekEnd(toIsoDate(next));
    }
  }

  async function handleCreate() {
    setError('');
    if (!weekStart || !weekEnd) {
      setError('Both dates are required');
      return;
    }
    if (weekStart > weekEnd) {
      setError('End date must be on or after start date');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/admin/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ week_start: weekStart, week_end: weekEnd }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || `Failed (${res.status})`);
      }
      onCreated(data.id as string);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create newsletter');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="new-newsletter-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink/70"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md bg-bone border border-line-soft shadow-xl p-7"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h2
            id="new-newsletter-title"
            className="font-display font-bold uppercase tracking-wide text-xl text-foreground"
          >
            New Newsletter
          </h2>
          <button
            type="button"
            aria-label="Close"
            onClick={onClose}
            className="p-1 text-foreground/60 hover:text-foreground"
          >
            <X size={18} />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label
              htmlFor="new-week-start"
              className="block text-xs font-mono font-medium text-muted uppercase tracking-[.1em] mb-1"
            >
              Week start
            </label>
            <input
              id="new-week-start"
              type="date"
              value={weekStart}
              onChange={(e) => handleStartChange(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div>
            <label
              htmlFor="new-week-end"
              className="block text-xs font-mono font-medium text-muted uppercase tracking-[.1em] mb-1"
            >
              Week end
            </label>
            <input
              id="new-week-end"
              type="date"
              value={weekEnd}
              onChange={(e) => setWeekEnd(e.target.value)}
              min={weekStart}
              className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <p className="text-xs text-muted">
            <MonoTag>Tip</MonoTag>{' '}
            <span className="ml-1">Default is the current Monday → Sunday. Change as needed.</span>
          </p>

          {error && (
            <p className="text-sm text-rust" role="alert">
              {error}
            </p>
          )}
        </div>

        <div className="flex flex-wrap justify-end gap-3 mt-6">
          <ChamferButton
            variant="steel"
            size="sm"
            arrow={false}
            onClick={onClose}
            disabled={submitting}
          >
            Cancel
          </ChamferButton>
          <ChamferButton
            variant="ink"
            size="sm"
            arrow={false}
            onClick={handleCreate}
            disabled={submitting}
          >
            {submitting ? 'Creating…' : 'Create Draft'}
          </ChamferButton>
        </div>
      </div>
    </div>
  );
}
