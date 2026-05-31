import { getSql } from '@/lib/db';
import { normalizeSlackMessage, isBackblastPayload, isPreblastPayload } from '@/lib/slack/normalizeSlackMessage';
import { extractSlackImageFiles, rehostSlackImageFiles, appendImageBlocks } from '@/lib/slack/slackImages';

export interface ReconcileResult {
  processed: number;
  errors: number;
  channels: number;
}

interface SlackMessage {
  ts: string;
  text?: string;
  user?: string;
  bot_id?: string;
  app_id?: string;
  subtype?: string;
  thread_ts?: string;
  metadata?: Record<string, unknown>;
  blocks?: unknown[];
  files?: unknown[];
}

interface SlackConversationsResponse {
  ok: boolean;
  messages?: SlackMessage[];
  error?: string;
}

/**
 * Pull last-100 history for every enabled ao_channel and idempotently upsert
 * backblast/preblast rows into f3_events. Pure data work — no revalidate, no
 * knowledge rebuild (callers own those side effects).
 */
export async function reconcileEnabledChannels(): Promise<ReconcileResult> {
  const botToken = process.env.SLACK_BOT_TOKEN;
  if (!botToken) throw new Error('SLACK_BOT_TOKEN not configured');

  const sql = getSql();
  let channels;
  try {
    channels = await sql`SELECT * FROM ao_channels WHERE is_enabled = true`;
  } catch (channelsError) {
    console.error('Error fetching channels:', channelsError);
    throw new Error('Database error');
  }

  if (!channels || channels.length === 0) {
    console.error('No enabled channels found');
    return { processed: 0, errors: 0, channels: 0 };
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
        if (message.subtype === 'thread_broadcast') continue;
        if (message.thread_ts && message.thread_ts !== message.ts) continue;

        // Build raw payload preserving metadata and blocks
        // metadata.event_type is required to detect bot-posted backblasts
        // (their text doesn't start with "Backblast")
        const rawPayload = JSON.stringify({
          event: {
            type: 'message',
            channel: channel.slack_channel_id,
            ts: message.ts,
            text: message.text || '',
            user: message.user,
            bot_id: message.bot_id,
            metadata: message.metadata,
            blocks: message.blocks,
            files: message.files,
          },
        });

        if (!isBackblastPayload(rawPayload) && !isPreblastPayload(rawPayload)) {
          continue;
        }

        try {
          const normalized = await normalizeSlackMessage(rawPayload, channel.ao_display_name);

          // Re-host human-uploaded photos (Slack file attachments) to Blob and
          // inject image blocks so the display surfaces them. Non-fatal.
          try {
            const imageFiles = extractSlackImageFiles({ files: message.files });
            if (imageFiles.length > 0) {
              const urls = await rehostSlackImageFiles(imageFiles);
              if (urls.length > 0) {
                normalized.content_json = appendImageBlocks(normalized.content_json, urls);
              }
            }
          } catch (photoErr) {
            console.error('[reconcile] photo rehost failed (non-fatal):', photoErr);
          }

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

  console.log(`Reconciliation complete: ${processedCount} processed, ${errorCount} errors`);

  return { processed: processedCount, errors: errorCount, channels: channels.length };
}
