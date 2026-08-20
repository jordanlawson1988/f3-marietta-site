'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { THIN_HISTORY_THRESHOLD } from '@/lib/beatdown/intel';
import type { BeatdownIntel } from '@/types/beatdown';
import type { AoCoverage } from './page';

const REGION = { id: '', ao_display_name: 'Region-wide', backblasts: 0 };

export default function LedgerClient({ aos }: { aos: AoCoverage[] }) {
  const [aoId, setAoId] = useState<string>(aos[0]?.id ?? '');
  const [intel, setIntel] = useState<BeatdownIntel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError(null);

    fetch(`/api/beatdown/intel?ao_id=${encodeURIComponent(aoId)}`, { signal: controller.signal })
      .then(async (resp) => {
        const data = await resp.json();
        if (!resp.ok) throw new Error(data?.message || 'Archive intel is unavailable.');
        setIntel(data as BeatdownIntel);
      })
      .catch((err: Error) => {
        if (err.name === 'AbortError') return;
        setIntel(null);
        setError(err.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });

    return () => controller.abort();
  }, [aoId]);

  const tabs = [...aos, REGION];
  const maxBackblasts = Math.max(1, ...aos.map((a) => a.backblasts));
  const stale = intel?.knowledge_stale ?? false;

  return (
    <main className="mx-auto max-w-[1320px] px-5 py-10 sm:px-7 md:py-14">
      <header className="mb-9">
        <span className="inline-flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[.2em] text-steel">
          <span aria-hidden="true" className="h-px w-7 bg-steel" />§ What the builder knows
        </span>
        <h1 className="mt-5 font-display text-[clamp(40px,7vw,72px)] font-bold uppercase leading-[.9] tracking-[-.01em]">
          The{' '}
          <span className="font-serif normal-case italic tracking-normal text-steel">Ledger</span>
        </h1>
        <p className="mt-5 max-w-[640px] text-[17px] leading-relaxed text-muted">
          Every term the region has used recently, how often, and how long ago. This is what the
          builder reads before it writes a line.
        </p>
        <Link
          href="/beatdown-builder"
          className="mt-5 inline-block font-display text-[13px] font-semibold uppercase tracking-[.1em] text-steel-2 hover:underline"
        >
          ← Back to the builder
        </Link>
      </header>

      {/* knowledge status */}
      <section
        className={`border-[1.5px] px-6 py-6 md:px-8 ${
          stale ? 'border-brass bg-bone-2 text-ink' : 'border-ink bg-ink text-bone'
        }`}
      >
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-display text-[22px] font-bold uppercase tracking-[.02em]">
                Knowledge{intel?.knowledge_version ? ` v${intel.knowledge_version}` : ''}
              </h2>
              <span
                className={`inline-flex items-center border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[.18em] ${
                  stale ? 'border-rust/50 text-rust' : 'border-steel/50 text-steel'
                }`}
              >
                {intel?.knowledge_version === null || intel === null
                  ? 'Absent'
                  : stale
                    ? 'Blind'
                    : 'Fresh'}
              </span>
            </div>
            <p
              className={`mt-3 max-w-xl text-[15px] leading-relaxed ${stale ? 'text-muted' : 'text-bone/70'}`}
            >
              {intel === null
                ? 'Loading the archive analysis…'
                : intel.knowledge_version === null
                  ? 'No archive analysis on file. Generation is running on raw backblasts until the reconcile cron builds one.'
                  : stale
                    ? 'Past the 14-day freshness window, so generation has dropped it entirely. Drafts are running without AO intel — check the reconcile cron.'
                    : 'Rebuilt by the daily reconcile cron. Every AO below is drawing on a current intel block.'}
            </p>
          </div>
          <dl className="flex flex-wrap gap-8">
            <Stat
              label="Source backblasts"
              value={intel?.source_event_count != null ? String(intel.source_event_count) : '—'}
              muted={stale}
            />
            <Stat label="Active AOs" value={String(aos.length)} muted={stale} />
            <Stat
              label="Built"
              value={intel?.knowledge_generated_at ? formatDateTime(intel.knowledge_generated_at) : '—'}
              muted={stale}
            />
          </dl>
        </div>
      </section>

      {/* AO tabs */}
      <div className="mt-9 flex flex-wrap items-center gap-x-7 border-b border-line-soft" role="tablist" aria-label="AO">
        {tabs.map((t) => {
          const selected = aoId === t.id;
          return (
            <button
              key={t.id || 'region'}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => setAoId(t.id)}
              className={`min-h-[44px] border-b-2 py-3 font-display text-[13px] font-semibold uppercase tracking-[.06em] transition-colors ${
                selected ? 'border-steel text-ink' : 'border-transparent text-muted hover:text-ink'
              }`}
            >
              {t.ao_display_name}
              {t.id && (
                <span className="ml-2 font-mono text-[10px] tracking-[.14em] opacity-60">
                  {t.backblasts}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-7 grid gap-7 lg:grid-cols-[1fr_340px] lg:items-start">
        {/* ledger table */}
        <section>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[20px] font-bold uppercase tracking-[.02em]">
              Repeat Ledger
            </h2>
            {intel && (
              <span className="font-mono text-[10px] uppercase tracking-[.16em] text-muted">
                {intel.ledger.length} terms · last {intel.window} backblasts
              </span>
            )}
          </div>

          {error && <p className="mt-4 text-[15px] text-rust">{error}</p>}
          {loading && <p className="mt-4 font-mono text-[11px] uppercase tracking-[.16em] text-muted">Reading…</p>}

          {!loading && intel && intel.ledger.length === 0 && (
            <p className="mt-4 text-[15px] leading-relaxed text-muted">
              No Exicon terms matched the backblasts read for this AO.
            </p>
          )}

          {!loading && intel && intel.ledger.length > 0 && (
            <table className="mt-4 w-full border-collapse">
              <thead>
                <tr className="border-b-[1.5px] border-ink text-left">
                  <Th>Exicon term</Th>
                  <Th>Used in</Th>
                  <Th>Last seen</Th>
                  <Th>Frequency</Th>
                </tr>
              </thead>
              <tbody>
                {intel.ledger.map((row) => (
                  <tr key={row.term} className="border-b border-line-soft">
                    <td className="py-3 pr-4 text-[15px] font-medium">{row.term}</td>
                    <td className="py-3 pr-4 font-mono text-[11px] tracking-[.1em] text-muted">
                      {row.used} of {row.window}
                    </td>
                    <td className="py-3 pr-4 font-mono text-[11px] tracking-[.1em] text-muted">
                      {formatDate(row.last_used)}
                    </td>
                    <td className="w-[30%] py-3">
                      <span className="block h-1.5 bg-ink/10">
                        <span
                          className="block h-1.5 bg-rust"
                          style={{ width: `${Math.round((row.used / Math.max(1, row.window)) * 100)}%` }}
                        />
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <p className="mt-6 font-mono text-[10px] uppercase leading-loose tracking-[.14em] text-muted">
            {'// Matching is word-bounded and plural-tolerant — "Merkins" counts as "Merkin"'}
            <br />
            {'// The count is beatdowns that used the term, not raw mentions'}
            <br />
            {'// Top 20 terms only · terms under 3 characters are skipped'}
          </p>
        </section>

        {/* right column */}
        <div>
          <section className="border-[1.5px] border-line-soft bg-bone-2 px-6 py-5">
            <p className="font-mono text-[10px] uppercase tracking-[.2em] text-steel">
              {'// Archive coverage'}
            </p>
            <ul className="mt-4">
              {aos.map((a) => {
                const thin = a.backblasts < THIN_HISTORY_THRESHOLD;
                return (
                  <li key={a.id} className="mb-3.5">
                    <div className="flex items-baseline justify-between">
                      <span className={`text-[14px] ${thin ? 'text-rust' : 'text-ink'}`}>
                        {a.ao_display_name}
                      </span>
                      <span className="font-mono text-[10px] tracking-[.12em] text-muted">
                        {a.backblasts}
                      </span>
                    </div>
                    <span className="mt-1.5 block h-1 bg-ink/10">
                      <span
                        className={`block h-1 ${thin ? 'bg-brass' : 'bg-steel'}`}
                        style={{ width: `${Math.round((a.backblasts / maxBackblasts) * 100)}%` }}
                      />
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="mt-4 text-[13px] leading-relaxed text-muted">
              Under {THIN_HISTORY_THRESHOLD} backblasts an AO gets no intel block of its own and
              leans on the region-wide knowledge document.
            </p>
          </section>

          {intel?.ao_intel && intel.ao_intel.voice_samples.length > 0 && (
            <section className="mt-5 border-[1.5px] border-ink bg-bone px-6 py-5">
              <p className="font-mono text-[10px] uppercase tracking-[.2em] text-steel">
                {'// How this AO writes'}
              </p>
              {intel.ao_intel.voice_samples.slice(0, 3).map((v) => (
                <p key={v} className="mt-3 font-serif text-[16px] italic leading-snug">
                  &ldquo;{v}&rdquo;
                </p>
              ))}
              <p className="mt-4 text-[13px] leading-relaxed text-muted">
                Pulled from backblasts so the draft sounds like this AO.
              </p>
            </section>
          )}

          {intel && intel.sources.length > 0 && (
            <section className="mt-5 border-[1.5px] border-line-soft bg-bone px-6 py-5">
              <p className="font-mono text-[10px] uppercase tracking-[.2em] text-steel">
                {'// Read for this AO'}
              </p>
              <ul className="mt-3">
                {intel.sources.map((s, i) => (
                  <li
                    key={`${s.event_date ?? 'x'}-${i}`}
                    className="grid grid-cols-[64px_1fr] gap-3 border-b border-line-softer py-2 last:border-b-0"
                  >
                    <span className="font-mono text-[10px] tracking-[.1em] text-muted">
                      {formatDate(s.event_date)}
                    </span>
                    <span className="text-[13px] leading-snug">
                      {s.title || 'Untitled backblast'}
                      {s.q_name && <span className="text-steel"> · {s.q_name}</span>}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </div>
    </main>
  );
}

function Stat({ label, value, muted }: { label: string; value: string; muted: boolean }) {
  return (
    <div>
      <dd className="font-display text-[30px] font-bold leading-none">{value}</dd>
      <dt className={`mt-2 font-mono text-[9px] uppercase tracking-[.18em] ${muted ? 'text-muted' : 'text-bone/60'}`}>
        {label}
      </dt>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="pb-2.5 font-mono text-[9px] font-normal uppercase tracking-[.18em] text-muted">
      {children}
    </th>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 10);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
