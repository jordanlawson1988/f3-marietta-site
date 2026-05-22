import { NextResponse } from 'next/server';
import { revalidatePath } from 'next/cache';
import { getSql } from '@/lib/db';
import { validateAdminToken } from '@/lib/admin/auth';
import { joinSlackChannel, resolveBotForChannel } from '@/lib/slack/joinChannel';
import { reconcileSingleChannel } from '@/lib/slack/reconcileChannels';

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
    const prior = await sql`SELECT is_enabled FROM ao_channels WHERE id = ${id}`;
    if (prior.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const prevEnabled = !!prior[0].is_enabled;

    const data = await sql`
      UPDATE ao_channels SET
        ao_display_name = ${body.ao_display_name},
        slack_channel_name = ${body.slack_channel_name ?? null},
        is_enabled = ${body.is_enabled}
      WHERE id = ${id}
      RETURNING *
    `;
    const channel = data[0] as { id: string; slack_channel_id: string; ao_display_name: string; is_enabled: boolean };

    let botStatus = null;
    if (channel.is_enabled) {
      botStatus = await resolveBotForChannel(
        { slackChannelId: channel.slack_channel_id, displayName: channel.ao_display_name, prevEnabled, nextEnabled: true },
        { join: joinSlackChannel, reconcile: reconcileSingleChannel }
      );
      if (botStatus.backfilled > 0) {
        revalidatePath('/backblasts');
        revalidatePath('/');
      }
    }

    return NextResponse.json({ channel, botStatus });
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
