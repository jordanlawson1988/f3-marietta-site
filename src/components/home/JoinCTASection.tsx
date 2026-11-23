import { CTABand } from "@/components/ui/brand/CTABand";
import { getHeroPhotoForSlot } from "@/lib/backblast/getHeroPhotos";
import { formatHeroStamp } from "@/lib/backblast/rankHeroPhotos";
import { GENERIC_BACKBLAST_FALLBACK } from "@/lib/backblast/getBackblastImage";

export async function JoinCTASection() {
  // Own slot in the ranked list, so this never duplicates the hero or impact photo.
  const photo = await getHeroPhotoForSlot("join");

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
      backgroundImage={photo?.url ?? GENERIC_BACKBLAST_FALLBACK}
      backgroundStamp={photo ? formatHeroStamp(photo) : undefined}
      watermark={
        <span className="absolute -bottom-16 right-0 font-display font-bold uppercase text-bone text-[clamp(200px,30vw,480px)] leading-none">
          05:30
        </span>
      }
    />
  );
}
