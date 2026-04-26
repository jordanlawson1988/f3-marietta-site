import { NextRequest, NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSql } from '@/lib/db';
import { verifySlackSignature } from '@/lib/slack/slackVerify';
import { normalizeSlackMessage, isBackblastPayload, isPreblastPayload } from '@/lib/slack/normalizeSlackMessage';
import type { NormalizedEvent } from '@/types/f3Event';

// Slack event types
interface SlackEvent {
    type: string;
    subtype?: string;
    channel: string;
    ts: string;
    thread_ts?: string;  // Present if this is a thread reply
    text?: string;
    user?: string;
    bot_id?: string;
    app_id?: string;
    message?: {
        ts: string;
        thread_ts?: string;  // Present if this is a thread reply
        text?: string;
        user?: string;
        bot_id?: string;
    };
    previous_message?: {
        ts: string;
    };
}

interface SlackEventPayload {
    type: 'url_verification' | 'event_callback';
    challenge?: string;
    token?: string;
    event?: SlackEvent;
}

/**
 * POST /api/slack/events
 * Handles Slack Events API webhooks for backblast and preblast messages
 */
export async function POST(request: NextRequest) {
    try {
        // Get raw body for signature verification
        const rawBody = await request.text();

        // Verify Slack signature
        const signingSecret = process.env.SLACK_SIGNING_SECRET;
        if (!signingSecret) {
            console.error('SLACK_SIGNING_SECRET not configured');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const signature = request.headers.get('x-slack-signature') || '';
        const timestamp = request.headers.get('x-slack-request-timestamp') || '';

        if (!verifySlackSignature(signingSecret, signature, timestamp, rawBody)) {
            console.error('Invalid Slack signature');
            return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
        }

        // Parse the payload
        const payload: SlackEventPayload = JSON.parse(rawBody);

        // Handle URL verification challenge (used when setting up Events API)
        if (payload.type === 'url_verification') {
            return NextResponse.json({ challenge: payload.challenge });
        }

        // Handle event callbacks
        if (payload.type === 'event_callback' && payload.event) {
            // Process asynchronously but respond quickly to Slack
            // Note: Vercel functions have time limits, so we process inline
            await handleSlackEvent(payload.event, rawBody);
        }

        // Always respond 200 quickly to acknowledge receipt
        return NextResponse.json({ ok: true });
    } catch (error) {
        console.error('Error processing Slack event:', error);
        // Still return 200 to prevent Slack from retrying
        return NextResponse.json({ ok: true });
    }
}

async function handleSlackEvent(event: SlackEvent, rawPayload: string) {
    const { type, subtype, channel, ts } = event;

    console.log('handleSlackEvent called:', { type, subtype, channel, ts });
    console.log('Event text preview:', event.text?.substring(0, 100));

    // Only process message events
    if (type !== 'message') {
        console.log('Not a message event, ignoring');
        return;
    }

    // Filter out thread replies - we only want top-level messages
    // A thread reply has thread_ts that differs from ts (or message.ts for edits)
    const messageTs = event.message?.ts || ts;
    const threadTs = event.message?.thread_ts || event.thread_ts;
    if (threadTs && threadTs !== messageTs) {
        console.log('Skipping thread reply:', { messageTs, threadTs });
        return;
    }

    // Check if this channel is in our allowlist
    const aoChannel = await getAOChannel(channel);
    if (!aoChannel) {
        console.log('Channel not in allowlist:', channel);
        return;
    }
    console.log('Channel matched:', aoChannel.ao_display_name);

    // Handle message deletion
    if (subtype === 'message_deleted' && event.previous_message) {
        console.log('Processing message deletion');
        await handleMessageDeleted(channel, event.previous_message.ts);
        return;
    }

    // Handle message edit (message_changed)
    if (subtype === 'message_changed' && event.message) {
        console.log('Processing message edit');

        if (isBackblastPayload(rawPayload) || isPreblastPayload(rawPayload)) {
            await handleF3EventUpsert(aoChannel.ao_display_name, rawPayload, ts);
        }
        return;
    }

    // Handle new message (no subtype or bot_message)
    if (!subtype || subtype === 'bot_message') {
        console.log('Processing new message, text length:', (event.text || '').length);

        const isBackblast = isBackblastPayload(rawPayload);
        const isPreblast = isPreblastPayload(rawPayload);

        if (!isBackblast && !isPreblast) {
            console.log('Not a backblast or preblast, ignoring');
            return;
        }

        console.log(`Message identified as ${isPreblast ? 'preblast' : 'backblast'}, upserting...`);
        await handleF3EventUpsert(aoChannel.ao_display_name, rawPayload);
    }
}

async function getAOChannel(slackChannelId: string) {
    const sql = getSql();
    const rows = await sql`SELECT * FROM ao_channels WHERE slack_channel_id = ${slackChannelId} AND is_enabled = true`;
    return rows[0] || null;
}

/**
 * Upsert to canonical f3_events table with full normalization
 */
async function handleF3EventUpsert(
    aoDisplayName: string,
    rawPayload: string,
    editTs?: string
) {
    try {
        // Normalize the Slack message
        const normalized = await normalizeSlackMessage(rawPayload, aoDisplayName);

        // Prepare the f3_events record
        const record = {
            slack_channel_id: normalized.slack_channel_id,
            slack_message_ts: normalized.slack_message_ts,
            slack_permalink: normalized.slack_permalink || null,
            ao_display_name: aoDisplayName,
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
            last_slack_edit_ts: editTs || null,
            is_deleted: false,
        };

        // Upsert to f3_events
        const sql = getSql();
        const rows = await sql`
            INSERT INTO f3_events (slack_channel_id, slack_message_ts, slack_permalink, ao_display_name, event_kind, title, event_date, event_time, location_text, q_slack_user_id, q_name, pax_count, content_text, content_html, content_json, raw_envelope_json, last_slack_edit_ts, is_deleted)
            VALUES (${record.slack_channel_id}, ${record.slack_message_ts}, ${record.slack_permalink}, ${record.ao_display_name}, ${record.event_kind}, ${record.title}, ${record.event_date}, ${record.event_time}, ${record.location_text}, ${record.q_slack_user_id}, ${record.q_name}, ${record.pax_count}, ${record.content_text}, ${record.content_html}, ${JSON.stringify(record.content_json)}, ${JSON.stringify(record.raw_envelope_json)}, ${record.last_slack_edit_ts}, ${record.is_deleted})
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
                last_slack_edit_ts = EXCLUDED.last_slack_edit_ts,
                is_deleted = EXCLUDED.is_deleted,
                updated_at = now()
            RETURNING id
        `;

        if (rows.length === 0) {
            console.error('Error upserting f3_event: no rows returned');
            return;
        }

        const eventId = rows[0]?.id;
        console.log(`F3 Event upserted: ${eventId} (${normalized.event_kind})`);

        // Upsert child records
        if (eventId) {
            await upsertChildRecords(eventId, normalized);
        }

        // Trigger revalidation — home carries BackblastsPreviewSection,
        // ImpactSection background, JoinCTASection background, and the
        // Muster Log count, so it needs to refresh alongside /backblasts.
        revalidatePath('/');
        revalidatePath('/backblasts');
        if (eventId) {
            revalidatePath(`/backblasts/${eventId}`);
        }

    } catch (error) {
        console.error('Error in handleF3EventUpsert:', error);
    }
}

/**
 * Upsert child records (attendees, qs, blocks)
 */
async function upsertChildRecords(eventId: string, normalized: NormalizedEvent) {
    const sql = getSql();

    // Delete existing child records first (idempotent replace)
    await Promise.all([
        sql`DELETE FROM f3_event_attendees WHERE event_id = ${eventId}`,
        sql`DELETE FROM f3_event_qs WHERE event_id = ${eventId}`,
        sql`DELETE FROM slack_message_blocks WHERE event_id = ${eventId}`,
    ]);

    // Insert attendees
    if (normalized.attendees.length > 0) {
        for (const a of normalized.attendees) {
            try {
                await sql`INSERT INTO f3_event_attendees (event_id, attendee_external_id, attendee_slack_user_id) VALUES (${eventId}, ${a.external_id || null}, ${a.slack_user_id || null})`;
            } catch (error) {
                console.error('Error inserting attendee:', error);
            }
        }
    }

    // Insert Qs
    if (normalized.qs.length > 0) {
        for (const q of normalized.qs) {
            try {
                await sql`INSERT INTO f3_event_qs (event_id, q_external_id, q_slack_user_id) VALUES (${eventId}, ${q.external_id || null}, ${q.slack_user_id || null})`;
            } catch (error) {
                console.error('Error inserting Q:', error);
            }
        }
    }

    // Insert blocks
    if (normalized.blocks.length > 0) {
        for (const block of normalized.blocks) {
            try {
                const blockRows = await sql`INSERT INTO slack_message_blocks (event_id, block_index, block_type, block_id, block_json) VALUES (${eventId}, ${block.index}, ${block.type || null}, ${block.id || null}, ${JSON.stringify(block.json)}) RETURNING id`;

                // Insert block elements
                if (blockRows[0]?.id && block.elements && block.elements.length > 0) {
                    for (const el of block.elements) {
                        try {
                            await sql`INSERT INTO slack_block_elements (block_row_id, element_index, element_type, element_json) VALUES (${blockRows[0].id}, ${el.index}, ${el.type || null}, ${JSON.stringify(el.json)})`;
                        } catch (elError) {
                            console.error('Error inserting element:', elError);
                        }
                    }
                }
            } catch (blockError) {
                console.error('Error inserting block:', blockError);
            }
        }
    }
}

async function handleMessageDeleted(channelId: string, messageTs: string) {
    try {
        const sql = getSql();
        const rows = await sql`UPDATE f3_events SET is_deleted = true, updated_at = now() WHERE slack_channel_id = ${channelId} AND slack_message_ts = ${messageTs} RETURNING id`;
        if (rows[0]) console.log(`Soft deleted: ${rows[0].id}`);
    } catch (error) {
        console.error('Error soft-deleting f3_event:', error);
    }

    revalidatePath('/');
    revalidatePath('/backblasts');
}

