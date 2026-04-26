'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DraftWithEvent } from '@/types/automation';
import { SectionHead } from '@/components/ui/brand/SectionHead';
import { StatusChip } from '@/components/ui/brand/StatusChip';
import { MonoTag } from '@/components/ui/brand/MonoTag';

type StatusFilter = 'all' | 'pending' | 'approved' | 'posted' | 'rejected' | 'edited';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'posted', label: 'Posted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'edited', label: 'Edited' },
];

/** Map a draft status string to the correct StatusChip variant (or null for MonoTag fallback). */
function resolveChipVariant(
  status: string
): 'active' | 'draft' | 'archived' | 'pending' | null {
  switch (status) {
    case 'approved':
    case 'posted':
      return 'active';
    case 'edited':
    case 'draft':
      return 'draft';
    case 'pending':
      return 'pending';
    case 'archived':
      return 'archived';
    default:
      // rejected, unknown → MonoTag fallback
      return null;
  }
}

function StatusCell({ status }: { status: string }) {
  const variant = resolveChipVariant(status);
  if (variant) {
    return <StatusChip variant={variant}>{status}</StatusChip>;
  }
  return <MonoTag variant="muted">{status}</MonoTag>;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '…';
}

export default function HistoryPage() {
  const [drafts, setDrafts] = useState<DraftWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const fetchDrafts = useCallback(async (status: StatusFilter) => {
    setLoading(true);
    try {
      const url =
        status === 'all'
          ? '/api/admin/drafts'
          : `/api/admin/drafts?status=${status}`;
      const res = await fetch(url, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        setDrafts(data);
      }
    } catch (err) {
      console.error('Failed to fetch drafts:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDrafts(filter);
  }, [filter, fetchDrafts]);

  return (
    <div className="p-6">
      <SectionHead eyebrow="§ Admin · Drafts" h2="Draft History" align="left" />

      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        {/* Filter select — styled to match editorial palette */}
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as StatusFilter)}
          className="bg-transparent border border-bone/25 px-3 py-1.5 text-bone text-sm font-mono tracking-wide focus:outline-none focus:border-steel"
        >
          {STATUS_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value} className="bg-ink text-bone">
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-muted">Loading drafts...</div>
        </div>
      ) : drafts.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-muted text-center">
            No drafts match this filter.
          </p>
        </div>
      ) : (
        <div className="border border-line-soft overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-line-soft text-left">
                  <th className="px-4 py-3">
                    <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">AO</span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">Date</span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">Q</span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">Status</span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">Caption</span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">Posted</span>
                  </th>
                  <th className="px-4 py-3">
                    <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">Buffer ID</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft) => (
                  <tr
                    key={draft.id}
                    className="relative group border-b border-line-soft last:border-0 hover:bg-ink/30 transition-colors"
                  >
                    {/* Left accent */}
                    <td className="px-4 py-3 font-medium text-bone relative whitespace-nowrap">
                      <span
                        aria-hidden
                        className="absolute left-0 top-0 bottom-0 w-[3px] bg-steel scale-y-0 origin-top group-hover:scale-y-100 transition-transform duration-300"
                      />
                      {draft.f3_event.ao_display_name ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {formatDate(draft.f3_event.event_date)}
                    </td>
                    <td className="px-4 py-3 text-muted whitespace-nowrap">
                      {draft.f3_event.q_name ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusCell status={draft.status} />
                    </td>
                    <td className="px-4 py-3 text-muted max-w-xs">
                      {truncate(draft.caption, 80)}
                    </td>
                    <td className="px-4 py-3 text-muted/60 whitespace-nowrap">
                      {formatTimestamp(draft.posted_at)}
                    </td>
                    <td className="px-4 py-3 text-muted/60 font-mono text-xs whitespace-nowrap">
                      {draft.buffer_post_id ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
