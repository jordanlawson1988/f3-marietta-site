import type { ReactNode } from "react";
import { ClipFrame } from "@/components/ui/brand/ClipFrame";
import { MonoTag } from "@/components/ui/brand/MonoTag";

type Props = {
  /** small monospaced eyebrow above the title */
  eyebrow: string;
  /** sentence-case insight title (per BI best practice — insight in the title) */
  title: ReactNode;
  /** optional one-liner subtext (caveats, denominators, "n=X") */
  subtitle?: ReactNode;
  /** top-right element (legend, compare toggle, etc.) */
  trailing?: ReactNode;
  children: ReactNode;
  /** min-height so empty states don't pop the layout */
  minHeight?: string;
  className?: string;
};

export function ChartCard({
  eyebrow,
  title,
  subtitle,
  trailing,
  children,
  minHeight = "min-h-[220px]",
  className = "",
}: Props) {
  return (
    <ClipFrame padding="p-6" className={`${minHeight} ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <MonoTag>// {eyebrow}</MonoTag>
          <h3 className="font-display font-bold uppercase text-[18px] tracking-[-.005em] leading-tight mt-2 text-ink">
            {title}
          </h3>
          {subtitle && (
            <p className="font-mono text-[11px] text-muted mt-1">{subtitle}</p>
          )}
        </div>
        {trailing && <div className="shrink-0">{trailing}</div>}
      </div>
      <div className="mt-4">{children}</div>
    </ClipFrame>
  );
}
