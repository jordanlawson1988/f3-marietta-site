import { ChartCard } from "./ChartCard";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export type HeatmapCell = {
  /** 0 = Mon, 6 = Sun */
  dow: number;
  /** time bucket label, e.g. "5:15a", "5:30a", "6:00a" */
  bucket: string;
  count: number;
};

type Props = {
  data: HeatmapCell[];
  /** ordered list of time buckets — controls column order */
  buckets: string[];
  /** buckets that always render even when empty. Empty cells in these
   * columns are informative ("no posts at that scheduled time"). */
  alwaysShowBuckets?: Set<string>;
  title: React.ReactNode;
  eyebrow?: string;
  subtitle?: React.ReactNode;
  /** small footnote rendered below the grid (e.g. data-quality caveats) */
  footnote?: React.ReactNode;
};

function intensityClass(count: number, max: number): string {
  if (count === 0) return "bg-black/[.04]";
  const ratio = count / max;
  if (ratio > 0.75) return "bg-ink text-bone";
  if (ratio > 0.5) return "bg-ink/70 text-bone";
  if (ratio > 0.25) return "bg-amber-400/70 text-ink";
  return "bg-amber-300/40 text-ink";
}

export function DayTimeHeatmap({
  data,
  buckets,
  alwaysShowBuckets,
  title,
  eyebrow = "day × time",
  subtitle,
  footnote,
}: Props) {
  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
        <p className="font-mono text-xs text-muted">// no posts in range</p>
      </ChartCard>
    );
  }

  const lookup = new Map<string, number>();
  for (const c of data) {
    lookup.set(`${c.dow}|${c.bucket}`, c.count);
  }
  const max = Math.max(...data.map((d) => d.count));

  // Hide trailing columns where every day is zero, UNLESS the bucket is in
  // the always-show set (those zeros are meaningful). Keeps the grid tight
  // while still surfacing real gaps in expected schedule windows.
  const visibleBuckets = buckets.filter((b) => {
    if (alwaysShowBuckets?.has(b)) return true;
    for (let dow = 0; dow < 7; dow++) {
      if ((lookup.get(`${dow}|${b}`) ?? 0) > 0) return true;
    }
    return false;
  });

  return (
    <ChartCard eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <div className="overflow-x-auto">
        <table
          className="font-mono text-[11px] w-full border-separate"
          style={{ borderSpacing: "2px" }}
          aria-label="Posts heatmap by day of week and time bucket"
        >
          <thead>
            <tr>
              <th className="w-12 text-left text-muted font-normal tracking-[.15em] uppercase pr-2">
                day
              </th>
              {visibleBuckets.map((b) => (
                <th
                  key={b}
                  className="text-center text-muted font-normal tracking-[.05em] py-1"
                >
                  {b}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {DAYS.map((day, i) => (
              <tr key={day}>
                <td className="text-muted pr-2 tracking-[.1em] uppercase">{day}</td>
                {visibleBuckets.map((b) => {
                  const v = lookup.get(`${i}|${b}`) ?? 0;
                  return (
                    <td
                      key={b}
                      className={`text-center h-7 min-w-[36px] ${intensityClass(v, max)}`}
                      title={`${day} ${b}: ${v} post${v === 1 ? "" : "s"}`}
                    >
                      {v > 0 ? v : ""}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-mono text-[10px] tracking-[.15em] uppercase text-muted mt-3">
        // darker = denser · F3 culture is pre-dawn — empty 7a+ slots are expected
      </p>
      {footnote && (
        <p className="font-mono text-[10px] text-muted mt-2 leading-relaxed">
          {footnote}
        </p>
      )}
    </ChartCard>
  );
}
