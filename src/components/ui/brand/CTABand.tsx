import type { ReactNode } from "react";
import { ChamferButton } from "./ChamferButton";
import { TopoBackground } from "./TopoBackground";

type Variant = "steel" | "ink" | "bone" | "gradient";

type Props = {
  variant?: Variant;
  id?: string;
  title: ReactNode;
  kicker?: ReactNode;
  primary: { label: string; href: string };
  secondary?: { label: string; href: string };
  watermark?: ReactNode;
  className?: string;
};

export function CTABand({ variant = "steel", id, title, kicker, primary, secondary, watermark, className = "" }: Props) {
  const bg =
    variant === "gradient" ? "text-bone" :
    variant === "steel" ? "bg-steel text-bone" :
    variant === "ink" ? "bg-ink text-bone" :
    "bg-bone-2 text-ink";
  const bgStyle = variant === "gradient"
    ? { background: "linear-gradient(180deg, #24446a 0%, #1a3552 100%)" } as React.CSSProperties
    : undefined;
  const primaryVariant = variant === "bone" ? "ink" : "bone";
  const kickerColor = variant === "bone" ? "text-ink-2" : "text-bone/75";

  return (
    <section id={id} className={`relative overflow-hidden ${bg} ${className}`} style={bgStyle}>
      {variant !== "bone" && variant !== "gradient" && <TopoBackground variant="dark" />}
      {watermark && <div className="pointer-events-none absolute inset-0 opacity-[.06] select-none" aria-hidden="true">{watermark}</div>}
      <div className="relative z-10 max-w-[1320px] mx-auto px-7 py-24 md:py-28 grid grid-cols-1 md:grid-cols-[1.5fr_1fr] gap-10 items-end">
        <h2 className="font-display font-bold uppercase leading-[.86] text-[clamp(48px,8vw,140px)] tracking-[-.01em]">
          {title}
        </h2>
        <div className="flex flex-col gap-6">
          {kicker && <p className={`text-[17px] leading-[1.6] max-w-md ${kickerColor}`}>{kicker}</p>}
          <div className="flex flex-wrap gap-3">
            <ChamferButton variant={primaryVariant} href={primary.href} size="lg">{primary.label}</ChamferButton>
            {secondary && <ChamferButton variant="ghost" href={secondary.href} size="lg">{secondary.label}</ChamferButton>}
          </div>
        </div>
      </div>
    </section>
  );
}
