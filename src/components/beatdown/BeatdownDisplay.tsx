'use client';

import { useState } from 'react';
import type { BeatdownDraft, BeatdownExerciseItem, BeatdownInputs } from '@/types/beatdown';
import BeatdownSection from './BeatdownSection';
import ExerciseSwapModal from './ExerciseSwapModal';
import ShareActionsBar from './ShareActionsBar';
import EditableText from './EditableText';

interface Props {
  inputs: BeatdownInputs;
  draft: BeatdownDraft;
  setDraft: (d: BeatdownDraft) => void;
  generationMs: number;
  model: string;
  knowledgeVersion: number | null;
}

export default function BeatdownDisplay({ inputs, draft, setDraft, generationMs, model, knowledgeVersion }: Props) {
  const [regen, setRegen] = useState<'warmup' | 'thang' | 'cot' | null>(null);
  const [swap, setSwap] = useState<{ section: 'warmup' | 'thang'; index: number } | null>(null);

  const showCoaching = inputs.theme === 'fng-friendly' || inputs.theme === 'q-school';

  function setItems(section: 'warmup' | 'thang', items: BeatdownExerciseItem[]) {
    if (section === 'warmup') setDraft({ ...draft, sections: { ...draft.sections, warmup: { items } } });
    else setDraft({ ...draft, sections: { ...draft.sections, thang: { ...draft.sections.thang, items } } });
  }

  function addItem(section: 'warmup' | 'thang') {
    const items = section === 'warmup' ? draft.sections.warmup.items : draft.sections.thang.items;
    setItems(section, [...items, { exercise: 'New exercise', reps: 'x 10', note: '' }]);
  }

  async function regenerateSection(section: 'warmup' | 'thang' | 'cot') {
    setRegen(section);
    try {
      const resp = await fetch('/api/beatdown/regenerate-section', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputs, current: draft, section }),
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data?.message || 'Regenerate failed');
      setDraft({
        ...draft,
        sections: { ...draft.sections, [section]: data.data },
      });
    } catch (err) {
      alert((err as Error).message);
    } finally {
      setRegen(null);
    }
  }

  function applySwap(item: BeatdownExerciseItem) {
    if (!swap) return;
    const items = swap.section === 'warmup' ? [...draft.sections.warmup.items] : [...draft.sections.thang.items];
    items[swap.index] = item;
    setItems(swap.section, items);
    setSwap(null);
  }

  return (
    <section className="mt-8 space-y-4 beatdown-card">
      <header className="rounded-md border border-border p-4 bg-card">
        <div className="text-[10px] uppercase tracking-widest text-primary">
          F3 Marietta{inputs.ao_display_name ? ` · ${inputs.ao_display_name}` : ''} · {draft.sections.header.length_min} min
        </div>
        <EditableText
          value={draft.title}
          onChange={(value) => setDraft({ ...draft, title: value, sections: { ...draft.sections, header: { ...draft.sections.header, title: value } } })}
          as="h2"
          className="mt-1 text-2xl md:text-3xl font-bold"
          placeholder="Beatdown title"
          ariaLabel="Edit beatdown title"
        />
        <EditableText
          value={draft.sections.header.summary}
          onChange={(value) => setDraft({ ...draft, sections: { ...draft.sections, header: { ...draft.sections.header, summary: value } } })}
          as="p"
          className="mt-1 text-sm text-muted-foreground"
          placeholder="One-line summary"
          ariaLabel="Edit beatdown summary"
          multiline
        />
        <div className="mt-2 text-xs text-muted-foreground no-print">
          {model} · {generationMs}ms{knowledgeVersion ? ` · knowledge v${knowledgeVersion}` : ''}
        </div>
      </header>

      <BeatdownSection
        label="Warm-up" sectionKey="warmup" draft={draft} inputs={inputs} showCoaching={showCoaching}
        onChangeItems={(items) => setItems('warmup', items)}
        onAddItem={() => addItem('warmup')}
        onRegenerate={() => regenerateSection('warmup')}
        onSwap={(i) => setSwap({ section: 'warmup', index: i })}
        regenerating={regen === 'warmup'}
      />
      <BeatdownSection
        label="The Thang" sectionKey="thang" draft={draft} inputs={inputs} showCoaching={showCoaching}
        onChangeItems={(items) => setItems('thang', items)}
        onAddItem={() => addItem('thang')}
        onRegenerate={() => regenerateSection('thang')}
        onSwap={(i) => setSwap({ section: 'thang', index: i })}
        regenerating={regen === 'thang'}
        onChangeFormatNote={(value) =>
          setDraft({ ...draft, sections: { ...draft.sections, thang: { ...draft.sections.thang, format_note: value } } })
        }
      />
      <BeatdownSection
        label="COT" sectionKey="cot" draft={draft} inputs={inputs} showCoaching={showCoaching}
        onChangeItems={() => {}}
        onAddItem={() => {}}
        onRegenerate={() => regenerateSection('cot')}
        onSwap={() => {}}
        regenerating={regen === 'cot'}
        onChangeCotTalkingPoints={(points) =>
          setDraft({ ...draft, sections: { ...draft.sections, cot: { ...draft.sections.cot, talking_points: points } } })
        }
        onChangeCotNotes={(notes) =>
          setDraft({ ...draft, sections: { ...draft.sections, cot: { ...draft.sections.cot, notes } } })
        }
      />

      <ShareActionsBar inputs={inputs} draft={draft} generationMs={generationMs} model={model} knowledgeVersion={knowledgeVersion} />

      {swap && (
        <ExerciseSwapModal
          focus={inputs.focus}
          currentTerm={(swap.section === 'warmup' ? draft.sections.warmup.items : draft.sections.thang.items)[swap.index].exercise}
          onApply={applySwap}
          onClose={() => setSwap(null)}
        />
      )}
    </section>
  );
}
