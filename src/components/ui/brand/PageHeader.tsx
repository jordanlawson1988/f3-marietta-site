import type { ReactNode } from "react";
import Image from "next/image";
import { EyebrowLabel } from "./EyebrowLabel";
import { MeterBar } from "./MeterBar";
import { MonoTag } from "./MonoTag";
import { TopoBackground } from "./TopoBackground";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  kicker?: ReactNode;
  variant?: "bone" | "ink";
  meter?: { left?: ReactNode; right?: ReactNode };
  /** Optional hero photo behind the header. Heavy ink overlay preserves contrast. */
  backgroundImage?: string;
  className?: string;
};

export function PageHeader({ eyebrow, title, kicker, variant = "bone", meter, backgroundImage, className = "" }: Props) {
  const bg = variant === "ink" ? "bg-ink text-bone" : "bg-bone text-ink";
  const kickerColor = variant === "ink" ? "text-bone/80" : "text-muted";

  return (
    <header className={`relative overflow-hidden ${bg} ${className}`}>
      {backgroundImage && (
        <>
          <Image
            src={backgroundImage}
            alt=""
            aria-hidden="true"
            fill
            sizes="100vw"
            className="object-cover opacity-40"
            priority={false}
          />
          <div
            aria-hidden="true"
            className="absolute inset-0 pointer-events-none"
            style={{
              background:
                variant === "ink"
                  ? "linear-gradient(90deg, rgba(10,13,18,.92) 0%, rgba(10,13,18,.78) 55%, rgba(10,13,18,.5) 100%)"
                  : "linear-gradient(90deg, rgba(241,236,225,.88) 0%, rgba(241,236,225,.72) 60%, rgba(241,236,225,.5) 100%)",
            }}
          />
        </>
      )}
      {variant === "ink" && !backgroundImage && <TopoBackground variant="dark" />}
      {meter && (
        <MeterBar
          variant={variant}
          left={meter.left && <MonoTag variant={variant === "ink" ? "bone" : "muted"}>{meter.left}</MonoTag>}
          right={meter.right && <MonoTag variant={variant === "ink" ? "bone" : "muted"}>{meter.right}</MonoTag>}
        />
      )}
      <div className="relative z-10 max-w-[1320px] mx-auto px-7 md:px-7 py-24 md:py-32">
        {eyebrow && <EyebrowLabel variant={variant === "ink" ? "steel" : "steel"} withRule>{eyebrow}</EyebrowLabel>}
        <h1 className="mt-6 font-display font-bold uppercase leading-[.86] text-[clamp(52px,8vw,128px)] tracking-[-.01em]">
          {title}
        </h1>
        {kicker && <p className={`mt-8 max-w-xl text-[18px] leading-[1.55] ${kickerColor}`}>{kicker}</p>}
      </div>
    </header>
  );
}
