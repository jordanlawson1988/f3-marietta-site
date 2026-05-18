import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

type Point = { month: string; count: number };

export function PostsOverTimeChart({ data }: { data: Point[] }) {
  if (data.length === 0) {
    return (
      <ClipFrame padding="p-6" className="min-h-[220px]">
        <MonoTag>// posts over time · monthly</MonoTag>
        <p className="font-mono text-xs text-muted mt-3">// no posts in range</p>
      </ClipFrame>
    );
  }

  const w = 600;
  const h = 180;
  const padX = 32;
  const padY = 20;
  const max = Math.max(...data.map((p) => p.count));
  const stepX = data.length > 1 ? (w - padX * 2) / (data.length - 1) : 0;

  const points = data.map((p, i) => {
    const x = padX + i * stepX;
    const y = h - padY - ((p.count / max) * (h - padY * 2));
    return { x, y, ...p };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <ClipFrame padding="p-6" className="min-h-[220px]">
      <MonoTag>// posts over time · monthly</MonoTag>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        className="w-full h-auto mt-4"
        role="img"
        aria-label="Monthly post counts line chart"
      >
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
              y={h - 4}
              textAnchor="middle"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              fill="#6b7280"
            >
              {p.month.slice(5)}
            </text>
            <text
              x={p.x}
              y={p.y - 6}
              textAnchor="middle"
              fontSize="9"
              fontFamily="ui-monospace, monospace"
              fill="#0a0a0a"
            >
              {p.count}
            </text>
          </g>
        ))}
      </svg>
    </ClipFrame>
  );
}
