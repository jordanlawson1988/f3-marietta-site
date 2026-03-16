import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { generateCaption } from '@/lib/claude';
import {
  INSTAGRAM_CAPTION_SYSTEM_PROMPT,
  buildUserPrompt,
} from '@/lib/prompts/instagram-caption';
import type { F3Event } from '@/types';

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  // Log the start of the run
  const { data: run, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      run_type: 'generate_drafts',
      status: 'success',
      started_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (runError || !run) {
    return NextResponse.json(
      { error: 'Failed to create agent run', details: runError?.message },
      { status: 500 }
    );
  }

  // Get event IDs that already have drafts
  const { data: existingDrafts, error: draftsError } = await supabase
    .from('instagram_drafts')
    .select('event_id');

  if (draftsError) {
    await supabase
      .from('agent_runs')
      .update({
        status: 'failure',
        error_message: `Failed to query existing drafts: ${draftsError.message}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return NextResponse.json(
      { error: 'Failed to query existing drafts', details: draftsError.message },
      { status: 500 }
    );
  }

  const existingEventIds = (existingDrafts ?? []).map(
    (d: { event_id: string }) => d.event_id
  );

  // Query backblasts that don't have drafts yet
  let query = supabase
    .from('f3_events')
    .select('*')
    .eq('event_kind', 'backblast')
    .eq('is_deleted', false)
    .order('event_date', { ascending: false });

  if (existingEventIds.length > 0) {
    // Supabase's .not('id', 'in', ...) expects a parenthesized list
    query = query.not(
      'id',
      'in',
      `(${existingEventIds.join(',')})`
    );
  }

  const { data: events, error: eventsError } = await query;

  if (eventsError) {
    await supabase
      .from('agent_runs')
      .update({
        status: 'failure',
        error_message: `Failed to query events: ${eventsError.message}`,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return NextResponse.json(
      { error: 'Failed to query events', details: eventsError.message },
      { status: 500 }
    );
  }

  const newEvents = (events ?? []) as F3Event[];

  if (newEvents.length === 0) {
    await supabase
      .from('agent_runs')
      .update({
        status: 'success',
        details: { message: 'No new events to process' },
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return NextResponse.json({
      drafts_created: 0,
      drafts_skipped: existingEventIds.length,
      errors: [],
    });
  }

  // Process each event
  let draftsCreated = 0;
  const errors: { event_id: string; error: string }[] = [];

  for (const event of newEvents) {
    try {
      const result = await generateCaption(
        INSTAGRAM_CAPTION_SYSTEM_PROMPT,
        buildUserPrompt(event)
      );

      const { error: insertError } = await supabase
        .from('instagram_drafts')
        .insert({
          event_id: event.id,
          caption: result.caption,
          story_text: result.story_text,
          hashtags: result.hashtags,
          alt_text: result.alt_text,
          status: 'pending',
          post_type: 'feed',
        });

      if (insertError) {
        errors.push({
          event_id: event.id,
          error: `Insert failed: ${insertError.message}`,
        });
      } else {
        draftsCreated++;
      }
    } catch (err) {
      errors.push({
        event_id: event.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  // Determine final run status
  const allFailed = draftsCreated === 0 && errors.length > 0;
  const someFailed = draftsCreated > 0 && errors.length > 0;
  const finalStatus = allFailed ? 'failure' : someFailed ? 'partial' : 'success';

  await supabase
    .from('agent_runs')
    .update({
      status: finalStatus,
      error_message: errors.length > 0
        ? `${errors.length} of ${newEvents.length} drafts failed`
        : null,
      details: errors.length > 0 ? { errors } : { drafts_created: draftsCreated },
      completed_at: new Date().toISOString(),
    })
    .eq('id', run.id);

  return NextResponse.json({
    drafts_created: draftsCreated,
    drafts_skipped: existingEventIds.length,
    errors,
  });
}
