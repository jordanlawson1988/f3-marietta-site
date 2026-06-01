import { NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/admin/auth";
import {
  planMonthlyAoRecap, buildAoRecapMessage, buildRegionRecapMessage,
} from "@/lib/stats/buildAoRecap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Admin-only dry preview of the AO/region recap. No Slack calls. Renders every
 *  message that would post + the live-flag state. */
export async function GET(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const plan = await planMonthlyAoRecap();
  const aoPosts = plan.aoBlocks.map((b) => ({
    aoDisplayName: b.aoDisplayName, channelId: b.channelId,
    posts: b.posts, beatdowns: b.beatdowns, paxCount: b.paxCount,
    fngCount: b.fngs?.count ?? 0,
    message: buildAoRecapMessage(b, plan.window.monthLabel),
  }));
  const regionPost = plan.regionBlock
    ? { channelId: process.env.SLACK_NEWSLETTER_CHANNEL_ID ?? null,
        fngCount: plan.regionBlock.fngs?.count ?? 0,
        message: buildRegionRecapMessage(plan.regionBlock, plan.window.monthLabel) }
    : null;

  return NextResponse.json({
    mode: "dry-run",
    window: plan.window,
    liveFlagSet: process.env.MONTHLY_AO_RECAP_LIVE === "true",
    regionChannelSet: Boolean(process.env.SLACK_NEWSLETTER_CHANNEL_ID),
    aoPostCount: aoPosts.length,
    aoPosts,
    regionPost,
  });
}
