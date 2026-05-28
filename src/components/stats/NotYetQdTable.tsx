import Link from "next/link";
import { ChartCard } from "./ChartCard";
import type { NotYetQdRow } from "@/lib/stats/getNotYetQdPax";

type Props = {
  data: NotYetQdRow[];
  paxHref: (slug: string) => string;
  title?: React.ReactNode;
  eyebrow?: string;
  subtitle?: React.ReactNode;
};

export function NotYetQdTable({
  data,
  paxHref,
  title = "PAX who haven't taken the Q this period",
  eyebrow = "q recruits · in range",
  subtitle = "Posted at least once but didn't Q in the active range. Sorted by posts — most-active first.",
}: Props) {
  if (data.length === 0) {
    return (
      <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
        <p className="font-mono text-xs text-muted">
          // every PAX who posted also took the Q — solid rotation
        </p>
      </ChartCard>
    );
  }

  const maxPosts = data[0].posts;

  return (
    <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <div className="overflow-x-auto">
        <table
          className="w-full font-mono text-[11px] border-collapse"
          aria-label="PAX who have not taken the Q in range"
        >
          <thead>
            <tr className="text-left tracking-[.15em] uppercase text-muted border-b border-line-soft">
              <th className="pb-2 pr-3 font-normal w-8">#</th>
              <th className="pb-2 pr-3 font-normal">PAX</th>
              <th className="pb-2 pr-3 font-normal w-28" title="Lapsed Q = has Q'd before; First-timer = never Q'd">
                history
              </th>
              <th className="pb-2 pr-3 font-normal text-right" title="Posts in range">
                posts
              </th>
              <th className="pb-2 font-normal text-right" title="Distinct AOs visited in range">
                AOs
              </th>
            </tr>
          </thead>
          <tbody>
            {data.map((r, i) => {
              const widthPct = maxPosts === 0 ? 0 : Math.max(8, (r.posts / maxPosts) * 100);
              return (
                <tr
                  key={r.paxKey}
                  className="border-b border-line-soft last:border-b-0 hover:bg-black/[.03] group"
                >
                  <td className="py-2 pr-3 text-muted">{i + 1}</td>
                  <td className="py-2 pr-3">
                    <Link
                      href={paxHref(r.paxSlug)}
                      prefetch={false}
                      className="text-ink group-hover:underline underline-offset-4"
                    >
                      {r.paxLabel}
                    </Link>
                  </td>
                  <td className="py-2 pr-3">
                    {r.everQd ? (
                      <span
                        className="inline-block px-1.5 py-0.5 border border-amber-700/40 text-amber-800 text-[10px] tracking-[.12em] uppercase"
                        title="Has Q'd before, but not in this range"
                      >
                        lapsed Q
                      </span>
                    ) : (
                      <span
                        className="inline-block px-1.5 py-0.5 border border-emerald-700/40 text-emerald-800 text-[10px] tracking-[.12em] uppercase"
                        title="Never Q'd anywhere yet — fresh recruit"
                      >
                        first-timer
                      </span>
                    )}
                  </td>
                  <td className="py-2 pr-3 text-right">
                    <span className="inline-flex items-center gap-2 justify-end">
                      <span
                        className="block h-2 bg-emerald-600/70"
                        style={{ width: `${widthPct}px`, maxWidth: "80px" }}
                        aria-hidden
                      />
                      <span className="tabular-nums w-7 text-right">{r.posts}</span>
                    </span>
                  </td>
                  <td className="py-2 text-right tabular-nums">{r.aosVisited}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </ChartCard>
  );
}
