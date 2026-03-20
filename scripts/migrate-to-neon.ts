#!/usr/bin/env npx tsx
/**
 * Migrate all data from Supabase to Neon.
 *
 * Usage: npx tsx scripts/migrate-to-neon.ts
 *
 * Reads from Supabase via REST API (service role key) and writes to Neon via
 * @neondatabase/serverless Pool (DATABASE_URL). Tables are processed in FK-safe
 * order, each TRUNCATED CASCADE before insert.
 */

import { config } from 'dotenv';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Pool, PoolClient } from '@neondatabase/serverless';

config({ path: '.env.local' });

// ---------------------------------------------------------------------------
// Env validation
// ---------------------------------------------------------------------------
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const databaseUrl = process.env.DATABASE_URL;

if (!supabaseUrl || !supabaseKey) {
    console.error('Error: Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}
if (!databaseUrl) {
    console.error('Error: Missing DATABASE_URL in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const pool = new Pool({ connectionString: databaseUrl });

// ---------------------------------------------------------------------------
// Table definitions — ordered for FK safety
// ---------------------------------------------------------------------------

interface TableDef {
    name: string;
    /** Columns to SELECT / INSERT (order matters for parameterised query). */
    columns: string[];
    /** Columns that hold jsonb data and need JSON.stringify before insert. */
    jsonbColumns?: string[];
    /** Whether to TRUNCATE CASCADE (needed for parent tables). */
    cascadeTruncate?: boolean;
}

const TABLES: TableDef[] = [
    {
        name: 'ao_channels',
        columns: ['id', 'slack_channel_id', 'slack_channel_name', 'ao_display_name', 'is_enabled', 'created_at'],
        cascadeTruncate: true,
    },
    {
        name: 'slack_users',
        columns: ['slack_user_id', 'team_id', 'display_name', 'real_name', 'image_48', 'is_bot', 'deleted', 'updated_at'],
        cascadeTruncate: true,
    },
    {
        name: 'regions',
        columns: ['id', 'name', 'slug', 'sort_order', 'is_primary', 'is_active', 'created_at', 'updated_at'],
        cascadeTruncate: true,
    },
    {
        name: 'f3_events',
        columns: [
            'id', 'slack_channel_id', 'slack_message_ts', 'slack_permalink',
            'ao_display_name', 'event_kind', 'title', 'event_date', 'event_time',
            'location_text', 'q_slack_user_id', 'q_name', 'pax_count',
            'content_text', 'content_html', 'content_json', 'raw_envelope_json',
            'last_slack_edit_ts', 'is_deleted', 'created_at', 'updated_at',
        ],
        jsonbColumns: ['content_json', 'raw_envelope_json'],
        cascadeTruncate: true,
    },
    {
        name: 'f3_event_attendees',
        columns: ['id', 'event_id', 'attendee_external_id', 'attendee_slack_user_id', 'created_at'],
    },
    {
        name: 'f3_event_qs',
        columns: ['id', 'event_id', 'q_external_id', 'q_slack_user_id', 'created_at'],
    },
    {
        name: 'slack_message_blocks',
        columns: ['id', 'event_id', 'block_index', 'block_type', 'block_id', 'block_json'],
        jsonbColumns: ['block_json'],
        cascadeTruncate: true,
    },
    {
        name: 'slack_block_elements',
        columns: ['id', 'block_row_id', 'element_index', 'element_type', 'element_json'],
        jsonbColumns: ['element_json'],
    },
    {
        name: 'workout_schedule',
        columns: [
            'id', 'ao_name', 'workout_type', 'day_of_week', 'start_time', 'end_time',
            'location_name', 'address', 'region_id', 'map_link',
            'is_active', 'created_at', 'updated_at',
        ],
        cascadeTruncate: true,
    },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Fetch ALL rows from a Supabase table, paginating in chunks of 1000. */
async function fetchAllRows(table: string): Promise<Record<string, unknown>[]> {
    const PAGE_SIZE = 1000;
    const allRows: Record<string, unknown>[] = [];
    let offset = 0;

    while (true) {
        const { data, error } = await supabase
            .from(table)
            .select('*')
            .range(offset, offset + PAGE_SIZE - 1);

        if (error) {
            throw new Error(`Supabase fetch error for ${table}: ${error.message}`);
        }
        if (!data || data.length === 0) break;

        allRows.push(...data);
        if (data.length < PAGE_SIZE) break; // last page
        offset += PAGE_SIZE;
    }

    return allRows;
}

/** Build a batch INSERT query with $1, $2, ... placeholders. */
function buildInsertQuery(
    table: string,
    columns: string[],
    batchSize: number,
): string {
    const colList = columns.map(c => `"${c}"`).join(', ');
    const valueTuples: string[] = [];
    let paramIdx = 1;
    for (let i = 0; i < batchSize; i++) {
        const placeholders = columns.map(() => `$${paramIdx++}`).join(', ');
        valueTuples.push(`(${placeholders})`);
    }
    return `INSERT INTO "${table}" (${colList}) VALUES ${valueTuples.join(', ')}`;
}

/** Flatten rows into a single params array, stringifying jsonb columns. */
function flattenParams(
    rows: Record<string, unknown>[],
    columns: string[],
    jsonbColumns: Set<string>,
): unknown[] {
    const params: unknown[] = [];
    for (const row of rows) {
        for (const col of columns) {
            let val = row[col];
            if (val !== null && val !== undefined && jsonbColumns.has(col)) {
                val = JSON.stringify(val);
            }
            params.push(val ?? null);
        }
    }
    return params;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function migrateTable(client: PoolClient, def: TableDef): Promise<number> {
    const { name, columns, jsonbColumns = [], cascadeTruncate } = def;
    const jsonbSet = new Set(jsonbColumns);

    // 1. Truncate target table in Neon
    const truncateSql = cascadeTruncate
        ? `TRUNCATE TABLE "${name}" CASCADE`
        : `TRUNCATE TABLE "${name}"`;
    await client.query(truncateSql);

    // 2. Fetch all rows from Supabase
    const rows = await fetchAllRows(name);
    if (rows.length === 0) {
        console.log(`  ${name}: 0 rows (source empty)`);
        return 0;
    }

    // 3. Batch insert into Neon (100 rows per batch)
    const BATCH_SIZE = 100;
    let inserted = 0;
    for (let i = 0; i < rows.length; i += BATCH_SIZE) {
        const batch = rows.slice(i, i + BATCH_SIZE);
        const query = buildInsertQuery(name, columns, batch.length);
        const params = flattenParams(batch, columns, jsonbSet);
        await client.query(query, params);
        inserted += batch.length;
    }

    console.log(`  ${name}: ${inserted} rows migrated`);
    return inserted;
}

async function main() {
    console.log('=== Supabase → Neon Data Migration ===\n');
    console.log(`Source: ${supabaseUrl}`);
    console.log(`Target: Neon (DATABASE_URL)\n`);

    const client = await pool.connect();

    try {
        await client.query('BEGIN');

        let totalRows = 0;
        for (const def of TABLES) {
            const count = await migrateTable(client, def);
            totalRows += count;
        }

        await client.query('COMMIT');

        console.log(`\nMigration complete! ${totalRows} total rows migrated across ${TABLES.length} tables.`);
    } catch (err) {
        await client.query('ROLLBACK');
        console.error('\nMigration FAILED — transaction rolled back.');
        throw err;
    } finally {
        client.release();
        await pool.end();
    }
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});
