/**
 * Slack User Sync Cron Endpoint
 * POST /api/slack/sync-users
 * 
 * Syncs all Slack workspace users to the local slack_users table.
 * Designed to run as a Vercel cron job daily.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { getSlackClient, isSlackClientConfigured } from '@/lib/slack/slackClient';

interface SyncStats {
    total: number;
    inserted: number;
    updated: number;
    errors: number;
}

/**
 * POST /api/slack/sync-users
 * Sync all Slack users to the database
 */
export async function POST(request: NextRequest) {
    try {
        // Verify cron secret for Vercel cron jobs
        const cronSecret = process.env.CRON_SECRET;
        if (!cronSecret) {
            return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
        }
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${cronSecret}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Check if Slack client is configured
        if (!isSlackClientConfigured()) {
            return NextResponse.json(
                { error: 'SLACK_BOT_TOKEN not configured' },
                { status: 500 }
            );
        }

        const stats = await syncAllSlackUsers();

        return NextResponse.json({
            ok: true,
            stats,
            syncedAt: new Date().toISOString(),
        });
    } catch (error) {
        console.error('Error syncing Slack users:', error);
        return NextResponse.json(
            { error: 'Failed to sync users', details: String(error) },
            { status: 500 }
        );
    }
}

/**
 * GET /api/slack/sync-users
 * Also support GET for manual triggering and Vercel cron
 */
export async function GET(request: NextRequest) {
    // Delegate to POST handler
    return POST(request);
}

/**
 * Sync all Slack users from the workspace
 */
async function syncAllSlackUsers(): Promise<SyncStats> {
    const client = getSlackClient();
    const sql = getSql();
    const stats: SyncStats = { total: 0, inserted: 0, updated: 0, errors: 0 };

    let cursor: string | undefined;

    do {
        // Fetch users with pagination
        const result = await client.users.list({
            limit: 200,
            cursor,
        });

        if (!result.ok || !result.members) {
            console.error('Failed to fetch Slack users:', result.error);
            break;
        }

        // Process each user
        for (const user of result.members) {
            stats.total++;

            // Skip Slackbot and deleted users we can't use
            if (user.id === 'USLACKBOT') {
                continue;
            }

            try {
                const slackUserId = user.id!;
                const teamId = user.team_id || null;
                const displayName = user.profile?.display_name || null;
                const realName = user.profile?.real_name || null;
                const image48 = user.profile?.image_48 || null;
                const isBot = user.is_bot || false;
                const deleted = user.deleted || false;

                // Check if exists
                const existing = await sql`SELECT slack_user_id FROM slack_users WHERE slack_user_id = ${slackUserId}`;

                if (existing.length > 0) {
                    // Update existing
                    try {
                        await sql`UPDATE slack_users SET team_id = ${teamId}, display_name = ${displayName}, real_name = ${realName}, image_48 = ${image48}, is_bot = ${isBot}, deleted = ${deleted}, updated_at = now() WHERE slack_user_id = ${slackUserId}`;
                        stats.updated++;
                    } catch (error) {
                        console.error(`Error updating user ${user.id}:`, error);
                        stats.errors++;
                    }
                } else {
                    // Insert new
                    try {
                        await sql`INSERT INTO slack_users (slack_user_id, team_id, display_name, real_name, image_48, is_bot, deleted) VALUES (${slackUserId}, ${teamId}, ${displayName}, ${realName}, ${image48}, ${isBot}, ${deleted})`;
                        stats.inserted++;
                    } catch (error) {
                        console.error(`Error inserting user ${user.id}:`, error);
                        stats.errors++;
                    }
                }
            } catch (error) {
                console.error(`Error processing user ${user.id}:`, error);
                stats.errors++;
            }
        }

        // Get next page cursor
        cursor = result.response_metadata?.next_cursor;
    } while (cursor);

    console.log('Slack user sync complete:', stats);
    return stats;
}
