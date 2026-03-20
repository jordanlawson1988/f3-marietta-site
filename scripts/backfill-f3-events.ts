#!/usr/bin/env npx tsx
/**
 * Backfill F3 Events Script
 * 
 * Migrates existing backblasts table data to the new canonical f3_events table.
 * This script is safe to run multiple times (idempotent).
 * 
 * Usage: npx tsx scripts/backfill-f3-events.ts
 * 
 * Options:
 *   --dry-run     Show what would be migrated without making changes
 *   --limit=N     Process only N records (for testing)
 */

import { config } from 'dotenv';
import { neon } from '@neondatabase/serverless';
import { createClient } from '@supabase/supabase-js';

// Load environment variables from .env.local
config({ path: '.env.local' });

// We still need Supabase client to READ from the old backblasts table
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}
if (!databaseUrl) {
    console.error('Error: Missing DATABASE_URL');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const sql = neon(databaseUrl);

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

interface BackblastRow {
    id: string;
    slack_channel_id: string;
    slack_message_ts: string;
    slack_permalink: string | null;
    ao_display_name: string | null;
    title: string | null;
    backblast_date: string | null;
    q_name: string | null;
    pax_text: string | null;
    fng_text: string | null;
    pax_count: number | null;
    content_text: string;
    content_json: Record<string, unknown> | null;
    last_slack_edit_ts: string | null;
    is_deleted: boolean;
    created_at: string;
    updated_at: string;
}

interface Stats {
    total: number;
    processed: number;
    skipped: number;
    errors: number;
    created: number;
    updated: number;
}

async function main() {
    console.log('===========================================');
    console.log('F3 Events Backfill Script');
    console.log('===========================================');
    console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
    if (limit) console.log(`Limit: ${limit} records`);
    console.log('');

    const stats: Stats = {
        total: 0,
        processed: 0,
        skipped: 0,
        errors: 0,
        created: 0,
        updated: 0,
    };

    try {
        // Fetch backblasts with content_json
        console.log('Fetching backblasts...');

        let query = supabase
            .from('backblasts')
            .select('*')
            .not('content_json', 'is', null)
            .order('created_at', { ascending: true });

        if (limit) {
            query = query.limit(limit);
        }

        const { data: backblasts, error } = await query;

        if (error) {
            console.error('Error fetching backblasts:', error);
            process.exit(1);
        }

        if (!backblasts || backblasts.length === 0) {
            console.log('No backblasts found to migrate.');
            return;
        }

        stats.total = backblasts.length;
        console.log(`Found ${stats.total} backblasts to process.\n`);

        // Process each backblast
        for (const row of backblasts as BackblastRow[]) {
            try {
                const result = await processBackblast(row, isDryRun);
                stats.processed++;

                if (result === 'created') stats.created++;
                else if (result === 'updated') stats.updated++;
                else if (result === 'skipped') stats.skipped++;

                // Progress update every 10 records
                if (stats.processed % 10 === 0) {
                    console.log(`Progress: ${stats.processed}/${stats.total}`);
                }
            } catch (err) {
                stats.errors++;
                console.error(`Error processing ${row.id}:`, err);
            }
        }

        // Final summary
        console.log('\n===========================================');
        console.log('SUMMARY');
        console.log('===========================================');
        console.log(`Total:     ${stats.total}`);
        console.log(`Processed: ${stats.processed}`);
        console.log(`Created:   ${stats.created}`);
        console.log(`Updated:   ${stats.updated}`);
        console.log(`Skipped:   ${stats.skipped}`);
        console.log(`Errors:    ${stats.errors}`);

        if (isDryRun) {
            console.log('\n⚠️  DRY RUN - No changes were made.');
        } else {
            console.log('\n✅ Migration complete!');
        }

    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

async function processBackblast(
    row: BackblastRow,
    dryRun: boolean
): Promise<'created' | 'updated' | 'skipped'> {
    const envelope = row.content_json;

    if (!envelope) {
        return 'skipped';
    }

    // Extract event data from stored envelope
    const event = (envelope as Record<string, unknown>).event as Record<string, unknown> | undefined;
    const message = event?.message || event;

    if (!message) {
        console.log(`  Skipping ${row.id}: No event data`);
        return 'skipped';
    }

    // Determine event kind from stored data
    let eventKind = 'backblast';
    const metadata = (message as Record<string, unknown>).metadata as Record<string, unknown> | undefined;
    const eventType = metadata?.event_type as string | undefined;

    if (eventType?.toLowerCase() === 'preblast') {
        eventKind = 'preblast';
    }

    // Extract Q Slack user ID if available
    const eventPayload = metadata?.event_payload as Record<string, unknown> | undefined;
    const qSlackUserId = eventPayload?.the_q as string | undefined;

    // Render HTML from blocks if available
    const blocks = (message as Record<string, unknown>).blocks as unknown[] | undefined;
    let contentHtml: string | null = null;

    if (blocks && blocks.length > 0) {
        // Basic HTML rendering (simplified for backfill)
        contentHtml = await renderBlocksSimple(blocks);
    }

    // Build f3_event record
    const f3Event = {
        slack_channel_id: row.slack_channel_id,
        slack_message_ts: row.slack_message_ts,
        slack_permalink: row.slack_permalink,
        ao_display_name: row.ao_display_name,
        event_kind: eventKind,
        title: row.title,
        event_date: row.backblast_date,
        event_time: null,
        location_text: null,
        q_slack_user_id: qSlackUserId || null,
        q_name: row.q_name,
        pax_count: row.pax_count,
        content_text: row.content_text,
        content_html: contentHtml,
        content_json: {
            text: (message as Record<string, unknown>).text,
            blocks: blocks,
            metadata: metadata,
        },
        raw_envelope_json: envelope,
        last_slack_edit_ts: row.last_slack_edit_ts,
        is_deleted: row.is_deleted,
        created_at: row.created_at,
        updated_at: row.updated_at,
    };

    console.log(`  Processing: ${row.id} → ${eventKind} (${row.backblast_date || 'no date'})`);

    if (dryRun) {
        return 'created';
    }

    // Check if already exists
    const existing = await sql`SELECT id FROM f3_events WHERE slack_channel_id = ${row.slack_channel_id} AND slack_message_ts = ${row.slack_message_ts}`;

    // Upsert to f3_events
    const result = await sql`
        INSERT INTO f3_events (
            slack_channel_id, slack_message_ts, slack_permalink,
            ao_display_name, event_kind, title, event_date, event_time,
            location_text, q_slack_user_id, q_name, pax_count,
            content_text, content_html, content_json, raw_envelope_json,
            last_slack_edit_ts, is_deleted, created_at, updated_at
        ) VALUES (
            ${f3Event.slack_channel_id}, ${f3Event.slack_message_ts}, ${f3Event.slack_permalink},
            ${f3Event.ao_display_name}, ${f3Event.event_kind}, ${f3Event.title}, ${f3Event.event_date}, ${f3Event.event_time},
            ${f3Event.location_text}, ${f3Event.q_slack_user_id}, ${f3Event.q_name}, ${f3Event.pax_count},
            ${f3Event.content_text}, ${f3Event.content_html}, ${JSON.stringify(f3Event.content_json)}, ${JSON.stringify(f3Event.raw_envelope_json)},
            ${f3Event.last_slack_edit_ts}, ${f3Event.is_deleted}, ${f3Event.created_at}, ${f3Event.updated_at}
        )
        ON CONFLICT (slack_channel_id, slack_message_ts) DO UPDATE SET
            slack_permalink = EXCLUDED.slack_permalink,
            ao_display_name = EXCLUDED.ao_display_name,
            event_kind = EXCLUDED.event_kind,
            title = EXCLUDED.title,
            event_date = EXCLUDED.event_date,
            event_time = EXCLUDED.event_time,
            location_text = EXCLUDED.location_text,
            q_slack_user_id = EXCLUDED.q_slack_user_id,
            q_name = EXCLUDED.q_name,
            pax_count = EXCLUDED.pax_count,
            content_text = EXCLUDED.content_text,
            content_html = EXCLUDED.content_html,
            content_json = EXCLUDED.content_json,
            raw_envelope_json = EXCLUDED.raw_envelope_json,
            last_slack_edit_ts = EXCLUDED.last_slack_edit_ts,
            is_deleted = EXCLUDED.is_deleted,
            updated_at = EXCLUDED.updated_at
        RETURNING id
    `;

    if (!result || result.length === 0) {
        throw new Error('Upsert failed: no row returned');
    }

    const insertedId = (result[0] as Record<string, unknown>).id as string;

    // Handle child records if we have event data
    if (insertedId && eventPayload) {
        await upsertChildRecords(insertedId, eventKind, eventPayload, blocks || []);
    }

    return existing.length > 0 ? 'updated' : 'created';
}

async function upsertChildRecords(
    eventId: string,
    eventKind: string,
    eventPayload: Record<string, unknown>,
    blocks: unknown[]
) {
    // Delete existing child records
    await Promise.all([
        sql`DELETE FROM f3_event_attendees WHERE event_id = ${eventId}`,
        sql`DELETE FROM f3_event_qs WHERE event_id = ${eventId}`,
        sql`DELETE FROM slack_message_blocks WHERE event_id = ${eventId}`,
    ]);

    // Insert attendees
    if (eventKind === 'backblast' && Array.isArray(eventPayload.the_pax)) {
        const attendees = eventPayload.the_pax
            .filter((p): p is string => typeof p === 'string');

        for (const slackUserId of attendees) {
            await sql`INSERT INTO f3_event_attendees (event_id, attendee_slack_user_id, attendee_external_id)
                VALUES (${eventId}, ${slackUserId}, ${null})`;
        }
    }

    // Insert Qs
    if (eventKind === 'backblast' && eventPayload.the_q) {
        await sql`INSERT INTO f3_event_qs (event_id, q_slack_user_id, q_external_id)
            VALUES (${eventId}, ${String(eventPayload.the_q)}, ${null})`;
    }

    // Insert blocks (simplified - just store the raw JSON)
    if (blocks.length > 0) {
        for (let index = 0; index < blocks.length; index++) {
            const b = blocks[index] as Record<string, unknown>;
            const type = b.type as string || null;
            const blockId = b.block_id as string || null;
            await sql`INSERT INTO slack_message_blocks (event_id, block_index, block_type, block_id, block_json)
                VALUES (${eventId}, ${index}, ${type}, ${blockId}, ${JSON.stringify(b)})`;
        }
    }
}

async function renderBlocksSimple(blocks: unknown[]): Promise<string> {
    const htmlParts: string[] = [];

    for (const block of blocks) {
        const b = block as Record<string, unknown>;
        const blockType = b.type as string;

        switch (blockType) {
            case 'section': {
                const textObj = b.text as Record<string, unknown> | undefined;
                if (textObj?.text) {
                    const text = escapeHtml(String(textObj.text));
                    htmlParts.push(`<p>${convertMrkdwnSimple(text)}</p>`);
                }
                break;
            }

            case 'rich_text': {
                const elements = b.elements as unknown[] | undefined;
                if (elements) {
                    for (const el of elements) {
                        const e = el as Record<string, unknown>;
                        if (e.type === 'rich_text_section') {
                            const sectionText = extractRichTextContent(e);
                            if (sectionText) {
                                htmlParts.push(`<p>${sectionText}</p>`);
                            }
                        }
                    }
                }
                break;
            }

            case 'divider':
                htmlParts.push('<hr>');
                break;

            case 'header': {
                const text = (b.text as Record<string, unknown>)?.text;
                if (text) {
                    htmlParts.push(`<h2>${escapeHtml(String(text))}</h2>`);
                }
                break;
            }
        }
    }

    return htmlParts.join('\n');
}

function extractRichTextContent(section: Record<string, unknown>): string {
    const elements = section.elements as unknown[] | undefined;
    if (!elements) return '';

    return elements.map(el => {
        const e = el as Record<string, unknown>;
        if (e.type === 'text') {
            let text = escapeHtml(String(e.text || ''));
            const style = e.style as Record<string, boolean> | undefined;
            if (style?.bold) text = `<strong>${text}</strong>`;
            if (style?.italic) text = `<em>${text}</em>`;
            return text;
        }
        if (e.type === 'user') {
            return `<span class="mention">@${e.user_id}</span>`;
        }
        if (e.type === 'link') {
            return `<a href="${escapeHtml(String(e.url))}">${escapeHtml(String(e.text || e.url))}</a>`;
        }
        return '';
    }).join('');
}

function convertMrkdwnSimple(text: string): string {
    // Bold
    let result = text.replace(/\*([^*]+)\*/g, '<strong>$1</strong>');
    // Italic
    result = result.replace(/_([^_]+)_/g, '<em>$1</em>');
    // Line breaks
    result = result.replace(/\n/g, '<br>');
    return result;
}

function escapeHtml(text: string): string {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

// Run the script
main().catch(console.error);
