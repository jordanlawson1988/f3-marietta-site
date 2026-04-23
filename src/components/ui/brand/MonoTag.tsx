import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  variant?: "muted" | "steel" | "bone" | "ink";
};

export function MonoTag({ children, className = "", variant = "muted" }: Props) {
  const color =
    variant === "steel" ? "text-steel" :
    variant === "bone" ? "text-bone/70" :
    variant === "ink" ? "text-ink" :
    "text-muted";
  return (
    <span className={`font-mono text-[11px] tracking-[.15em] uppercase ${color} ${className}`}>
      {children}
    </span>
  );
}
