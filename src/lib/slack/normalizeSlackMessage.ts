/**
 * Slack Message Normalizer
 * Parses and normalizes Slack event payloads into canonical F3 event format
 */

import type { NormalizedEvent, EventKind, SlackEventMetadata } from '@/types/f3Event';
import { resolveSlackUserName } from './lookupSlackUser';
import { renderSlackBlocksToHtml } from './renderSlackBlocksToHtml';

/**
 * Normalize a Slack event payload into canonical F3 event format
 * 
 * Handles both event shapes:
 * 1. Direct message: payload.event.* contains the message
 * 2. message_changed: payload.event.message.* contains the message
 */
export async function normalizeSlackMessage(
    rawPayload: string,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _aoDisplayName: string
): Promise<NormalizedEvent> {
    const envelope = JSON.parse(rawPayload) as Record<string, unknown>;
    const event = envelope.event as Record<string, unknown>;

    if (!event) {
        throw new Error('No event object in payload');
    }

    // Detect message location
    // If event.message exists (message_changed subtype), use event.message
    // Otherwise use event directly
    const subtype = event.subtype as string | undefined;
    const hasMessageObject = subtype === 'message_changed' && event.message;

    const message = hasMessageObject
        ? (event.message as Record<string, unknown>)
        : event;

    // Extract core identifiers
    const slack_channel_id = (event.channel as string) || '';
    const slack_message_ts = (message.ts as string) || (event.ts as string) || '';

    // Extract blocks
    const blocks = (message.blocks as unknown[]) || [];

    // Extract metadata
    const metadata = message.metadata as SlackEventMetadata | undefined;
    const eventType = metadata?.event_type || '';
    const eventPayload = metadata?.event_payload || {};

    // Determine event kind
    const event_kind = determineEventKind(eventType, message);

    // Extract structured fields from event_payload
    const title = extractTitle(eventPayload, message);
    const { event_date, event_time } = extractDateTime(eventPayload);
    const location_text = extractLocation(eventPayload);

    // Extract Q information
    const q_slack_user_id = extractQSlackUserId(eventPayload, event_kind);
    const q_name = q_slack_user_id
        ? await resolveSlackUserName(q_slack_user_id)
        : null;

    // Extract PAX count
    const pax_count = extractPaxCount(eventPayload, event_kind);

    // Render HTML content
    const userLookup = async (userId: string) => resolveSlackUserName(userId);
    const { html: content_html, text: content_text } = blocks.length > 0
        ? await renderSlackBlocksToHtml(blocks, userLookup)
        : { html: '', text: (message.text as string) || '' };

    // Extract child arrays
    const attendees = extractAttendees(eventPayload, event_kind);
    const qs = extractQs(eventPayload, event_kind, q_slack_user_id);
    const normalizedBlocks = normalizeBlocks(blocks);

    // Build normalized message object (for content_json)
    const content_json: Record<string, unknown> = {
        text: message.text,
        blocks: blocks,
        metadata: metadata,
    };

    return {
        slack_channel_id,
        slack_message_ts,
        event_kind,
        title: title || undefined,
        event_date: event_date || undefined,
        event_time: event_time || undefined,
        location_text: location_text || undefined,
        q_slack_user_id: q_slack_user_id || undefined,
        q_name: q_name || undefined,
        pax_count: pax_count || undefined,
        content_text: content_text || undefined,
        content_html: content_html || undefined,
        content_json,
        raw_envelope_json: envelope,
        attendees,
        qs,
        blocks: normalizedBlocks,
    };
}

/**
 * Determine event kind from metadata or message content
 */
function determineEventKind(eventType: string, message: Record<string, unknown>): EventKind {
    const lowerType = eventType.toLowerCase();

    if (lowerType === 'backblast' || lowerType.includes('backblast')) {
        return 'backblast';
    }

    if (lowerType === 'preblast' || lowerType.includes('preblast')) {
        return 'preblast';
    }

    // Fallback: check message text
    const text = (message.text as string) || '';
    const lowerText = text.toLowerCase();

    if (lowerText.startsWith('backblast')) {
        return 'backblast';
    }

    if (lowerText.startsWith('preblast')) {
        return 'preblast';
    }

    return 'unknown';
}

