import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { postNewsletter } from '@/lib/slack';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await verifySession();
  if (authError) return authError;

  const { id } = await params;

  const { data: newsletter, error: fetchError } = await supabase
    .from('newsletters')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !newsletter) {
    return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
  }

  if (!newsletter.body_slack_mrkdwn) {
    return NextResponse.json({ error: 'Newsletter has no Slack content' }, { status: 400 });
  }

  // Update status to approved
  await supabase
    .from('newsletters')
    .update({
      status: 'approved',
      approved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);

  try {
    const messageTs = await postNewsletter(newsletter.body_slack_mrkdwn);

    const { data: updated, error: updateError } = await supabase
      .from('newsletters')
      .update({
        status: 'posted',
        posted_at: new Date().toISOString(),
        slack_message_ts: messageTs,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      return NextResponse.json({ error: updateError.message }, { status: 500 });
    }

    // Log success
    await supabase.from('agent_runs').insert({
      run_type: 'publish_newsletter',
      status: 'success',
      details: { newsletter_id: id, slack_message_ts: messageTs },
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json(updated);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Slack publish failed';

    // Log failure
    await supabase.from('agent_runs').insert({
      run_type: 'publish_newsletter',
      status: 'failure',
      error_message: errorMessage,
      details: { newsletter_id: id },
      completed_at: new Date().toISOString(),
    });

    return NextResponse.json(
      { error: errorMessage, status: 'approved' },
      { status: 502 }
    );
  }
}
