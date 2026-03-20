import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { generateCaption } from '@/lib/claude';
import {
  INSTAGRAM_CAPTION_SYSTEM_PROMPT,
  buildUserPrompt,
} from '@/lib/prompts/instagram-caption';
import type { F3Event } from '@/types/f3Event';

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sql = getSql();

  // Log the start of the run
  const runRows = await sql`INSERT INTO agent_runs (run_type, status, started_at) VALUES ('generate_drafts', 'success', now()) RETURNING id`;

  if (!runRows[0]) {
    return NextResponse.json(
      { error: 'Failed to create agent run' },
      { status: 500 }
    );
  }

  const runId = runRows[0].id;

  // Get event IDs that already have drafts
  let existingDraftRows;
  try {
    existingDraftRows = await sql`SELECT event_id FROM instagram_drafts`;
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await sql`UPDATE agent_runs SET status = 'failure', error_message = ${`Failed to query existing drafts: ${errorMessage}`}, completed_at = now() WHERE id = ${runId}`;

    return NextResponse.json(
      { error: 'Failed to query existing drafts', details: errorMessage },
      { status: 500 }
    );
  }

  const existingEventIds = (existingDraftRows ?? []).map(
    (d) => d.event_id as string
  );

  // Query backblasts that don't have drafts yet
  let events;
  try {
    if (existingEventIds.length > 0) {
      events = await sql`SELECT * FROM f3_events WHERE event_kind = 'backblast' AND is_deleted = false AND id != ALL(${existingEventIds}) ORDER BY created_at DESC`;
    } else {
      events = await sql`SELECT * FROM f3_events WHERE event_kind = 'backblast' AND is_deleted = false ORDER BY created_at DESC`;
    }
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await sql`UPDATE agent_runs SET status = 'failure', error_message = ${`Failed to query events: ${errorMessage}`}, completed_at = now() WHERE id = ${runId}`;

    return NextResponse.json(
      { error: 'Failed to query events', details: errorMessage },
      { status: 500 }
    );
  }

  const newEvents = (events ?? []) as F3Event[];

  if (newEvents.length === 0) {
    await sql`UPDATE agent_runs SET status = 'success', details = ${JSON.stringify({ message: 'No new events to process' })}, completed_at = now() WHERE id = ${runId}`;

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

      try {
        await sql`INSERT INTO instagram_drafts (event_id, caption, story_text, hashtags, alt_text, status, post_type) VALUES (${event.id}, ${result.caption}, ${result.story_text}, ${result.hashtags}, ${result.alt_text}, 'pending', 'feed')`;
        draftsCreated++;
      } catch (insertErr) {
        const insertMessage = insertErr instanceof Error ? insertErr.message : String(insertErr);
        errors.push({
          event_id: event.id,
          error: `Insert failed: ${insertMessage}`,
        });
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
  const errorMsg = errors.length > 0
    ? `${errors.length} of ${newEvents.length} drafts failed`
    : null;
  const details = errors.length > 0 ? { errors } : { drafts_created: draftsCreated };

  await sql`UPDATE agent_runs SET status = ${finalStatus}, error_message = ${errorMsg}, details = ${JSON.stringify(details)}, completed_at = now() WHERE id = ${runId}`;

  return NextResponse.json({
    drafts_created: draftsCreated,
    drafts_skipped: existingEventIds.length,
    errors,
  });
}
