/**
 * Slack User Lookup
 * Resolves Slack user IDs to human-readable display names
 */

import { getSql } from '@/lib/db';
import { getSlackClient, isSlackClientConfigured } from './slackClient';
import type { SlackUser } from '@/types/f3Event';

/**
 * Lookup a Slack user by ID
 * First checks local cache, then fetches from Slack API if not found
 */
export async function lookupSlackUser(slackUserId: string): Promise<SlackUser | null> {
    const sql = getSql();

    // First, check our local cache
    const cached = await sql`SELECT * FROM slack_users WHERE slack_user_id = ${slackUserId}`;

    if (cached[0]) {
        return cached[0] as SlackUser;
    }

    // Not in cache - fetch from Slack API if configured
    if (!isSlackClientConfigured()) {
        console.warn(`Slack user ${slackUserId} not in cache and SLACK_BOT_TOKEN not configured`);
        return null;
    }

    try {
        const client = getSlackClient();
        const result = await client.users.info({ user: slackUserId });

        if (!result.ok || !result.user) {
            console.warn(`Failed to fetch Slack user ${slackUserId}:`, result.error);
            return null;
        }

        const user = result.user;
        const slackUser: Omit<SlackUser, 'updated_at'> = {
            slack_user_id: user.id!,
            team_id: user.team_id || null,
            display_name: user.profile?.display_name || null,
            real_name: user.profile?.real_name || null,
            image_48: user.profile?.image_48 || null,
            is_bot: user.is_bot || false,
            deleted: user.deleted || false,
        };

        // Upsert into cache
        try {
            const inserted = await sql`INSERT INTO slack_users (slack_user_id, team_id, display_name, real_name, image_48, is_bot, deleted)
                VALUES (${slackUser.slack_user_id}, ${slackUser.team_id}, ${slackUser.display_name}, ${slackUser.real_name}, ${slackUser.image_48}, ${slackUser.is_bot}, ${slackUser.deleted})
                ON CONFLICT (slack_user_id) DO UPDATE SET
                    team_id = EXCLUDED.team_id,
                    display_name = EXCLUDED.display_name,
                    real_name = EXCLUDED.real_name,
                    image_48 = EXCLUDED.image_48,
                    is_bot = EXCLUDED.is_bot,
                    deleted = EXCLUDED.deleted,
                    updated_at = now()
                RETURNING *`;

            return inserted[0] as SlackUser;
        } catch (insertError) {
            console.error('Error caching Slack user:', insertError);
            // Return the user data even if caching fails
            return { ...slackUser, updated_at: new Date().toISOString() } as SlackUser;
        }
    } catch (error) {
        console.error(`Error fetching Slack user ${slackUserId}:`, error);
        return null;
    }
}

/**
 * Resolve a Slack user ID to a display name
 * Uses priority: display_name → real_name → slack_user_id
 */
export async function resolveSlackUserName(slackUserId: string): Promise<string> {
    const user = await lookupSlackUser(slackUserId);

    if (!user) {
        return slackUserId; // Fallback to raw ID
    }

    // Priority: display_name → real_name → slack_user_id
    if (user.display_name && user.display_name.trim()) {
        return user.display_name.trim();
    }

    if (user.real_name && user.real_name.trim()) {
        return user.real_name.trim();
    }

    return slackUserId;
}

/**
 * Batch lookup multiple Slack users
 * Returns a map of slack_user_id → display name
 */
export async function batchResolveSlackUserNames(
    slackUserIds: string[]
): Promise<Map<string, string>> {
    const result = new Map<string, string>();

    if (slackUserIds.length === 0) {
        return result;
    }

    const sql = getSql();

    // Deduplicate
    const uniqueIds = [...new Set(slackUserIds)];

    // First, check cache for all users
    const cached = await sql`SELECT slack_user_id, display_name, real_name FROM slack_users WHERE slack_user_id = ANY(${uniqueIds})`;

    const cachedMap = new Map<string, { display_name: string | null; real_name: string | null }>();
    for (const user of cached) {
        cachedMap.set(user.slack_user_id as string, {
            display_name: user.display_name as string | null,
            real_name: user.real_name as string | null,
        });
    }

    // Process each user
    for (const userId of uniqueIds) {
        const cachedUser = cachedMap.get(userId);

        if (cachedUser) {
            const name = cachedUser.display_name?.trim() ||
                cachedUser.real_name?.trim() ||
                userId;
            result.set(userId, name);
        } else {
            // Fetch from Slack API
            const name = await resolveSlackUserName(userId);
            result.set(userId, name);
        }
    }

    return result;
}
