import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/auth';
import { getSql } from '@/lib/db';
import { generateNewsletter } from '@/lib/claude';
import {
  NEWSLETTER_SYSTEM_PROMPT,
  buildUserPrompt,
} from '@/lib/prompts/newsletter';
import type { F3Event } from '@/types/f3Event';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession(request);
  if (session.error) return session.error;

  const { id } = await params;

  const sql = getSql();

  const newsletterRows = await sql`SELECT * FROM newsletters WHERE id = ${id}`;
  const newsletter = newsletterRows[0];

  if (!newsletter) {
    return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
  }

  let incomingNotes: string | null | undefined;
  try {
    const body = (await request.json()) as { notes?: string | null };
    incomingNotes = body.notes;
  } catch {
    incomingNotes = undefined;
  }

  const notes =
    incomingNotes === undefined ? (newsletter.notes as string | null) : incomingNotes;

  const toDateString = (value: unknown): string => {
    if (value instanceof Date) return value.toISOString().split('T')[0];
    if (typeof value === 'string') return value.length > 10 ? value.slice(0, 10) : value;
    return String(value);
  };
  const weekStart = toDateString(newsletter.week_start);
  const weekEnd = toDateString(newsletter.week_end);

  let eventRows;
  try {
    eventRows = await sql`SELECT * FROM f3_events WHERE event_kind = 'backblast' AND is_deleted = false AND created_at >= ${weekStart + 'T00:00:00Z'} AND created_at <= ${weekEnd + 'T23:59:59Z'} ORDER BY created_at ASC`;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: 'Failed to query events', details: message },
      { status: 500 }
    );
  }

  const weekEvents = (eventRows ?? []) as F3Event[];

  if (weekEvents.length === 0) {
    return NextResponse.json(
      { error: `No events found for week ${weekStart} to ${weekEnd}` },
      { status: 400 }
    );
  }

  const runRows = await sql`INSERT INTO agent_runs (run_type, status, started_at) VALUES ('generate_newsletter', 'success', now()) RETURNING id`;
  const runId = runRows[0]?.id;

  try {
    const result = await generateNewsletter(
      NEWSLETTER_SYSTEM_PROMPT,
      buildUserPrompt(weekEvents, weekStart, weekEnd, notes)
    );

    const updated = await sql`
      UPDATE newsletters SET
        title = ${result.title},
        body_markdown = ${result.body_markdown},
        body_slack_mrkdwn = ${result.body_slack_mrkdwn},
        notes = ${notes},
        last_edited_by = ${session.user.email},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    if (runId) {
      await sql`UPDATE agent_runs SET status = 'success', details = ${JSON.stringify({ newsletter_id: id, week_start: weekStart, week_end: weekEnd, events_count: weekEvents.length, regenerated: true, has_notes: Boolean(notes && notes.trim()) })}, completed_at = now() WHERE id = ${runId}`;
    }

    return NextResponse.json(updated[0]);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (runId) {
      await sql`UPDATE agent_runs SET status = 'failure', error_message = ${message}, completed_at = now() WHERE id = ${runId}`;
    }
    return NextResponse.json(
      { error: 'Failed to regenerate newsletter', details: message },
      { status: 500 }
    );
  }
}
