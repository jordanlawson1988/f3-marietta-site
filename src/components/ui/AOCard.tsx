import Link from "next/link";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { StatusChip } from "@/components/ui/brand/StatusChip";
import { slugifyAo } from "@/lib/stats/getNextMarietteMuster";
import type { WorkoutScheduleRow } from "@/types/workout";

type Props = {
  workout: WorkoutScheduleRow;
  code?: string;
  status?: "active" | "launch";
  qName?: string;
  className?: string;
};

const DAY_LABELS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

function formatTime(hhmmss: string): string {
  const [h, m] = hhmmss.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "am" : "pm";
  return `${hour12}:${m.toString().padStart(2, "0")}${ampm}`;
}

export function AOCard({ workout, code, status = "active", qName, className = "" }: Props) {
  const dayLabel = DAY_LABELS[workout.day_of_week % 7];
  const timeLabel = formatTime(workout.start_time);
  // Anchor for deep links from the TopBar "Next Muster" link. scroll-margin
  // clears the sticky 56-72px navbar so the card lands below the chrome,
  // not behind it.
  const anchorId = `ao-${slugifyAo(workout.ao_name)}`;

  return (
    <article
      id={anchorId}
      style={{ scrollMarginTop: "120px" }}
      className={`group relative bg-bone border border-line-soft p-7 transition-all duration-300 hover:-translate-y-0.5 hover:border-ink hover:shadow-[0_10px_30px_rgba(12,12,12,.08)] target:ring-2 target:ring-steel ${className}`}
    >
      <span
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-[3px] bg-steel origin-left scale-x-0 group-hover:scale-x-100 transition-transform duration-300"
      />
      <div className="flex items-center justify-between gap-3 mb-5">
        <MonoTag>{code ?? "F3.MAR"}</MonoTag>
        <StatusChip variant={status}>{status === "launch" ? "Launching" : "Active"}</StatusChip>
      </div>
      <h3 className="font-display font-bold uppercase text-[clamp(28px,3vw,34px)] leading-none tracking-[-.01em]">
        {workout.ao_name}
      </h3>
      <div className="mt-3 flex items-center gap-1.5 text-muted font-mono text-[11px] tracking-[.1em] uppercase">
        <svg viewBox="0 0 16 16" className="w-3 h-3" fill="currentColor" aria-hidden="true">
          <path d="M8 1c-3 0-5.5 2.2-5.5 5 0 3.6 4.8 8.5 5 8.7.3.3.7.3 1 0 .2-.2 5-5.1 5-8.7 0-2.8-2.5-5-5.5-5zm0 7a2 2 0 1 1 0-4 2 2 0 0 1 0 4z" />
        </svg>
        <span>{workout.location_name ?? workout.address}</span>
      </div>

      <div className="mt-6 flex items-center justify-between pt-5 border-t border-line-soft">
        <div className="flex items-center gap-4">
          <MonoTag>{dayLabel}</MonoTag>
          <span className="font-display font-semibold text-[15px]">{timeLabel}</span>
          <MonoTag variant="steel">· GLOOM</MonoTag>
        </div>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <MonoTag>{qName ? `Q · ${qName}` : "Peer-Led"}</MonoTag>
        <Link
          href={workout.map_link ?? `https://www.google.com/maps?q=${encodeURIComponent(workout.address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[11px] tracking-[.15em] uppercase text-steel inline-flex items-center gap-1 group-hover:gap-2.5 transition-all"
        >
          Directions <span aria-hidden="true">→</span>
        </Link>
      </div>
    </article>
  );
}
