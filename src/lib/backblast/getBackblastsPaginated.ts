import { getSql } from '@/lib/db';
import type { EventKind } from '@/types/f3Event';

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
 * Now reads from the canonical f3_events table via Neon
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

    const sql = getSql();
    const offset = (page - 1) * pageSize;
    const kind = eventKind ?? 'backblast';
    const searchPattern = search ? `%${search}%` : null;

    try {
        // Use separate queries for each filter combination to stay with tagged templates
        let countResult;
        let rows;

        if (ao && searchPattern) {
            countResult = await sql`SELECT count(*)::int AS total FROM f3_events WHERE is_deleted = false AND event_kind = ${kind} AND ao_display_name = ${ao} AND (q_name ILIKE ${searchPattern} OR ao_display_name ILIKE ${searchPattern} OR content_text ILIKE ${searchPattern} OR title ILIKE ${searchPattern})`;
            rows = await sql`SELECT id, ao_display_name, event_kind, title, event_date, q_name, pax_count, content_text, content_html, created_at FROM f3_events WHERE is_deleted = false AND event_kind = ${kind} AND ao_display_name = ${ao} AND (q_name ILIKE ${searchPattern} OR ao_display_name ILIKE ${searchPattern} OR content_text ILIKE ${searchPattern} OR title ILIKE ${searchPattern}) ORDER BY event_date DESC NULLS LAST, created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
        } else if (ao) {
            countResult = await sql`SELECT count(*)::int AS total FROM f3_events WHERE is_deleted = false AND event_kind = ${kind} AND ao_display_name = ${ao}`;
            rows = await sql`SELECT id, ao_display_name, event_kind, title, event_date, q_name, pax_count, content_text, content_html, created_at FROM f3_events WHERE is_deleted = false AND event_kind = ${kind} AND ao_display_name = ${ao} ORDER BY event_date DESC NULLS LAST, created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
        } else if (searchPattern) {
            countResult = await sql`SELECT count(*)::int AS total FROM f3_events WHERE is_deleted = false AND event_kind = ${kind} AND (q_name ILIKE ${searchPattern} OR ao_display_name ILIKE ${searchPattern} OR content_text ILIKE ${searchPattern} OR title ILIKE ${searchPattern})`;
            rows = await sql`SELECT id, ao_display_name, event_kind, title, event_date, q_name, pax_count, content_text, content_html, created_at FROM f3_events WHERE is_deleted = false AND event_kind = ${kind} AND (q_name ILIKE ${searchPattern} OR ao_display_name ILIKE ${searchPattern} OR content_text ILIKE ${searchPattern} OR title ILIKE ${searchPattern}) ORDER BY event_date DESC NULLS LAST, created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
        } else {
            countResult = await sql`SELECT count(*)::int AS total FROM f3_events WHERE is_deleted = false AND event_kind = ${kind}`;
            rows = await sql`SELECT id, ao_display_name, event_kind, title, event_date, q_name, pax_count, content_text, content_html, created_at FROM f3_events WHERE is_deleted = false AND event_kind = ${kind} ORDER BY event_date DESC NULLS LAST, created_at DESC LIMIT ${pageSize} OFFSET ${offset}`;
        }

        const total: number = countResult[0]?.total ?? 0;
        const totalPages = Math.ceil(total / pageSize);

        return {
            rows: rows as F3EventRow[],
            total,
            page,
            pageSize,
            totalPages,
        };
    } catch (error) {
        console.error('Error fetching f3_events:', error);
        return {
            rows: [],
            total: 0,
            page,
            pageSize,
            totalPages: 0,
        };
    }
}

/**
 * Get list of unique AO names for filter dropdown
 */
export async function getAOList(): Promise<string[]> {
    const sql = getSql();

    try {
        const rows = await sql`SELECT DISTINCT ao_display_name FROM f3_events WHERE is_deleted = false AND ao_display_name IS NOT NULL ORDER BY ao_display_name`;
        return rows.map((r) => r.ao_display_name as string);
    } catch (error) {
        console.error('Error fetching AO list:', error);
        return [];
    }
}

/**
 * Create a short excerpt from content text
 */
export function createExcerpt(text: string | null, maxLength: number = 100): string {
    if (!text) return '';

    const cleaned = text
        .replace(/<@[A-Z0-9]+>/g, '')
        .replace(/@U[A-Z0-9]{8,}/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    if (cleaned.length <= maxLength) {
        return cleaned;
    }

    const truncated = cleaned.slice(0, maxLength);
    const lastSpace = truncated.lastIndexOf(' ');

    if (lastSpace > maxLength * 0.7) {
        return truncated.slice(0, lastSpace) + '...';
    }

    return truncated + '...';
}
