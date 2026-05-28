import { ChartCard } from "./ChartCard";
import type { QRanking } from "@/lib/stats/getQStats";

type Props = {
  data: QRanking[];
  diversity?: number | null;
  title?: React.ReactNode;
  eyebrow?: string;
  subtitle?: React.ReactNode;
};

function diversityBand(d: number): { label: string; tone: string } {
  if (d >= 0.7) return { label: "Diverse rotation", tone: "text-emerald-700" };
  if (d >= 0.4) return { label: "Healthy mix", tone: "text-amber-700" };
  if (d >= 0.2) return { label: "Concentrated", tone: "text-rose-700" };
  return { label: "Single Q risk", tone: "text-rose-700" };
}

export function QRotationCard({
  data,
  diversity,
  title = "Q rotation at this AO",
  eyebrow = "q rotation · in range",
  subtitle,
}: Props) {
  if (data.length === 0) {
    return (
      <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
        <p className="font-mono text-xs text-muted">
          // no Q records in range (f3_event_qs covers ~85% of beatdowns)
        </p>
      </ChartCard>
    );
  }

  const total = data.reduce((s, q) => s + q.count, 0);
  const band = diversity !== null && diversity !== undefined ? diversityBand(diversity) : null;

  return (
    <ChartCard
      eyebrow={eyebrow}
      title={title}
      subtitle={subtitle}
      trailing={
        band && (
          <span className={`font-mono text-[10px] tracking-[.18em] uppercase ${band.tone}`}>
            {band.label}
          </span>
        )
      }
    >
      <ul className="font-mono text-[11px] space-y-1.5">
        {data.map((q) => {
          const widthPct = total === 0 ? 0 : Math.max(3, (q.count / total) * 100);
          return (
            <li key={q.key} className="grid grid-cols-[140px_1fr_30px] items-center gap-3">
              <span className="truncate" title={q.label}>
                {q.label}
              </span>
              <span className="block h-3 bg-amber-600" style={{ width: `${widthPct}%` }} aria-hidden />
              <span className="text-right tabular-nums">{q.count}</span>
            </li>
          );
        })}
      </ul>
    </ChartCard>
  );
}
