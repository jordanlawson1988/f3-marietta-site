#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { Pool } from '@neondatabase/serverless';

config({ path: '.env.local' });

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    const tables = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
        ORDER BY table_name
    `);

    console.log(`Tables (${tables.rows.length}):`);
    for (const row of tables.rows) {
        const count = await pool.query(`SELECT count(*) FROM "${row.table_name}"`);
        console.log(`  ${row.table_name}: ${count.rows[0].count} rows`);
    }

    await pool.end();
}

main().catch(console.error);
