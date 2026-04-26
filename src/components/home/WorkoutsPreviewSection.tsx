import Link from "next/link";
import { getWorkoutSchedule } from "@/lib/workouts/getWorkoutSchedule";
import { SectionHead } from "@/components/ui/brand/SectionHead";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";
import { WorkoutsFilter } from "./WorkoutsFilter";
import type { WorkoutWithRegion } from "@/types/workout";

/** "06:00:00" -> "6:00am" — same logic as AOCard.formatTime so the kicker
 *  copy and the card chips read identically. */
function formatTime(hhmmss: string): string {
  const [h, m] = hhmmss.split(":").map(Number);
  const hour12 = ((h + 11) % 12) + 1;
  const ampm = h < 12 ? "am" : "pm";
  return `${hour12}:${m.toString().padStart(2, "0")}${ampm}`;
}

/** Pretty-print the time spread of a workout group: single time as-is,
 *  multiple as a sorted "min–max" range so we don't lie about gaps. */
function timeRange(times: string[]): string {
  const unique = Array.from(new Set(times)).sort();
  if (unique.length === 0) return "";
  if (unique.length === 1) return formatTime(unique[0]);
  return `${formatTime(unique[0])}–${formatTime(unique[unique.length - 1])}`;
}

/** Build the kicker copy from the actual Marietta-region schedule rather
 *  than hardcoding times — the previous static "07:00 on Saturdays"
 *  drifted out of sync with the data (Saturdays are 6:00am–6:30am). */
function buildKicker(workouts: WorkoutWithRegion[]): string {
  const marietta = workouts.filter((w) => w.region_slug === "marietta");
  const weekdayTimes = marietta
    .filter((w) => w.day_of_week >= 1 && w.day_of_week <= 5)
    .map((w) => w.start_time);
  const satTimes = marietta
    .filter((w) => w.day_of_week === 6)
    .map((w) => w.start_time);

  const parts: string[] = [];
  if (weekdayTimes.length > 0) {
    parts.push(`Weekdays kick off at ${timeRange(weekdayTimes)}`);
  }
  if (satTimes.length > 0) {
    parts.push(`Saturdays at ${timeRange(satTimes)}`);
  }
  const intro = parts.length > 0 ? `${parts.join(", ")}. ` : "";
  return `${intro}Beatdowns, rucks, Q-school, and runs rotating through the week. Pick a day. Pick a post. Fall in.`;
}

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
  const kicker = buildKicker(flat);

  return (
    <section id="workouts" className="bg-bone-2 py-28">
      <div className="max-w-[1320px] mx-auto px-5 sm:px-7">
        <ScrollReveal>
          <SectionHead
            eyebrow="§ 02 · Posts of Assembly"
            h2={<>Find Your<br />Beatdown.</>}
            kicker={kicker}
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
