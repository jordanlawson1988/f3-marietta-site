import { isBackblastPayload, isPreblastPayload } from '@/lib/slack/normalizeSlackMessage';

/**
 * Pure pre-DB triage for Slack Events API messages.
 *
 * The events webhook fires for EVERY top-level message in channels the bot
 * belongs to, but only ~1-3 messages/day are actual backblasts/preblasts.
 * Triaging on the raw payload before any database access keeps ordinary
 * chatter from waking the Neon endpoint (each wake costs ~5 min of compute
 * on the free-tier autosuspend).
 */

export interface TriageableSlackEvent {
  type: string;
  subtype?: string;
  ts: string;
  thread_ts?: string;
  message?: {
    ts: string;
    thread_ts?: string;
  };
  previous_message?: {
    ts: string;
  };
}

export type SlackTriageResult =
  | { action: 'ignore'; reason: 'not_message' | 'thread_reply' | 'not_f3_content' | 'unsupported_subtype' }
  | { action: 'delete'; previousTs: string }
  | { action: 'upsert'; kind: 'backblast' | 'preblast'; editTs?: string };

export function triageSlackEvent(event: TriageableSlackEvent, rawPayload: string): SlackTriageResult {
  if (event.type !== 'message') return { action: 'ignore', reason: 'not_message' };

  // Thread replies never carry F3 events — only top-level messages do.
  // A reply has thread_ts differing from its own ts (parents have them equal).
  const messageTs = event.message?.ts || event.ts;
  const threadTs = event.message?.thread_ts || event.thread_ts;
  if (threadTs && threadTs !== messageTs) return { action: 'ignore', reason: 'thread_reply' };

  if (event.subtype === 'message_deleted' && event.previous_message) {
    return { action: 'delete', previousTs: event.previous_message.ts };
  }

  if (event.subtype === 'message_changed' && event.message) {
    const kind = classify(rawPayload);
    // The top-level ts of a message_changed envelope is the edit timestamp.
    return kind ? { action: 'upsert', kind, editTs: event.ts } : { action: 'ignore', reason: 'not_f3_content' };
  }

  if (!event.subtype || event.subtype === 'bot_message') {
    const kind = classify(rawPayload);
    return kind ? { action: 'upsert', kind } : { action: 'ignore', reason: 'not_f3_content' };
  }

  return { action: 'ignore', reason: 'unsupported_subtype' };
}

function classify(rawPayload: string): 'backblast' | 'preblast' | null {
  if (isBackblastPayload(rawPayload)) return 'backblast';
  if (isPreblastPayload(rawPayload)) return 'preblast';
  return null;
}
