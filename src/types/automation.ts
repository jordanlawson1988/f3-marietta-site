import type { F3Event } from './f3Event';

export interface InstagramDraft {
  id: string;
  event_id: string;
  caption: string;
  story_text: string | null;
  hashtags: string[];
  alt_text: string | null;
  image_url: string | null;
  image_storage_path: string | null;
  status: 'pending' | 'approved' | 'posted' | 'rejected' | 'edited';
  post_type: 'feed' | 'story';
  buffer_post_id: string | null;
  approved_at: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Newsletter {
  id: string;
  week_start: string;
  week_end: string;
  title: string | null;
  body_markdown: string | null;
  body_slack_mrkdwn: string | null;
  status: 'draft' | 'approved' | 'posted';
  slack_message_ts: string | null;
  approved_at: string | null;
  posted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AgentRun {
  id: string;
  run_type: 'generate_drafts' | 'generate_newsletter' | 'publish_instagram' | 'publish_newsletter';
  status: 'success' | 'failure' | 'partial';
  details: Record<string, unknown> | null;
  error_message: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface DraftWithEvent extends InstagramDraft {
  f3_event: Pick<F3Event, 'ao_display_name' | 'event_date' | 'q_name' | 'pax_count' | 'content_text'>;
}

export interface CaptionGeneration {
  caption: string;
  story_text: string;
  hashtags: string[];
  alt_text: string;
}
