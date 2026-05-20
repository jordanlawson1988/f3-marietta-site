'use client';

import { useCallback, useEffect, useState, use } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Newsletter } from '@/types/automation';
import { StatusChip } from '@/components/ui/brand/StatusChip';
import { SectionHead } from '@/components/ui/brand/SectionHead';
import { ChamferButton } from '@/components/ui/brand/ChamferButton';
import { ClipFrame } from '@/components/ui/brand/ClipFrame';
import { MonoTag } from '@/components/ui/brand/MonoTag';
import NewsletterPreview from '@/components/ui/NewsletterPreview';

function toDateInputValue(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  // Use UTC components — DB `date` type was loaded as a UTC-midnight Date.
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatDateRange(start: string | null | undefined, end: string | null | undefined): string {
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric', year: 'numeric' };
  const fmt = (v: string | null | undefined) => {
    if (!v) return '—';
    const d = new Date(v);
    if (Number.isNaN(d.getTime())) return '—';
    return d.toLocaleDateString('en-US', opts);
  };
  return `${fmt(start)} – ${fmt(end)}`;
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusChipVariant(
  status: string
): 'active' | 'draft' | 'pending' | 'archived' | null {
  if (status === 'posted') return 'active';
  if (status === 'draft') return 'draft';
  if (status === 'approved') return 'pending';
  return null;
}

export default function NewsletterDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [newsletter, setNewsletter] = useState<Newsletter | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Editable state
  const [editTitle, setEditTitle] = useState('');
  const [editBody, setEditBody] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editWeekStart, setEditWeekStart] = useState('');
  const [editWeekEnd, setEditWeekEnd] = useState('');
  const [savedBody, setSavedBody] = useState('');

  const [saving, setSaving] = useState(false);
  const [posting, setPosting] = useState(false);
  const [regenerating, setRegenerating] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [regenerateError, setRegenerateError] = useState<string | null>(null);
  const [postError, setPostError] = useState<string | null>(null);
  const [dateError, setDateError] = useState<string | null>(null);

  const fetchNewsletter = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/newsletter/${id}`, { credentials: 'include' });
      if (res.status === 404) {
        setLoadError('Newsletter not found');
        return;
      }
      if (!res.ok) {
        setLoadError(`Load failed (${res.status})`);
        return;
      }
      const data: Newsletter = await res.json();
      setNewsletter(data);
      setEditTitle(data.title ?? '');
      setEditBody(data.body_slack_mrkdwn ?? '');
      setSavedBody(data.body_slack_mrkdwn ?? '');
      setEditNotes(data.notes ?? '');
      setEditWeekStart(toDateInputValue(data.week_start));
      setEditWeekEnd(toDateInputValue(data.week_end));
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchNewsletter();
  }, [fetchNewsletter]);

  const isPosted = newsletter?.status === 'posted';
  const readOnly = isPosted;

  function validateDates(): string | null {
    if (!editWeekStart || !editWeekEnd) return 'Both dates are required';
    if (editWeekStart > editWeekEnd) return 'End date must be on or after start date';
    return null;
  }

  async function handleSave() {
    if (!newsletter || readOnly) return;
    const dErr = validateDates();
    if (dErr) {
      setDateError(dErr);
      return;
    }
    setDateError(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/newsletter/${newsletter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle,
          body_slack_mrkdwn: editBody,
          notes: editNotes,
          week_start: editWeekStart,
          week_end: editWeekEnd,
        }),
      });
      if (res.ok) {
        await fetchNewsletter();
      } else {
        const err = await res.json().catch(() => ({}));
        setDateError(err.error ?? 'Save failed');
      }
    } catch (err) {
      console.error('Save failed:', err);
    } finally {
      setSaving(false);
    }
  }

  async function handleApproveAndPost() {
    if (!newsletter || readOnly) return;
    setPostError(null);
    await handleSave();

    setPosting(true);
    try {
      const res = await fetch(`/api/admin/newsletter/${newsletter.id}/approve`, {
        method: 'POST',
        credentials: 'include',
      });
      if (res.ok) {
        await fetchNewsletter();
      } else {
        const err = await res.json().catch(() => ({}));
        setPostError(err.error ?? `Post failed (${res.status})`);
      }
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Post failed');
    } finally {
      setPosting(false);
    }
  }

  async function handleRegenerate() {
    if (!newsletter || readOnly) return;
    const dErr = validateDates();
    if (dErr) {
      setDateError(dErr);
      return;
    }

    const hasUnsavedBody = editBody !== savedBody;
    if (hasUnsavedBody) {
      const ok = window.confirm(
        'Regenerating will discard your unsaved edits to the body. Continue?'
      );
      if (!ok) return;
    }

    setRegenerateError(null);
    setRegenerating(true);
    try {
      // Persist any date/title/notes changes first so the regen uses the latest values.
      await fetch(`/api/admin/newsletter/${newsletter.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          title: editTitle,
          notes: editNotes,
          week_start: editWeekStart,
          week_end: editWeekEnd,
        }),
      });

      const res = await fetch(
        `/api/admin/newsletter/${newsletter.id}/regenerate`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ notes: editNotes }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || `Regenerate failed (${res.status})`);
      }
      await fetchNewsletter();
    } catch (err) {
      setRegenerateError(err instanceof Error ? err.message : 'Regenerate failed');
    } finally {
      setRegenerating(false);
    }
  }

  async function handleDelete() {
    if (!newsletter || isPosted) return;
    const ok = window.confirm(
      `Delete this newsletter draft for ${formatDateRange(newsletter.week_start, newsletter.week_end)}? This cannot be undone.`
    );
    if (!ok) return;

    setDeleting(true);
    try {
      const res = await fetch(`/api/admin/newsletter/${newsletter.id}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (res.ok) {
        router.push('/admin/newsletter');
      } else {
        const err = await res.json().catch(() => ({}));
        setRegenerateError(err.error ?? 'Delete failed');
        setDeleting(false);
      }
    } catch (err) {
      setRegenerateError(err instanceof Error ? err.message : 'Delete failed');
      setDeleting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <SectionHead eyebrow="§ Admin · Newsletter" h2="Newsletter" align="left" />
        <div className="flex items-center justify-center py-20">
          <div className="text-muted">Loading…</div>
        </div>
      </div>
    );
  }

  if (loadError || !newsletter) {
    return (
      <div className="p-6">
        <SectionHead eyebrow="§ Admin · Newsletter" h2="Newsletter" align="left" />
        <div className="flex flex-col items-center justify-center py-20 gap-3">
          <p className="font-display font-bold uppercase text-2xl tracking-wide text-muted">
            {loadError ?? 'Not found'}
          </p>
          <Link
            href="/admin/newsletter"
            className="text-sm font-mono uppercase tracking-[.1em] text-steel hover:text-ink"
          >
            ← Back to all newsletters
          </Link>
        </div>
      </div>
    );
  }

  const variant = statusChipVariant(newsletter.status);

  return (
    <div className="p-6 max-w-5xl">
      <div className="mb-4">
        <Link
          href="/admin/newsletter"
          className="text-xs font-mono uppercase tracking-[.1em] text-steel hover:text-ink"
        >
          ← All newsletters
        </Link>
      </div>

      <SectionHead
        eyebrow="§ Admin · Newsletter"
        h2={readOnly ? 'Newsletter (posted)' : 'Newsletter Draft'}
        align="left"
      />

      {/* Status + authorship strip */}
      <div className="flex flex-wrap items-center gap-3 mb-5">
        {variant ? (
          <StatusChip variant={variant}>{newsletter.status}</StatusChip>
        ) : (
          <MonoTag>{newsletter.status}</MonoTag>
        )}
        <span className="text-sm text-muted">
          Week of {formatDateRange(newsletter.week_start, newsletter.week_end)}
        </span>
        <span className="text-xs text-muted">
          Created {formatTimestamp(newsletter.created_at)}
          {newsletter.created_by ? ` by ${newsletter.created_by}` : ''}
        </span>
        {(newsletter.last_edited_by || newsletter.updated_at !== newsletter.created_at) && (
          <span className="text-xs text-muted">
            · Last edited {formatTimestamp(newsletter.updated_at)}
            {newsletter.last_edited_by ? ` by ${newsletter.last_edited_by}` : ''}
          </span>
        )}
        {newsletter.posted_at && (
          <span className="text-xs text-muted">
            · Posted {formatTimestamp(newsletter.posted_at)}
            {newsletter.posted_by ? ` by ${newsletter.posted_by}` : ''}
          </span>
        )}
      </div>

      {readOnly && (
        <div className="mb-5 border border-line-soft bg-bone/60 p-4 text-sm text-muted">
          This newsletter has been posted to Slack. Editing is disabled — start a new draft
          to publish another one.
        </div>
      )}

      <div className="space-y-5 mb-8">
        {/* Editable week range */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label
              htmlFor="week-start"
              className="block text-xs font-mono font-medium text-muted uppercase tracking-[.1em] mb-1"
            >
              Week start
            </label>
            <input
              id="week-start"
              type="date"
              value={editWeekStart}
              onChange={(e) => {
                setEditWeekStart(e.target.value);
                setDateError(null);
              }}
              disabled={readOnly}
              className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
          </div>
          <div>
            <label
              htmlFor="week-end"
              className="block text-xs font-mono font-medium text-muted uppercase tracking-[.1em] mb-1"
            >
              Week end
            </label>
            <input
              id="week-end"
              type="date"
              value={editWeekEnd}
              onChange={(e) => {
                setEditWeekEnd(e.target.value);
                setDateError(null);
              }}
              min={editWeekStart}
              disabled={readOnly}
              className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            />
          </div>
        </div>
        {dateError && (
          <p className="text-sm text-rust" role="alert">
            {dateError}
          </p>
        )}

        {/* Editable title */}
        <div>
          <label
            htmlFor="newsletter-title"
            className="block text-xs font-mono font-medium text-muted uppercase tracking-[.1em] mb-1"
          >
            Title
          </label>
          <input
            id="newsletter-title"
            type="text"
            value={editTitle}
            onChange={(e) => setEditTitle(e.target.value)}
            disabled={readOnly}
            className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
            placeholder="Newsletter title"
          />
        </div>

        {/* Live context / notes */}
        {!readOnly && (
          <div>
            <div className="flex items-center justify-between mb-1">
              <label
                htmlFor="newsletter-notes"
                className="block text-xs font-mono font-medium text-muted uppercase tracking-[.1em]"
              >
                Live context / notes for AI
              </label>
              <span className="text-[10px] font-mono text-muted/70 uppercase tracking-[.1em]">
                used when you click Regenerate
              </span>
            </div>
            <textarea
              id="newsletter-notes"
              value={editNotes}
              onChange={(e) => setEditNotes(e.target.value)}
              rows={4}
              className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary font-mono"
              placeholder="Monthly theme, FNGs to call out, upcoming F2/F3 events, Qs on deck for next week, weather note, anything else you want Claude to fold in…"
            />
            <div className="flex flex-wrap items-center gap-3 mt-2">
              <ChamferButton
                variant="steel"
                size="sm"
                arrow={false}
                onClick={handleRegenerate}
                disabled={saving || posting || regenerating || deleting}
              >
                {regenerating ? 'Regenerating…' : 'Regenerate with notes'}
              </ChamferButton>
              {regenerateError && (
                <span className="text-xs text-rust">{regenerateError}</span>
              )}
            </div>
          </div>
        )}

        {/* Body editor + preview */}
        <ClipFrame variant="bone" padding="p-7">
          <NewsletterPreview value={editBody} onChange={readOnly ? () => {} : setEditBody} />
        </ClipFrame>

        {/* Actions */}
        <div className="flex flex-wrap gap-3 pt-2">
          {!readOnly && (
            <>
              <ChamferButton
                variant="steel"
                size="md"
                arrow={false}
                onClick={handleSave}
                disabled={saving || posting || regenerating || deleting}
              >
                {saving ? 'Saving…' : 'Save Edits'}
              </ChamferButton>
              <ChamferButton
                variant="ink"
                size="md"
                arrow={false}
                onClick={handleApproveAndPost}
                disabled={saving || posting || regenerating || deleting || !editBody.trim()}
              >
                {posting ? 'Posting…' : 'Approve & Post to Slack'}
              </ChamferButton>
              <ChamferButton
                variant="bone"
                size="sm"
                arrow={false}
                onClick={handleDelete}
                disabled={saving || posting || regenerating || deleting}
                className="!border-rust !text-rust hover:!bg-rust hover:!text-bone ml-auto"
              >
                {deleting ? 'Deleting…' : 'Delete draft'}
              </ChamferButton>
            </>
          )}
        </div>
        {postError && (
          <p className="text-sm text-rust" role="alert">
            {postError}
          </p>
        )}
      </div>

      {newsletter.slack_message_ts && (
        <div className="text-xs font-mono text-muted">
          Slack message TS: {newsletter.slack_message_ts}
        </div>
      )}
    </div>
  );
}
