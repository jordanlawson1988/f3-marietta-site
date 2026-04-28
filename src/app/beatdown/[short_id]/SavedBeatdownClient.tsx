'use client';

import Link from 'next/link';
import type { BeatdownInputs, BeatdownSections } from '@/types/beatdown';
import BeatdownSection from '@/components/beatdown/BeatdownSection';
import ShareActionsBar from '@/components/beatdown/ShareActionsBar';

interface Row {
  short_id: string;
  title: string;
  inputs: BeatdownInputs;
  sections: BeatdownSections;
  generation_model: string;
  generation_ms: number;
  created_at: string;
}

export default function SavedBeatdownClient({ row }: { row: Row }) {
  const draft = { title: row.title, sections: row.sections };
  const showCoaching = row.inputs.theme === 'fng-friendly' || row.inputs.theme === 'q-school';

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 md:py-12">
      <div className="mb-4 no-print text-sm">
        <Link href="/beatdown-builder" className="underline">← Build a new beatdown</Link>
      </div>
      <section className="space-y-4 beatdown-card">
        <header className="rounded-md border border-border p-4 bg-card">
          <div className="text-[10px] uppercase tracking-widest text-primary">
            F3 Marietta · {row.inputs.ao_display_name} · {row.sections.header.length_min} min
          </div>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold">{row.title}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{row.sections.header.summary}</p>
        </header>

        <BeatdownSection
          label="Warm-up" sectionKey="warmup" draft={draft} inputs={row.inputs} showCoaching={showCoaching}
          onChangeItems={() => {}} onAddItem={() => {}} onRegenerate={async () => {}} onSwap={() => {}} regenerating={false}
        />
        <BeatdownSection
          label="The Thang" sectionKey="thang" draft={draft} inputs={row.inputs} showCoaching={showCoaching}
          onChangeItems={() => {}} onAddItem={() => {}} onRegenerate={async () => {}} onSwap={() => {}} regenerating={false}
        />
        <BeatdownSection
          label="COT" sectionKey="cot" draft={draft} inputs={row.inputs} showCoaching={showCoaching}
          onChangeItems={() => {}} onAddItem={() => {}} onRegenerate={async () => {}} onSwap={() => {}} regenerating={false}
        />

        <ShareActionsBar
          inputs={row.inputs}
          draft={draft}
          generationMs={row.generation_ms}
          model={row.generation_model}
          knowledgeVersion={null}
        />

        <p className="text-xs text-muted-foreground no-print">
          Saved {new Date(row.created_at).toLocaleString()} · <Link href={`/beatdown-builder?seed=${row.short_id}`} className="underline">Remix this beatdown</Link>
        </p>
      </section>
    </main>
  );
}
