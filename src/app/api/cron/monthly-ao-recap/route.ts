import { NextResponse } from "next/server";
import { getSlackClient } from "@/lib/slack/slackClient";
import {
  planMonthlyAoRecap, buildAoRecapMessage, buildRegionRecapMessage,
} from "@/lib/stats/buildAoRecap";
import { buildAoRecapRunReport, type AoPostResult } from "@/lib/stats/aoRecapReport";
import { claimRecapPost, releaseRecapPost, setRecapPostTs } from "@/lib/stats/recapPosts";

export const dynamic = "force-dynamic";
export const maxDuration = 60;
export const runtime = "nodejs";

/**
 * Monthly AO + region recap cron. On the 1st, posts a deterministic recap of
 * the prior month to each enabled AO channel and to #all-f3-marietta.
 * Dry-run unless MONTHLY_AO_RECAP_LIVE==="true" AND ?live=1 AND not ?dry=1.
 * Idempotent per (period, channel) via monthly_ao_recap_posts.
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
  const envLive = process.env.MONTHLY_AO_RECAP_LIVE === "true";
  const isLive = envLive && queryLive && !queryDry;
  const mode: "live" | "dry-run" = isLive ? "live" : "dry-run";

  const plan = await planMonthlyAoRecap();
  const period = plan.window.from.slice(0, 7); // 'YYYY-MM'
  const regionChannel = process.env.SLACK_NEWSLETTER_CHANNEL_ID;

  type Job = { scope: "ao" | "region"; label: string; channelId: string; text: string; aoName: string | null };
  const jobs: Job[] = plan.aoBlocks.map((b) => ({
    scope: "ao" as const, label: b.aoDisplayName, channelId: b.channelId,
    text: buildAoRecapMessage(b, plan.window.monthLabel), aoName: b.aoDisplayName,
  }));
  if (plan.regionBlock && regionChannel) {
    jobs.push({
      scope: "region", label: "#all-f3-marietta", channelId: regionChannel,
      text: buildRegionRecapMessage(plan.regionBlock, plan.window.monthLabel), aoName: null,
    });
  }

  const client = getSlackClient();
  const results: AoPostResult[] = [];
  for (const j of jobs) {
    if (!isLive) {
      results.push({ scope: j.scope, label: j.label, channelId: j.channelId, status: "dry-run" });
      continue;
    }
    const claimed = await claimRecapPost(period, j.channelId, j.scope, j.aoName);
    if (!claimed) {
      results.push({ scope: j.scope, label: j.label, channelId: j.channelId, status: "already-posted" });
      continue;
    }
    try {
      const res = await client.chat.postMessage({ channel: j.channelId, text: j.text, unfurl_links: false });
      // Post delivered — the claim MUST stay. Recording the ts is best-effort:
      // a failure here must not fall into the catch below (which releases the
      // claim and would re-post to a public channel on the next run).
      if (res.ts) {
        try {
          await setRecapPostTs(period, j.channelId, res.ts);
        } catch (tsErr) {
          console.error("[monthly-ao-recap] setRecapPostTs failed (non-fatal):", tsErr);
        }
      }
      results.push({ scope: j.scope, label: j.label, channelId: j.channelId, status: "posted" });
    } catch (err) {
      await releaseRecapPost(period, j.channelId); // post failed — free the claim so a retry can re-post
      results.push({
        scope: j.scope, label: j.label, channelId: j.channelId, status: "error",
        error: err instanceof Error ? err.message : String(err),
      });
    }
    await sleep(250);
  }

  const skippedEmpty = plan.skippedEmpty;
  const report = buildAoRecapRunReport({ monthLabel: plan.window.monthLabel, mode, results, skippedEmpty });
  const { posted: reportPosted, error: reportError } = await postAdminReport(report);

  return NextResponse.json({
    window: plan.window, mode, regionChannelSet: Boolean(regionChannel),
    jobs: jobs.length, results, reportPosted, reportError,
  });
}

async function postAdminReport(report: string): Promise<{ posted: boolean; error: string | null }> {
  const adminId = process.env.SLACK_ADMIN_USER_ID;
  if (!adminId) return { posted: false, error: "SLACK_ADMIN_USER_ID not set" };
  try {
    await getSlackClient().chat.postMessage({ channel: adminId, text: report, unfurl_links: false });
    return { posted: true, error: null };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[monthly-ao-recap] admin report post failed:", msg);
    return { posted: false, error: msg };
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
