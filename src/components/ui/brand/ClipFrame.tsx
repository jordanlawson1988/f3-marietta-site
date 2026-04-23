import type { ReactNode } from "react";

type Variant = "bone" | "ink" | "steel";

type Props = {
  children: ReactNode;
  variant?: Variant;
  className?: string;
  padding?: string;
};

const variantClass: Record<Variant, string> = {
  bone: "bg-bone border-line-soft",
  ink:  "bg-ink-2 border-bone/15 text-bone",
  steel: "bg-steel/10 border-steel/40",
};

export function ClipFrame({ children, variant = "bone", className = "", padding = "p-7" }: Props) {
  return (
    <div
      className={`relative border clip-chamfer ${variantClass[variant]} ${padding} ${className}`}
      style={{ borderColor: "var(--line-soft)" }}
    >
      {children}
    </div>
  );
}
