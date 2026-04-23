import type { CSSProperties } from "react";

type Corner = "tl" | "tr" | "bl" | "br";

type Props = {
  corner: Corner;
  size?: number;
  color?: "steel" | "bone" | "ink";
  thickness?: number;
  className?: string;
};

export function CornerBracket({ corner, size = 22, color = "steel", thickness = 2, className = "" }: Props) {
  const colorVar =
    color === "steel" ? "var(--steel)" :
    color === "bone" ? "var(--bone)" :
    "var(--ink)";
  const positions: Record<Corner, CSSProperties> = {
    tl: { top: 0, left: 0, borderTop: `${thickness}px solid ${colorVar}`, borderLeft: `${thickness}px solid ${colorVar}` },
    tr: { top: 0, right: 0, borderTop: `${thickness}px solid ${colorVar}`, borderRight: `${thickness}px solid ${colorVar}` },
    bl: { bottom: 0, left: 0, borderBottom: `${thickness}px solid ${colorVar}`, borderLeft: `${thickness}px solid ${colorVar}` },
    br: { bottom: 0, right: 0, borderBottom: `${thickness}px solid ${colorVar}`, borderRight: `${thickness}px solid ${colorVar}` },
  };
  return (
    <span
      aria-hidden="true"
      className={`pointer-events-none absolute ${className}`}
      style={{ width: size, height: size, ...positions[corner] }}
    />
  );
}
