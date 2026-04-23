import { Section } from "@/components/ui/Section";
import { Button } from "@/components/ui/Button";
import { getWorkoutSchedule } from "@/lib/workouts/getWorkoutSchedule";
import { WorkoutSchedule } from "./WorkoutSchedule";

export const dynamic = 'force-dynamic';

function getTodayISODay(): number {
    const day = new Date().getDay(); // 0=Sun … 6=Sat
    return day === 0 ? 7 : day; // ISO: 1=Mon … 7=Sun
}

export default async function WorkoutsPage() {
    const schedule = await getWorkoutSchedule();
    const todayIndex = getTodayISODay();

    return (
        <div className="flex flex-col min-h-screen">
            {/* TODO(redesign): replaced by PageHeader in Wave 4 */}

            <Section>
                <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-8">
                    All workouts are free, open to all men, and held outdoors rain or shine.
                    Check the schedule below and join us in the gloom.
                </p>

                <WorkoutSchedule schedule={schedule} todayIndex={todayIndex} />
            </Section>

            <section className="mt-8 mb-20">
                <div className="max-w-2xl mx-auto text-center bg-[#0A1A2F] border border-[#23334A] rounded-xl px-6 py-8">
                    <h2 className="text-xl font-semibold mb-2 text-white">Not in Marietta? No problem!</h2>
                    <p className="text-gray-300">
                        You can find F3 workouts all across the country (and the world). Use the F3 Nation map to search for any region or AO.
                    </p>
                    <Button asChild className="mt-4">
                        <a
                            href="https://map.f3nation.com/"
                            target="_blank"
                            rel="noopener noreferrer"
                        >
                            Find F3 Near You
                        </a>
                    </Button>
                </div>
            </section>
        </div>
    );
}
