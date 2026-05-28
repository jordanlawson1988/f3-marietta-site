import { redirect } from "next/navigation";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { parseTimeRange, defaultTimeRange } from "@/lib/stats/timeRange";
import { rangeParam } from "@/lib/stats/rangeParam";
import { getQLeaderboard } from "@/lib/stats/getQLeaderboard";
import { getOverviewStats } from "@/lib/stats/getOverviewStats";
import type { CompareMode } from "@/lib/stats/getPriorRange";

import { Crumbs } from "@/components/stats/Crumbs";
import { FilterBar } from "@/components/stats/FilterBar";
import { KpiTile } from "@/components/stats/KpiTile";
import { FreshnessBadge } from "@/components/stats/FreshnessBadge";
import { QLeaderboardTable } from "@/components/stats/QLeaderboardTable";
import { NotYetQdTable } from "@/components/stats/NotYetQdTable";
import { StatsNav } from "@/components/stats/StatsNav";
import { getNotYetQdPax } from "@/lib/stats/getNotYetQdPax";

export const dynamic = "force-dynamic";

type SP = {
  range?: string;
  from?: string;
  to?: string;
  ao?: string;
  topN?: string;
  compare?: string;
};

function parseCompare(v?: string): CompareMode {
  if (v === "prior" || v === "yoy") return v;
  return "off";
}

export default async function AdminAnalyticsQsPage({
  searchParams,
}: {
  searchParams: Promise<SP>;
}) {
  const sp = await searchParams;
  let range = parseTimeRange({ range: sp.range, from: sp.from, to: sp.to });
  if (!range) {
    if (sp.range || sp.from || sp.to) redirect("/admin/analytics/qs");
    range = defaultTimeRange();
  }
  const compare = parseCompare(sp.compare);

  const aoSlugs =
    sp.ao && sp.ao !== "all"
      ? sp.ao.split(",").map((s) => s.trim()).filter(Boolean)
      : [];
  const aoFilter = aoSlugs.length > 0 ? aoSlugs : null;

  const topNParam = sp.topN ?? "50";
  const topN =
    topNParam === "all" ? Number.MAX_SAFE_INTEGER : parseInt(topNParam, 10) || 50;

  const [overview, qLeaderboard, notYetQd] = await Promise.all([
    getOverviewStats(range, aoFilter, 1),
    getQLeaderboard(range, aoFilter, topN),
    getNotYetQdPax(range, aoFilter, 200),
  ]);

  const linkSuffix = rangeParam(range, compare);
  const aoOptions = overview.allAoRanking.map((row, rank) => ({
    aoSlug: row.aoSlug,
    aoName: row.ao,
    rank,
  }));

  const totalQs = qLeaderboard.length;
  const totalWorkoutsLed = qLeaderboard.reduce((s, q) => s + q.count, 0);
  const avgWorkoutsPerQ =
    totalQs === 0 ? 0 : Math.round((totalWorkoutsLed / totalQs) * 10) / 10;
  const topQName = qLeaderboard[0]?.qLabel ?? "—";

  const insight =
    totalQs === 0
      ? `No Q records logged in ${range.label.toLowerCase()}.`
      : `${totalQs} different PAX took the Q, leading ${totalWorkoutsLed} workouts. ${topQName} led the rotation.`;

  const paxSlugHref = (slug: string) =>
    `/admin/analytics/pax/${slug}${linkSuffix}`;

  return (
    <section className="max-w-[1320px] mx-auto px-7 py-16">
      <SectionHead
        eyebrow={
          <Crumbs
            items={[
              { label: "§ Admin", href: "/admin" },
              { label: "Analytics", href: `/admin/analytics${linkSuffix}` },
              { label: "Qs" },
            ]}
          />
        }
        h2="Q leaderboard"
        kicker={
          <div className="flex items-center gap-4 flex-wrap">
            <span>{range.label}</span>
            <FreshnessBadge />
          </div>
        }
        align="left"
      />

      <StatsNav
        current="/admin/analytics/qs"
        filterSuffix={linkSuffix}
        scope="admin"
      />

      <div className="mb-6 p-5 border border-line-soft bg-bone-2/60">
        <p className="font-display font-medium text-[20px] leading-tight tracking-[-.01em] text-ink">
          {insight}
        </p>
      </div>

      <FilterBar aoOptions={aoOptions} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <KpiTile label="distinct Qs" value={totalQs} />
        <KpiTile label="workouts led" value={totalWorkoutsLed} />
        <KpiTile
          label="avg led / Q"
          value={avgWorkoutsPerQ}
          caption="distribution evenness"
        />
        <KpiTile label="top Q" value={topQName} featured />
      </div>

      <QLeaderboardTable
        data={qLeaderboard}
        paxHref={paxSlugHref}
        title="Q leaderboard"
        subtitle="Every PAX who Q'd at least one workout. Drill into a PAX to see their full profile."
      />

      <div className="mt-4">
        <NotYetQdTable data={notYetQd} paxHref={paxSlugHref} />
      </div>
    </section>
  );
}
