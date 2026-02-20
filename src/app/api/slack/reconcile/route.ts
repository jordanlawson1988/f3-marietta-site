import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { supabase } from '@/lib/supabase';
import { parseBackblast, isBackblastMessage, generateBackblastTitle } from '@/lib/backblast/parseBackblast';

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
 * Called by Vercel Cron to reconcile backblasts from Slack
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
                // Fetch recent messages from Slack (last 7 days worth)
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
                    // Skip non-backblast messages
                    if (!message.text || !isBackblastMessage(message.text)) {
                        continue;
                    }

                    // Skip deleted messages
                    if (message.subtype === 'tombstone') {
                        continue;
                    }

                    // Parse and upsert
                    const parsed = parseBackblast(message.text, channel.ao_display_name);
                    const title = generateBackblastTitle(parsed);

                    const { error: upsertError } = await supabase
                        .from('backblasts')
                        .upsert(
                            {
                                slack_channel_id: channel.slack_channel_id,
                                slack_message_ts: message.ts,
                                ao_display_name: parsed.ao || channel.ao_display_name,
                                title,
                                backblast_date: parsed.date,
                                q_name: parsed.q,
                                pax_text: parsed.pax,
                                fng_text: parsed.fngs,
                                pax_count: parsed.count,
                                content_text: parsed.content,
                                is_deleted: false,
                            },
                            {
                                onConflict: 'slack_channel_id,slack_message_ts',
                            }
                        );

                    if (upsertError) {
                        console.error('Error upserting:', upsertError);
                        errorCount++;
                    } else {
                        processedCount++;
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
