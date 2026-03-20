import { NextRequest, NextResponse } from 'next/server';
import { validateAdminToken } from '@/lib/admin/auth';
import { getSql } from '@/lib/db';
import { postNewsletter } from '@/lib/slack/postNewsletter';

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const authError = await validateAdminToken(_request);
  if (authError) return authError;

  const { id } = await params;
  const sql = getSql();

  const rows = await sql`SELECT * FROM newsletters WHERE id = ${id}`;

  if (!rows[0]) {
    return NextResponse.json({ error: 'Newsletter not found' }, { status: 404 });
  }

  const newsletter = rows[0];

  if (!newsletter.body_slack_mrkdwn) {
    return NextResponse.json({ error: 'Newsletter has no Slack content' }, { status: 400 });
  }

  // Update status to approved
  await sql`UPDATE newsletters SET status = 'approved', approved_at = now(), updated_at = now() WHERE id = ${id}`;

  try {
    const messageTs = await postNewsletter(newsletter.body_slack_mrkdwn as string);

    const updatedRows = await sql`UPDATE newsletters SET status = 'posted', posted_at = now(), slack_message_ts = ${messageTs}, updated_at = now() WHERE id = ${id} RETURNING *`;

    if (!updatedRows[0]) {
      return NextResponse.json({ error: 'Failed to update newsletter' }, { status: 500 });
    }

    // Log success
    await sql`INSERT INTO agent_runs (run_type, status, details, completed_at) VALUES ('publish_newsletter', 'success', ${JSON.stringify({ newsletter_id: id, slack_message_ts: messageTs })}, now())`;

    return NextResponse.json(updatedRows[0]);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Slack publish failed';

    // Log failure
    await sql`INSERT INTO agent_runs (run_type, status, error_message, details, completed_at) VALUES ('publish_newsletter', 'failure', ${errorMessage}, ${JSON.stringify({ newsletter_id: id })}, now())`;

    return NextResponse.json(
      { error: errorMessage, status: 'approved' },
      { status: 502 }
    );
  }
}
