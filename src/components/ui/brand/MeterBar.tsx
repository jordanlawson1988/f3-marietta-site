import type { ReactNode } from "react";

type Props = {
  left?: ReactNode;
  right?: ReactNode;
  className?: string;
  variant?: "bone" | "ink";
  tickCount?: number;
  highlightIndices?: number[];
};

export function MeterBar({
  left,
  right,
  className = "",
  variant = "bone",
  tickCount = 32,
  highlightIndices = [5, 12, 22, 27],
}: Props) {
  const textColor = variant === "ink" ? "text-bone/60" : "text-muted";
  const tickBase = variant === "ink" ? "bg-bone/25" : "bg-ink/20";
  const tickHighlight = "bg-steel";
  const border = variant === "ink" ? "border-bone/12" : "border-line-soft";

  return (
    <div
      className={`flex items-center justify-between border-y px-7 py-3.5 font-mono text-[11px] tracking-[.1em] uppercase ${textColor} ${border} ${className}`}
    >
      {left && <div className="flex items-center gap-3">{left}</div>}
      <div className="flex items-center gap-[2px]" aria-hidden="true">
        {Array.from({ length: tickCount }, (_, i) => {
          const isHighlight = highlightIndices.includes(i);
          return (
            <span
              key={i}
              className={`w-[2px] ${isHighlight ? `${tickHighlight} h-3.5` : `${tickBase} h-2.5`}`}
            />
          );
        })}
      </div>
      {right && <div className="flex items-center gap-3">{right}</div>}
    </div>
  );
}
