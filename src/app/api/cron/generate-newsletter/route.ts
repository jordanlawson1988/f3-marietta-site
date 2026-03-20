import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { generateNewsletter } from '@/lib/claude';
import {
  NEWSLETTER_SYSTEM_PROMPT,
  buildUserPrompt,
} from '@/lib/prompts/newsletter';
import type { F3Event } from '@/types/f3Event';

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
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = getSql();

  // Allow manual override via query params: ?week_start=2026-03-10&week_end=2026-03-16
  const url = new URL(request.url);
  const manualStart = url.searchParams.get('week_start');
  const manualEnd = url.searchParams.get('week_end');

  const { weekStart, weekEnd } = manualStart && manualEnd
    ? { weekStart: manualStart, weekEnd: manualEnd }
    : getWeekBoundaries();

  // Check if newsletter already exists for this week
  const existingRows = await sql`SELECT id FROM newsletters WHERE week_start = ${weekStart}`;

  if (existingRows[0]) {
    return NextResponse.json({
      message: `Newsletter already exists for week ${weekStart} to ${weekEnd}`,
      newsletter_id: existingRows[0].id,
    });
  }

  // Query backblasts for the week
  let eventRows;
  try {
    eventRows = await sql`SELECT * FROM f3_events WHERE event_kind = 'backblast' AND is_deleted = false AND created_at >= ${weekStart + 'T00:00:00Z'} AND created_at <= ${weekEnd + 'T23:59:59Z'} ORDER BY created_at ASC`;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to query events', details: errorMessage },
      { status: 500 }
    );
  }

  const weekEvents = (eventRows ?? []) as F3Event[];

  if (weekEvents.length === 0) {
    return NextResponse.json({
      message: `No events found for week ${weekStart} to ${weekEnd}`,
      events_count: 0,
    });
  }

  // Log the start of the run
  const runRows = await sql`INSERT INTO agent_runs (run_type, status, started_at) VALUES ('generate_newsletter', 'success', now()) RETURNING id`;

  if (!runRows[0]) {
    return NextResponse.json(
      { error: 'Failed to create agent run' },
      { status: 500 }
    );
  }

  const runId = runRows[0].id;

  try {
    const result = await generateNewsletter(
      NEWSLETTER_SYSTEM_PROMPT,
      buildUserPrompt(weekEvents, weekStart, weekEnd)
    );

    let newsletterId;
    try {
      const newsletterRows = await sql`INSERT INTO newsletters (week_start, week_end, title, body_markdown, body_slack_mrkdwn, status) VALUES (${weekStart}, ${weekEnd}, ${result.title}, ${result.body_markdown}, ${result.body_slack_mrkdwn}, 'draft') RETURNING id`;
      newsletterId = newsletterRows[0]?.id;
    } catch (insertErr) {
      const insertMessage = insertErr instanceof Error ? insertErr.message : String(insertErr);

      await sql`UPDATE agent_runs SET status = 'failure', error_message = ${`Failed to insert newsletter: ${insertMessage}`}, completed_at = now() WHERE id = ${runId}`;

      return NextResponse.json(
        { error: 'Failed to insert newsletter', details: insertMessage },
        { status: 500 }
      );
    }

    await sql`UPDATE agent_runs SET status = 'success', details = ${JSON.stringify({ newsletter_id: newsletterId, week_start: weekStart, week_end: weekEnd, events_count: weekEvents.length })}, completed_at = now() WHERE id = ${runId}`;

    return NextResponse.json({
      newsletter_id: newsletterId,
      week_start: weekStart,
      week_end: weekEnd,
      events_count: weekEvents.length,
      title: result.title,
    });
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await sql`UPDATE agent_runs SET status = 'failure', error_message = ${errorMessage}, completed_at = now() WHERE id = ${runId}`;

    return NextResponse.json(
      { error: 'Failed to generate newsletter', details: errorMessage },
      { status: 500 }
    );
  }
}
