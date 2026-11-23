import Image from "next/image";

type Props = {
  src: string;
  /** Surface tone the overlay fades into. */
  tone?: "ink" | "bone";
  /** Above-the-fold heroes should preload; everything else lazy-loads. */
  priority?: boolean;
  /**
   * Where the copy sits. The overlay is heaviest on that side so headlines
   * stay legible while the men in frame stay visible on the other side.
   */
  anchor?: "left" | "right";
};

const INK = "10,13,18";
const BONE = "241,236,225";

/**
 * Full-bleed backblast photo behind a hero surface.
 *
 * The photo renders at full opacity; legibility comes from the gradient,
 * not from dimming the whole image. On wide screens the gradient runs
 * horizontally away from the copy so faces show through on the far side.
 * On narrow screens copy spans the full width, so a uniform wash plus a
 * bottom fade takes over instead.
 */
export function HeroPhotoBackdrop({ src, tone = "ink", priority = false, anchor = "left" }: Props) {
  const rgb = tone === "ink" ? INK : BONE;
  const dir = anchor === "left" ? "90deg" : "270deg";
  // Copy lives in the first ~55% of the width, so the wash can drop off fast
  // past that and let the far side of the frame show the men almost clean.
  const wide = `linear-gradient(${dir}, rgba(${rgb},.94) 0%, rgba(${rgb},.84) 36%, rgba(${rgb},.36) 66%, rgba(${rgb},.08) 100%), linear-gradient(180deg, rgba(${rgb},0) 55%, rgba(${rgb},.75) 100%)`;
  const narrow = `linear-gradient(180deg, rgba(${rgb},.72) 0%, rgba(${rgb},.62) 55%, rgba(${rgb},.9) 100%)`;

  return (
    <>
      <Image
        src={src}
        alt=""
        aria-hidden="true"
        fill
        sizes="100vw"
        className="object-cover object-center"
        priority={priority}
      />
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none md:hidden" style={{ background: narrow }} />
      <div aria-hidden="true" className="absolute inset-0 pointer-events-none hidden md:block" style={{ background: wide }} />
    </>
  );
}
