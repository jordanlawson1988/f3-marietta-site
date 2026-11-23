import type { ReactNode } from "react";
import { EyebrowLabel } from "./EyebrowLabel";
import { HeroPhotoBackdrop } from "./HeroPhotoBackdrop";
import { MeterBar } from "./MeterBar";
import { MonoTag } from "./MonoTag";
import { TopoBackground } from "./TopoBackground";

type Props = {
  eyebrow?: string;
  title: ReactNode;
  kicker?: ReactNode;
  variant?: "bone" | "ink";
  meter?: { left?: ReactNode; right?: ReactNode };
  /** Optional hero photo behind the header. A tone-matched gradient preserves contrast. */
  backgroundImage?: string;
  /** Documentary caption for the photo, e.g. "The Battlefield · 08.11.26 · 14 PAX". */
  backgroundStamp?: string;
  className?: string;
};

export function PageHeader({ eyebrow, title, kicker, variant = "bone", meter, backgroundImage, backgroundStamp, className = "" }: Props) {
  const bg = variant === "ink" ? "bg-ink text-bone" : "bg-bone text-ink";
  const kickerColor = variant === "ink" ? "text-bone/80" : "text-muted";

  return (
    <header data-testid="page-header" className={`relative overflow-hidden ${bg} ${className}`}>
      {/* Page headers are the LCP element on every page they appear on, so the photo preloads. */}
      {backgroundImage && <HeroPhotoBackdrop src={backgroundImage} tone={variant} priority />}
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
        {backgroundImage && backgroundStamp && (
          <MonoTag
            variant={variant === "ink" ? "bone" : "muted"}
            className="block mt-10 text-[10px] tracking-[.2em]"
            data-testid="hero-stamp"
          >
            {`// ${backgroundStamp}`}
          </MonoTag>
        )}
      </div>
    </header>
  );
}
