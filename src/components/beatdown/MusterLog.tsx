'use client';

import { useEffect, useState } from 'react';

interface Props {
  aoName: string | null;
  /** Backblasts being read for this generation. */
  window: number;
  lockedCount: number;
  /** Display label, not the raw enum value — "Full Body", not "full". */
  focusLabel: string;
}

/**
 * Replaces the spinner. gemini-3.1-pro-preview takes ~18s with thinking on,
 * which is a long time to stare at a rotating border. Each line here is a real
 * stage of buildBeatdownContext -> generateGeminiContent, so the wait doubles
 * as the evidence that the draft is grounded in the archive.
 *
 * The final stage has no timer: it holds until the parent unmounts this on the
 * API response, so the log can never claim to have finished ahead of the model.
 */
export default function MusterLog({ aoName, window: readWindow, lockedCount, focusLabel }: Props) {
  const stages = [
    'Loading region knowledge…',
    aoName ? `Reading the last ${readWindow} backblasts at ${aoName}…` : 'Reading recent backblasts region-wide…',
    `Scoring the Exicon for ${focusLabel.toUpperCase()}…`,
    lockedCount > 0
      ? `Holding ${lockedCount} repeat ${lockedCount === 1 ? 'lock' : 'locks'}…`
      : 'No repeat locks held…',
    'Drafting on gemini-3.1-pro-preview…',
  ];

  const [stage, setStage] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    if (stage >= stages.length - 1) return;
    const t = setTimeout(() => setStage((s) => s + 1), stage === 0 ? 500 : 750);
    return () => clearTimeout(t);
  }, [stage, stages.length]);

  useEffect(() => {
    const i = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(i);
  }, []);

  const pct = Math.round(((stage + 1) / stages.length) * 100);

  return (
    <section
      className="mt-6 border-[1.5px] border-ink bg-ink text-bone p-6 md:p-8"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex items-baseline justify-between border-b border-bone/20 pb-3">
        <h2 className="font-display font-bold uppercase tracking-[.02em] text-[22px] text-bone">Muster Log</h2>
        <span className="font-mono text-[10px] uppercase tracking-[.18em] text-bone/55">
          {elapsed}s elapsed
        </span>
      </div>

      <div className="mt-5 h-[3px] bg-bone/15">
        <div className="h-[3px] bg-steel transition-all duration-500" style={{ width: `${pct}%` }} />
      </div>

      <ol className="mt-6 space-y-2">
        {stages.slice(0, stage + 1).map((line, i) => {
          const current = i === stage;
          return (
            <li key={line} className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className={`mt-[7px] inline-block h-2 w-2 shrink-0 ${current ? 'bg-rust' : 'bg-steel'}`}
              />
              <span className={`font-mono text-[13px] leading-relaxed ${current ? 'text-bone' : 'text-bone/65'}`}>
                {line}
              </span>
            </li>
          );
        })}
      </ol>

      <p className="mt-7 border-t border-bone/20 pt-5 text-[15px] leading-relaxed text-bone/70 max-w-lg">
        The slow part is the model weighing what this AO has already done against what you asked
        for. That is the step that makes the draft yours instead of generic.
      </p>
    </section>
  );
}
