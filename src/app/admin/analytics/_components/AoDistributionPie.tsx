import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

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

export function AoDistributionPie({ data }: { data: Datum[] }) {
  if (data.length === 0) {
    return (
      <ClipFrame padding="p-6" className="min-h-[220px]">
        <MonoTag>// ao distribution</MonoTag>
        <p className="font-mono text-xs text-muted mt-3">// no posts in range</p>
      </ClipFrame>
    );
  }
  const total = data.reduce((s, d) => s + d.count, 0);
  const singleSlice = data.length === 1;
  let cumulative = 0;
  const slices = data.map((d, i) => {
    const startFrac = cumulative / total;
    cumulative += d.count;
    const endFrac = cumulative / total;
    return {
      ...d,
      color: COLORS[i % COLORS.length],
      path: arcPath(60, 60, 50, startFrac, endFrac),
      pct: ((d.count / total) * 100).toFixed(0),
    };
  });
  const legendItems = singleSlice
    ? [{ ...data[0], color: COLORS[0], pct: "100" }]
    : slices;
  return (
    <ClipFrame padding="p-6" className="min-h-[220px]">
      <MonoTag>// ao distribution</MonoTag>
      <div className="flex items-center gap-4 mt-3">
        <svg
          viewBox="0 0 120 120"
          className="w-28 h-28"
          role="img"
          aria-label={`AO distribution. ${legendItems.map((s) => `${s.ao} ${s.pct}%`).join(", ")}.`}
        >
          {singleSlice ? (
            // Single-AO PAX: arcPath produces a degenerate sliver (sin(2π)≈0).
            // Render a full circle instead — matches Phase 1 PostsByAoChart pattern.
            <circle cx="60" cy="60" r="50" fill={COLORS[0]} />
          ) : (
            slices.map((s) => (
              <path key={s.ao} d={s.path} fill={s.color} />
            ))
          )}
        </svg>
        <ul className="font-mono text-xs flex-1 space-y-1">
          {legendItems.map((s) => (
            <li key={s.ao} className="flex items-baseline gap-2">
              <span
                className="w-3 h-3 inline-block"
                style={{ backgroundColor: s.color }}
              />
              <span className="flex-1 truncate">{s.ao}</span>
              <span className="text-muted">{s.count}</span>
              <span className="w-8 text-right text-muted">{s.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ClipFrame>
  );
}
