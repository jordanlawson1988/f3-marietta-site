'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import type { Newsletter } from '@/types/automation';
import { StatusChip } from '@/components/ui/brand/StatusChip';
import { SectionHead } from '@/components/ui/brand/SectionHead';
import { ChamferButton } from '@/components/ui/brand/ChamferButton';
import { MonoTag } from '@/components/ui/brand/MonoTag';
import { NewNewsletterModal } from './NewNewsletterModal';

type FilterKey = 'all' | 'draft' | 'posted';

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatTimestamp(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function statusChipVariant(
  status: string
): 'active' | 'draft' | 'pending' | 'archived' | null {
  if (status === 'posted' || status === 'active') return 'active';
  if (status === 'draft') return 'draft';
  if (status === 'approved') return 'pending';
  if (status === 'archived') return 'archived';
  return null;
}

export default function NewsletterListPage() {
  const router = useRouter();
  const [newsletters, setNewsletters] = useState<Newsletter[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [showModal, setShowModal] = useState(false);

  const fetchNewsletters = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/newsletter', { credentials: 'include' });
      if (res.ok) {
        const data: Newsletter[] = await res.json();
        setNewsletters(data);
      }
    } catch (err) {
      console.error('Failed to fetch newsletters:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNewsletters();
  }, [fetchNewsletters]);

  const currentlyPosted = useMemo(
    () =>
      newsletters
        .filter((n) => n.status === 'posted')
        .sort((a, b) =>
          (b.posted_at ?? b.updated_at ?? '').localeCompare(a.posted_at ?? a.updated_at ?? '')
        )[0] ?? null,
    [newsletters]
  );

  const filtered = useMemo(() => {
    if (filter === 'draft') {
      return newsletters.filter((n) => n.status === 'draft' || n.status === 'approved');
    }
    if (filter === 'posted') {
      return newsletters.filter((n) => n.status === 'posted');
    }
    return newsletters;
  }, [filter, newsletters]);

  const counts = useMemo(() => {
    let drafts = 0;
    let posted = 0;
    for (const n of newsletters) {
      if (n.status === 'posted') posted += 1;
      else drafts += 1;
    }
    return { all: newsletters.length, drafts, posted };
  }, [newsletters]);

  function handleCreated(id: string) {
    setShowModal(false);
    router.push(`/admin/newsletter/${id}`);
  }

  return (
    <div className="p-6 max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <SectionHead eyebrow="§ Admin · Newsletter" h2="Newsletter Manager" align="left" />
        <ChamferButton
          variant="ink"
          size="md"
          arrow={false}
          onClick={() => setShowModal(true)}
        >
          New Newsletter
        </ChamferButton>
      </div>

      {currentlyPosted && (
        <div className="border border-line-soft bg-bone/60 p-5 mb-6">
          <div className="flex flex-wrap items-center gap-3 mb-2">
            <MonoTag>Currently posted</MonoTag>
            <StatusChip variant="active">posted</StatusChip>
            <span className="text-sm text-muted">
              Week of {formatDate(currentlyPosted.week_start)} &ndash;{' '}
              {formatDate(currentlyPosted.week_end)}
            </span>
            <span className="text-xs text-muted">
              Posted {formatTimestamp(currentlyPosted.posted_at)}
              {currentlyPosted.posted_by ? ` by ${currentlyPosted.posted_by}` : ''}
            </span>
          </div>
          <div className="flex flex-wrap items-baseline justify-between gap-3">
            <p className="font-display font-bold uppercase tracking-wide text-lg text-foreground">
              {currentlyPosted.title ?? 'Untitled'}
            </p>
            <Link
              href={`/admin/newsletter/${currentlyPosted.id}`}
              className="text-xs font-mono uppercase tracking-[.1em] text-steel hover:text-ink"
            >
              View →
            </Link>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2 mb-4">
        {(
          [
            { key: 'all', label: `All (${counts.all})` },
            { key: 'draft', label: `Drafts (${counts.drafts})` },
            { key: 'posted', label: `Posted (${counts.posted})` },
          ] as { key: FilterKey; label: string }[]
        ).map((opt) => {
          const active = filter === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              onClick={() => setFilter(opt.key)}
              aria-pressed={active}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-[.1em] border transition-colors ${
                active
                  ? 'bg-ink text-bone border-ink'
                  : 'bg-bone text-foreground/70 border-line-soft hover:border-ink'
              }`}
            >
              {opt.label}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-muted">Loading newsletters…</div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 gap-3 border border-dashed border-line-soft">
          <p className="font-display font-bold uppercase text-xl tracking-wide text-muted text-center">
            {newsletters.length === 0 ? 'No newsletters yet' : 'No matches for this filter'}
          </p>
          {newsletters.length === 0 && (
            <p className="text-sm text-muted">
              Click <strong>New Newsletter</strong> to start one for a specific week.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Desktop / tablet table */}
          <div className="hidden md:block border border-line-soft overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-line-soft text-left bg-muted/30">
                    <th className="px-4 py-3"><MonoTag>Status</MonoTag></th>
                    <th className="px-4 py-3"><MonoTag>Week</MonoTag></th>
                    <th className="px-4 py-3"><MonoTag>Title</MonoTag></th>
                    <th className="px-4 py-3"><MonoTag>Last edited</MonoTag></th>
                    <th className="px-4 py-3"><MonoTag>Posted</MonoTag></th>
                    <th className="px-4 py-3 text-right"><MonoTag>Action</MonoTag></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((n) => {
                    const variant = statusChipVariant(n.status);
                    return (
                      <tr
                        key={n.id}
                        className="border-b border-line-soft last:border-b-0 hover:bg-steel/5 border-l-2 border-l-transparent hover:border-l-steel transition-colors"
                      >
                        <td className="px-4 py-3">
                          {variant ? (
                            <StatusChip variant={variant}>{n.status}</StatusChip>
                          ) : (
                            <MonoTag>{n.status}</MonoTag>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted whitespace-nowrap">
                          {formatDate(n.week_start)} – {formatDate(n.week_end)}
                        </td>
                        <td className="px-4 py-3 text-foreground font-medium">
                          {n.title ?? <span className="text-muted italic">(untitled)</span>}
                        </td>
                        <td className="px-4 py-3 text-muted whitespace-nowrap">
                          <div>{formatTimestamp(n.updated_at)}</div>
                          {n.last_edited_by && (
                            <div className="text-xs">by {n.last_edited_by}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-muted whitespace-nowrap">
                          {n.posted_at ? (
                            <>
                              <div>{formatTimestamp(n.posted_at)}</div>
                              {n.posted_by && (
                                <div className="text-xs">by {n.posted_by}</div>
                              )}
                            </>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <Link href={`/admin/newsletter/${n.id}`}>
                            <ChamferButton
                              variant="steel"
                              size="sm"
                              arrow={false}
                            >
                              {n.status === 'posted' ? 'View' : 'Edit'}
                            </ChamferButton>
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile card list */}
          <div className="md:hidden space-y-3">
            {filtered.map((n) => {
              const variant = statusChipVariant(n.status);
              return (
                <Link
                  key={n.id}
                  href={`/admin/newsletter/${n.id}`}
                  className="block border border-line-soft p-4 hover:border-ink transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    {variant ? (
                      <StatusChip variant={variant}>{n.status}</StatusChip>
                    ) : (
                      <MonoTag>{n.status}</MonoTag>
                    )}
                    <span className="text-xs text-muted">
                      {formatDate(n.week_start)} – {formatDate(n.week_end)}
                    </span>
                  </div>
                  <p className="font-medium text-foreground">
                    {n.title ?? <span className="text-muted italic">(untitled)</span>}
                  </p>
                  <p className="text-xs text-muted mt-2">
                    Updated {formatTimestamp(n.updated_at)}
                    {n.last_edited_by ? ` by ${n.last_edited_by}` : ''}
                  </p>
                  {n.posted_at && (
                    <p className="text-xs text-muted">
                      Posted {formatTimestamp(n.posted_at)}
                      {n.posted_by ? ` by ${n.posted_by}` : ''}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </>
      )}

      {showModal && (
        <NewNewsletterModal
          onClose={() => setShowModal(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  );
}
