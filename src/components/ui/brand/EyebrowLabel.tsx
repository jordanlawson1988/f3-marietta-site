import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  variant?: "muted" | "steel" | "bone";
  withRule?: boolean;
};

export function EyebrowLabel({ children, className = "", variant = "muted", withRule = false }: Props) {
  const color =
    variant === "steel" ? "text-steel" :
    variant === "bone" ? "text-bone/70" :
    "text-muted";
  const ruleColor = variant === "steel" ? "bg-steel" : variant === "bone" ? "bg-bone/40" : "bg-muted";
  return (
    <span className={`inline-flex items-center gap-2.5 font-mono text-[11px] tracking-[.2em] uppercase ${color} ${className}`}>
      {withRule && <span className={`h-px w-7 ${ruleColor}`} aria-hidden="true" />}
      {children}
    </span>
  );
}
