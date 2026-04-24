import { CTABand } from "@/components/ui/brand/CTABand";
import { getRecentBackblastPhotos } from "@/lib/backblast/getRecentBackblastPhotos";
import { GENERIC_BACKBLAST_FALLBACK } from "@/lib/backblast/getBackblastImage";

export async function JoinCTASection() {
  // Pull the 2nd-most-recent so this section doesn't duplicate ImpactSection's photo.
  const recent = await getRecentBackblastPhotos(3);
  const backgroundImage = recent[1] ?? recent[0] ?? GENERIC_BACKBLAST_FALLBACK;

  return (
    <CTABand
      variant="gradient"
      id="new"
      title={<>Post.<br />That&apos;s it.</>}
      kicker={
        <>
          No sign-up. No fee. No catch. Show up five minutes early, tell us your name, and fall in. We&apos;ll handle the rest.
        </>
      }
      primary={{ label: "Plan Your First Post", href: "/new-here" }}
      backgroundImage={backgroundImage}
      watermark={
        <span className="absolute -bottom-16 right-0 font-display font-bold uppercase text-bone text-[clamp(200px,30vw,480px)] leading-none">
          05:30
        </span>
      }
    />
  );
}
