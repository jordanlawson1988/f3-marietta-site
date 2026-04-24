import Link from "next/link";
import { getWorkoutSchedule } from "@/lib/workouts/getWorkoutSchedule";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { WorkoutsFilter } from "./WorkoutsFilter";
import type { WorkoutWithRegion } from "@/types/workout";

export async function WorkoutsPreviewSection() {
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
    <section id="workouts" className="bg-bone-2 py-28">
      <div className="max-w-[1320px] mx-auto px-7">
        <ScrollReveal>
          <SectionHead
            eyebrow="§ 02 · Posts of Assembly"
            h2={<>Find Your<br />Beatdown.</>}
            kicker={
              <>
                Every AO runs 05:30 to 06:15 (or 07:00 on Saturdays). Beatdowns, rucks, Q-school, and runs rotating through the week. Pick a day. Pick a post. Fall in.
              </>
            }
          />
        </ScrollReveal>

        <ScrollReveal>
          <WorkoutsFilter workouts={flat} limit={6} />
        </ScrollReveal>

        <div className="mt-10 flex justify-center">
          <Link
            href="/workouts"
            className="inline-flex items-center gap-2 font-display font-bold uppercase tracking-[.1em] text-[14px] text-steel-2 hover:gap-3 transition-all"
          >
            View all posts <span aria-hidden="true">→</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
