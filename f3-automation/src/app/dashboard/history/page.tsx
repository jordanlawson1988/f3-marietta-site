'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DraftWithEvent } from '@/types';
import StatusBadge from '@/components/StatusBadge';

type StatusFilter = 'all' | 'pending' | 'approved' | 'posted' | 'rejected' | 'edited';

const STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'posted', label: 'Posted' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'edited', label: 'Edited' },
];

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(dateStr: string | null): string {
  if (!dateStr) return '\u2014';
  return new Date(dateStr).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max) + '\u2026';
}

export default function HistoryPage() {
  const [drafts, setDrafts] = useState<DraftWithEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<StatusFilter>('all');

  const fetchDrafts = useCallback(async (status: StatusFilter) => {
    setLoading(true);
    try {
      const url =
        status === 'all' ? '/api/drafts' : `/api/drafts?status=${status}`;
      const res = await fetch(url);
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
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-foreground">Draft History</h1>

        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as StatusFilter)}
          className="px-3 py-1.5 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary"
        >
          {STATUS_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="text-foreground/50">Loading drafts...</div>
        </div>
      ) : drafts.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <p className="text-foreground/50 text-center">
            No drafts match this filter.
          </p>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-foreground/60">
                  <th className="px-4 py-3 font-medium">AO</th>
                  <th className="px-4 py-3 font-medium">Date</th>
                  <th className="px-4 py-3 font-medium">Q</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Caption</th>
                  <th className="px-4 py-3 font-medium">Posted</th>
                  <th className="px-4 py-3 font-medium">Buffer ID</th>
                </tr>
              </thead>
              <tbody>
                {drafts.map((draft, idx) => (
                  <tr
                    key={draft.id}
                    className={`border-b border-border last:border-b-0 ${
                      idx % 2 === 1 ? 'bg-muted/40' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-foreground font-medium whitespace-nowrap">
                      {draft.f3_event.ao_display_name ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3 text-foreground/70 whitespace-nowrap">
                      {formatDate(draft.f3_event.event_date)}
                    </td>
                    <td className="px-4 py-3 text-foreground/70 whitespace-nowrap">
                      {draft.f3_event.q_name ?? 'Unknown'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={draft.status} />
                    </td>
                    <td className="px-4 py-3 text-foreground/70 max-w-xs">
                      {truncate(draft.caption, 80)}
                    </td>
                    <td className="px-4 py-3 text-foreground/50 whitespace-nowrap">
                      {formatTimestamp(draft.posted_at)}
                    </td>
                    <td className="px-4 py-3 text-foreground/50 font-mono text-xs whitespace-nowrap">
                      {draft.buffer_post_id ?? '\u2014'}
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
