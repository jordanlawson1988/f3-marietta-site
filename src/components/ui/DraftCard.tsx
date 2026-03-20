'use client';

import { useState } from 'react';
import type { DraftWithEvent } from '@/types/automation';
import StatusBadge from '@/components/ui/StatusBadge';
import CaptionEditor from '@/components/ui/CaptionEditor';
import ImageUpload from '@/components/ui/ImageUpload';

function formatDate(dateStr: string | null): string {
  if (!dateStr) return 'Unknown date';
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export default function DraftCard({
  draft,
  onUpdate,
}: {
  draft: DraftWithEvent;
  onUpdate: () => void;
}) {
  const [caption, setCaption] = useState(draft.caption);
  const [hashtags, setHashtags] = useState(draft.hashtags.join(', '));
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [loading, setLoading] = useState<string | null>(null);
  const [fullCaption, setFullCaption] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const { f3_event } = draft;

  async function handleApprove() {
    if (!imageFile) return;
    setLoading('approve');

    try {
      // Save any edits first
      await saveEdits();

      const formData = new FormData();
      formData.append('image', imageFile);

      const res = await fetch(`/api/admin/drafts/${draft.id}/approve`, {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to approve');
      }

      const data = await res.json();
      setFullCaption(data.full_caption);
      onUpdate();
    } catch (err) {
      console.error('Approve failed:', err);
    } finally {
      setLoading(null);
    }
  }

  async function handleReject() {
    setLoading('reject');

    try {
      const res = await fetch(`/api/admin/drafts/${draft.id}/reject`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to reject');
      }

      onUpdate();
    } catch (err) {
      console.error('Reject failed:', err);
    } finally {
      setLoading(null);
    }
  }

  async function handleRegenerate() {
    setLoading('regenerate');

    try {
      const res = await fetch(`/api/admin/drafts/${draft.id}/regenerate`, {
        method: 'POST',
        credentials: 'include',
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to regenerate');
      }

      onUpdate();
    } catch (err) {
      console.error('Regenerate failed:', err);
    } finally {
      setLoading(null);
    }
  }

  async function saveEdits() {
    const hashtagArray = hashtags
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);

    if (caption !== draft.caption || hashtagArray.join(',') !== draft.hashtags.join(',')) {
      await fetch(`/api/admin/drafts/${draft.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ caption, hashtags: hashtagArray }),
      });
    }
  }

  return (
    <div className="bg-card border border-border rounded-lg p-6 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center gap-3">
        <h3 className="text-lg font-semibold text-foreground">
          {f3_event.ao_display_name ?? 'Unknown AO'}
        </h3>
        <span className="text-sm text-foreground/50">{formatDate(f3_event.event_date)}</span>
        <span className="text-sm text-foreground/50">
          Q: {f3_event.q_name ?? 'Unknown'}
        </span>
        {f3_event.pax_count != null && (
          <span className="text-sm text-foreground/50">
            PAX: {f3_event.pax_count}
          </span>
        )}
        <StatusBadge status={draft.status} />
      </div>

      {/* Image Upload */}
      <ImageUpload file={imageFile} onFileSelect={setImageFile} />

      {/* Caption Editor */}
      <div>
        <label className="block text-xs font-medium text-foreground/60 mb-1">Caption</label>
        <CaptionEditor value={caption} onChange={setCaption} />
      </div>

      {/* Hashtags */}
      <div>
        <label className="block text-xs font-medium text-foreground/60 mb-1">
          Hashtags (comma-separated)
        </label>
        <input
          type="text"
          value={hashtags}
          onChange={(e) => setHashtags(e.target.value)}
          className="w-full px-3 py-2 bg-muted border border-border rounded-md text-foreground text-sm placeholder:text-foreground/40 focus:outline-none focus:ring-2 focus:ring-primary"
          placeholder="F3, F3Marietta, fitness"
        />
      </div>

      {/* Story text (read-only) */}
      {draft.story_text && (
        <div>
          <label className="block text-xs font-medium text-foreground/60 mb-1">Story Text</label>
          <p className="px-3 py-2 bg-muted border border-border rounded-md text-foreground/80 text-sm whitespace-pre-wrap">
            {draft.story_text}
          </p>
        </div>
      )}

      {/* Alt text (read-only) */}
      {draft.alt_text && (
        <div>
          <label className="block text-xs font-medium text-foreground/60 mb-1">Alt Text</label>
          <p className="px-3 py-2 bg-muted border border-border rounded-md text-foreground/80 text-sm">
            {draft.alt_text}
          </p>
        </div>
      )}

      {/* Copy Caption (shown after approval) */}
      {fullCaption && (
        <div className="bg-muted border border-green-500/30 rounded-md p-4 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-green-500">Approved — copy caption for Instagram:</span>
            <button
              onClick={() => {
                navigator.clipboard.writeText(fullCaption);
                setCopied(true);
                setTimeout(() => setCopied(false), 2000);
              }}
              className="px-3 py-1 bg-green-600 text-white text-xs font-medium rounded hover:bg-green-600/90 transition-colors"
            >
              {copied ? 'Copied!' : 'Copy Caption'}
            </button>
          </div>
          <pre className="text-sm text-foreground/80 whitespace-pre-wrap">{fullCaption}</pre>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap gap-3 pt-2">
        <button
          onClick={handleApprove}
          disabled={!imageFile || loading !== null}
          className="px-4 py-2 bg-primary text-white text-sm font-medium rounded-md hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading === 'approve' ? 'Approving...' : 'Approve'}
        </button>
        <button
          onClick={handleReject}
          disabled={loading !== null}
          className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-md hover:bg-red-600/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading === 'reject' ? 'Rejecting...' : 'Reject'}
        </button>
        <button
          onClick={handleRegenerate}
          disabled={loading !== null}
          className="px-4 py-2 bg-secondary text-foreground text-sm font-medium rounded-md hover:bg-secondary/80 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          {loading === 'regenerate' ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>
    </div>
  );
}
