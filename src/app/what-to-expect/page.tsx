import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/brand/PageHeader";
import { CTABand } from "@/components/ui/brand/CTABand";
import { MeterBar } from "@/components/ui/brand/MeterBar";
import { MonoTag } from "@/components/ui/brand/MonoTag";
import { ScrollReveal } from "@/components/ui/brand/ScrollReveal";

export const metadata: Metadata = {
  title: "What to Expect",
  description: "The first whistle — minute-by-minute of an F3 Marietta workout.",
};

const TIMELINE = [
  { t: "0:00",  h: "Disclaimer + Mosey", body: "The Q delivers the F3 disclaimer — you are responsible for your own well-being. A short mosey warms the legs." },
  { t: "5:00",  h: "Warm-Up", body: "SSH, Imperial Walkers, Don Quixotes, and the like. Everyone paces themselves." },
  { t: "10:00", h: "The Thang", body: "Peer-led beatdown. Bodyweight, cardio, maybe a ruck. 25–30 minutes of work. Plenty of modifications." },
  { t: "40:00", h: "Mary", body: "Core work to cool down. Planks, LBCs, flutter kicks." },
  { t: "43:00", h: "COT", body: "Circle of Trust. Count-o-rama, name-o-rama, FNG introductions, announcements, and a prayer / reflection." },
  { t: "45:00", h: "Charge", body: "Back to the truck, back to your family, back to the day — improved." },
];

export default function WhatToExpectPage() {
  return (
    <>
      <PageHeader
        eyebrow="§ The Script"
        variant="ink"
        title={<>The First<br />Whistle.</>}
        kicker={<>A standard F3 workout runs 45 minutes. Here&apos;s the minute-by-minute.</>}
      />

      <section className="bg-bone py-20">
        <div className="max-w-[1320px] mx-auto px-7">
          <MeterBar
            left={<MonoTag>T · 0:00</MonoTag>}
            right={<MonoTag>T · 45:00</MonoTag>}
            tickCount={40}
            highlightIndices={[0, 5, 12, 30, 36, 39]}
            className="mb-14"
          />
          <ol className="border-y border-line-soft">
            {TIMELINE.map((step, i) => (
              <ScrollReveal
                key={step.t}
                delayMs={i * 60}
                as="li"
                className={`flex flex-col md:flex-row gap-6 md:gap-12 py-8 ${i < TIMELINE.length - 1 ? "border-b border-line-soft" : ""}`}
              >
                <div className="md:w-40 font-display font-bold uppercase text-steel leading-none text-[clamp(42px,5vw,56px)]">{step.t}</div>
                <div className="flex-1">
                  <h3 className="font-display font-bold uppercase text-[22px] tracking-[-.01em]">{step.h}</h3>
                  <p className="mt-2 text-[15px] leading-[1.6] text-muted max-w-xl">{step.body}</p>
                </div>
              </ScrollReveal>
            ))}
          </ol>
        </div>
      </section>

      <CTABand
        variant="gradient"
        title={<>Plan your<br />first post.</>}
        primary={{ label: "Find a Workout", href: "/workouts" }}
      />
    </>
  );
}
