import type { ReactNode } from "react";

type Variant = "active" | "launch" | "archived" | "draft" | "fng" | "pending";

type Props = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
};

const variantClass: Record<Variant, string> = {
  active:   "bg-steel/15 text-steel border-steel/40",
  launch:   "bg-rust/15 text-rust border-rust/40",
  archived: "bg-muted/15 text-muted border-muted/40",
  draft:    "bg-brass/15 text-brass border-brass/40",
  fng:      "bg-olive/15 text-olive border-olive/40",
  pending:  "bg-ink/10 text-ink border-ink/30",
};

export function StatusChip({ children, variant = "active", className = "" }: Props) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 border font-mono text-[10px] tracking-[.18em] uppercase ${variantClass[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
