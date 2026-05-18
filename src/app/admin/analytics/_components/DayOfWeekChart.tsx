import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function DayOfWeekChart({
  data,
}: {
  data: Array<{ dow: number; count: number }>;
}) {
  const lookup = new Map(data.map((d) => [d.dow, d.count]));
  const max = data.length ? Math.max(...data.map((d) => d.count)) : 0;
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <ClipFrame padding="p-6" className="min-h-[220px]">
        <MonoTag>// posts by day of week</MonoTag>
        <p className="font-mono text-xs text-muted mt-3">// no posts in range</p>
      </ClipFrame>
    );
  }

  return (
    <ClipFrame padding="p-6" className="min-h-[220px]">
      <MonoTag>// posts by day of week</MonoTag>
      <ul className="font-mono text-xs space-y-2 mt-4">
        {DAYS.map((label, i) => {
          const count = lookup.get(i) ?? 0;
          const widthPct = max === 0 ? 0 : Math.max(2, (count / max) * 100);
          return (
            <li key={label} className="flex items-baseline gap-3">
              <span className="w-10 text-muted">{label}</span>
              <span className="flex-1 relative h-4 bg-black/5">
                <span
                  className="absolute inset-y-0 left-0 bg-foreground"
                  style={{ width: `${widthPct}%` }}
                />
              </span>
              <span className="w-8 text-right">{count}</span>
            </li>
          );
        })}
      </ul>
    </ClipFrame>
  );
}