/**
 * Extract title from event payload or message
 */
function extractTitle(
    eventPayload: Record<string, unknown>,
    message: Record<string, unknown>
): string | null {
    // Try event_payload.title first
    if (eventPayload.title && typeof eventPayload.title === 'string') {
        return eventPayload.title;
    }

    // Fallback: parse from message text
    const text = (message.text as string) || '';
    const firstLine = text.split('\n')[0] || '';

    // Match "Backblast! Title" or "Preblast: Title" patterns
    const match = firstLine.match(/^(?:backblast|preblast)[!:]?\s*(.+)?$/i);
    if (match && match[1]) {
        return match[1].trim();
    }

    return null;
}

/**
 * Extract date and time from event payload
 */
function extractDateTime(
    eventPayload: Record<string, unknown>
): { event_date: string | null; event_time: string | null } {
    let event_date: string | null = null;
    let event_time: string | null = null;

    // Try event_payload.date
    if (eventPayload.date) {
        const dateStr = String(eventPayload.date);
        event_date = parseDate(dateStr);
    }

    // Try start_time
    if (eventPayload.start_time) {
        event_time = String(eventPayload.start_time);

        // If start_time contains a date, extract it
        if (!event_date && event_time.includes('-')) {
            const parts = event_time.split('T');
            if (parts[0]) {
                event_date = parseDate(parts[0]);
            }
        }
    }

    return { event_date, event_time };
}

/**
 * Parse various date formats to YYYY-MM-DD
 */
