import { ChartCard } from "./ChartCard";
import { formatChartMonth } from "@/lib/stats/formatMonth";

type Point = { month: string; count: number };

type Props = {
  data: Point[];
  /** optional prior-period series for dashed overlay */
  priorData?: Point[];
  /** "Posts climbed 14% in May — driven by Battlefield" — replaces the eyebrow noun-phrase title */
  title: React.ReactNode;
  eyebrow?: string;
  subtitle?: React.ReactNode;
  trailing?: React.ReactNode;
  /** auto-pin the highest spike with an annotation */
  highlightPeak?: boolean;
};

export function TrendChart({
  data,
  priorData,
  title,
  eyebrow = "posts over time · monthly",
  subtitle,
  trailing,
  highlightPeak = true,
}: Props) {
  if (data.length === 0 || data.every((p) => p.count === 0)) {
    return (
      <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle} trailing={trailing}>
        <p className="font-mono text-xs text-muted">// no posts in range</p>
      </ChartCard>
    );
  }

  // With only one data point a line chart looks broken. Render a single
  // bold count + month label so the user gets the takeaway.
  if (data.length === 1) {
    const only = data[0];
    return (
      <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle} trailing={trailing}>
        <div className="flex items-baseline gap-4">
          <span className="font-display font-black text-[64px] tracking-[-.02em] leading-none text-ink">
            {only.count.toLocaleString()}
          </span>
          <span className="font-mono text-[11px] tracking-[.15em] uppercase text-muted">
            in {only.month}
          </span>
        </div>
        <p className="font-mono text-[10px] tracking-[.15em] uppercase text-muted mt-3">
          // expand the range to see the trend line
        </p>
      </ChartCard>
    );
  }

  const w = 600;
  const h = 200;
  const padX = 36;
  const padY = 28;

  const currentMax = Math.max(...data.map((p) => p.count));
  const priorMax = priorData?.length ? Math.max(...priorData.map((p) => p.count)) : 0;
  const yMax = Math.max(currentMax, priorMax, 1);
  const stepX = data.length > 1 ? (w - padX * 2) / (data.length - 1) : 0;

  const project = (i: number, count: number) => ({
    x: padX + i * stepX,
    y: h - padY - (count / yMax) * (h - padY * 2),
  });

  const points = data.map((p, i) => ({ ...project(i, p.count), ...p }));
  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const areaPath = `M ${points[0].x.toFixed(1)} ${(h - padY).toFixed(1)} L ${polyline} L ${points[points.length - 1].x.toFixed(1)} ${(h - padY).toFixed(1)} Z`;

  // Project prior series onto the SAME x positions (one-to-one by index).
  // Truncate or pad with the available overlap so the dashed line aligns
  // with the current line visually (i.e., prior March = current March slot).
  let priorPolyline: string | null = null;
  if (priorData && priorData.length > 0) {
    const pts = priorData.slice(0, data.length).map((p, i) => project(i, p.count));
    priorPolyline = pts.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  }

  // Peak annotation: highest single-month, only if it's at least 20% above the median.
  let peak: (typeof points)[number] | null = null;
  if (highlightPeak && points.length >= 3) {
    const sorted = [...data].map((d) => d.count).sort((a, b) => a - b);
    const median = sorted[Math.floor(sorted.length / 2)] || 0;
    const maxIdx = points.reduce(
      (best, p, i) => (p.count > points[best].count ? i : best),
      0,
    );
    const candidate = points[maxIdx];
    if (median > 0 && candidate.count >= median * 1.2) {
      peak = candidate;
    } else if (median === 0 && candidate.count > 0) {
      peak = candidate;
    }
  }

  return (
    <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle} trailing={trailing}>
      {priorPolyline && (
        <div className="flex items-center gap-3 mb-2 font-mono text-[10px] tracking-[.15em] uppercase text-muted">
          <span className="inline-flex items-center gap-1.5">
            <span className="inline-block w-3 h-px bg-ink" aria-hidden />
            current
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span
              className="inline-block w-3 h-px"
              style={{
                background:
                  "repeating-linear-gradient(to right, currentColor 0 3px, transparent 3px 6px)",
              }}
              aria-hidden
            />
            prior period
          </span>
        </div>
      )}
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto"
        role="img"
        aria-label="Posts per month trend chart"
      >
        <defs>
          <linearGradient id="trendArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#d4a93c" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#d4a93c" stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#trendArea)" />
        {priorPolyline && (
          <polyline
            points={priorPolyline}
            fill="none"
            stroke="#6b7280"
            strokeWidth="1.5"
            strokeDasharray="3 3"
          />
        )}
        <polyline
          points={polyline}
          fill="none"
          stroke="#0a0a0a"
          strokeWidth="2"
        />
        {points.map((p) => (
          <g key={p.month}>
            <circle cx={p.x} cy={p.y} r="3" fill="#d4a93c" />
            <text
              x={p.x}
              y={h - 8}
              textAnchor="middle"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              fill="#6b7280"
            >
              {formatChartMonth(p.month)}
            </text>
            <text
              x={p.x}
              y={p.y - 8}
              textAnchor="middle"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              fill="#0a0a0a"
            >
              {p.count}
            </text>
          </g>
        ))}
        {peak && (
          <g>
            <circle cx={peak.x} cy={peak.y} r="6" fill="none" stroke="#d4a93c" strokeWidth="1.5" />
            <text
              x={peak.x}
              y={peak.y - 18}
              textAnchor="middle"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              fill="#7e6b3a"
            >
              ↑ peak
            </text>
          </g>
        )}
      </svg>
    </ChartCard>
  );
}
