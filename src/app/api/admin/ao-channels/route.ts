import { NextResponse } from 'next/server';
import { getSql } from '@/lib/db';
import { validateAdminToken } from '@/lib/admin/auth';
import { validateAoChannelInput } from '@/lib/admin/aoChannelValidation';

export async function GET(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  try {
    const sql = getSql();
    const data = await sql`SELECT * FROM ao_channels ORDER BY ao_display_name ASC`;
    return NextResponse.json({ channels: data });
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Database error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const v = validateAoChannelInput(await request.json());
  if (!v.ok) return NextResponse.json({ error: v.error }, { status: 400 });

  try {
    const sql = getSql();
    const dup = await sql`SELECT id FROM ao_channels WHERE slack_channel_id = ${v.value.slack_channel_id}`;
    if (dup.length) return NextResponse.json({ error: 'That Slack channel is already registered' }, { status: 409 });

    const nameDup = await sql`SELECT id FROM ao_channels WHERE lower(ao_display_name) = lower(${v.value.ao_display_name})`;
    const data = await sql`
      INSERT INTO ao_channels (slack_channel_id, slack_channel_name, ao_display_name, is_enabled)
      VALUES (${v.value.slack_channel_id}, ${v.value.slack_channel_name}, ${v.value.ao_display_name}, ${v.value.is_enabled})
      RETURNING *
    `;
    return NextResponse.json(
      {
        channel: data[0],
        warning: nameDup.length ? 'Another channel already uses this display name (analytics groups by it)' : null,
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    return NextResponse.json({ error: e instanceof Error ? e.message : 'Database error' }, { status: 500 });
  }
}
