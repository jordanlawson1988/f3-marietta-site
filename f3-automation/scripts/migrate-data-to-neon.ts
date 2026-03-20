#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { Pool } from '@neondatabase/serverless';

// Load automation .env.local first (SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
config({ path: '.env.local' });
// Then load parent project .env.local (DATABASE_URL) without overriding
config({ path: '../.env.local', override: false });

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const DATABASE_URL = process.env.DATABASE_URL!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}
if (!DATABASE_URL) {
    console.error('Missing DATABASE_URL in ../.env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
});

const neon = new Pool({ connectionString: DATABASE_URL });

const BATCH_SIZE = 100;

async function migrateInstagramDrafts() {
    console.log('\n--- instagram_drafts ---');

    await neon.query('TRUNCATE instagram_drafts CASCADE');

    const { data, error } = await supabase
        .from('instagram_drafts')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) throw new Error(`Supabase fetch error: ${error.message}`);
    if (!data || data.length === 0) {
        console.log('  No rows to migrate.');
        return 0;
    }

    let inserted = 0;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        const values: string[] = [];
        const params: unknown[] = [];
        let paramIdx = 1;

        for (const row of batch) {
            const placeholders = [];
            for (const col of [
                'id', 'event_id', 'caption', 'story_text', 'hashtags',
                'alt_text', 'image_url', 'image_storage_path', 'status',
                'post_type', 'buffer_post_id', 'approved_at', 'posted_at',
                'created_at', 'updated_at',
            ]) {
                placeholders.push(`$${paramIdx++}`);
                // hashtags is TEXT[] — pass as-is, pg driver handles arrays
                params.push(row[col] ?? null);
            }
            values.push(`(${placeholders.join(', ')})`);
        }

        await neon.query(
            `INSERT INTO instagram_drafts (
                id, event_id, caption, story_text, hashtags,
                alt_text, image_url, image_storage_path, status,
                post_type, buffer_post_id, approved_at, posted_at,
                created_at, updated_at
            ) VALUES ${values.join(', ')}`,
            params,
        );
        inserted += batch.length;
    }

    console.log(`  Migrated ${inserted} rows.`);
    return inserted;
}

async function migrateNewsletters() {
    console.log('\n--- newsletters ---');

    await neon.query('TRUNCATE newsletters CASCADE');

    const { data, error } = await supabase
        .from('newsletters')
        .select('*')
        .order('created_at', { ascending: true });

    if (error) throw new Error(`Supabase fetch error: ${error.message}`);
    if (!data || data.length === 0) {
        console.log('  No rows to migrate.');
        return 0;
    }

    let inserted = 0;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        const values: string[] = [];
        const params: unknown[] = [];
        let paramIdx = 1;

        for (const row of batch) {
            const placeholders = [];
            for (const col of [
                'id', 'week_start', 'week_end', 'title', 'body_markdown',
                'body_slack_mrkdwn', 'status', 'slack_message_ts',
                'approved_at', 'posted_at', 'created_at', 'updated_at',
            ]) {
                placeholders.push(`$${paramIdx++}`);
                params.push(row[col] ?? null);
            }
            values.push(`(${placeholders.join(', ')})`);
        }

        await neon.query(
            `INSERT INTO newsletters (
                id, week_start, week_end, title, body_markdown,
                body_slack_mrkdwn, status, slack_message_ts,
                approved_at, posted_at, created_at, updated_at
            ) VALUES ${values.join(', ')}`,
            params,
        );
        inserted += batch.length;
    }

    console.log(`  Migrated ${inserted} rows.`);
    return inserted;
}

async function migrateAgentRuns() {
    console.log('\n--- agent_runs ---');

    await neon.query('TRUNCATE agent_runs CASCADE');

    const { data, error } = await supabase
        .from('agent_runs')
        .select('*')
        .order('started_at', { ascending: true });

    if (error) throw new Error(`Supabase fetch error: ${error.message}`);
    if (!data || data.length === 0) {
        console.log('  No rows to migrate.');
        return 0;
    }

    let inserted = 0;
    for (let i = 0; i < data.length; i += BATCH_SIZE) {
        const batch = data.slice(i, i + BATCH_SIZE);
        const values: string[] = [];
        const params: unknown[] = [];
        let paramIdx = 1;

        for (const row of batch) {
            const placeholders = [];
            for (const col of [
                'id', 'run_type', 'status', 'details',
                'error_message', 'started_at', 'completed_at',
            ]) {
                placeholders.push(`$${paramIdx++}`);
                // details is JSONB — stringify if it's an object
                if (col === 'details' && row[col] !== null && typeof row[col] === 'object') {
                    params.push(JSON.stringify(row[col]));
                } else {
                    params.push(row[col] ?? null);
                }
            }
            values.push(`(${placeholders.join(', ')})`);
        }

        await neon.query(
            `INSERT INTO agent_runs (
                id, run_type, status, details,
                error_message, started_at, completed_at
            ) VALUES ${values.join(', ')}`,
            params,
        );
        inserted += batch.length;
    }

    console.log(`  Migrated ${inserted} rows.`);
    return inserted;
}

async function main() {
    console.log('=== Migrating automation data from Supabase to Neon ===');

    const counts = {
        instagram_drafts: await migrateInstagramDrafts(),
        newsletters: await migrateNewsletters(),
        agent_runs: await migrateAgentRuns(),
    };

    console.log('\n=== Migration complete ===');
    console.log('Summary:');
    for (const [table, count] of Object.entries(counts)) {
        console.log(`  ${table}: ${count} rows`);
    }

    await neon.end();
}

main().catch((err) => {
    console.error('Migration failed:', err);
    process.exit(1);
});
