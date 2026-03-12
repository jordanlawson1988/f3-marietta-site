#!/usr/bin/env npx tsx
/**
 * Backfill Titles Script
 *
 * Scans f3_events records with generic titles (e.g., "THE LAST STAND BACKBLAST")
 * and attempts to extract the actual user-provided title from:
 *   1. Slack metadata: event_payload.title
 *   2. Message text: first line matching "Backblast! Custom Title"
 *   3. Content text: first line matching "Backblast! Custom Title"
 *
 * Usage:
 *   npx tsx scripts/backfill-titles.ts [--dry-run] [--limit=N] [--verbose]
 *
 * Options:
 *   --dry-run   Show what would change without making changes
 *   --limit=N   Process only N records
 *   --verbose   Show all records, not just ones being updated
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

// Load environment variables from .env.local
config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    console.error('Please set these environment variables in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Parse CLI arguments
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const isVerbose = args.includes('--verbose');
const limitArg = args.find(a => a.startsWith('--limit='));
const limit = limitArg ? parseInt(limitArg.split('=')[1], 10) : undefined;

interface Stats {
    total: number;
    genericTitles: number;
    titlesFixed: number;
    noTitleFound: number;
    alreadyGood: number;
    errors: number;
}

interface F3EventRow {
    id: string;
    title: string | null;
    ao_display_name: string | null;
    event_kind: string;
    content_text: string | null;
    raw_envelope_json: Record<string, unknown> | null;
    created_at: string;
}

/**
 * Check if a title looks like a generic auto-generated title
 * Examples: "THE LAST STAND BACKBLAST", "Black Ops Backblast", "THE BATTLEFIELD BACKBLAST"
 */
function isGenericTitle(title: string | null, aoName: string | null): boolean {
    if (!title) return true;

    const lowerTitle = title.toLowerCase();

    // Pattern 1: Ends with "backblast" (case-insensitive)
    if (lowerTitle.endsWith('backblast')) {
        return true;
    }

    // Pattern 2: Is just "[AO Name] Backblast" or "[AO Name] Backblast — [date]"
    if (aoName) {
        const aoLower = aoName.toLowerCase();
        if (lowerTitle.startsWith(aoLower) && lowerTitle.includes('backblast')) {
            return true;
        }
    }

    // Pattern 3: Very short generic title
    if (lowerTitle === 'backblast' || lowerTitle === 'backblast!') {
        return true;
    }

    return false;
}

/**
 * Extract title from Slack metadata event_payload.title
 */
function extractTitleFromMetadata(envelope: Record<string, unknown>): string | null {
    try {
        const event = envelope.event as Record<string, unknown> | undefined;
        if (!event) return null;

        // Handle message_changed subtype
        const message = (event.message || event) as Record<string, unknown>;
        const metadata = message.metadata as Record<string, unknown> | undefined;
        if (!metadata) return null;

        const eventPayload = metadata.event_payload as Record<string, unknown> | undefined;
        if (!eventPayload) return null;

        const title = eventPayload.title;
        if (typeof title === 'string' && title.trim()) {
            return title.trim();
        }

        return null;
    } catch {
        return null;
    }
}

/**
 * Extract title from message text first line
 * Looks for patterns like "Backblast! Custom Title Here"
 */
function extractTitleFromText(text: string | null): string | null {
    if (!text) return null;

    const firstLine = text.split('\n')[0]?.trim() || '';
    if (!firstLine) return null;

    // Match "Backblast! Title" or "Backblast: Title" patterns
    // Case-insensitive, capture everything after the prefix
    const match = firstLine.match(/^(?:backblast)[!:]?\s*(.+)?$/i);
    if (match && match[1]) {
        const title = match[1].trim();
        // Skip if it's just metadata like "DATE:" or starts with a field name
        if (title.toUpperCase().startsWith('DATE:') ||
            title.toUpperCase().startsWith('AO:') ||
            title.toUpperCase().startsWith('Q:')) {
            return null;
        }
        return title;
    }

    return null;
}

/**
 * Extract raw text from Slack message envelope
 */
function extractMessageText(envelope: Record<string, unknown>): string | null {
    try {
        const event = envelope.event as Record<string, unknown> | undefined;
        if (!event) return null;

        const message = (event.message || event) as Record<string, unknown>;
        const text = message.text;
        if (typeof text === 'string') {
            return text;
        }
        return null;
    } catch {
        return null;
    }
}

