import Link from "next/link";
import { ChartCard } from "./ChartCard";
import type { PaxRanking } from "@/lib/stats/resolvePaxIdentity";

type Props = {
  data: PaxRanking[];
  /** undefined = show all */
  topN?: number;
  paxHref: (key: string) => string;
  title?: React.ReactNode;
  eyebrow?: string;
  subtitle?: React.ReactNode;
};

export function PaxLeaderboardTable({
  data,
  topN,
  paxHref,
  title = "Top PAX by posts",
  eyebrow = "pax leaderboard · in range",
  subtitle,
}: Props) {
  const visible = topN === undefined ? data : data.slice(0, topN);
  if (visible.length === 0) {
    return (
      <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
        <p className="font-mono text-xs text-muted">// no PAX activity in range</p>
      </ChartCard>
    );
  }

  const max = visible[0].count;

  return (
    <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <ul className="font-mono text-[11px] space-y-1.5">
        {visible.map((p, i) => {
          const widthPct = max === 0 ? 0 : Math.max(2, (p.count / max) * 100);
          return (
            <li key={p.key}>
              <Link
                href={paxHref(p.key)}
                prefetch={false}
                className="grid grid-cols-[24px_140px_1fr_40px] items-center gap-3 hover:bg-black/[.04] focus-visible:bg-black/[.06] px-1 py-1 -mx-1 transition-colors"
              >
                <span className="text-muted text-right tabular-nums">{i + 1}</span>
                <span className="truncate" title={p.label}>
                  {p.label}
                </span>
                <span className="block h-3 bg-ink/90" style={{ width: `${widthPct}%` }} aria-hidden />
                <span className="text-right tabular-nums">{p.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
