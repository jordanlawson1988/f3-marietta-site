import { HomeHero } from "@/components/home/HomeHero";
import { ThreeFsSection } from "@/components/home/ThreeFsSection";
import { CreedPrinciplesSection } from "@/components/home/CreedPrinciplesSection";
import { WorkoutsPreviewSection } from "@/components/home/WorkoutsPreviewSection";
import { BackblastsPreviewSection } from "@/components/home/BackblastsPreviewSection";
import { BeatdownCTASection } from "@/components/home/BeatdownCTASection";
import { ImpactSection } from "@/components/home/ImpactSection";
import { JoinCTASection } from "@/components/home/JoinCTASection";
import { MarqueeRibbon } from "@/components/layout/MarqueeRibbon";
import { getWeeklyPaxCount } from "@/lib/stats/getWeeklyPaxCount";

/**
 * ISR safety net. Primary refresh path is on-demand:
 * /api/slack/events calls revalidatePath('/') on every upsert/delete.
 * This short interval catches cases where the webhook didn't fire or
 * the revalidation call failed (e.g., function cold-start timeout).
 */
export const revalidate = 300;

export default async function Home() {
  const weeklyPax = await getWeeklyPaxCount();

  return (
    <>
      <HomeHero weeklyPax={weeklyPax} />
      <MarqueeRibbon />
      <ThreeFsSection />
      <CreedPrinciplesSection />
      <MarqueeRibbon />
      <WorkoutsPreviewSection />
      <BackblastsPreviewSection />
      <BeatdownCTASection />
      <ImpactSection />
      <JoinCTASection />
    </>
  );
}
