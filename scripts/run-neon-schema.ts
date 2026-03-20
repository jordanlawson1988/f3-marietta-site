#!/usr/bin/env npx tsx
/**
 * Run the combined schema SQL against Neon database.
 * Usage: npx tsx scripts/run-neon-schema.ts
 */

import { config } from 'dotenv';
import { readFileSync } from 'fs';
import { Pool } from '@neondatabase/serverless';

config({ path: '.env.local' });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
    console.error('Error: Missing DATABASE_URL in .env.local');
    process.exit(1);
}

async function main() {
    const sql = readFileSync('scripts/neon-schema.sql', 'utf-8');
    console.log('Connecting to Neon...');

    const pool = new Pool({ connectionString: databaseUrl });

    try {
        console.log('Running schema migration...');
        await pool.query(sql);
        console.log('Schema migration complete!');

        // Verify tables
        const result = await pool.query(`
            SELECT table_name
            FROM information_schema.tables
            WHERE table_schema = 'public'
            AND table_type = 'BASE TABLE'
            ORDER BY table_name
        `);

        console.log(`\nTables created (${result.rows.length}):`);
        for (const row of result.rows) {
            console.log(`  - ${row.table_name}`);
        }
    } catch (error) {
        console.error('Schema migration failed:', error);
        process.exit(1);
    } finally {
        await pool.end();
    }
}

main().catch(console.error);
