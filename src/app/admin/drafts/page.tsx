'use client';

import { useCallback, useEffect, useState } from 'react';
import type { DraftWithEvent } from '@/types/automation';
import DraftCard from '@/components/ui/DraftCard';
import { SectionHead } from '@/components/ui/brand/SectionHead';

export default function PendingDraftsPage() {
  const [drafts, setDrafts] = useState<DraftWithEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refreshDrafts = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/drafts?status=pending,edited', {
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
    refreshDrafts();
  }, [refreshDrafts]);

  if (loading) {
    return (
      <div className="p-6">
        <SectionHead eyebrow="§ Admin · Drafts" h2="Draft Manager" align="left" />
        <div className="flex items-center justify-center py-20">
          <div className="text-muted">Loading drafts...</div>
        </div>
      </div>
    );
  }

  if (drafts.length === 0) {
    return (
      <div className="p-6">
        <SectionHead eyebrow="§ Admin · Drafts" h2="Draft Manager" align="left" />
        <div className="flex items-center justify-center py-20">
          <p className="text-muted text-center">
            No pending drafts &mdash; check back after the next cron run
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <SectionHead eyebrow="§ Admin · Drafts" h2="Draft Manager" align="left" />
      <div className="max-w-3xl mx-auto space-y-6">
        {drafts.map((draft) => (
          <DraftCard key={draft.id} draft={draft} onUpdate={refreshDrafts} />
        ))}
      </div>
    </div>
  );
}
