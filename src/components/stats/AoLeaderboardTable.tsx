import Link from "next/link";
import { ChartCard } from "./ChartCard";
import { getAoColor } from "@/lib/stats/aoColors";
import type { AoHealthRow } from "@/lib/stats/getAoHealth";

type Props = {
  data: AoHealthRow[];
  aoHref: (slug: string) => string;
  title?: React.ReactNode;
  eyebrow?: string;
  subtitle?: React.ReactNode;
};

export function AoLeaderboardTable({
  data,
  aoHref,
  title = "AO scoreboard",
  eyebrow = "ao leaderboard · in range",
  subtitle = "Posts, PAX, Q rotation, FNGs, and average head count per AO. Click a row to drill in.",
}: Props) {
  // Sort by raw post count desc — what users expect from "the scoreboard"
  // now that the composite health score isn't shown.
  const sorted = [...data].sort((a, b) => b.posts - a.posts);
  if (sorted.length === 0) {
    return (
      <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
        <p className="font-mono text-xs text-muted">// no AO activity in range</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <div className="overflow-x-auto">
        <table
          className="w-full font-mono text-[11px] border-collapse"
          aria-label="AO scoreboard"
        >
          <thead>
            <tr className="text-left tracking-[.15em] uppercase text-muted border-b border-line-soft">
              <th className="pb-2 pr-3 font-normal w-8">#</th>
              <th className="pb-2 pr-3 font-normal">AO</th>
              <th className="pb-2 pr-3 font-normal text-right" title="Backblasts logged in range">
                posts
              </th>
              <th className="pb-2 pr-3 font-normal text-right" title="Unique PAX who posted">
                pax
              </th>
              <th className="pb-2 pr-3 font-normal text-right" title="Distinct Qs in range">
                Qs
              </th>
              <th className="pb-2 pr-3 font-normal text-right" title="FNG callouts (raw count)">
                fngs
              </th>
              <th className="pb-2 font-normal text-right" title="Average head count per workout">
                avg HC
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r, i) => (
              <tr
                key={r.aoSlug}
                className="border-b border-line-soft last:border-b-0 hover:bg-black/[.03] group"
              >
                <td className="py-2 pr-3 text-muted">{i + 1}</td>
                <td className="py-2 pr-3">
                  <Link
                    href={aoHref(r.aoSlug)}
                    prefetch={false}
                    className="inline-flex items-center gap-2 text-ink group-hover:underline underline-offset-4"
                  >
                    <span
                      className="w-2 h-2 inline-block border border-black/40"
                      style={{ background: getAoColor(i) }}
                      aria-hidden
                    />
                    {r.ao}
                  </Link>
                </td>
                <td className="py-2 pr-3 text-right">{r.posts}</td>
                <td className="py-2 pr-3 text-right">{r.uniquePax}</td>
                <td className="py-2 pr-3 text-right">{r.uniqueQs}</td>
                <td className="py-2 pr-3 text-right">{r.fngCount}</td>
                <td className="py-2 text-right">
                  {r.avgHeadcount ?? "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
