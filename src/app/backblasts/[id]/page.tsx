import { notFound } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { sanitizeHtmlContent } from '@/lib/security/sanitize';
import { Section } from '@/components/ui/Section';
import type { F3Event } from '@/types/f3Event';
import { ArrowLeft, ExternalLink, Calendar, User, Users, MapPin } from 'lucide-react';

interface BackblastDetailPageProps {
    params: Promise<{ id: string }>;
}

async function getF3Event(id: string): Promise<F3Event | null> {
    const { data, error } = await supabase
        .from('f3_events')
        .select('*')
        .eq('id', id)
        .eq('is_deleted', false)
        .single();

    if (error || !data) {
        return null;
    }

    return data as F3Event;
}

export async function generateMetadata({ params }: BackblastDetailPageProps) {
    const { id } = await params;
    const event = await getF3Event(id);

    if (!event) {
        return { title: 'Event Not Found' };
    }

    const eventType = event.event_kind === 'preblast' ? 'Preblast' : 'Backblast';
    const title = event.ao_display_name
        ? `${event.ao_display_name} ${eventType}`
        : eventType;

    return {
        title: `${title} | F3 Marietta`,
        description: event.content_text?.slice(0, 160),
    };
}

export default async function BackblastDetailPage({ params }: BackblastDetailPageProps) {
    const { id } = await params;
    const event = await getF3Event(id);

    if (!event) {
        notFound();
    }

    const isPreblast = event.event_kind === 'preblast';
    const eventType = isPreblast ? 'Preblast' : 'Backblast';

    const formattedDate = event.event_date
        ? new Date(event.event_date + 'T00:00:00').toLocaleDateString('en-US', {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
            year: 'numeric',
        })
        : null;

    return (
        <div className="flex flex-col min-h-screen">
            {/* Header */}
            <div className="bg-gradient-to-b from-muted/60 to-background border-b border-border py-10">
                <div className="container mx-auto px-4 max-w-4xl">
                    {/* Back Link */}
                    <Link
                        href="/backblasts"
                        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors mb-6"
                    >
                        <ArrowLeft className="h-4 w-4" />
                        Back to Events
                    </Link>

                    {/* Metadata Badges */}
                    <div className="flex flex-wrap gap-3 mb-4">
                        {/* Event Type Badge */}
                        <span className={`
                            inline-flex items-center px-3 py-1 rounded-full text-sm font-medium
                            ${isPreblast
                                ? 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                                : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                            }
                        `}>
                            {eventType}
                        </span>

                        {/* AO Badge */}
                        {event.ao_display_name && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                                <MapPin className="h-3.5 w-3.5" />
                                {event.ao_display_name}
                            </span>
                        )}

                        {/* Date Badge */}
                        {formattedDate && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-muted text-muted-foreground text-sm">
                                <Calendar className="h-3.5 w-3.5" />
                                {formattedDate}
                            </span>
                        )}
                    </div>

                    {/* Title */}
                    <h1 className="text-3xl md:text-4xl font-bold font-heading text-foreground mb-4">
                        {event.title || eventType}
                    </h1>

                    {/* Quick Stats */}
                    <div className="flex flex-wrap gap-6 text-sm">
                        {event.q_name && (
                            <div className="flex items-center gap-2">
                                <User className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">Q:</span>
                                <span className="text-foreground font-medium">
                                    {event.q_name}
                                </span>
                            </div>
                        )}
                        {event.pax_count !== null && event.pax_count > 0 && (
                            <div className="flex items-center gap-2">
                                <Users className="h-4 w-4 text-muted-foreground" />
                                <span className="text-muted-foreground">PAX:</span>
                                <span className="text-foreground font-medium">
                                    {event.pax_count}
                                </span>
                            </div>
                        )}
                        {event.event_time && (
                            <div className="flex items-center gap-2">
                                <span className="text-muted-foreground">Time:</span>
                                <span className="text-foreground font-medium">
                                    {event.event_time}
                                </span>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Content */}
            <Section>
                <div className="max-w-4xl mx-auto">
                    {/* Workout Content */}
                    <article className="backblast-content max-w-none">
                        {/* Render HTML content if available */}
                        {event.content_html ? (
                            <div
                                className="text-foreground text-base"
                                dangerouslySetInnerHTML={{ __html: sanitizeHtmlContent(event.content_html) }}
                            />
                        ) : (
                            <div
                                className="text-foreground text-base whitespace-pre-line"
                                style={{ fontFamily: 'var(--font-sans)' }}
                            >
                                {event.content_text}
                            </div>
                        )}
                    </article>

                    {/* Slack Permalink */}
                    {event.slack_permalink && (
                        <div className="mt-10 pt-6 border-t border-border">
                            <a
                                href={event.slack_permalink}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-primary transition-colors"
                            >
                                <ExternalLink className="h-4 w-4" />
                                View original in Slack
                            </a>
                        </div>
                    )}
                </div>
            </Section>
        </div>
    );
}
