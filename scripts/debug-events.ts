#!/usr/bin/env npx tsx
/**
 * Debug script to see full content of events
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function main() {
    const { data, error } = await supabase
        .from('f3_events')
        .select('id, event_kind, event_date, q_name, q_slack_user_id, ao_display_name, title, content_text, created_at')
        .eq('is_deleted', false)
        .eq('event_kind', 'backblast')
        .limit(10);

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('=== F3 Events (Backblasts) ===\n');
    for (const event of data || []) {
        console.log('='.repeat(60));
        console.log(`ID: ${event.id}`);
        console.log(`AO: ${event.ao_display_name}`);
        console.log(`Title: ${event.title}`);
        console.log(`Event Date: ${event.event_date}`);
        console.log(`Q Name: ${event.q_name}`);
        console.log(`Q Slack ID: ${event.q_slack_user_id}`);
        console.log(`Created At: ${event.created_at}`);
        console.log('');
        console.log('Content (first 500 chars):');
        console.log(event.content_text?.slice(0, 500) || '(empty)');
        console.log('');
    }
}

main().catch(console.error);
