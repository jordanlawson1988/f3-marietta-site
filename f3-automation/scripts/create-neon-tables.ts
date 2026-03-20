#!/usr/bin/env npx tsx
import { config } from 'dotenv';
import { Pool } from '@neondatabase/serverless';

// Load from f3-marietta's .env.local (shared database)
config({ path: '../.env.local' });

async function main() {
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });

    console.log('Creating automation tables in Neon...');

    await pool.query(`
        CREATE TABLE IF NOT EXISTS instagram_drafts (
            id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            event_id           UUID NOT NULL REFERENCES f3_events(id),
            caption            TEXT NOT NULL,
            story_text         TEXT,
            hashtags           TEXT[],
            alt_text           TEXT,
            image_url          TEXT,
            image_storage_path TEXT,
            status             TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'approved', 'posted', 'rejected', 'edited')),
            post_type          TEXT NOT NULL DEFAULT 'feed'
                CHECK (post_type IN ('feed', 'story')),
            buffer_post_id     TEXT,
            approved_at        TIMESTAMPTZ,
            posted_at          TIMESTAMPTZ,
            created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(event_id, post_type)
        );

        CREATE TABLE IF NOT EXISTS newsletters (
            id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            week_start         DATE NOT NULL,
            week_end           DATE NOT NULL,
            title              TEXT,
            body_markdown      TEXT,
            body_slack_mrkdwn  TEXT,
            status             TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft', 'approved', 'posted')),
            slack_message_ts   TEXT,
            approved_at        TIMESTAMPTZ,
            posted_at          TIMESTAMPTZ,
            created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            UNIQUE(week_start)
        );

        CREATE TABLE IF NOT EXISTS agent_runs (
            id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            run_type           TEXT NOT NULL
                CHECK (run_type IN ('generate_drafts', 'generate_newsletter', 'publish_instagram', 'publish_newsletter')),
            status             TEXT NOT NULL
                CHECK (status IN ('success', 'failure', 'partial')),
            details            JSONB,
            error_message      TEXT,
            started_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
            completed_at       TIMESTAMPTZ
        );
    `);

    // Verify
    const result = await pool.query(`
        SELECT table_name FROM information_schema.tables
        WHERE table_schema = 'public'
        AND table_name IN ('instagram_drafts', 'newsletters', 'agent_runs')
        ORDER BY table_name
    `);

    console.log('Tables created:');
    for (const row of result.rows) {
        const count = await pool.query(`SELECT count(*) FROM "${row.table_name}"`);
        console.log(`  ${row.table_name}: ${count.rows[0].count} rows`);
    }

    await pool.end();
}

main().catch(console.error);
