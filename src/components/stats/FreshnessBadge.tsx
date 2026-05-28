import { MonoTag } from "@/components/ui/brand/MonoTag";

function formatAsOf(d: Date = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
    month: "short",
    day: "numeric",
  });
  return fmt.format(d).replace(",", "").toUpperCase();
}

export function FreshnessBadge({
  asOf,
  label = "live",
}: {
  asOf?: Date;
  label?: string;
}) {
  const stamp = formatAsOf(asOf);
  return (
    <span
      className="inline-flex items-center gap-2 font-mono text-[10px] tracking-[.18em] uppercase text-muted"
      title="When the underlying data was last queried"
    >
      <span
        className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"
        aria-hidden
      />
      <MonoTag className="!text-[10px]">// {label} · {stamp} ET</MonoTag>
    </span>
  );
}
