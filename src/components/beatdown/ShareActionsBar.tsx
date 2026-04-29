'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/Button';
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

  async function handleSave() {
    setSaving(true);
    try {
      const resp = await fetch('/api/beatdown/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, draft, generation_ms: generationMs, model, knowledge_version: knowledgeVersion }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.short_id) throw new Error(data?.message || 'Save failed');
      router.push(`/beatdown/${data.short_id}`);
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function handleCopy() {
    const text = formatSlackblast(draft, inputs);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Fallback: select-and-copy via textarea
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  }

  function handlePrint() {
    window.print();
  }

  return (
    <div className="sticky bottom-0 md:static z-10 -mx-4 md:mx-0 px-4 py-3 md:px-0 md:py-0 bg-background/95 md:bg-transparent backdrop-blur md:backdrop-blur-none border-t md:border-0 border-border no-print">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="default" onClick={handleSave} disabled={saving} className="flex-1 min-w-[120px]">
          {saving ? 'Saving…' : 'Save'}
        </Button>
        <Button type="button" variant="outline" onClick={handleCopy} className="flex-1 min-w-[120px]">
          {copied ? 'Copied!' : 'Copy as Slackblast'}
        </Button>
        <Button type="button" variant="outline" onClick={handlePrint} className="flex-1 min-w-[120px]">
          Print
        </Button>
      </div>
    </div>
  );
}
