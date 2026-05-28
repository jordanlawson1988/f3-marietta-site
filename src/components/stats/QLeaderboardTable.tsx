import Link from "next/link";
import { ChartCard } from "./ChartCard";
import type { QLeaderboardRow } from "@/lib/stats/getQLeaderboard";

type Props = {
  data: QLeaderboardRow[];
  paxHref: (slug: string) => string;
  title?: React.ReactNode;
  eyebrow?: string;
  subtitle?: React.ReactNode;
};

export function QLeaderboardTable({
  data,
  paxHref,
  title = "Who's carrying the Q this period",
  eyebrow = "q leaderboard · in range",
  subtitle = "Each row = times this PAX Q'd a workout. AOs = unique sites they led.",
}: Props) {
  if (data.length === 0) {
    return (
      <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
        <p className="font-mono text-xs text-muted">
          // no Q records in range — f3_event_qs covers ~85% of beatdowns, older
          ones may be missing
        </p>
      </ChartCard>
    );
  }

  const max = data[0].count;

  return (
    <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <ul className="font-mono text-[11px] space-y-1.5">
        {data.map((q, i) => {
          const widthPct = max === 0 ? 0 : Math.max(4, (q.count / max) * 100);
          return (
            <li key={q.qKey}>
              <Link
                href={paxHref(q.qSlug)}
                prefetch={false}
                className="grid grid-cols-[24px_140px_1fr_120px_30px] items-center gap-3 hover:bg-black/[.04] focus-visible:bg-black/[.06] px-1 py-1 -mx-1 transition-colors"
              >
                <span className="text-muted text-right tabular-nums">{i + 1}</span>
                <span className="truncate" title={q.qLabel}>
                  {q.qLabel}
                </span>
                <span className="block h-3 bg-amber-600" style={{ width: `${widthPct}%` }} aria-hidden />
                <span className="text-muted truncate text-[10px]">
                  {q.aoCount} AO{q.aoCount === 1 ? "" : "s"}
                  {q.topAo ? ` · ${q.topAo}` : ""}
                </span>
                <span className="text-right tabular-nums">{q.count}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
