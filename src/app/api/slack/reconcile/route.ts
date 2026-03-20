import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSql } from '@/lib/db';
import { normalizeSlackMessage, isBackblastPayload, isPreblastPayload } from '@/lib/slack/normalizeSlackMessage';

// This endpoint is called by Vercel Cron as a safety net
// to catch any missed Slack events

// Vercel Cron configuration - runs at 2 AM EST daily
export const dynamic = 'force-dynamic';

interface SlackMessage {
    ts: string;
    text?: string;
    user?: string;
    bot_id?: string;
    app_id?: string;
    subtype?: string;
}

interface SlackConversationsResponse {
    ok: boolean;
    messages?: SlackMessage[];
    error?: string;
}

/**
 * GET /api/slack/reconcile
 * Called by Vercel Cron to reconcile f3_events from Slack
 */
export async function GET(request: NextRequest) {
    // Verify cron secret
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 503 });
    }
    const authHeader = request.headers.get('authorization');
    if (authHeader !== `Bearer ${cronSecret}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const botToken = process.env.SLACK_BOT_TOKEN;

    if (!botToken) {
        console.error('SLACK_BOT_TOKEN not configured');
        return NextResponse.json({ error: 'Configuration error' }, { status: 500 });
    }

    try {
        // Get all enabled AO channels
        const sql = getSql();
        let channels;
        try {
            channels = await sql`SELECT * FROM ao_channels WHERE is_enabled = true`;
        } catch (channelsError) {
            console.error('Error fetching channels:', channelsError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
        }

        if (!channels || channels.length === 0) {
            console.error('No enabled channels found');
            return NextResponse.json({ error: 'No channels found' }, { status: 500 });
        }

        let processedCount = 0;
        let errorCount = 0;

        // Process each channel
        for (const channel of channels) {
            try {
                // Fetch recent messages from Slack (last 100 messages)
                const response = await fetch(
                    `https://slack.com/api/conversations.history?channel=${channel.slack_channel_id}&limit=100`,
                    {
                        headers: {
                            Authorization: `Bearer ${botToken}`,
                            'Content-Type': 'application/json',
                        },
                    }
                );

                const data: SlackConversationsResponse = await response.json();

                if (!data.ok) {
                    console.error(`Error fetching channel ${channel.slack_channel_id}:`, data.error);
                    errorCount++;
                    continue;
                }

                // Process each message
                for (const message of data.messages || []) {
                    if (message.subtype === 'tombstone') continue;

                    // Build a minimal raw payload for normalization
                    const rawPayload = JSON.stringify({
                        event: {
                            type: 'message',
                            channel: channel.slack_channel_id,
                            ts: message.ts,
                            text: message.text || '',
                            user: message.user,
                            bot_id: message.bot_id,
                        },
                    });

                    if (!isBackblastPayload(rawPayload) && !isPreblastPayload(rawPayload)) {
                        continue;
                    }

                    try {
                        const normalized = await normalizeSlackMessage(rawPayload, channel.ao_display_name);

                        await sql`
                            INSERT INTO f3_events (slack_channel_id, slack_message_ts, slack_permalink, ao_display_name, event_kind, title, event_date, event_time, location_text, q_slack_user_id, q_name, pax_count, content_text, content_html, content_json, raw_envelope_json, is_deleted)
                            VALUES (${normalized.slack_channel_id}, ${normalized.slack_message_ts}, ${normalized.slack_permalink || null}, ${channel.ao_display_name}, ${normalized.event_kind}, ${normalized.title || null}, ${normalized.event_date || null}, ${normalized.event_time || null}, ${normalized.location_text || null}, ${normalized.q_slack_user_id || null}, ${normalized.q_name || null}, ${normalized.pax_count || null}, ${normalized.content_text || null}, ${normalized.content_html || null}, ${JSON.stringify(normalized.content_json)}, ${JSON.stringify(normalized.raw_envelope_json)}, ${false})
                            ON CONFLICT (slack_channel_id, slack_message_ts) DO UPDATE SET
                                slack_permalink = EXCLUDED.slack_permalink,
                                ao_display_name = EXCLUDED.ao_display_name,
                                event_kind = EXCLUDED.event_kind,
                                title = EXCLUDED.title,
                                event_date = EXCLUDED.event_date,
                                event_time = EXCLUDED.event_time,
                                location_text = EXCLUDED.location_text,
                                q_slack_user_id = EXCLUDED.q_slack_user_id,
                                q_name = EXCLUDED.q_name,
                                pax_count = EXCLUDED.pax_count,
                                content_text = EXCLUDED.content_text,
                                content_html = EXCLUDED.content_html,
                                content_json = EXCLUDED.content_json,
                                raw_envelope_json = EXCLUDED.raw_envelope_json,
                                is_deleted = EXCLUDED.is_deleted,
                                updated_at = now()
                        `;

                        processedCount++;
                    } catch (err) {
                        console.error(`Error processing message ${message.ts}:`, err);
                        errorCount++;
                    }
                }
            } catch (err) {
                console.error(`Error processing channel ${channel.slack_channel_id}:`, err);
                errorCount++;
            }
        }

        // Revalidate the backblasts page
        revalidatePath('/backblasts');

        console.log(`Reconciliation complete: ${processedCount} processed, ${errorCount} errors`);

        return NextResponse.json({
            ok: true,
            processed: processedCount,
            errors: errorCount,
            channels: channels.length,
        });
    } catch (error) {
        console.error('Reconciliation error:', error);
        return NextResponse.json({ error: 'Reconciliation failed' }, { status: 500 });
    }
}
