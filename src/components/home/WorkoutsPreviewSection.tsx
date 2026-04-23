import Link from "next/link";
import { getWorkoutSchedule } from "@/lib/workouts/getWorkoutSchedule";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { WorkoutsFilter } from "./WorkoutsFilter";
import type { WorkoutScheduleRow } from "@/types/workout";

export async function WorkoutsPreviewSection() {
  const schedule = await getWorkoutSchedule();
  const flat: WorkoutScheduleRow[] = [];
  for (const day of Object.values(schedule)) {
    for (const region of day.regions) {
      flat.push(...region.workouts);
    }
  }

  return (
    <section id="workouts" className="bg-bone-2 py-28">
      <div className="max-w-[1320px] mx-auto px-7">
        <ScrollReveal>
          <SectionHead
            eyebrow="§ 02 · Posts of Assembly"
            h2={<>Find Your<br />Battlefield.</>}
            kicker={
              <>
                Every AO runs 05:15 to 06:00 (or 07:00 on Saturdays). Beatdowns, rucks, Q-school, and runs rotating through the week. Pick a day. Pick a post. Fall in.
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
