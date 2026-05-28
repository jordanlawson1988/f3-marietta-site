import { ChartCard } from "./ChartCard";
import type { FngFunnel } from "@/lib/stats/getFngFunnel";

type Props = {
  data: FngFunnel;
  title?: React.ReactNode;
  eyebrow?: string;
  subtitle?: React.ReactNode;
  fngsHref?: string;
};

const STAGE_COLORS = ["bg-ink", "bg-amber-600", "bg-amber-500", "bg-emerald-600"] as const;

export function FngFunnelWidget({
  data,
  title = "From FNG callout to committed PAX",
  eyebrow = "fng funnel · post-callout",
  subtitle = "Tracks FNGs called out in range → ever posted again → posted 3+ → has Q'd a workout.",
  fngsHref,
}: Props) {
  if (data.calledOut === 0) {
    return (
      <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
        <p className="font-mono text-xs text-muted">// no FNG callouts in range</p>
      </ChartCard>
    );
  }

  const stages = [
    { label: "called out", value: data.calledOut },
    { label: "returned", value: data.returned },
    { label: "committed 3+", value: data.committed },
    { label: "now Q'ing", value: data.qing },
  ];
  const max = stages[0].value || 1;

  return (
    <ChartCard
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      trailing={
        fngsHref ? (
          <a
            href={fngsHref}
            className="font-mono text-[10px] tracking-[.18em] uppercase text-muted hover:text-ink underline underline-offset-4"
          >
            see roster →
          </a>
        ) : null
      }
    >
      <ul className="space-y-2">
        {stages.map((s, i) => {
          const widthPct = (s.value / max) * 100;
          const pctOfTop =
            i === 0 ? null : ((s.value / max) * 100).toFixed(0);
          return (
            <li key={s.label}>
              <div className="flex items-baseline justify-between font-mono text-[11px]">
                <span className="text-muted tracking-[.12em] uppercase">{s.label}</span>
                <span className="tabular-nums">
                  {s.value}
                  {pctOfTop !== null && (
                    <span className="text-muted ml-2">({pctOfTop}%)</span>
                  )}
                </span>
              </div>
              <div className="mt-1 h-3 bg-black/[.05]">
                <div
                  className={STAGE_COLORS[i]}
                  style={{ width: `${Math.max(2, widthPct)}%` }}
                />
              </div>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
