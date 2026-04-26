import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { WorkoutsFilter } from "@/components/home/WorkoutsFilter";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { getWorkoutSchedule } from "@/lib/workouts/getWorkoutSchedule";
import type { WorkoutWithRegion } from "@/types/workout";

export const metadata: Metadata = {
  title: "Workouts",
  description: "All F3 Marietta AOs and workout times. Rain or shine, free of charge.",
};

export default async function WorkoutsPage() {
  const schedule = await getWorkoutSchedule();
  const flat: WorkoutWithRegion[] = [];
  for (const day of Object.values(schedule)) {
    for (const region of day.regions) {
      for (const w of region.workouts) {
        flat.push({
          ...w,
          region_name: region.region.name,
          region_slug: region.region.slug,
          region_is_primary: region.region.is_primary,
        });
      }
    }
  }

  return (
    <>
      <PageHeader
        eyebrow="§ Posts of Assembly"
        title={<>Find Your<br />Beatdown.</>}
        kicker={<>Beatdowns kick off at 05:30 weekdays. Saturdays start at 06:00. Pick a day. Pick a post. Fall in.</>}
        meter={{ left: "Marietta Region · F3 Nation", right: `Active AOs · ${flat.length}` }}
      />

      <section className="bg-bone py-20">
        <div className="max-w-[1320px] mx-auto px-5 sm:px-7">
          <ScrollReveal>
            <WorkoutsFilter workouts={flat} />
          </ScrollReveal>
          <div className="mt-20 border border-line-soft bg-bone-2 p-10 text-center">
            <div className="font-mono text-[11px] tracking-[.15em] uppercase text-ink-2">// Don&apos;t see your AO?</div>
            <h3 className="mt-3 font-display font-bold uppercase text-[28px] tracking-[-.01em]">
              The region is growing.
            </h3>
            <p className="mt-3 text-[15px] text-ink-2 max-w-xl mx-auto">
              Interested in planting an AO in your part of Marietta? Send us a note — we&apos;ll help you stand it up.
            </p>
            <div className="mt-5">
              <a href="/contact" className="inline-block font-display font-bold uppercase tracking-[.1em] text-[14px] text-steel-2">
                Contact Us →
              </a>
            </div>
          </div>
        </div>
      </section>

      <CTABand
        variant="ink"
        title={<>First Post.</>}
        kicker={<>Arrive five minutes early. Tell us your name. Fall in.</>}
        primary={{ label: "What to Expect", href: "/what-to-expect" }}
      />
    </>
  );
}
