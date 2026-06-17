'use client';

import { useState } from 'react';
import BeatdownForm from '@/components/beatdown/BeatdownForm';
import BeatdownDisplay from '@/components/beatdown/BeatdownDisplay';
import BeatdownLoader from '@/components/beatdown/BeatdownLoader';
import type { BeatdownDraft, BeatdownInputs } from '@/types/beatdown';

interface AoOption {
  id: string;
  ao_display_name: string;
}
interface FamousOption {
  slug: string;
  title: string;
  category: 'famous' | 'ipc';
  description: string;
}

interface Props {
  aos: AoOption[];
  famousBeatdowns: FamousOption[];
}

export default function BeatdownBuilderClient({ aos, famousBeatdowns }: Props) {
  const [inputs, setInputs] = useState<BeatdownInputs | null>(null);
  const [draft, setDraft] = useState<BeatdownDraft | null>(null);
  const [generationMs, setGenerationMs] = useState<number>(0);
  const [model, setModel] = useState<string>('');
  const [knowledgeVersion, setKnowledgeVersion] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Once a beatdown is generated, collapse the form out of the scroll. Keeping it
  // mounted (via `hidden`, not unmounting) preserves the user's selections, while
  // removing its native <select> dropdowns from the painted page — those were a
  // source of the iOS ghost/overlap and they also make the page needlessly tall.
  const [formOpen, setFormOpen] = useState(true);

  async function handleGenerate(formInputs: BeatdownInputs) {
    setError(null);
    setLoading(true);
    setInputs(formInputs);
    try {
      const resp = await fetch('/api/beatdown/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formInputs),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || data?.error || 'Generation failed');
      setDraft({ title: data.title, sections: data.sections });
      setGenerationMs(data.generation_ms);
      setModel(data.model);
      setKnowledgeVersion(data.knowledge_version);
      setFormOpen(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <header className="mb-8">
        <h1 className="font-heading text-3xl md:text-4xl font-bold">AI Beatdown Builder</h1>
        <p className="mt-2 text-muted-foreground">
          F3 Marietta&apos;s own Q tool — generates beatdowns from our backblasts, the Exicon, and famous F3 BDs.
        </p>
      </header>

      {draft && (
        <button
          type="button"
          onClick={() => setFormOpen((o) => !o)}
          className="mb-4 w-full rounded-md border border-[var(--line)] bg-[var(--bone-2)] px-4 py-3 text-left text-sm font-medium no-print"
          aria-expanded={formOpen}
        >
          {formOpen ? '▲ Hide inputs' : '▾ Adjust inputs & regenerate'}
        </button>
      )}

      <div className={draft && !formOpen ? 'hidden' : undefined}>
        <BeatdownForm
          aos={aos}
          famousBeatdowns={famousBeatdowns}
          disabled={loading}
          onSubmit={handleGenerate}
        />
      </div>

      {loading && <BeatdownLoader />}

      {error && (
        <div className="mt-6 rounded-md border border-red-500/30 bg-red-500/10 p-4 text-red-300">
          {error}
        </div>
      )}

      {!loading && draft && inputs && (
        <BeatdownDisplay
          inputs={inputs}
          draft={draft}
          setDraft={setDraft}
          generationMs={generationMs}
          model={model}
          knowledgeVersion={knowledgeVersion}
        />
      )}
    </main>
  );
}
