'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Newsletter } from '@/types/automation';
import { StatusChip } from '@/components/ui/brand/StatusChip';
import { SectionHead } from '@/components/ui/brand/SectionHead';
import { ChamferButton } from '@/components/ui/brand/ChamferButton';
import { ClipFrame } from '@/components/ui/brand/ClipFrame';
import { MonoTag } from '@/components/ui/brand/MonoTag';
import NewsletterPreview from '@/components/ui/NewsletterPreview';

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

function newsletterStatusVariant(status: string): 'active' | 'draft' | 'pending' | 'archived' | null {
  if (status === 'published' || status === 'active' || status === 'posted') return 'active';
  if (status === 'draft') return 'draft';
  if (status === 'pending') return 'pending';
  if (status === 'archived') return 'archived';
  return null;
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
      <div className="p-6">
        <SectionHead eyebrow="§ Admin · Newsletter" h2="Newsletter Manager" align="left" />
        <div className="flex items-center justify-center py-20">
          <div className="text-muted">Loading newsletters...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl">
      <SectionHead eyebrow="§ Admin · Newsletter" h2="Newsletter Manager" align="left" />

      {/* Current draft editor */}
      {currentDraft ? (
        <div className="space-y-5 mb-10">
          <div className="flex flex-wrap items-center gap-3">
            <StatusChip variant="draft">{currentDraft.status}</StatusChip>
            <span className="text-sm text-muted">
              Week of {formatDate(currentDraft.week_start)} &ndash;{' '}
              {formatDate(currentDraft.week_end)}
            </span>
          </div>

          {/* Editable title */}
          <div>
            <label className="block text-xs font-mono font-medium text-muted uppercase tracking-[.1em] mb-1">
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

          {/* Mrkdwn editor + preview wrapped in ClipFrame */}
          <ClipFrame variant="bone" padding="p-7">
            <NewsletterPreview value={editBody} onChange={setEditBody} />
          </ClipFrame>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-3 pt-2">
            <ChamferButton
              variant="ghost"
              size="md"
              arrow={false}
              onClick={handleSave}
              disabled={saving || posting}
            >
              {saving ? 'Saving...' : 'Save Edits'}
            </ChamferButton>
            <ChamferButton
              variant="ink"
              size="md"
              arrow={false}
              onClick={handleApproveAndPost}
              disabled={saving || posting || !editBody.trim()}
            >
              {posting ? 'Posting...' : 'Approve & Post to Slack'}
            </ChamferButton>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
          <p className="font-display font-bold uppercase text-2xl tracking-wide text-muted text-center">
            No Draft Newsletter
          </p>
          <p className="text-sm text-muted text-center">
            One will be generated by the next cron run.
          </p>
        </div>
      )}

      {/* Past newsletters */}
      {pastNewsletters.length > 0 && (
        <div className="space-y-4">
          <h2 className="font-display font-bold uppercase tracking-wide text-lg text-foreground">
            Past Newsletters
          </h2>
          <div className="border border-border overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left bg-muted/30">
                    <th className="px-4 py-3">
                      <MonoTag>Week</MonoTag>
                    </th>
                    <th className="px-4 py-3">
                      <MonoTag>Title</MonoTag>
                    </th>
                    <th className="px-4 py-3">
                      <MonoTag>Status</MonoTag>
                    </th>
                    <th className="px-4 py-3">
                      <MonoTag>Posted</MonoTag>
                    </th>
                    <th className="px-4 py-3">
                      <MonoTag>Slack TS</MonoTag>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pastNewsletters.map((nl) => {
                    const chipVariant = newsletterStatusVariant(nl.status);
                    return (
                      <tr
                        key={nl.id}
                        className="border-b border-border last:border-b-0 transition-colors hover:bg-steel/5 border-l-2 border-l-transparent hover:border-l-steel"
                      >
                        <td className="px-4 py-3 text-muted whitespace-nowrap">
                          {formatDate(nl.week_start)} &ndash;{' '}
                          {formatDate(nl.week_end)}
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium">
                          {nl.title ?? 'Untitled'}
                        </td>
                        <td className="px-4 py-3">
                          {chipVariant ? (
                            <StatusChip variant={chipVariant}>{nl.status}</StatusChip>
                          ) : (
                            <MonoTag>{nl.status}</MonoTag>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted whitespace-nowrap">
                          {formatTimestamp(nl.posted_at)}
                        </td>
                        <td className="px-4 py-3 text-muted font-mono text-xs whitespace-nowrap">
                          {nl.slack_message_ts ?? '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {pastNewsletters.length === 0 && !currentDraft && (
        <div className="flex flex-col items-center gap-4 py-16">
          <p className="font-display font-bold uppercase text-2xl tracking-wide text-muted text-center">
            No Newsletters Yet
          </p>
        </div>
      )}
    </div>
  );
}
