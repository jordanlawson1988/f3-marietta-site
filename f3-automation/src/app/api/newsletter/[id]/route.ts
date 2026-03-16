import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifySession();
  if (authError) return authError;

  const { id } = await params;
  const body = await request.json();

  const updateFields: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (body.title !== undefined) updateFields.title = body.title;
  if (body.body_markdown !== undefined) updateFields.body_markdown = body.body_markdown;
  if (body.body_slack_mrkdwn !== undefined) updateFields.body_slack_mrkdwn = body.body_slack_mrkdwn;

  const { data, error } = await supabase
    .from('newsletters')
    .update(updateFields)
    .eq('id', id)
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(data);
}
