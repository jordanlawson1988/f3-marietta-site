'use client';

import { useState } from 'react';
import type { BeatdownIntel, IntelConfidence } from '@/types/beatdown';

interface Props {
  intel: BeatdownIntel | null;
  loading: boolean;
  error: string | null;
  releasedTerms: string[];
  onToggleTerm: (term: string) => void;
}

const CONFIDENCE: Record<IntelConfidence, { label: string; className: string }> = {
  strong: { label: 'Strong history', className: 'text-steel border-steel/50' },
  thin: { label: 'Thin history', className: 'text-brass border-brass/50' },
  region: { label: 'Region-wide', className: 'text-olive border-olive/50' },
};

/**
 * What the region already knows, shown before the Q commits to anything. The
 * repeat ledger is the steerable part: a locked term is withheld from the
 * draft, and tapping it hands the term back.
 */
export default function IntelRail({ intel, loading, error, releasedTerms, onToggleTerm }: Props) {
  const [showSources, setShowSources] = useState(false);
  // Collapsed on phones, always open from lg up. Driven by a class rather than
  // a viewport check so there is nothing to mismatch on hydration.
  const [expanded, setExpanded] = useState(false);
  const released = new Set(releasedTerms.map((t) => t.toLowerCase()));

  return (
    <aside className="border-[1.5px] border-ink bg-ink text-bone" aria-label="Archive intel">
      <header className="border-b border-bone/20 px-6 py-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display font-bold uppercase tracking-[.02em] text-[20px] text-bone">
            The Intel
          </h2>
          {intel && (
            <span
              className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.18em] ${CONFIDENCE[intel.confidence].className}`}
            >
              {CONFIDENCE[intel.confidence].label}
            </span>
          )}
        </div>
        <p className="mt-2 font-mono text-[10px] uppercase tracking-[.16em] text-bone/55">
          {loading ? 'Reading the archive…' : scopeLine(intel)}
        </p>
        {intel?.knowledge_stale && (
          <p className="mt-3 border border-brass/40 px-3 py-2 text-[13px] leading-snug text-brass">
            Archive analysis v{intel.knowledge_version} is past its freshness window, so generation
            has dropped it. Drafts are running on raw backblasts until the reconcile cron catches up.
          </p>
        )}
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          aria-expanded={expanded}
          className="mt-3 min-h-[44px] w-full border border-bone/25 font-mono text-[10px] uppercase tracking-[.18em] text-bone/70 hover:border-steel hover:text-steel lg:hidden"
        >
          {expanded ? 'Hide the intel' : summaryLine(intel, releasedTerms)}
        </button>
      </header>

      <div className={`${expanded ? 'block' : 'hidden'} lg:block`}>
      {error && (
        <p className="px-6 py-5 text-[14px] leading-relaxed text-bone/70">
          {error} You can still generate — the draft just won&apos;t be steered by the archive.
        </p>
      )}

      {!error && !loading && intel && (
        <>
          {intel.ao_intel ? (
            <section className="border-b border-bone/20 px-6 py-5">
              <TagBlock label="AO signature" items={intel.ao_intel.top_exercises} />
              <TagBlock label="Common formats" items={intel.ao_intel.common_formats} />
              <TagBlock label="Crowd pleasers" items={intel.ao_intel.crowd_pleasers ?? []} />
              <TagBlock label="Recent trends" items={intel.ao_intel.recent_trends ?? []} />
              {intel.ao_intel.voice_samples.length > 0 && (
                <div className="mt-4">
                  <p className="font-mono text-[10px] uppercase tracking-[.2em] text-steel">
                    {'// How this AO writes'}
                  </p>
                  {intel.ao_intel.voice_samples.slice(0, 2).map((v) => (
                    <p key={v} className="mt-2 font-serif text-[16px] italic leading-snug text-bone/85">
                      &ldquo;{v}&rdquo;
                    </p>
                  ))}
                </div>
              )}
            </section>
          ) : (
            <p className="border-b border-bone/20 px-6 py-5 text-[14px] leading-relaxed text-bone/65">
              {intel.ao_display_name
                ? `No intel block for ${intel.ao_display_name} yet — the archive analysis found too little to summarize. Formats and voice come from the region-wide document.`
                : 'No AO selected, so the draft gets no terrain, landmarks, or local voice. Pick one and this fills in.'}
            </p>
          )}

          <section className="px-6 py-5">
            <div className="flex items-baseline justify-between">
              <p className="font-mono text-[10px] uppercase tracking-[.2em] text-steel">
                {'// Repeat ledger'}
              </p>
              <span className="font-mono text-[10px] uppercase tracking-[.14em] text-bone/55">
                {intel.ledger.length - countReleased(intel, released)} locked
              </span>
            </div>

            {intel.ledger.length === 0 ? (
              <p className="mt-3 text-[14px] leading-relaxed text-bone/65">
                Nothing to hold back — no Exicon terms matched the backblasts read.
              </p>
            ) : (
              <>
                <p className="mt-2 mb-3 text-[13px] leading-snug text-bone/60">
                  Matched against the last {intel.window} backblast{intel.window === 1 ? '' : 's'}.
                  Locked terms are withheld from the draft — tap one to release it.
                </p>
                <ul>
                  {intel.ledger.map((row) => {
                    const isReleased = released.has(row.term.toLowerCase());
                    return (
                      <li key={row.term}>
                        <button
                          type="button"
                          onClick={() => onToggleTerm(row.term)}
                          aria-pressed={!isReleased}
                          className="grid w-full min-h-[44px] grid-cols-[1fr_auto_auto] items-center gap-3 border-b border-bone/10 text-left transition-colors hover:bg-bone/[.05]"
                        >
                          <span className={`text-[14px] ${isReleased ? 'text-bone/50 line-through' : 'text-bone'}`}>
                            {row.term}
                          </span>
                          <span className="font-mono text-[11px] tracking-[.1em] text-bone/50">
                            {row.used}/{row.window}
                          </span>
                          <span
                            className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.16em] ${
                              isReleased ? 'text-bone/50 border-bone/30' : 'text-rust border-rust/50'
                            }`}
                          >
                            {isReleased ? 'Allowed' : 'Locked'}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </>
            )}

            {intel.sources.length > 0 && (
              <div className="mt-5 border-t border-bone/20 pt-4">
                <button
                  type="button"
                  onClick={() => setShowSources((v) => !v)}
                  aria-expanded={showSources}
                  className="min-h-[44px] w-full text-left font-mono text-[10px] uppercase tracking-[.18em] text-bone/60 hover:text-steel"
                >
                  {showSources ? '− Hide' : '+ Show'} the {intel.sources.length} backblast
                  {intel.sources.length === 1 ? '' : 's'} it read
                </button>
                {showSources && (
                  <ul className="pb-2">
                    {intel.sources.map((s, i) => (
                      <li
                        key={`${s.event_date ?? 'x'}-${i}`}
                        className="grid grid-cols-[72px_1fr] gap-3 border-b border-bone/10 py-2"
                      >
                        <span className="font-mono text-[10px] tracking-[.1em] text-bone/50">
                          {formatDate(s.event_date)}
                        </span>
                        <span className="text-[13px] leading-snug text-bone/80">
                          {s.title || 'Untitled backblast'}
                          {s.q_name && <span className="text-steel"> · {s.q_name}</span>}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </section>
        </>
      )}

      {loading && (
        <div className="px-6 py-8" aria-hidden="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="mb-3 h-3 animate-pulse bg-bone/10" style={{ width: `${90 - i * 15}%` }} />
          ))}
        </div>
      )}
      </div>
    </aside>
  );
}

function countReleased(intel: BeatdownIntel, released: Set<string>): number {
  return intel.ledger.filter((r) => released.has(r.term.toLowerCase())).length;
}

function summaryLine(intel: BeatdownIntel | null, releasedTerms: string[]): string {
  if (!intel) return 'Show the intel';
  const released = new Set(releasedTerms.map((t) => t.toLowerCase()));
  const locked = intel.ledger.filter((r) => !released.has(r.term.toLowerCase())).length;
  return `${intel.window} read · ${locked} locked · show`;
}

function scopeLine(intel: BeatdownIntel | null): string {
  if (!intel) return 'Pick an AO to see what the region knows';
  const where = intel.ao_display_name ?? 'Region-wide';
  return `${where} · ${intel.window} read · ${intel.on_file} on file`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function TagBlock({ label, items }: { label: string; items: string[] }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4 last:mb-0">
      <p className="font-mono text-[10px] uppercase tracking-[.2em] text-steel">{`// ${label}`}</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className="border border-bone/25 px-2 py-1 text-[12px] leading-snug text-bone/85">
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}
