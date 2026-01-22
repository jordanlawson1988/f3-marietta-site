#!/usr/bin/env npx tsx
/**
 * Backfill Missing Data Script
 * 
 * Fixes missing event_date and q_name fields by:
 * 1. Parsing DATE from content_text if event_date is null
 * 2. Resolving q_name from slack_users if q_slack_user_id exists but q_name is null
 * 
 * Usage:
 *   npx tsx scripts/backfill-missing-data.ts [--dry-run]
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const isDryRun = process.argv.includes('--dry-run');

/**
 * Parse date from content_text
 * Looks for patterns like "DATE: 2026-01-12" or "Date: January 12, 2026"
 */
function parseDateFromContent(contentText: string): string | null {
    if (!contentText) return null;

    // Pattern 1: DATE: YYYY-MM-DD
    const isoMatch = contentText.match(/DATE:\s*(\d{4}-\d{2}-\d{2})/i);
    if (isoMatch) {
        return isoMatch[1];
    }

    // Pattern 2: DATE: MM/DD/YYYY
    const usMatch = contentText.match(/DATE:\s*(\d{1,2})\/(\d{1,2})\/(\d{4})/i);
    if (usMatch) {
        const month = usMatch[1].padStart(2, '0');
        const day = usMatch[2].padStart(2, '0');
        return `${usMatch[3]}-${month}-${day}`;
    }

    // Pattern 3: Date: Month DD, YYYY (e.g., "January 12, 2026")
    const monthNames = ['january', 'february', 'march', 'april', 'may', 'june',
        'july', 'august', 'september', 'october', 'november', 'december'];
    const textMatch = contentText.match(/DATE:\s*([A-Za-z]+)\s+(\d{1,2}),?\s*(\d{4})/i);
    if (textMatch) {
        const monthIndex = monthNames.indexOf(textMatch[1].toLowerCase());
        if (monthIndex >= 0) {
            const month = String(monthIndex + 1).padStart(2, '0');
            const day = textMatch[2].padStart(2, '0');
            return `${textMatch[3]}-${month}-${day}`;
        }
    }

    return null;
}

async function main() {
    console.log('=== Backfill Missing Data ===');
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    // Step 1: Fetch all events with missing data
    const { data: events, error: fetchError } = await supabase
        .from('f3_events')
        .select('id, event_date, q_name, q_slack_user_id, content_text')
        .eq('is_deleted', false);

    if (fetchError) {
        console.error('Error fetching events:', fetchError);
        process.exit(1);
    }

    if (!events || events.length === 0) {
        console.log('No events found.');
        return;
    }

    console.log(`Found ${events.length} total events`);

    // Collect unique Slack user IDs that need resolution
    const needsQName = events.filter(e => !e.q_name && e.q_slack_user_id);
    const userIdsToResolve = [...new Set(needsQName.map(e => e.q_slack_user_id).filter(Boolean))];

    // Fetch display names from slack_users
    const userNameMap = new Map<string, string>();
    if (userIdsToResolve.length > 0) {
        const { data: users } = await supabase
            .from('slack_users')
            .select('slack_user_id, display_name, real_name')
            .in('slack_user_id', userIdsToResolve);

        for (const user of users || []) {
            const name = user.display_name?.trim() || user.real_name?.trim();
            if (name) {
                userNameMap.set(user.slack_user_id, name);
            }
        }
        console.log(`Resolved ${userNameMap.size} user names from slack_users table`);
    }

    console.log('');

    // Process each event
    let dateUpdates = 0;
    let qNameUpdates = 0;

    for (const event of events) {
        const updates: Record<string, unknown> = {};

        // Fix missing date
        if (!event.event_date && event.content_text) {
            const parsedDate = parseDateFromContent(event.content_text);
            if (parsedDate) {
                updates.event_date = parsedDate;
                console.log(`  DATE: Event ${event.id.slice(0, 8)}... → ${parsedDate}`);
                dateUpdates++;
            }
        }

        // Fix missing Q name
        if (!event.q_name && event.q_slack_user_id) {
            const resolvedName = userNameMap.get(event.q_slack_user_id);
            if (resolvedName) {
                updates.q_name = resolvedName;
                console.log(`  Q NAME: Event ${event.id.slice(0, 8)}... → ${resolvedName}`);
                qNameUpdates++;
            }
        }

        // Apply updates
        if (Object.keys(updates).length > 0 && !isDryRun) {
            const { error: updateError } = await supabase
                .from('f3_events')
                .update(updates)
                .eq('id', event.id);

            if (updateError) {
                console.error(`  ERROR updating ${event.id}:`, updateError);
            }
        }
    }

    console.log('');
    console.log('=== Summary ===');
    console.log(`Dates fixed: ${dateUpdates}`);
    console.log(`Q names fixed: ${qNameUpdates}`);

    if (isDryRun) {
        console.log('');
        console.log('This was a DRY RUN. Run without --dry-run to apply changes.');
    }
}

main().catch(console.error);
