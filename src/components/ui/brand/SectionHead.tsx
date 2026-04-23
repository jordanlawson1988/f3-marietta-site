import type { ReactNode } from "react";
import { EyebrowLabel } from "./EyebrowLabel";

type Props = {
  eyebrow: string;
  h2: ReactNode;
  kicker?: ReactNode;
  align?: "left" | "center" | "split";
  id?: string;
  variant?: "bone" | "ink";
  className?: string;
};

export function SectionHead({ eyebrow, h2, kicker, align = "split", id, variant = "bone", className = "" }: Props) {
  const eyebrowVariant = variant === "ink" ? "bone" : "muted";
  const kickerColor = variant === "ink" ? "text-bone/70" : "text-muted";

  if (align === "split") {
    return (
      <div id={id} className={`grid grid-cols-1 md:grid-cols-[1fr_2fr] gap-8 md:gap-16 mb-14 ${className}`}>
        <div>
          <EyebrowLabel variant={eyebrowVariant} withRule>{eyebrow}</EyebrowLabel>
          <h2 className="mt-5 font-display font-bold uppercase leading-[.9] text-[clamp(42px,6vw,88px)] tracking-[-.01em]">
            {h2}
          </h2>
        </div>
        {kicker && (
          <div className={`max-w-xl text-[17px] leading-[1.6] ${kickerColor} self-end pb-2`}>
            {kicker}
          </div>
        )}
      </div>
    );
  }

  const alignClass = align === "center" ? "text-center items-center" : "items-start";
  return (
    <div id={id} className={`flex flex-col gap-5 mb-14 ${alignClass} ${className}`}>
      <EyebrowLabel variant={eyebrowVariant} withRule>{eyebrow}</EyebrowLabel>
      <h2 className="font-display font-bold uppercase leading-[.9] text-[clamp(42px,6vw,88px)] tracking-[-.01em]">
        {h2}
      </h2>
      {kicker && <div className={`max-w-xl text-[17px] leading-[1.6] ${kickerColor}`}>{kicker}</div>}
    </div>
  );
}
