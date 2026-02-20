"use client";

import { useState } from "react";
import { Section } from "@/components/ui/Section";
import { Hero } from "@/components/ui/Hero";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils";
import { ChevronDown, MapPin, Clock, ExternalLink } from "lucide-react";

// Types
interface Workout {
    name: string;
    type: string;
    time: string;
    location?: string;
    address: string;
    region?: string;
    mapLink?: string;
}

interface DaySchedule {
    marietta: Workout[];
    westCobb: Workout[];
    otherNearby: Workout[];
}

type WeekSchedule = Record<string, DaySchedule>;

// Schedule Data
const weekSchedule: WeekSchedule = {
    Monday: {
        marietta: [
            {
                name: "The Last Stand",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                location: "Custer Park",
                address: "600 Kenneth E Marcus Way, Marietta, GA",
                mapLink: "https://map.f3nation.com/?eventId=44023&locationId=44024",
            },
        ],
        westCobb: [
            {
                name: "The Forge",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                location: "Lost Mountain Park",
                address: "4843 Dallas Hwy, Powder Springs, GA 30127",
                mapLink: "https://map.f3nation.com/?eventId=34743&locationId=34744",
            },
            {
                name: "The Grove",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                location: "Hillgrove Highschool",
                address: "4165 Luther Ward Rd, Powder Springs, GA",
                mapLink: "https://map.f3nation.com/?eventId=32723&locationId=32724",
            },
            {
                name: "The Streak",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                location: "Logan Farm Park",
                address: "4405 Cherokee St, Acworth, GA",
                mapLink: "https://map.f3nation.com/",
            },
        ],
        otherNearby: [
            {
                name: "Madhouse",
                type: "Running",
                time: "5:45 AM – 6:15 AM",
                region: "Atlanta",
                location: "Taylor-Brawner Park",
                address: "3180 Atlanta Rd SE, Smyrna, GA",
                mapLink: "https://map.f3nation.com/?eventId=40243&locationId=40243",
            },
        ],
    },
    Tuesday: {
        marietta: [
            {
                name: "The Battlefield",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                location: "Marietta High School",
                address: "1171 Whitlock Ave NW, Marietta, GA",
                mapLink: "https://map.f3nation.com/?eventId=47961&locationId=47965",
            },
        ],
        westCobb: [
            {
                name: "Crazy 8's",
                type: "Running",
                time: "5:30 AM – 6:15 AM",
                location: "Lost Mountain Park",
                address: "4843 Dallas Hwy, Powder Springs, GA 30127",
                mapLink: "https://map.f3nation.com/?eventId=32865&locationId=34744",
            },
            {
                name: "The OG",
                type: "Bootcamp 0-0 (No running)",
                time: "5:30 AM – 6:15 AM",
                location: "Due West Methodist Church",
                address: "3956 Due West Rd, Marietta, GA",
                mapLink: "https://map.f3nation.com/?eventId=32866&locationId=32866",
            },
            {
                name: "The Chase",
                type: "Running",
                time: "5:30 AM – 6:15 AM",
                location: "Cobb Vineyard Church",
                address: "3206 Old 41 Hwy NW, Kennesaw, GA",
                mapLink: "https://map.f3nation.com/?eventId=44452&locationId=44452",
            },
        ],
        otherNearby: [
            {
                name: "The Flight Deck",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                region: "Cherokee",
                location: "Aviation Park",
                address: "2659 Barrett Lakes Blvd, Kennesaw, GA",
                mapLink: "https://map.f3nation.com/?eventId=32677&locationId=32677",
            },
            {
                name: "Warning Track",
                type: "Bootcamp",
                time: "5:45 AM – 6:30 AM",
                region: "Atlanta",
                location: "Tolleson Park",
                address: "3515 McCauley Rd, Smyrna, GA",
                mapLink: "https://map.f3nation.com/?eventId=32973&locationId=32975",
            },
        ],
    },
    Wednesday: {
        marietta: [
            {
                name: "The Last Stand",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                location: "Custer Park",
                address: "600 Kenneth E Marcus Way, Marietta, GA",
                mapLink: "https://map.f3nation.com/?eventId=44023&locationId=44024",
            },
        ],
        westCobb: [
            {
                name: "The Forge",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                location: "Lost Mountain Park",
                address: "4843 Dallas Hwy, Powder Springs, GA 30127",
                mapLink: "https://map.f3nation.com/?eventId=34743&locationId=34744",
            },
            {
                name: "The Grove",
                type: "Bootcamp",
                time: "5:30 AM – 6:30 AM",
                location: "Hillgrove Highschool",
                address: "4165 Luther Ward Rd, Powder Springs, GA",
                mapLink: "https://map.f3nation.com/?eventId=32723&locationId=32724",
            },
            {
                name: "The Streak",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                location: "Logan Farm Park",
                address: "4405 Cherokee St, Acworth, GA",
                mapLink: "https://map.f3nation.com/",
            },
        ],
        otherNearby: [
            {
                name: "Swiss Army Knife",
                type: "Bootcamp",
                time: "5:45 AM – 6:30 AM",
                region: "Atlanta",
                location: "Jonquil Park",
                address: "3000 Park Rd, Smyrna, GA 30080",
                mapLink: "https://map.f3nation.com/?eventId=41433&locationId=41433",
            },
        ],
    },
    Thursday: {
        marietta: [
            {
                name: "The Battlefield",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                location: "Marietta High School",
                address: "1171 Whitlock Ave NW, Marietta, GA",
                mapLink: "https://map.f3nation.com/?eventId=47961&locationId=47965",
            },
        ],
        westCobb: [
            {
                name: "Crazy 8's",
                type: "Running",
                time: "5:30 AM – 6:15 AM",
                location: "Lost Mountain Park",
                address: "4843 Dallas Hwy, Powder Springs, GA 30127",
                mapLink: "https://map.f3nation.com/?eventId=32865&locationId=34744",
            },
        ],
        otherNearby: [
            {
                name: "Galaxy",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                region: "West Atlanta",
                location: "East Cobb Park",
                address: "3322 Roswell Rd, Marietta, GA",
                mapLink: "https://map.f3nation.com/",
            },
            {
                name: "Warning Track",
                type: "Bootcamp",
                time: "5:45 AM – 6:30 AM",
                region: "Atlanta",
                location: "Tolleson Park",
                address: "3515 McCauley Rd, Smyrna, GA",
                mapLink: "https://map.f3nation.com/?eventId=32973&locationId=32975",
            },
        ],
    },
    Friday: {
        marietta: [],
        westCobb: [
            {
                name: "The Foundry",
                type: "Bootcamp",
                time: "5:15 AM – 6:15 AM",
                location: "Lost Mountain Park",
                address: "4843 Dallas Hwy, Powder Springs, GA 30127",
                mapLink: "https://map.f3nation.com/?eventId=34744&locationId=34744",
            },
        ],
        otherNearby: [
            {
                name: "The Flight Deck",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                region: "Cherokee",
                location: "Aviation Park",
                address: "2659 Barrett Lakes Blvd, Kennesaw, GA",
                mapLink: "https://map.f3nation.com/?eventId=32677&locationId=32677",
            },
            {
                name: "Galaxy",
                type: "Bootcamp",
                time: "5:30 AM – 6:15 AM",
                region: "West Atlanta",
                location: "East Cobb Park",
                address: "3322 Roswell Rd, Marietta, GA",
                mapLink: "https://map.f3nation.com/",
            },
        ],
    },
    Saturday: {
        marietta: [],
        westCobb: [
            {
                name: "The Outpost",
                type: "Bootcamp",
                time: "6:30 AM – 7:30 AM",
                location: "West Ridge Church",
                address: "3522 Hiram Acworth Hwy, Dallas, GA",
                mapLink: "https://map.f3nation.com/?eventId=45391&locationId=45391",
            },
        ],
        otherNearby: [
            {
                name: "Warning Track",
                type: "Bootcamp",
                time: "6:30 AM – 7:30 AM",
                region: "Atlanta",
                location: "Tolleson Park",
                address: "3515 McCauley Rd, Smyrna, GA",
                mapLink: "https://map.f3nation.com/?eventId=32973&locationId=32975",
            },
        ],
    },
    Sunday: {
        marietta: [],
        westCobb: [],
        otherNearby: [],
    },
};

const DAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const REGIONS = [
    { key: "marietta" as const, label: "Marietta" },
    { key: "westCobb" as const, label: "West Cobb" },
    { key: "otherNearby" as const, label: "Other Nearby" },
];

function getTodayIndex(): number {
    const day = new Date().getDay(); // 0=Sun … 6=Sat
    return day === 0 ? 6 : day - 1; // remap to 0=Mon … 6=Sun
}

function getWorkoutCount(schedule: DaySchedule): number {
    return schedule.marietta.length + schedule.westCobb.length + schedule.otherNearby.length;
}

// ── Workout Card ────────────────────────────────────────────────────────────
function WorkoutCard({ workout }: { workout: Workout }) {
    return (
        <div className="bg-card border border-border rounded-md p-3 space-y-2 hover:border-primary/50 transition-colors">
            <div className="space-y-1">
                <h4 className="font-bold text-sm text-foreground leading-tight">{workout.name}</h4>
                <div className="flex flex-wrap gap-1">
                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded">
                        {workout.type}
                    </span>
                    {workout.region && (
                        <span className="text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                            {workout.region}
                        </span>
                    )}
                </div>
            </div>
            <div className="space-y-1 text-xs text-muted-foreground">
                <div className="flex items-center gap-1.5">
                    <Clock className="h-3 w-3 shrink-0" />
                    <span>{workout.time}</span>
                </div>
                {workout.location && (
                    <div className="flex items-start gap-1.5">
                        <MapPin className="h-3 w-3 shrink-0 mt-0.5" />
                        <span className="leading-tight">{workout.location}</span>
                    </div>
                )}
                <div className="text-xs text-muted-foreground/70 pl-[1.125rem] leading-tight">
                    {workout.address}
                </div>
            </div>
            {workout.mapLink && (
                <a
                    href={workout.mapLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
                >
                    Directions <ExternalLink className="h-3 w-3" />
                </a>
            )}
        </div>
    );
}

// ── Region Section ──────────────────────────────────────────────────────────
function RegionSection({ label, workouts }: { label: string; workouts: Workout[] }) {
    if (workouts.length === 0) return null;
    return (
        <div className="mb-4 last:mb-0">
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 pb-1 border-b border-border/50">
                {label}
            </h4>
            <div className="space-y-2">
                {workouts.map((workout, idx) => (
                    <WorkoutCard key={`${workout.name}-${idx}`} workout={workout} />
                ))}
            </div>
        </div>
    );
}

// ── Day Card ────────────────────────────────────────────────────────────────
function DayCard({ day, schedule, defaultOpen }: { day: string; schedule: DaySchedule; defaultOpen: boolean }) {
    const [isOpen, setIsOpen] = useState(defaultOpen);
    const totalWorkouts = getWorkoutCount(schedule);

    if (totalWorkouts === 0) return null;

    return (
        <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/50 transition-colors"
            >
                <div className="flex items-center gap-3">
                    <span className="font-bold font-heading text-foreground">{day}</span>
                    <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                        {totalWorkouts} workout{totalWorkouts !== 1 ? "s" : ""}
                    </span>
                </div>
                <ChevronDown
                    className={cn(
                        "h-5 w-5 text-muted-foreground transition-transform duration-200",
                        isOpen && "rotate-180"
                    )}
                />
            </button>
            <div
                className={cn(
                    "overflow-hidden transition-all duration-300 ease-in-out",
                    isOpen ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
                )}
            >
                <div className="p-4 pt-0 border-t border-border">
                    {REGIONS.map((region) => (
                        <RegionSection
                            key={region.key}
                            label={region.label}
                            workouts={schedule[region.key]}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}

// ── Page ────────────────────────────────────────────────────────────────────
export default function WorkoutsPage() {
    const todayIndex = getTodayIndex();

    return (
        <div className="flex flex-col min-h-screen">
            <Hero
                title="WORKOUT SCHEDULE"
                subtitle="Find a workout near you. Just show up."
                ctaText="New to F3?"
                ctaLink="/new-here"
                backgroundImage="/images/workouts-bg.jpg"
            />

            <Section>
                <p className="text-muted-foreground text-center max-w-2xl mx-auto mb-8">
                    All workouts are free, open to all men, and held outdoors rain or shine.
                    Check the schedule below and join us in the gloom.
                </p>

                <div className="space-y-3 max-w-4xl mx-auto">
                    {DAYS.map((day, index) => (
                        <DayCard
                            key={day}
                            day={day}
                            schedule={weekSchedule[day]}
                            defaultOpen={index === todayIndex}
                        />
                    ))}
                </div>
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
