import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  className?: string;
  align?: "left" | "center";
  variant?: "bone" | "ink";
};

export function CreedQuote({ children, className = "", align = "center", variant = "ink" }: Props) {
  const color = variant === "ink" ? "text-bone" : "text-ink";
  const alignClass = align === "center" ? "text-center mx-auto" : "text-left";
  return (
    <blockquote
      className={`font-serif italic leading-[1.15] text-[clamp(36px,5vw,64px)] max-w-4xl ${alignClass} ${color} ${className}`}
    >
      {children}
    </blockquote>
  );
}
