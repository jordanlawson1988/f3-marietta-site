import { NextResponse } from "next/server";
import { getSlackClient } from "@/lib/slack/slackClient";
import {
  buildRecapMessage,
  planMonthlyRecap,
} from "@/lib/stats/buildPaxRecap";

export const dynamic = "force-dynamic";
// Vercel serverless function ceiling — DMing 50+ PAX with rate-limit
// spacing needs more than the 10s default.
export const maxDuration = 60;

/**
 * Monthly recap cron: on the 1st of each month, DM every PAX who posted
 * during the prior calendar month with a personalized recap + link.
 *
 * Auth:
 *   - Cron: `Authorization: Bearer ${CRON_SECRET}` (matches the existing
 *     sync-glossary pattern; Vercel cron sets this header automatically).
 *
 * Safety:
 *   - Dry-run unless `MONTHLY_RECAP_LIVE === "true"`. Dry-run still
 *     constructs the message and resolves recipients, but does NOT call
 *     Slack. The JSON response shows what would have been sent.
 *   - Query overrides: `?dry=1` forces dry-run regardless of env;
 *     `?live=1` requires both env flag AND query for an extra opt-in
 *     (defense against accidental sends).
 *
 * Returns: { window, mode, recipients, sent, skipped, errors, sample }
 */
export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const queryDry = url.searchParams.get("dry") === "1";
  const queryLive = url.searchParams.get("live") === "1";
  const envLive = process.env.MONTHLY_RECAP_LIVE === "true";
  // To actually send: env flag AND ?live=1 query param AND NOT ?dry=1.
  // Anything else falls back to dry-run for safety.
  const isLive = envLive && queryLive && !queryDry;
  const mode = isLive ? "live" : "dry-run";

  const plan = await planMonthlyRecap();
  const { window, recipients, sample } = plan;

  if (recipients.length === 0) {
    return NextResponse.json({
      window,
      mode,
      recipients: 0,
      sent: 0,
      skipped: 0,
      errors: [],
      sample: null,
      message: "No PAX posted in the recap window",
    });
  }

  if (!isLive) {
    return NextResponse.json({
      window,
      mode,
      recipients: recipients.length,
      sent: 0,
      skipped: recipients.length,
      errors: [],
      sample,
      reminders: [
        "Set MONTHLY_RECAP_LIVE=true in Vercel env vars to enable real sends.",
        "Cron must also pass ?live=1 — Vercel cron URL needs that querystring or you call it manually.",
      ],
    });
  }

  // Live send. Pace requests to stay under Slack chat.postMessage tier
  // limits (Tier 3 = ~50/min). 250ms = 240/min headroom for retries.
  const client = getSlackClient();
  let sent = 0;
  const errors: Array<{ slackUserId: string; paxLabel: string; error: string }> = [];

  for (const row of recipients) {
    try {
      await client.chat.postMessage({
        channel: row.slackUserId,
        text: buildRecapMessage(row, window.monthLabel),
        unfurl_links: false,
      });
      sent += 1;
    } catch (err) {
      errors.push({
        slackUserId: row.slackUserId,
        paxLabel: row.paxLabel,
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await sleep(250);
  }

  return NextResponse.json({
    window,
    mode,
    recipients: recipients.length,
    sent,
    skipped: recipients.length - sent - errors.length,
    errors,
    sample,
  });
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
