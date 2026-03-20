import Link from 'next/link';
import { Hero } from '@/components/ui/Hero';
import { Section } from '@/components/ui/Section';
import { getBackblastsPaginated, getAOList, createExcerpt } from '@/lib/backblast/getBackblastsPaginated';
import { ChevronLeft, ChevronRight, Calendar, Users, User } from 'lucide-react';
import { BackblastFilters } from './BackblastFilters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface BackblastsPageProps {
    searchParams: Promise<{
        page?: string;
        pageSize?: string;
        ao?: string;
        q?: string;
    }>;
}

export default async function BackblastsPage({ searchParams }: BackblastsPageProps) {
    const params = await searchParams;

    const page = Math.max(1, parseInt(params.page || '1', 10) || 1);
    const pageSize = [50, 100, 200].includes(parseInt(params.pageSize || '50', 10))
        ? parseInt(params.pageSize || '50', 10)
        : 50;
    const aoFilter = params.ao || '';
    const searchQuery = params.q || '';

    const [result, aoList] = await Promise.all([
        getBackblastsPaginated({
            page,
            pageSize,
            ao: aoFilter || undefined,
            search: searchQuery || undefined,
            eventKind: 'backblast',  // Explicitly filter to backblasts only
        }),
        getAOList(),
    ]);

    const { rows: events, total, totalPages } = result;
    const startRow = (page - 1) * pageSize + 1;
    const endRow = Math.min(page * pageSize, total);

    // Build URL for pagination/filtering
    const buildUrl = (updates: Record<string, string | number | undefined>) => {
        const newParams = new URLSearchParams();

        const currentParams = {
            page: updates.page !== undefined ? updates.page : page,
            pageSize: updates.pageSize !== undefined ? updates.pageSize : pageSize,
            ao: updates.ao !== undefined ? updates.ao : aoFilter,
            q: updates.q !== undefined ? updates.q : searchQuery,
        };

        if (currentParams.page && currentParams.page !== 1) {
            newParams.set('page', String(currentParams.page));
        }
        if (currentParams.pageSize && currentParams.pageSize !== 50) {
            newParams.set('pageSize', String(currentParams.pageSize));
        }
        if (currentParams.ao) {
            newParams.set('ao', String(currentParams.ao));
        }
        if (currentParams.q) {
            newParams.set('q', String(currentParams.q));
        }

        const qs = newParams.toString();
        return `/backblasts${qs ? `?${qs}` : ''}`;
    };

    // Format date helper - handles Date objects (Neon) and strings
    const formatDate = (dateVal: string | Date | null) => {
        if (!dateVal) return null;
        const date = dateVal instanceof Date
            ? dateVal
            : typeof dateVal === 'string' && dateVal.includes('T')
                ? new Date(dateVal)
                : new Date(dateVal + 'T00:00:00');
        return date.toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    // Extract user-input title from backblast content (e.g., "Backblast! Isometric + Ladder 2.0" → "Isometric + Ladder 2.0")
    const extractUserTitle = (contentText: string | null): string | null => {
        if (!contentText) return null;
        const firstLine = contentText.split('\n')[0] || '';
        // Match "Backblast! Title" or "Backblast: Title" patterns
        const match = firstLine.match(/^(?:backblast)[!:]?\s*(.+)?$/i);
        if (match && match[1]) {
            return match[1].trim();
        }
        return null;
    };

    return (
        <div className="flex flex-col min-h-screen">
            <Hero
                title="BACKBLASTS"
                subtitle="Workout recaps from our AOs. See what you missed—or relive the pain."
                backgroundImage="/images/workouts-bg.jpg"
            />

            <Section>
                <div className="max-w-6xl mx-auto">
                    {/* Controls Row */}
                    <div className="mb-8 flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                        {/* Filters */}
                        <BackblastFilters
                            aoList={aoList}
                            aoFilter={aoFilter}
                            searchQuery={searchQuery}
                        />

                        {/* Page Size */}
                        <div className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground">Show:</span>
                            {[50, 100, 200].map((size) => (
                                <Link
                                    key={size}
                                    href={buildUrl({ pageSize: size, page: 1 })}
                                    className={`px-3 py-1.5 rounded-md font-medium ${pageSize === size
                                        ? 'bg-primary text-primary-foreground'
                                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                                        } transition-colors`}
                                >
                                    {size}
                                </Link>
                            ))}
                        </div>
                    </div>

                    {/* Results count */}
                    <p className="text-sm text-muted-foreground mb-6">
                        {total === 0 ? (
                            'No events found'
                        ) : (
                            <>
                                Showing {startRow}–{endRow} of {total} event{total !== 1 ? 's' : ''}
                                {aoFilter && ` in ${aoFilter}`}
                                {searchQuery && ` matching "${searchQuery}"`}
                            </>
                        )}
                    </p>

                    {/* Events List */}
                    {events.length === 0 ? (
                        <div className="text-center py-20 bg-card rounded-xl border border-border">
                            <p className="text-lg text-muted-foreground">No events found.</p>
                            <p className="text-sm text-muted-foreground mt-2">
                                Check back after workouts are posted in Slack!
                            </p>
                        </div>
                    ) : (
                        <>
                            {/* Event Cards Grid */}
                            <div className="grid gap-4">
                                {events.map((event) => {
                                    // Use event_date if available, otherwise fall back to created_at
                                    const formattedDate = formatDate(event.event_date || event.created_at);
                                    const isPreblast = event.event_kind === 'preblast';

                                    return (
                                        <Link
                                            key={event.id}
                                            href={`/backblasts/${event.id}`}
                                            className="group block bg-card border border-border rounded-xl p-5 hover:border-primary/50 hover:shadow-lg hover:shadow-primary/5 transition-all duration-200"
                                        >
                                            {/* Header Row */}
                                            <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                                                {/* Left: AO + Event Type Badge */}
                                                <div className="flex items-center gap-3">
                                                    <span className="text-lg font-semibold text-primary group-hover:text-primary/80 transition-colors">
                                                        {event.ao_display_name || 'Unknown AO'}
                                                    </span>
                                                    <span className={`
                                                        inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium
                                                        ${isPreblast
                                                            ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                                            : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                                                        }
                                                    `}>
                                                        {isPreblast ? 'Preblast' : 'Backblast'}
                                                    </span>
                                                </div>

                                                {/* Right: Date */}
                                                {formattedDate && (
                                                    <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
                                                        <Calendar className="h-4 w-4" />
                                                        <span>{formattedDate}</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Title - prefer user-input title from content over stored title */}
                                            {(() => {
                                                const userTitle = extractUserTitle(event.content_text);
                                                const displayTitle = userTitle || event.title;
                                                return displayTitle ? (
                                                    <h3 className="text-base font-medium text-foreground mb-3 line-clamp-1">
                                                        {displayTitle}
                                                    </h3>
                                                ) : null;
                                            })()}

                                            {/* Meta Row: Q + PAX */}
                                            <div className="flex flex-wrap gap-4 mb-4">
                                                {event.q_name && (
                                                    <div className="flex items-center gap-1.5 text-sm">
                                                        <User className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-foreground font-medium">{event.q_name}</span>
                                                        <span className="text-muted-foreground">(Q)</span>
                                                    </div>
                                                )}
                                                {event.pax_count !== null && event.pax_count > 0 && (
                                                    <div className="flex items-center gap-1.5 text-sm">
                                                        <Users className="h-4 w-4 text-muted-foreground" />
                                                        <span className="text-foreground font-medium">{event.pax_count}</span>
                                                        <span className="text-muted-foreground">PAX</span>
                                                    </div>
                                                )}
                                            </div>

                                            {/* Excerpt */}
                                            <p className="text-sm text-muted-foreground line-clamp-2 leading-relaxed">
                                                {createExcerpt(event.content_text, 180)}
                                            </p>

                                            {/* Hover indicator */}
                                            <div className="mt-4 flex items-center gap-1 text-xs text-primary/70 opacity-0 group-hover:opacity-100 transition-opacity">
                                                <span>View details</span>
                                                <ChevronRight className="h-3 w-3" />
                                            </div>
                                        </Link>
                                    );
                                })}
                            </div>
                        </>
                    )}

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="mt-8 flex items-center justify-between border-t border-border pt-6">
                            <div className="text-sm text-muted-foreground">
                                Page {page} of {totalPages}
                            </div>
                            <div className="flex gap-2">
                                {page > 1 ? (
                                    <Link
                                        href={buildUrl({ page: page - 1 })}
                                        className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-card border border-border rounded-lg hover:bg-muted transition-colors"
                                    >
                                        <ChevronLeft className="h-4 w-4" />
                                        Previous
                                    </Link>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-card border border-border rounded-lg text-muted-foreground cursor-not-allowed opacity-50">
                                        <ChevronLeft className="h-4 w-4" />
                                        Previous
                                    </span>
                                )}
                                {page < totalPages ? (
                                    <Link
                                        href={buildUrl({ page: page + 1 })}
                                        className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-card border border-border rounded-lg hover:bg-muted transition-colors"
                                    >
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </Link>
                                ) : (
                                    <span className="inline-flex items-center gap-1 px-4 py-2 text-sm bg-card border border-border rounded-lg text-muted-foreground cursor-not-allowed opacity-50">
                                        Next
                                        <ChevronRight className="h-4 w-4" />
                                    </span>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </Section>
        </div>
    );
}
