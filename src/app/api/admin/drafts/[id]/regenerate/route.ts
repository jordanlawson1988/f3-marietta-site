import { NextRequest, NextResponse } from 'next/server';
import { validateAdminToken } from '@/lib/admin/auth';
import { getSql } from '@/lib/db';
import { generateCaption } from '@/lib/claude';
import {
  INSTAGRAM_CAPTION_SYSTEM_PROMPT,
  buildUserPrompt,
} from '@/lib/prompts/instagram-caption';
import type { F3Event } from '@/types/f3Event';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateAdminToken(_request);
  if (authError) return authError;

  const { id } = await params;

  try {
    const sql = getSql();

    // Fetch draft with joined event data
    const rows = await sql`
      SELECT d.*,
        json_build_object(
          'id', e.id,
          'ao_display_name', e.ao_display_name,
          'event_kind', e.event_kind,
          'title', e.title,
          'event_date', e.event_date,
          'q_name', e.q_name,
          'pax_count', e.pax_count,
          'content_text', e.content_text,
          'created_at', e.created_at
        ) AS f3_event
      FROM instagram_drafts d
      INNER JOIN f3_events e ON d.event_id = e.id
      WHERE d.id = ${id}
    `;

    const draft = rows[0];

    if (!draft) {
      return NextResponse.json(
        { error: 'Draft not found' },
        { status: 404 }
      );
    }

    // Build regeneration prompt with previous caption context
    const event = draft.f3_event as unknown as F3Event;
    const basePrompt = buildUserPrompt(event);
    const regeneratePrompt = [
      basePrompt,
      '',
      'PREVIOUS CAPTION (do NOT repeat this):',
      draft.caption,
      '',
      'Generate a DIFFERENT caption variation. Avoid repeating the previous version.',
    ].join('\n');

    const result = await generateCaption(
      INSTAGRAM_CAPTION_SYSTEM_PROMPT,
      regeneratePrompt
    );

    const updated = await sql`
      UPDATE instagram_drafts SET
        caption = ${result.caption},
        story_text = ${result.story_text},
        hashtags = ${result.hashtags},
        alt_text = ${result.alt_text},
        status = 'pending',
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(updated[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json(
      { error: 'Failed to regenerate caption', details: message },
      { status: 500 }
    );
  }
}
