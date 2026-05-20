import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession } from '@/lib/admin/auth';
import { getSql } from '@/lib/db';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession(request);
  if (session.error) return session.error;

  const { id } = await params;

  try {
    const sql = getSql();
    const rows = await sql`SELECT * FROM newsletters WHERE id = ${id}`;

    if (!rows[0]) {
      return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
    }

    return NextResponse.json(rows[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession(request);
  if (session.error) return session.error;

  const { id } = await params;
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const weekStart = typeof body.week_start === 'string' ? body.week_start : undefined;
  const weekEnd = typeof body.week_end === 'string' ? body.week_end : undefined;

  if (weekStart !== undefined && !DATE_RE.test(weekStart)) {
    return NextResponse.json(
      { error: 'week_start must be YYYY-MM-DD' },
      { status: 400 }
    );
  }
  if (weekEnd !== undefined && !DATE_RE.test(weekEnd)) {
    return NextResponse.json(
      { error: 'week_end must be YYYY-MM-DD' },
      { status: 400 }
    );
  }
  if (weekStart && weekEnd && weekStart > weekEnd) {
    return NextResponse.json(
      { error: 'week_end must be on or after week_start' },
      { status: 400 }
    );
  }

  const notesProvided = Object.prototype.hasOwnProperty.call(body, 'notes');

  try {
    const sql = getSql();

    const data = await sql`
      UPDATE newsletters SET
        title = COALESCE(${(body.title as string | null) ?? null}, title),
        body_markdown = COALESCE(${(body.body_markdown as string | null) ?? null}, body_markdown),
        body_slack_mrkdwn = COALESCE(${(body.body_slack_mrkdwn as string | null) ?? null}, body_slack_mrkdwn),
        notes = CASE WHEN ${notesProvided}::boolean THEN ${(body.notes as string | null) ?? null} ELSE notes END,
        week_start = COALESCE(${weekStart ?? null}::date, week_start),
        week_end = COALESCE(${weekEnd ?? null}::date, week_end),
        last_edited_by = ${session.user.email},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!data[0]) {
      return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
    }

    return NextResponse.json(data[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession(request);
  if (session.error) return session.error;

  const { id } = await params;

  try {
    const sql = getSql();

    const rows = await sql`SELECT status FROM newsletters WHERE id = ${id}`;
    if (!rows[0]) {
      return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
    }
    if (rows[0].status === 'posted') {
      return NextResponse.json(
        { error: 'Cannot delete a posted newsletter' },
        { status: 400 }
      );
    }

    await sql`DELETE FROM newsletters WHERE id = ${id}`;
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
