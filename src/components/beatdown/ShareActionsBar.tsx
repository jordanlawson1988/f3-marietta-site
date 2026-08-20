'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { formatSlackblast } from '@/lib/beatdown/formatSlackblast';
import type { BeatdownDraft, BeatdownInputs } from '@/types/beatdown';

interface Props {
  inputs: BeatdownInputs;
  draft: BeatdownDraft;
  generationMs: number;
  model: string;
  knowledgeVersion: number | null;
}

export default function ShareActionsBar({ inputs, draft, generationMs, model, knowledgeVersion }: Props) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const resp = await fetch('/api/beatdown/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          inputs,
          draft,
          generation_ms: generationMs,
          model,
          knowledge_version: knowledgeVersion,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.short_id) throw new Error(data?.message || 'Save failed');
      router.push(`/beatdown/${data.short_id}`);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    const text = formatSlackblast(draft, inputs);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for browsers that refuse the async clipboard without a
      // secure context — still a user gesture, so execCommand is allowed.
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="no-print sticky bottom-0 z-10 -mx-5 border-t-[1.5px] border-ink bg-bone px-5 py-3 sm:-mx-7 sm:px-7 md:static md:mx-0 md:border-t-0 md:bg-transparent md:px-0 md:py-0">
      {error && (
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[.16em] text-rust">{error}</p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleCopy}
          className="min-h-[52px] flex-1 min-w-[180px] clip-chamfer border-[1.5px] border-ink bg-ink px-5 font-display text-[14px] font-semibold uppercase tracking-[.1em] text-bone transition-colors hover:border-steel hover:bg-steel"
        >
          {copied ? 'Copied' : 'Copy as Slackblast'}
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="min-h-[52px] flex-1 min-w-[140px] clip-chamfer border-[1.5px] border-ink bg-bone px-5 font-display text-[14px] font-semibold uppercase tracking-[.1em] text-ink transition-colors hover:bg-ink hover:text-bone disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save & Share'}
        </button>
        <button
          type="button"
          onClick={() => window.print()}
          className="min-h-[52px] min-w-[110px] clip-chamfer border-[1.5px] border-line-soft bg-transparent px-5 font-display text-[14px] font-semibold uppercase tracking-[.1em] text-muted transition-colors hover:border-steel hover:text-steel"
        >
          Print
        </button>
      </div>
    </div>
  );
}
