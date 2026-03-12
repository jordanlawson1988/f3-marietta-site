import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
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
        const { data: channels, error: channelsError } = await supabase
            .from('ao_channels')
            .select('*')
            .eq('is_enabled', true);

        if (channelsError || !channels) {
            console.error('Error fetching channels:', channelsError);
            return NextResponse.json({ error: 'Database error' }, { status: 500 });
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

                        const { error: upsertError } = await supabase
                            .from('f3_events')
                            .upsert(
                                {
                                    slack_channel_id: normalized.slack_channel_id,
                                    slack_message_ts: normalized.slack_message_ts,
                                    slack_permalink: normalized.slack_permalink || null,
                                    ao_display_name: channel.ao_display_name,
                                    event_kind: normalized.event_kind,
                                    title: normalized.title || null,
                                    event_date: normalized.event_date || null,
                                    event_time: normalized.event_time || null,
                                    location_text: normalized.location_text || null,
                                    q_slack_user_id: normalized.q_slack_user_id || null,
                                    q_name: normalized.q_name || null,
                                    pax_count: normalized.pax_count || null,
                                    content_text: normalized.content_text || null,
                                    content_html: normalized.content_html || null,
                                    content_json: normalized.content_json,
                                    raw_envelope_json: normalized.raw_envelope_json,
                                    is_deleted: false,
                                },
                                { onConflict: 'slack_channel_id,slack_message_ts' }
                            );

                        if (upsertError) {
                            console.error('Error upserting f3_event:', upsertError);
                            errorCount++;
                        } else {
                            processedCount++;
                        }
                    } catch (err) {
                        console.error(`Error normalizing message ${message.ts}:`, err);
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
