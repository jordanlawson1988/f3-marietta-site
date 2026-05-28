import { NextResponse } from "next/server";
import { validateAdminToken } from "@/lib/admin/auth";
import { planMonthlyRecap, buildPaxRecapUrl } from "@/lib/stats/buildPaxRecap";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Admin-protected preview of the monthly PAX recap. Always dry-run; never
 * touches the Slack API. Returns the full recipient list + sample message
 * so admins can sanity-check the next monthly send before flipping the
 * MONTHLY_RECAP_LIVE flag.
 *
 * Also surfaces the env-flag state so the UI can show whether prod is
 * armed for a real send on the next 1st.
 */
export async function GET(request: Request) {
  const authError = await validateAdminToken(request);
  if (authError) return authError;

  const plan = await planMonthlyRecap();

  return NextResponse.json({
    mode: "dry-run",
    window: plan.window,
    sample: plan.sample,
    liveFlagSet: process.env.MONTHLY_RECAP_LIVE === "true",
    recipients: plan.recipients.map((r) => ({
      paxLabel: r.paxLabel,
      paxSlug: r.paxSlug,
      slackUserId: r.slackUserId,
      posts: r.posts,
      aos: r.aos,
      qd: r.qd,
      url: buildPaxRecapUrl(r.paxSlug),
    })),
    recipientCount: plan.recipients.length,
  });
}
