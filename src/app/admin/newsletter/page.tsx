'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Newsletter } from '@/types/automation';
import { StatusChip } from '@/components/ui/brand/StatusChip';
import NewsletterPreview from '@/components/ui/NewsletterPreview';

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

export default function NewsletterPage() {
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);

  // Editable draft state
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);

  const fetchNewsletters = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/newsletter', {
        credentials: 'include',
      });
      if (res.ok) {
        const data: Newsletter[] = await res.json();
        setNewsletters(data);

        // Initialize editor with the most recent draft
        const draft = data.find((n) => n.status === 'draft');
        if (draft) {
          setEditTitle(draft.title ?? '');
          setEditBody(draft.body_slack_mrkdwn ?? '');
        }
      }
    } catch (err) {
      console.error('Failed to fetch newsletters:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNewsletters();
  }, [fetchNewsletters]);

  const currentDraft = newsletters.find((n) => n.status === 'draft') ?? null;
  const pastNewsletters = newsletters.filter((n) => n.status !== 'draft');

  async function handleSave() {
    if (!currentDraft) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/newsletter/${currentDraft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle,
          body_slack_mrkdwn: editBody,
        }),
      });
      if (res.ok) {
        await fetchNewsletters();
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveAndPost() {
    if (!currentDraft) return;

    // Save any pending edits first
    await handleSave();

    setPosting(true);
    try {
      const res = await fetch(`/api/admin/newsletter/${currentDraft.id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await fetchNewsletters();
      } else {
        const err = await res.json();
        console.error('Post failed:', err.error);
      }
    } catch (err) {
      console.error('Post failed:', err);
    } finally {
      setPosting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="text-foreground/50">Loading newsletters...</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-8">
      <h1 className="text-2xl font-bold text-foreground">Newsletter</h1>

      {/* Current draft editor */}
      {currentDraft ? (
        <div className="bg-card border border-border rounded-lg p-6 space-y-5">
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip variant="active">{currentDraft.status}</StatusChip>
            <span className="text-sm text-foreground/50">
              Week of {formatDate(currentDraft.week_start)} &ndash;{' '}
              {formatDate(currentDraft.week_end)}
            </span>
          </div>

          {/* Editable title */}
          <div>
            <label className="block text-xs font-medium text-foreground/60 mb-1">
              Title
            </label>
            <input
              type="text"
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Newsletter title"
            />
          </div>

          {/* Mrkdwn editor + preview */}
          <NewsletterPreview value={editBody} onChange={setEditBody} />

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            <button
              onClick={handleSave}
              disabled={saving || posting}
              className="px-4 py-2 bg-secondary text-foreground text-sm font-medium rounded-md hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Edits'}
            </button>
            <button
              onClick={handleApproveAndPost}
              disabled={saving || posting || !editBody.trim()}
              className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {posting ? 'Posting...' : 'Approve & Post to Slack'}
            </button>
          </div>
        </div>
      ) : (
        <div className="bg-card border border-border rounded-lg p-6">
          <p className="text-foreground/50 text-center">
            No draft newsletter &mdash; one will be generated by the next cron
            run.
          </p>
        </div>
      )}

      {/* Past newsletters */}
      {pastNewsletters.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-foreground">
            Past Newsletters
          </h2>
          <div className="bg-card border border-border rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-foreground/60">
                    <th className="px-4 py-3 font-medium">Week</th>
                    <th className="px-4 py-3 font-medium">Title</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium">Posted</th>
                    <th className="px-4 py-3 font-medium">Slack TS</th>
                  </tr>
                </thead>
                <tbody>
                  {pastNewsletters.map((nl, idx) => (
                    <tr
                      key={nl.id}
                      className={`border-b border-border last:border-b-0 ${
                        idx % 2 === 1 ? 'bg-muted/40' : ''
                      }`}
                    >
                      <td className="px-4 py-3 text-foreground/70 whitespace-nowrap">
                        {formatDate(nl.week_start)} &ndash;{' '}
                        {formatDate(nl.week_end)}
                      </td>
                      <td className="px-4 py-3 text-foreground font-medium">
                        {nl.title ?? 'Untitled'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusChip variant="active">{nl.status}</StatusChip>
                      </td>
                      <td className="px-4 py-3 text-foreground/50 whitespace-nowrap">
                        {formatTimestamp(nl.posted_at)}
                      </td>
                      <td className="px-4 py-3 text-foreground/50 font-mono text-xs whitespace-nowrap">
                        {nl.slack_message_ts ?? '\u2014'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {pastNewsletters.length === 0 && !currentDraft && (
        <p className="text-foreground/50 text-center py-8">
          No newsletters yet.
        </p>
      )}
    </div>
  );
}
