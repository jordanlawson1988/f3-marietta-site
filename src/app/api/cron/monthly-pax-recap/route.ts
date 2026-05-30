import { NextResponse } from "next/server";
import { getSlackClient } from "@/lib/slack/slackClient";
import {
  buildRecapMessage,
  planMonthlyRecap,
} from "@/lib/stats/buildPaxRecap";
import { buildRecapRunReport, type RecapSendError } from "@/lib/stats/recapReport";

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
 *     Slack for PAX DMs. The JSON response shows what would have been sent.
 *   - Query overrides: `?dry=1` forces dry-run regardless of env;
 *     `?live=1` requires both env flag AND query for an extra opt-in
 *     (defense against accidental sends).
 *
 * Reporting:
 *   - After the run (live AND dry-run), a failure/run report is DMed to
 *     SLACK_ADMIN_USER_ID covering send errors + unreachable PAX. Report
 *     posting is wrapped so it can never crash the run or mask send results.
 *
 * Returns: { window, mode, recipients, sent, skipped, errors, unreachable,
 *            reportPosted, reportError, sample }
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
  const mode: "live" | "dry-run" = isLive ? "live" : "dry-run";

  const plan = await planMonthlyRecap();
  const { window, recipients, unreachable, sample } = plan;

  // Send phase. Only live mode with recipients actually DMs PAX; dry-run and
  // the empty case leave sent=0 / errors=[] and fall through to reporting.
  let sent = 0;
  const errors: RecapSendError[] = [];
  let reminders: string[] | undefined;

  if (recipients.length === 0) {
    // Nothing to send — still report below (surfaces unreachable, if any).
  } else if (!isLive) {
    reminders = [
      "Set MONTHLY_RECAP_LIVE=true in Vercel env vars to enable real sends.",
      "Cron must also pass ?live=1 — Vercel cron URL needs that querystring or you call it manually.",
    ];
  } else {
    // Live send. Pace requests to stay under Slack chat.postMessage tier
    // limits (Tier 3 = ~50/min). 250ms = 240/min headroom for retries.
    const client = getSlackClient();
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
  }

  // Build + DM the run report to the admin (both modes). Never throws.
  const report = buildRecapRunReport({
    window,
    mode,
    recipientsCount: recipients.length,
    sent,
    errors,
    unreachable,
  });
  const { posted: reportPosted, error: reportError } = await postAdminReport(report);

  return NextResponse.json({
    window,
    mode,
    recipients: recipients.length,
    sent,
    skipped: recipients.length - sent - errors.length,
    errors,
    unreachable,
    reportPosted,
    reportError,
    sample,
    ...(reminders ? { reminders } : {}),
    ...(recipients.length === 0
      ? { message: "No PAX posted in the recap window" }
      : {}),
  });
}

/**
 * DM the run report to SLACK_ADMIN_USER_ID. Swallows its own errors — a
 * reporting failure is logged and surfaced in the JSON as `reportError`, but
 * never thrown, so it cannot crash the run or mask send results.
 */
async function postAdminReport(
  report: string,
): Promise<{ posted: boolean; error: string | null }> {
  const adminId = process.env.SLACK_ADMIN_USER_ID;
  if (!adminId) return { posted: false, error: "SLACK_ADMIN_USER_ID not set" };
  try {
    await getSlackClient().chat.postMessage({
      channel: adminId,
      text: report,
      unfurl_links: false,
    });
    return { posted: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[monthly-pax-recap] admin report post failed:", msg);
    return { posted: false, error: msg };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