function parseDate(dateStr: string): string | null {
    if (!dateStr) return null;

    // ISO format: YYYY-MM-DD
    const isoMatch = dateStr.match(/(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
        return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
    }

    // US format: MM/DD/YYYY or MM-DD-YYYY
    const usMatch = dateStr.match(/(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (usMatch) {
        const month = usMatch[1].padStart(2, '0');
        const day = usMatch[2].padStart(2, '0');
        return `${usMatch[3]}-${month}-${day}`;
    }

    // Unix timestamp (seconds)
    const timestamp = parseInt(dateStr, 10);
    if (!isNaN(timestamp) && timestamp > 1000000000) {
        const date = new Date(timestamp * 1000);
        return date.toISOString().split('T')[0];
    }

    return null;
}

/**
 * Extract location from event payload
 */
function extractLocation(eventPayload: Record<string, unknown>): string | null {
    if (eventPayload.location && typeof eventPayload.location === 'string') {
        return eventPayload.location;
    }

    if (eventPayload.ao && typeof eventPayload.ao === 'string') {
        return eventPayload.ao;
    }

    return null;
}

/**
 * Extract Q Slack user ID from event payload
 */
function extractQSlackUserId(
    eventPayload: Record<string, unknown>,
    eventKind: EventKind
): string | null {
    // Backblast: the_q contains Slack user ID
    if (eventKind === 'backblast' && eventPayload.the_q) {
        return String(eventPayload.the_q);
    }

    // Preblast: qs[] contains external IDs (not Slack IDs)
    // We can't resolve these to Slack IDs directly
    // Return null and handle separately

    return null;
}

/**
 * Extract PAX count from event payload
 */
function extractPaxCount(
    eventPayload: Record<string, unknown>,
    eventKind: EventKind
): number | null {
    // Backblast: count from the_pax array length
    if (eventKind === 'backblast' && Array.isArray(eventPayload.the_pax)) {
        return eventPayload.the_pax.length;
    }

    // Preblast: count from attendees array length
    if (eventKind === 'preblast' && Array.isArray(eventPayload.attendees)) {
        return eventPayload.attendees.length;
    }

    // Try explicit count field
    if (eventPayload.count !== undefined) {
        const count = parseInt(String(eventPayload.count), 10);
        if (!isNaN(count)) return count;
    }

    return null;
}

/**
 * Extract attendees from event payload
 */
function extractAttendees(
    eventPayload: Record<string, unknown>,
    eventKind: EventKind
): Array<{ external_id?: number; slack_user_id?: string }> {
    const attendees: Array<{ external_id?: number; slack_user_id?: string }> = [];

    // Backblast: the_pax contains Slack user IDs
    if (eventKind === 'backblast' && Array.isArray(eventPayload.the_pax)) {
        for (const pax of eventPayload.the_pax) {
            if (typeof pax === 'string') {
                attendees.push({ slack_user_id: pax });
            }
        }
    }

    // Preblast: attendees contains external IDs
    if (eventKind === 'preblast' && Array.isArray(eventPayload.attendees)) {
        for (const id of eventPayload.attendees) {
            if (typeof id === 'number') {
                attendees.push({ external_id: id });
            }
        }
    }

    return attendees;
}

/**
 * Extract Qs from event payload
 */
function extractQs(
    eventPayload: Record<string, unknown>,
    eventKind: EventKind,
    qSlackUserId: string | null
): Array<{ external_id?: number; slack_user_id?: string }> {
    const qs: Array<{ external_id?: number; slack_user_id?: string }> = [];

    // Backblast: single Q from the_q
    if (eventKind === 'backblast' && qSlackUserId) {
        qs.push({ slack_user_id: qSlackUserId });
    }

    // Preblast: qs contains external IDs
    if (eventKind === 'preblast' && Array.isArray(eventPayload.qs)) {
        for (const id of eventPayload.qs) {
            if (typeof id === 'number') {
                qs.push({ external_id: id });
            }
        }
    }

    return qs;
}

/**
 * Normalize blocks for storage
 */
function normalizeBlocks(
    blocks: unknown[]
): Array<{
    index: number;
    type?: string;
    id?: string;
    json: Record<string, unknown>;
    elements?: Array<{ index: number; type?: string; json: Record<string, unknown> }>;
}> {
    return blocks.map((block, index) => {
        const b = block as Record<string, unknown>;

        const normalizedBlock: {
            index: number;
            type?: string;
            id?: string;
            json: Record<string, unknown>;
            elements?: Array<{ index: number; type?: string; json: Record<string, unknown> }>;
        } = {
            index,
            type: b.type as string | undefined,
            id: b.block_id as string | undefined,
            json: b,
        };

        // Extract elements if present
        const elements = b.elements as unknown[] | undefined;
        if (Array.isArray(elements)) {
            normalizedBlock.elements = elements.map((el, elIndex) => {
                const e = el as Record<string, unknown>;
                return {
                    index: elIndex,
                    type: e.type as string | undefined,
                    json: e,
                };
            });
        }

        return normalizedBlock;
    });
}

/**
 * Check if a raw payload looks like a backblast
 */
export function isBackblastPayload(rawPayload: string): boolean {
    try {
        const envelope = JSON.parse(rawPayload);
        const event = envelope.event;

        if (!event) return false;

        // Check message object location
        const message = event.message || event;
        const text = (message.text as string) || '';
        const metadata = message.metadata as SlackEventMetadata | undefined;

        // Check metadata event_type
        if (metadata?.event_type?.toLowerCase() === 'backblast') {
            return true;
        }

        // Check text
        return text.toLowerCase().startsWith('backblast');
    } catch {
        return false;
    }
}

/**
 * Check if a raw payload looks like a preblast
 */
export function isPreblastPayload(rawPayload: string): boolean {
    try {
        const envelope = JSON.parse(rawPayload);
        const event = envelope.event;

        if (!event) return false;

        const message = event.message || event;
        const text = (message.text as string) || '';
        const metadata = message.metadata as SlackEventMetadata | undefined;

        if (metadata?.event_type?.toLowerCase() === 'preblast') {
            return true;
        }

        return text.toLowerCase().startsWith('preblast');
    } catch {
        return false;
    }
}
