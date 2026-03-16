import { NextResponse } from 'next/server';
import { verifyCronSecret } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { generateNewsletter } from '@/lib/claude';
import {
  NEWSLETTER_SYSTEM_PROMPT,
  buildUserPrompt,
} from '@/lib/prompts/newsletter';
import type { F3Event } from '@/types';

function getWeekBoundaries(): { weekStart: string; weekEnd: string } {
  const now = new Date();

  // week_start = 12 days ago, week_end = 6 days ago
  // When cron runs on Saturday: week_start = previous Monday, week_end = previous Sunday
  const msPerDay = 24 * 60 * 60 * 1000;

  const weekStartDate = new Date(now.getTime() - 12 * msPerDay);
  const weekEndDate = new Date(now.getTime() - 6 * msPerDay);

  const weekStart = weekStartDate.toISOString().split('T')[0];
  const weekEnd = weekEndDate.toISOString().split('T')[0];

  return { weekStart, weekEnd };
}

export async function GET(request: Request) {
  const authError = verifyCronSecret(request);
  if (authError) return authError;

  // Allow manual override via query params: ?week_start=2026-03-10&week_end=2026-03-16
  const url = new URL(request.url);
  const manualStart = url.searchParams.get('week_start');
  const manualEnd = url.searchParams.get('week_end');

  const { weekStart, weekEnd } = manualStart && manualEnd
    ? { weekStart: manualStart, weekEnd: manualEnd }
    : getWeekBoundaries();

  // Check if newsletter already exists for this week
  const { data: existing, error: existingError } = await supabase
    .from('newsletters')
    .select('id')
    .eq('week_start', weekStart)
    .maybeSingle();

  if (existingError) {
    return NextResponse.json(
      { error: 'Failed to check existing newsletters', details: existingError.message },
      { status: 500 }
    );
  }

  if (existing) {
    return NextResponse.json({
      message: `Newsletter already exists for week ${weekStart} to ${weekEnd}`,
      newsletter_id: existing.id,
    });
  }

  // Query backblasts for the week
  const { data: events, error: eventsError } = await supabase
    .from('f3_events')
    .select('*')
    .eq('event_kind', 'backblast')
    .eq('is_deleted', false)
    .gte('created_at', `${weekStart}T00:00:00Z`)
    .lte('created_at', `${weekEnd}T23:59:59Z`)
    .order('created_at', { ascending: true });

  if (eventsError) {
    return NextResponse.json(
      { error: 'Failed to query events', details: eventsError.message },
      { status: 500 }
    );
  }

  const weekEvents = (events ?? []) as F3Event[];

  if (weekEvents.length === 0) {
    return NextResponse.json({
      message: `No events found for week ${weekStart} to ${weekEnd}`,
      events_count: 0,
    });
  }

  // Log the start of the run
  const { data: run, error: runError } = await supabase
    .from('agent_runs')
    .insert({
      run_type: 'generate_newsletter',
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

  try {
    const result = await generateNewsletter(
      NEWSLETTER_SYSTEM_PROMPT,
      buildUserPrompt(weekEvents, weekStart, weekEnd)
    );

    const { data: newsletter, error: insertError } = await supabase
      .from('newsletters')
      .insert({
        week_start: weekStart,
        week_end: weekEnd,
        title: result.title,
        body_markdown: result.body_markdown,
        body_slack_mrkdwn: result.body_slack_mrkdwn,
        status: 'draft',
      })
      .select('id')
      .single();

    if (insertError) {
      await supabase
        .from('agent_runs')
        .update({
          status: 'failure',
          error_message: `Failed to insert newsletter: ${insertError.message}`,
          completed_at: new Date().toISOString(),
        })
        .eq('id', run.id);

      return NextResponse.json(
        { error: 'Failed to insert newsletter', details: insertError.message },
        { status: 500 }
      );
    }

    await supabase
      .from('agent_runs')
      .update({
        status: 'success',
        details: {
          newsletter_id: newsletter?.id,
          week_start: weekStart,
          week_end: weekEnd,
          events_count: weekEvents.length,
        },
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return NextResponse.json({
      newsletter_id: newsletter?.id,
      week_start: weekStart,
      week_end: weekEnd,
      events_count: weekEvents.length,
      title: result.title,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await supabase
      .from('agent_runs')
      .update({
        status: 'failure',
        error_message: errorMessage,
        completed_at: new Date().toISOString(),
      })
      .eq('id', run.id);

    return NextResponse.json(
      { error: 'Failed to generate newsletter', details: errorMessage },
      { status: 500 }
    );
  }
}
