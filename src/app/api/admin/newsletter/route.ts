import { NextRequest, NextResponse } from 'next/server';
import { getAdminSession, validateAdminToken } from '@/lib/admin/auth';
import { getSql } from '@/lib/db';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(request: NextRequest) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  try {
    const sql = getSql();

    const data = await sql`SELECT * FROM newsletters ORDER BY week_start DESC, created_at DESC`;

    return NextResponse.json(data);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const session = await getAdminSession(request);
  if (session.error) return session.error;

  let body: { week_start?: string; week_end?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const weekStart = body.week_start;
  const weekEnd = body.week_end;

  if (!weekStart || !weekEnd) {
    return NextResponse.json(
      { error: 'week_start and week_end are required (YYYY-MM-DD)' },
      { status: 400 }
    );
  }

  if (!DATE_RE.test(weekStart) || !DATE_RE.test(weekEnd)) {
    return NextResponse.json(
      { error: 'Dates must be YYYY-MM-DD' },
      { status: 400 }
    );
  }

  if (weekStart > weekEnd) {
    return NextResponse.json(
      { error: 'week_end must be on or after week_start' },
      { status: 400 }
    );
  }

  try {
    const sql = getSql();

    const existing = await sql`SELECT id FROM newsletters WHERE week_start = ${weekStart}`;
    if (existing[0]) {
      return NextResponse.json(
        { error: `A newsletter already exists for the week of ${weekStart}`, id: existing[0].id },
        { status: 409 }
      );
    }

    const rows = await sql`
      INSERT INTO newsletters (week_start, week_end, status, created_by, last_edited_by)
      VALUES (${weekStart}, ${weekEnd}, 'draft', ${session.user.email}, ${session.user.email})
      RETURNING *
    `;

    return NextResponse.json(rows[0], { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