async function main() {
    console.log('===========================================');
    console.log('Backfill Titles Script');
    console.log('===========================================');
    console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes)' : 'LIVE'}`);
    console.log(`Verbose: ${isVerbose ? 'YES' : 'NO'}`);
    if (limit) console.log(`Limit: ${limit} records`);
    console.log('');

    const stats: Stats = {
        total: 0,
        genericTitles: 0,
        titlesFixed: 0,
        noTitleFound: 0,
        alreadyGood: 0,
        errors: 0,
    };

    try {
        // Fetch all f3_events (backblasts only)
        console.log('Fetching backblast events...');

        let query = supabase
            .from('f3_events')
            .select('id, title, ao_display_name, event_kind, content_text, raw_envelope_json, created_at')
            .eq('is_deleted', false)
            .eq('event_kind', 'backblast')
            .order('created_at', { ascending: true });

        if (limit) {
            query = query.limit(limit);
        }

        const { data: events, error } = await query;

        if (error) {
            console.error('Error fetching f3_events:', error);
            process.exit(1);
        }

        if (!events || events.length === 0) {
            console.log('No backblast events found to process.');
            return;
        }

        stats.total = events.length;
        console.log(`Found ${stats.total} backblast events to analyze.\n`);

        // Process each event
        console.log('Analyzing titles...\n');
        console.log('-------------------------------------------');

        for (const event of events as F3EventRow[]) {
            try {
                const currentTitle = event.title;
                const aoName = event.ao_display_name;

                // Check if title is generic
                if (!isGenericTitle(currentTitle, aoName)) {
                    stats.alreadyGood++;
                    if (isVerbose) {
                        console.log(`  OK: ${event.id} - "${currentTitle}"`);
                    }
                    continue;
                }

                stats.genericTitles++;

                // Try to extract a better title
                let newTitle: string | null = null;
                let source = '';

                // Source 1: Slack metadata
                if (event.raw_envelope_json) {
                    newTitle = extractTitleFromMetadata(event.raw_envelope_json);
                    if (newTitle) {
                        source = 'metadata';
                    }
                }

                // Source 2: Raw message text from envelope
                if (!newTitle && event.raw_envelope_json) {
                    const messageText = extractMessageText(event.raw_envelope_json);
                    newTitle = extractTitleFromText(messageText);
                    if (newTitle) {
                        source = 'message_text';
                    }
                }

                // Source 3: Stored content_text
                if (!newTitle) {
                    newTitle = extractTitleFromText(event.content_text);
                    if (newTitle) {
                        source = 'content_text';
                    }
                }

                // Skip if new title is same as current or still generic
                if (newTitle && isGenericTitle(newTitle, aoName)) {
                    newTitle = null;
                }

                if (!newTitle) {
                    stats.noTitleFound++;
                    if (isVerbose) {
                        console.log(`  SKIP: ${event.id} - No better title found (current: "${currentTitle}")`);
                    }
                    continue;
                }

                // Found a better title!
                console.log(`  UPDATE: ${event.id}`);
                console.log(`          AO: ${aoName}`);
                console.log(`          Old: "${currentTitle}"`);
                console.log(`          New: "${newTitle}" (from ${source})`);
                console.log('');

                stats.titlesFixed++;

                if (!isDryRun) {
                    const { error: updateError } = await supabase
                        .from('f3_events')
                        .update({ title: newTitle })
                        .eq('id', event.id);

                    if (updateError) {
                        console.error(`    ERROR: ${updateError.message}`);
                        stats.errors++;
                    }
                }

            } catch (err) {
                stats.errors++;
                console.error(`Error processing ${event.id}:`, err);
            }
        }

        // Final summary
        console.log('-------------------------------------------');
        console.log('\n===========================================');
        console.log('SUMMARY');
        console.log('===========================================');
        console.log(`Total backblasts analyzed: ${stats.total}`);
        console.log(`Already have good titles:  ${stats.alreadyGood}`);
        console.log(`Had generic titles:        ${stats.genericTitles}`);
        console.log(`  - Titles fixed:          ${stats.titlesFixed}`);
        console.log(`  - No better title found: ${stats.noTitleFound}`);
        console.log(`Errors:                    ${stats.errors}`);

        if (isDryRun) {
            console.log('\n>>> DRY RUN - No changes were made.');
            console.log('>>> Run without --dry-run to apply changes.');
        } else if (stats.titlesFixed > 0) {
            console.log('\n>>> Title updates applied!');
        }

    } catch (err) {
        console.error('Fatal error:', err);
        process.exit(1);
    }
}

// Run the script
main().catch(console.error);
