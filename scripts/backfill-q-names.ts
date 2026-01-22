#!/usr/bin/env npx tsx
/**
 * Backfill Q Names Script
 * 
 * Re-resolves Q display names for all f3_events that have q_slack_user_id but
 * q_name still contains a raw Slack ID (matches pattern starting with 'U').
 * 
 * Usage:
 *   npx tsx scripts/backfill-q-names.ts [--dry-run]
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

const isDryRun = process.argv.includes('--dry-run');

async function main() {
    console.log('=== Backfill Q Names ===');
    console.log(`Mode: ${isDryRun ? 'DRY RUN' : 'LIVE'}`);
    console.log('');

    // Step 1: Find all events where q_name looks like a raw Slack ID
    // Slack user IDs start with 'U' and are uppercase alphanumeric
    const { data: events, error: fetchError } = await supabase
        .from('f3_events')
        .select('id, q_slack_user_id, q_name')
        .not('q_slack_user_id', 'is', null)
        .eq('is_deleted', false);

    if (fetchError) {
        console.error('Error fetching events:', fetchError);
        process.exit(1);
    }

    if (!events || events.length === 0) {
        console.log('No events with Q Slack user IDs found.');
        return;
    }

    console.log(`Found ${events.length} events with q_slack_user_id`);

    // Filter to events where q_name looks like a raw Slack ID
    const needsUpdate = events.filter(e => {
        const qName = e.q_name || '';
        // Match pattern like @U0A58BDPZSS or just U0A58BDPZSS
        return /^@?U[A-Z0-9]{8,}$/.test(qName) || qName === e.q_slack_user_id;
    });

    console.log(`${needsUpdate.length} events have raw Slack IDs as q_name`);
    console.log('');

    if (needsUpdate.length === 0) {
        console.log('All events already have resolved Q names. Nothing to do.');
        return;
    }

    // Step 2: Get all unique Slack user IDs that need resolution
    const uniqueUserIds = [...new Set(needsUpdate.map(e => e.q_slack_user_id).filter(Boolean))];
    console.log(`Looking up ${uniqueUserIds.length} unique Slack users...`);

    // Step 3: Fetch display names from slack_users table
    const { data: slackUsers, error: usersError } = await supabase
        .from('slack_users')
        .select('slack_user_id, display_name, real_name')
        .in('slack_user_id', uniqueUserIds);

    if (usersError) {
        console.error('Error fetching Slack users:', usersError);
        process.exit(1);
    }

    // Build lookup map: slack_user_id -> resolved name
    const userNameMap = new Map<string, string>();
    for (const user of slackUsers || []) {
        const name = user.display_name?.trim() || user.real_name?.trim() || user.slack_user_id;
        userNameMap.set(user.slack_user_id, name);
    }

    console.log(`Found ${userNameMap.size} users in slack_users table`);
    console.log('');

    // Step 4: Update events with resolved names
    let updated = 0;
    let skipped = 0;
    let notFound = 0;

    for (const event of needsUpdate) {
        const userId = event.q_slack_user_id;
        const resolvedName = userNameMap.get(userId);

        if (!resolvedName || resolvedName === userId) {
            // User not found in cache - skip (they might not be synced yet)
            console.log(`  SKIP: Event ${event.id} - User ${userId} not found in slack_users`);
            notFound++;
            continue;
        }

        // Same name - skip
        if (event.q_name === resolvedName) {
            skipped++;
            continue;
        }

        console.log(`  UPDATE: Event ${event.id}: "${event.q_name}" -> "${resolvedName}"`);

        if (!isDryRun) {
            const { error: updateError } = await supabase
                .from('f3_events')
                .update({ q_name: resolvedName })
                .eq('id', event.id);

            if (updateError) {
                console.error(`    ERROR updating event ${event.id}:`, updateError);
            } else {
                updated++;
            }
        } else {
            updated++;
        }
    }

    console.log('');
    console.log('=== Summary ===');
    console.log(`Updated: ${updated}`);
    console.log(`Skipped (already correct): ${skipped}`);
    console.log(`Not found in slack_users: ${notFound}`);

    if (isDryRun) {
        console.log('');
        console.log('This was a DRY RUN. Run without --dry-run to apply changes.');
    }
}

main().catch(console.error);
