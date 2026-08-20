'use client';

import { useCallback, useEffect, useState } from 'react';
import BeatdownForm from '@/components/beatdown/BeatdownForm';
import BeatdownDisplay from '@/components/beatdown/BeatdownDisplay';
import MusterLog from '@/components/beatdown/MusterLog';
import IntelRail from '@/components/beatdown/IntelRail';
import { FOCUS_OPTIONS } from '@/types/beatdown';
import type { BeatdownDraft, BeatdownInputs, BeatdownIntel } from '@/types/beatdown';

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
  const [aoId, setAoId] = useState<string>('');
  const [intel, setIntel] = useState<BeatdownIntel | null>(null);
  const [intelLoading, setIntelLoading] = useState(true);
  const [intelError, setIntelError] = useState<string | null>(null);
  const [releasedTerms, setReleasedTerms] = useState<string[]>([]);

  const [inputs, setInputs] = useState<BeatdownInputs | null>(null);
  const [draft, setDraft] = useState<BeatdownDraft | null>(null);
  const [generationMs, setGenerationMs] = useState<number>(0);
  const [model, setModel] = useState<string>('');
  const [knowledgeVersion, setKnowledgeVersion] = useState<number | null>(null);
  const [draftIntel, setDraftIntel] = useState<BeatdownIntel | null>(null);
  const [locksHonored, setLocksHonored] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // One fetch per AO change, aborted if the Q keeps switching — otherwise a
  // slow first request can land after a faster second and show the wrong AO's
  // history next to the right AO's name.
  useEffect(() => {
    const controller = new AbortController();
    setIntelLoading(true);
    setIntelError(null);

    fetch(`/api/beatdown/intel?ao_id=${encodeURIComponent(aoId)}`, { signal: controller.signal })
      .then(async (resp) => {
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.message || 'Archive intel is unavailable.');
        setIntel(data as BeatdownIntel);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setIntel(null);
        setIntelError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setIntelLoading(false);
      });

    return () => controller.abort();
  }, [aoId]);

  const handleAoChange = useCallback((next: string) => {
    setAoId(next);
    // Locks are per-AO — carrying them across would release a term the new
    // AO never had a problem with.
    setReleasedTerms([]);
  }, []);

  const toggleTerm = useCallback((term: string) => {
    setReleasedTerms((prev) =>
      prev.some((t) => t.toLowerCase() === term.toLowerCase())
        ? prev.filter((t) => t.toLowerCase() !== term.toLowerCase())
        : [...prev, term],
    );
  }, []);

  const lockedCount = intel
    ? intel.ledger.filter((r) => !releasedTerms.some((t) => t.toLowerCase() === r.term.toLowerCase())).length
    : 0;

  async function handleGenerate(formInputs: Omit<BeatdownInputs, 'released_terms'>) {
    const withLocks: BeatdownInputs = { ...formInputs, released_terms: releasedTerms };
    setError(null);
    setLoading(true);
    setInputs(withLocks);
    try {
      const resp = await fetch('/api/beatdown/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(withLocks),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || data?.error || 'Generation failed');
      setDraft({ title: data.title, sections: data.sections });
      setGenerationMs(data.generation_ms);
      setModel(data.model);
      setKnowledgeVersion(data.knowledge_version);
      setDraftIntel((data.intel as BeatdownIntel) ?? null);
      setLocksHonored(typeof data.locks_honored === 'number' ? data.locks_honored : null);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
    }
  }

  const aoName = aos.find((a) => a.id === aoId)?.ao_display_name ?? null;

  return (
    <main className="mx-auto max-w-[1320px] px-5 py-10 sm:px-7 md:py-14">
      <header className="mb-9">
        <span className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[.2em] text-steel">
          <span aria-hidden="true" className="h-px w-7 bg-steel" />§ For the Q
        </span>
        <h1 className="mt-5 font-display text-[clamp(40px,7vw,80px)] font-bold uppercase leading-[.88] tracking-[-.01em]">
          Build a beatdown<span className="text-steel">.</span>
        </h1>
        <p className="mt-5 max-w-[640px] text-[17px] leading-relaxed text-muted">
          Every draft is written against what this region has actually done — recent backblasts at
          your AO, the Exicon, and the famous BD library. You can see what it read, and overrule it.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px] lg:items-start lg:gap-7">
        <div className="order-2 lg:order-1">
          {!loading && !draft && (
            <BeatdownForm
              aos={aos}
              famousBeatdowns={famousBeatdowns}
              disabled={loading}
              aoId={aoId}
              onAoChange={handleAoChange}
              lockedCount={lockedCount}
              onSubmit={handleGenerate}
            />
          )}

          {loading && inputs && (
            <MusterLog
              aoName={inputs.ao_display_name}
              window={intel?.window ?? 0}
              lockedCount={lockedCount}
              focusLabel={FOCUS_OPTIONS.find((o) => o.value === inputs.focus)?.label ?? inputs.focus}
            />
          )}

          {error && (
            <div className="mt-6 border-[1.5px] border-rust/40 bg-rust/10 p-4 text-[15px] text-rust">
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
              intel={draftIntel}
              locksHonored={locksHonored}
              onStartOver={() => {
                setDraft(null);
                setInputs(null);
                setError(null);
              }}
            />
          )}
        </div>

        <div className="order-1 lg:order-2 lg:sticky lg:top-6">
          <IntelRail
            intel={intel}
            loading={intelLoading}
            error={intelError}
            releasedTerms={releasedTerms}
            onToggleTerm={toggleTerm}
          />
        </div>
      </div>

      <p className="sr-only" aria-live="polite">
        {aoName ? `Showing archive intel for ${aoName}` : 'Showing region-wide archive intel'}
      </p>
    </main>
  );
}
