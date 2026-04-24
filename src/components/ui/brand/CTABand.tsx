import type { ReactNode } from "react";
import Image from "next/image";
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
  /**
   * Optional hero photo behind the band. Heavy ink overlay is applied
   * automatically to preserve contrast. `priority=false` for all CTABands
   * since they're below the fold by convention.
   */
  backgroundImage?: string;
  backgroundImageAlt?: string;
  className?: string;
};

export function CTABand({
  variant = "steel",
  id,
  title,
  kicker,
  primary,
  secondary,
  watermark,
  backgroundImage,
  backgroundImageAlt = "",
  className = "",
}: Props) {
  const bg =
    variant === "gradient" ? "text-bone" :
    variant === "steel" ? "bg-steel text-bone" :
    variant === "ink" ? "bg-ink text-bone" :
    "bg-bone-2 text-ink";
  const bgStyle = variant === "gradient"
    ? { background: "linear-gradient(180deg, #24446a 0%, #1a3552 100%)" } as React.CSSProperties
    : undefined;
  const primaryVariant = variant === "bone" ? "ink" : "bone";
  const kickerColor = variant === "bone" ? "text-ink-2" : "text-bone/85";

  // Dark variants get a strong legibility overlay; bone gets a soft fade so
  // the photo still reads as dominant.
  const overlay = variant === "bone"
    ? "linear-gradient(180deg, rgba(241,236,225,.55) 0%, rgba(241,236,225,.88) 100%)"
    : "linear-gradient(90deg, rgba(10,13,18,.88) 0%, rgba(10,13,18,.72) 50%, rgba(10,13,18,.58) 100%)";

  return (
    <section id={id} className={`relative overflow-hidden ${bg} ${className}`} style={bgStyle}>
      {backgroundImage && (
        <Image
          src={backgroundImage}
          alt={backgroundImageAlt}
          fill
          sizes="100vw"
          className="object-cover opacity-70"
          priority={false}
          aria-hidden={backgroundImageAlt ? undefined : true}
        />
      )}
      {backgroundImage && (
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none"
          style={{ background: overlay }}
        />
      )}
      {variant !== "bone" && variant !== "gradient" && !backgroundImage && <TopoBackground variant="dark" />}
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
