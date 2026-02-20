import { supabase } from '@/lib/supabase';
import { escapePostgrestFilter } from '@/lib/security/sanitize';
import type { F3Event, EventKind } from '@/types/f3Event';

export interface F3EventRow {
    id: string;
    ao_display_name: string | null;
    event_kind: EventKind;
    title: string | null;
    event_date: string | null;
    q_name: string | null;
    pax_count: number | null;
    content_text: string | null;
    content_html: string | null;
    created_at: string;
}

export interface PaginatedBackblastsResult {
    rows: F3EventRow[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}

export interface GetBackblastsOptions {
    page?: number;
    pageSize?: number;
    ao?: string;
    search?: string;
    eventKind?: EventKind;
}

/**
 * Fetch F3 events with server-side pagination
 * Now reads from the canonical f3_events table
 */
export async function getBackblastsPaginated(
    options: GetBackblastsOptions = {}
): Promise<PaginatedBackblastsResult> {
    const {
        page = 1,
        pageSize = 50,
        ao,
        search,
        eventKind,
    } = options;

    // Calculate offset for pagination
    const offset = (page - 1) * pageSize;

    // Build the base query - now using f3_events table
    let query = supabase
        .from('f3_events')
        .select('id, ao_display_name, event_kind, title, event_date, q_name, pax_count, content_text, content_html, created_at', { count: 'exact' })
        .eq('is_deleted', false)
        .order('event_date', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

    // Filter to backblasts only by default
    // Use explicit eventKind to override (e.g., 'preblast' or pass null to show all)
    query = query.eq('event_kind', eventKind ?? 'backblast');

    // Apply AO filter
    if (ao) {
        query = query.eq('ao_display_name', ao);
    }

    // Apply search filter across multiple columns
    if (search) {
        const safe = escapePostgrestFilter(search);
        query = query.or(
            `q_name.ilike.%${safe}%,ao_display_name.ilike.%${safe}%,content_text.ilike.%${safe}%,title.ilike.%${safe}%`
        );
    }

    // Apply pagination
    query = query.range(offset, offset + pageSize - 1);

    const { data, error, count } = await query;

    if (error) {
        console.error('Error fetching f3_events:', error);
        return {
            rows: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
        };
    }

    const total = count || 0;
    const totalPages = Math.ceil(total / pageSize);

    return {
        rows: (data || []) as F3EventRow[],
        total,
        page,
        pageSize,
        totalPages,
    };
}

/**
 * Get list of unique AO names for filter dropdown
 */
export async function getAOList(): Promise<string[]> {
    const { data, error } = await supabase
        .from('f3_events')
        .select('ao_display_name')
        .eq('is_deleted', false)
        .not('ao_display_name', 'is', null);

    if (error || !data) {
        return [];
    }

    // Get unique AO names, sorted alphabetically
    const uniqueAOs = [...new Set(data.map((d) => d.ao_display_name).filter(Boolean))] as string[];
    return uniqueAOs.sort();
}

/**
 * Create a short excerpt from content text
 */
export function createExcerpt(text: string | null, maxLength: number = 100): string {
    if (!text) return '';

    // Clean up the text:
    // 1. Remove Slack user mentions like @U0A58BDPZSS or <@U0A58BDPZSS>
    // 2. Remove extra whitespace and normalize
    const cleaned = text
        .replace(/<@[A-Z0-9]+>/g, '')  // Remove <@UXXXXX> mentions
        .replace(/@U[A-Z0-9]{8,}/g, '')  // Remove @UXXXXX mentions
        .replace(/\s+/g, ' ')
        .trim();

    if (cleaned.length <= maxLength) {
        return cleaned;
    }

    // Truncate at word boundary
    const truncated = cleaned.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.7) {
        return truncated.slice(0, lastSpace) + '…';
    }

    return truncated + '…';
}
