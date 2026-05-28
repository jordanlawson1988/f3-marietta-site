import Link from "next/link";
import { ChartCard } from "./ChartCard";

type Datum = { ao: string; aoSlug: string; count: number };
const COLORS = ["#d4a93c", "#0a0a0a", "#7e6b3a", "#b8a160", "#d4d0c2"];

function arcPath(
  cx: number,
  cy: number,
  r: number,
  startFrac: number,
  endFrac: number,
): string {
  const start = startFrac * Math.PI * 2;
  const end = endFrac * Math.PI * 2;
  const x1 = cx + Math.sin(start) * r;
  const y1 = cy - Math.cos(start) * r;
  const x2 = cx + Math.sin(end) * r;
  const y2 = cy - Math.cos(end) * r;
  const large = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`;
}

type Props = {
  data: Datum[];
  aoHref?: (aoSlug: string) => string;
  title?: React.ReactNode;
  eyebrow?: string;
  subtitle?: React.ReactNode;
};

export function AoDistributionCard({
  data,
  aoHref,
  title = "Where this PAX posts",
  eyebrow = "ao distribution · in range",
  subtitle,
}: Props) {
  if (data.length === 0) {
    return (
      <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
        <p className="font-mono text-xs text-muted">// no posts in range</p>
      </ChartCard>
    );
  }

  const total = data.reduce((s, d) => s + d.count, 0);
  const singleSlice = data.length === 1;
  // Build cumulative fractions via prefix sum so we never reassign inside the
  // map callback (eslint react-hooks/immutability flags that under RSC).
  const prefixes = data.reduce<number[]>(
    (acc, d) => [...acc, (acc[acc.length - 1] ?? 0) + d.count],
    [],
  );
  const slices = data.map((d, i) => {
    const before = i === 0 ? 0 : prefixes[i - 1];
    const startFrac = before / total;
    const endFrac = prefixes[i] / total;
    return {
      ...d,
      color: COLORS[i % COLORS.length],
      path: arcPath(60, 60, 50, startFrac, endFrac),
      pct: ((d.count / total) * 100).toFixed(0),
    };
  });

  return (
    <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <div className="flex items-center gap-4">
        <svg
          viewBox="0 0 120 120"
          className="w-28 h-28"
          role="img"
          aria-label={`AO distribution. ${slices.map((s) => `${s.ao} ${s.pct}%`).join(", ")}.`}
        >
          {singleSlice ? (
            <circle cx="60" cy="60" r="50" fill={COLORS[0]} />
          ) : (
            slices.map((s) => <path key={s.ao} d={s.path} fill={s.color} />)
          )}
        </svg>
        <div className="flex-1">
          <ul className="font-mono text-[11px] space-y-1">
            {slices.map((s) => (
              <li key={s.ao} className="flex items-baseline gap-2">
                <span
                  className="w-2.5 h-2.5 inline-block"
                  style={{ backgroundColor: s.color }}
                  aria-hidden
                />
                {aoHref ? (
                  <Link
                    href={aoHref(s.aoSlug)}
                    prefetch={false}
                    className="flex-1 truncate hover:underline underline-offset-4"
                  >
                    {s.ao}
                  </Link>
                ) : (
                  <span className="flex-1 truncate">{s.ao}</span>
                )}
                <span className="text-muted tabular-nums">{s.count}</span>
                <span className="w-8 text-right text-muted">{s.pct}%</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </ChartCard>
  );
}
