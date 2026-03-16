'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DraftWithEvent } from '@/types';
import DraftCard from '@/components/DraftCard';

export default function PendingDraftsPage() {
  const [drafts, setDrafts] = useState<DraftWithEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshDrafts = useCallback(async () => {
    try {
      const res = await fetch('/api/drafts?status=pending');
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
    refreshDrafts();
  }, [refreshDrafts]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-foreground/50">Loading drafts...</div>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="text-foreground/50 text-center">
          No pending drafts &mdash; check back after the next cron run
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Pending Drafts</h1>
      {drafts.map((draft) => (
        <DraftCard key={draft.id} draft={draft} onUpdate={refreshDrafts} />
      ))}
    </div>
  );
}
