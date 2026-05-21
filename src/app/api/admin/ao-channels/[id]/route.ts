import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { validateAdminToken } from '@/lib/admin/auth';

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  try {
    const sql = getSql();
    const data = await sql`
      UPDATE ao_channels SET
        ao_display_name = ${body.ao_display_name},
        slack_channel_name = ${body.slack_channel_name ?? null},
        is_enabled = ${body.is_enabled}
      WHERE id = ${id}
      RETURNING *
    `;
    if (data.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ channel: data[0] });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const { id } = await params;

  try {
    const sql = getSql();
    const deleted = await sql`DELETE FROM ao_channels WHERE id = ${id} RETURNING id`;
    if (deleted.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Database error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
