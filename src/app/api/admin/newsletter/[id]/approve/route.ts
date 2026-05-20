import { NextRequest, NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { getAdminSession } from '@/lib/admin/auth';
import { getSql } from '@/lib/db';
import { postNewsletter } from '@/lib/slack/postNewsletter';

function gravatarIdenticon(email: string): string {
  const hash = createHash('md5').update(email.trim().toLowerCase()).digest('hex');
  return `https://www.gravatar.com/avatar/${hash}?d=identicon&s=128`;
}

function displayNameFor(user: { name?: string | null; email: string }): string {
  const trimmed = user.name?.trim();
  if (trimmed) return trimmed;
  return user.email.split('@')[0];
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getAdminSession(request);
  if (session.error) return session.error;

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

  if (newsletter.status === 'posted') {
    return NextResponse.json(
      { error: 'Newsletter is already posted' },
      { status: 409 }
    );
  }

  try {
    // Post to Slack FIRST — only flip DB state after Slack confirms.
    // (Previous version flipped to 'approved' before posting, which left
    //  the row stuck in an intermediate state on every Slack failure.)
    const messageTs = await postNewsletter(newsletter.body_slack_mrkdwn as string, {
      username: displayNameFor(session.user),
      iconUrl: gravatarIdenticon(session.user.email),
    });

    const updatedRows = await sql`
      UPDATE newsletters SET
        status = 'posted',
        approved_at = now(),
        posted_at = now(),
        posted_by = ${session.user.email},
        slack_message_ts = ${messageTs},
        updated_at = now()
      WHERE id = ${id}
      RETURNING *
    `;

    if (!updatedRows[0]) {
      return NextResponse.json({ error: 'Failed to update newsletter' }, { status: 500 });
    }

    await sql`INSERT INTO agent_runs (run_type, status, details, completed_at) VALUES ('publish_newsletter', 'success', ${JSON.stringify({ newsletter_id: id, slack_message_ts: messageTs, posted_by: session.user.email })}, now())`;

    return NextResponse.json(updatedRows[0]);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : 'Slack publish failed';

    await sql`INSERT INTO agent_runs (run_type, status, error_message, details, completed_at) VALUES ('publish_newsletter', 'failure', ${errorMessage}, ${JSON.stringify({ newsletter_id: id, attempted_by: session.user.email })}, now())`;

    return NextResponse.json(
      { error: errorMessage, status: 'approved' },
      { status: 502 }
    );
  }
}
