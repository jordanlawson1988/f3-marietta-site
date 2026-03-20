import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { getSql } from '@/lib/db';
import type { DraftWithEvent } from '@/types';

export async function GET(request: NextRequest) {
  const authError = await verifySession();
  if (authError) return authError;

  const status = request.nextUrl.searchParams.get('status');

  try {
    const sql = getSql();
    let rows: DraftWithEvent[];

    if (status) {
      const statuses = status.split(',');
      rows = await sql`
        SELECT d.*,
          json_build_object(
            'ao_display_name', e.ao_display_name,
            'event_date', e.event_date,
            'q_name', e.q_name,
            'pax_count', e.pax_count,
            'content_text', e.content_text
          ) AS f3_event
        FROM instagram_drafts d
        INNER JOIN f3_events e ON d.event_id = e.id
        WHERE d.status = ANY(${statuses})
        ORDER BY d.created_at DESC
      ` as unknown as DraftWithEvent[];
    } else {
      rows = await sql`
        SELECT d.*,
          json_build_object(
            'ao_display_name', e.ao_display_name,
            'event_date', e.event_date,
            'q_name', e.q_name,
            'pax_count', e.pax_count,
            'content_text', e.content_text
          ) AS f3_event
        FROM instagram_drafts d
        INNER JOIN f3_events e ON d.event_id = e.id
        ORDER BY d.created_at DESC
      ` as unknown as DraftWithEvent[];
    }

    return NextResponse.json(rows);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json(
      { error: 'Failed to fetch drafts', details: message },
      { status: 500 }
    );
  }
}
