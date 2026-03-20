import { NextRequest, NextResponse } from 'next/server';
import { validateAdminToken } from '@/lib/admin/auth';
import { getSql } from '@/lib/db';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  try {
    const sql = getSql();

    const data = await sql`
      UPDATE newsletters SET
        title = COALESCE(${body.title ?? null}, title),
        body_markdown = COALESCE(${body.body_markdown ?? null}, body_markdown),
        body_slack_mrkdwn = COALESCE(${body.body_slack_mrkdwn ?? null}, body_slack_mrkdwn),
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    return NextResponse.json(data[0]);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
