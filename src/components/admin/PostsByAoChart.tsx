import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

type Datum = { ao: string; count: number };

type Slice = { ao: string; count: number; color: string; path: string; pct: number };

const COLORS = ["#d4a93c", "#0a0a0a", "#7e6b3a", "#b8a160", "#d4d0c2"];

function buildArcs(data: Datum[], total: number): Slice[] {
  const top = data.slice(0, 4);
  const rest = data.slice(4);

  const flat: Array<{ ao: string; count: number; color: string }> = top.map((d, i) => ({
    ao: d.ao,
    count: d.count,
    color: COLORS[i],
  }));
  if (rest.length > 0) {
    flat.push({
      ao: rest.length === 1 ? rest[0].ao : `Other (${rest.length} AOs)`,
      count: rest.reduce((s, r) => s + r.count, 0),
      color: COLORS[4],
    });
  }

  let cumulative = 0;
  return flat.map((s) => {
    const startFrac = cumulative / total;
    cumulative += s.count;
    const endFrac = cumulative / total;
    const startAngle = startFrac * 2 * Math.PI - Math.PI / 2;
    const endAngle = endFrac * 2 * Math.PI - Math.PI / 2;
    const x1 = 100 * Math.cos(startAngle);
    const y1 = 100 * Math.sin(startAngle);
    const x2 = 100 * Math.cos(endAngle);
    const y2 = 100 * Math.sin(endAngle);
    const largeArc = endFrac - startFrac > 0.5 ? 1 : 0;
    const path =
      flat.length === 1
        // single AO — draw a full circle
        ? `M 0 -100 A 100 100 0 1 1 0 100 A 100 100 0 1 1 0 -100 Z`
        : `M 0 0 L ${x1.toFixed(2)} ${y1.toFixed(2)} A 100 100 0 ${largeArc} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z`;
    return { ...s, path, pct: Math.round((s.count / total) * 100) };
  });
}

export function PostsByAoChart({ data }: { data: Datum[] }) {
  const total = data.reduce((sum, r) => sum + r.count, 0);

  if (total === 0) {
    return (
      <ClipFrame padding="p-6" className="min-h-[260px]">
        <MonoTag>// posts by ao</MonoTag>
        <h3 className="font-display font-black uppercase text-[24px] tracking-[-.01em] mt-3 mb-4">
          By AO
        </h3>
        <p className="font-mono text-xs text-muted">// no posts yet this year</p>
      </ClipFrame>
    );
  }

  const arcs = buildArcs(data, total);

  return (
    <ClipFrame padding="p-6" className="min-h-[260px]">
      <MonoTag>// posts by ao</MonoTag>
      <h3 className="font-display font-black uppercase text-[24px] tracking-[-.01em] mt-3 mb-4">
        By AO
      </h3>
      <div className="flex gap-6 items-center">
        <svg
          viewBox="-110 -110 220 220"
          className="w-[180px] h-[180px] flex-shrink-0"
          role="img"
          aria-label={`Posts by AO. ${arcs.map((a) => `${a.ao} ${a.pct}%`).join(", ")}.`}
        >
          {arcs.map((a, i) => (
            <path key={`${a.ao}-${i}`} d={a.path} fill={a.color} stroke="#0a0a0a" strokeWidth={1} />
          ))}
        </svg>
        <ul className="font-mono text-xs leading-relaxed flex-1 space-y-1.5">
          {arcs.map((a, i) => (
            <li key={`${a.ao}-${i}`} className="grid grid-cols-[14px_1fr_40px] items-center gap-2">
              <span
                className="w-2.5 h-2.5 border border-ink inline-block"
                style={{ background: a.color }}
                aria-hidden="true"
              />
              <span className="truncate">{a.ao}</span>
              <span className="text-right text-muted">{a.pct}%</span>
            </li>
          ))}
        </ul>
      </div>
    </ClipFrame>
  );
}
