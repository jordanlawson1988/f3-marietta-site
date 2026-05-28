import { ChartCard } from "./ChartCard";
import type { WeekCell } from "@/lib/stats/getStreakCalendar";

type Props = {
  data: WeekCell[];
  title?: React.ReactNode;
  eyebrow?: string;
  subtitle?: React.ReactNode;
};

function intensity(posts: number): string {
  if (posts === 0) return "bg-black/[.05] text-muted";
  if (posts === 1) return "bg-amber-300/70 text-ink";
  if (posts === 2) return "bg-amber-500/85 text-ink";
  if (posts === 3) return "bg-amber-600 text-bone";
  return "bg-ink text-bone";
}

function shortWeek(weekStart: string): string {
  const d = new Date(weekStart + "T00:00:00Z");
  return d.toLocaleDateString("en-US", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function StreakCalendar({
  data,
  title = "Last 12 weeks of posts",
  eyebrow = "streak calendar · weekly",
  subtitle = "Each cell = one ISO week. Darker = more posts. Empty cells break the streak.",
}: Props) {
  if (data.length === 0 || data.every((c) => c.posts === 0)) {
    return (
      <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
        <p className="font-mono text-xs text-muted">// no posts in this window</p>
      </ChartCard>
    );
  }

  return (
    <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <div className="grid grid-cols-12 gap-1.5" role="list">
        {data.map((c) => (
          <div
            key={c.weekStart}
            role="listitem"
            title={`Week of ${c.weekStart} · ${c.posts} post${c.posts === 1 ? "" : "s"}`}
            className={`aspect-square flex items-center justify-center font-mono text-[10px] ${intensity(c.posts)}`}
          >
            {c.posts || ""}
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-3 font-mono text-[10px] tracking-[.15em] uppercase text-muted">
        <span>{shortWeek(data[0].weekStart)}</span>
        <span>→</span>
        <span>{shortWeek(data[data.length - 1].weekStart)}</span>
      </div>
    </ChartCard>
  );
}
